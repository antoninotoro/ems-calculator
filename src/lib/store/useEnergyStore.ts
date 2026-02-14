// ============================================
// Zustand Store - State Management
// ============================================

import { create } from "zustand";
import {
  EnergyState,
  SystemConfig,
  FinancialParams,
  WizardStep,
  UploadedFile,
  BillDataInfo,
  ManualInputData,
  MonthlyConsumptionRow,
  HOURS_PER_YEAR,
} from "@/lib/types/energy";
import {
  calculateLoadMetrics,
  parseFile,
  combineProfiles,
} from "@/lib/calculations/CSVParser";
import { analyzePDF, generateProfileFromBillDataInfo } from "@/lib/calculations/PDFParser";
import { runSimulation } from "@/lib/calculations/EnergyCalculator";
import {
  generateDemoLoadProfile,
  defaultConfig,
  defaultFinancial,
} from "@/lib/data/demoData";
import { findCityData } from "@/lib/data/italianCities";

/**
 * Genera un profilo di carico sintetico basato sul consumo annuo
 * Pattern tipico C&I: più consumo giorni feriali 8-18, meno weekend
 */
function generateSyntheticLoadProfile(annualConsumption_kWh: number): number[] {
  const profile: number[] = new Array(HOURS_PER_YEAR).fill(0);
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Fattori stagionali
  const monthlyFactors = [0.85, 0.85, 0.9, 0.95, 1.0, 1.1, 1.15, 1.1, 1.0, 0.95, 0.9, 0.85];

  // Pattern orario normalizzato (somma = 1 per giorno tipo)
  const weekdayPattern = [
    0.02, 0.015, 0.015, 0.015, 0.02, 0.03, 0.05, 0.08, 0.1, 0.11, 0.12, 0.12,
    0.11, 0.12, 0.12, 0.1, 0.08, 0.05, 0.035, 0.025, 0.02, 0.018, 0.016, 0.015,
  ];

  const weekendPattern = [
    0.035, 0.03, 0.03, 0.03, 0.03, 0.032, 0.035, 0.04, 0.045, 0.048, 0.05, 0.05,
    0.048, 0.048, 0.045, 0.042, 0.04, 0.038, 0.038, 0.038, 0.038, 0.038, 0.036, 0.035,
  ];

  // Calcola pesi per normalizzazione
  let totalWeight = 0;
  let hourIndex = 0;
  let dayOfYear = 0;

  // Prima passata: calcola peso totale
  for (let month = 0; month < 12; month++) {
    const monthFactor = monthlyFactors[month];
    for (let day = 0; day < daysPerMonth[month]; day++) {
      const dayOfWeek = (dayOfYear + 1) % 7;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const pattern = isWeekend ? weekendPattern : weekdayPattern;

      for (let hour = 0; hour < 24; hour++) {
        totalWeight += pattern[hour] * monthFactor;
      }
      dayOfYear++;
    }
  }

  // Seconda passata: assegna valori normalizzati
  hourIndex = 0;
  dayOfYear = 0;

  for (let month = 0; month < 12; month++) {
    const monthFactor = monthlyFactors[month];
    for (let day = 0; day < daysPerMonth[month]; day++) {
      const dayOfWeek = (dayOfYear + 1) % 7;
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const pattern = isWeekend ? weekendPattern : weekdayPattern;

      for (let hour = 0; hour < 24; hour++) {
        const weight = pattern[hour] * monthFactor;
        const consumption = (annualConsumption_kWh * weight) / totalWeight;
        profile[hourIndex] = Math.round(consumption * 100) / 100;
        hourIndex++;
      }
      dayOfYear++;
    }
  }

  return profile;
}

export const useEnergyStore = create<EnergyState>((set, get) => ({
  // ===== Stato Iniziale =====

  // Dati input
  loadProfile: [],
  loadMetrics: null,
  hasData: false,
  uploadedFiles: [],
  manualInput: {
    annualConsumption_kWh: null,
    averagePrice_euroKWh: null,
  },

  // Configurazione impianti
  config: defaultConfig,

  // Parametri finanziari
  financial: defaultFinancial,

  // Step corrente
  currentStep: "data" as WizardStep,

  // Risultati
  results: null,
  isCalculating: false,

  // Scenari salvati
  scenarios: [],

  // ===== Azioni =====

  /**
   * Imposta il profilo di carico e calcola le metriche
   */
  setLoadProfile: (data: number[]) => {
    const metrics = calculateLoadMetrics(data);
    set({
      loadProfile: data,
      loadMetrics: metrics,
      hasData: data.length > 0,
      results: null,
    });

    if (data.length > 0) {
      get().calculate();
    }
  },

  /**
   * Aggiunge file multipli (CSV o PDF)
   */
  addFiles: async (files: File[]) => {
    const currentFiles = get().uploadedFiles;
    const newFiles: UploadedFile[] = [];
    const newProfiles: number[][] = [];

    // Crea le entry per i nuovi file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = `file-${Date.now()}-${i}`;
      const fileType = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "csv";

      const uploadedFile: UploadedFile = {
        id: fileId,
        name: file.name,
        type: fileType as "csv" | "pdf",
        size: file.size,
        dataPoints: 0,
        pMax: 0,
        totalConsumption: 0,
        status: "processing",
      };

      newFiles.push(uploadedFile);
    }

    // Aggiorna lo stato con i file in processing
    set({ uploadedFiles: [...currentFiles, ...newFiles] });

    // Processa ogni file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = newFiles[i].id;
      const isPDF = file.name.toLowerCase().endsWith(".pdf");

      try {
        const data = await parseFile(file);
        const metrics = calculateLoadMetrics(data);

        // Se e' un PDF, estrai anche i dati della bolletta
        let billDataInfo = undefined;
        if (isPDF) {
          try {
            const pdfInfo = await analyzePDF(file);
            if (pdfInfo.billData) {
              const bd = pdfInfo.billData;

              // Estrai potenza massima storica dai dati mensili
              const maxPowerHistory = bd.monthlyConsumption
                ?.filter(m => m.maxPower !== undefined)
                .map(m => ({
                  month: m.month,
                  year: m.year,
                  maxPower: m.maxPower!
                }));

              billDataInfo = {
                // Dati generali
                ragioneSociale: bd.ragioneSociale,
                podCode: bd.podCode,
                supplier: bd.supplier,

                // Potenze contrattuali
                potenzaImpegnata: bd.potenzaImpegnata,
                potenzaDisponibile: bd.potenzaDisponibile,
                contractPower: bd.contractPower,

                // Consumi per fascia
                f1: bd.f1,
                f2: bd.f2,
                f3: bd.f3,
                totalConsumption: bd.totalConsumption,

                // Periodo e storico
                billingMonths: bd.billingMonths,
                historicalMonths: bd.monthlyConsumption?.length || 0,

                // Potenza massima storica (per valutazione infrastruttura EV)
                maxPowerHistory: maxPowerHistory?.length ? maxPowerHistory : undefined,

                // Dati economici
                prezzoMedio: bd.prezzoMedio,
                costiUnitari: bd.costiUnitari ? {
                  pun: bd.costiUnitari.pun,
                  spread: bd.costiUnitari.spread,
                  perditeRete: bd.costiUnitari.perditeRete,
                } : undefined,

                // Qualità dati
                dataQuality: bd.dataQuality ? {
                  confidence: bd.dataQuality.confidence,
                  validated: bd.dataQuality.consumptionValidated,
                  errors: bd.dataQuality.validationErrors,
                } : undefined,
              };
            }
          } catch {
            // Ignora errori nell'estrazione dati bolletta
          }
        }

        // Aggiorna il file con i dati
        set((state) => ({
          uploadedFiles: state.uploadedFiles.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  dataPoints: data.length,
                  pMax: metrics.pMax,
                  totalConsumption: metrics.totalConsumption,
                  status: "success" as const,
                  billData: billDataInfo,
                }
              : f
          ),
        }));

        newProfiles.push(data);
      } catch (error) {
        // Segna il file come errore
        set((state) => ({
          uploadedFiles: state.uploadedFiles.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  status: "error" as const,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Errore sconosciuto",
                }
              : f
          ),
        }));
      }
    }

    // Combina tutti i profili (esistenti + nuovi)
    const existingProfile = get().loadProfile;
    const allProfiles =
      existingProfile.length > 0
        ? [existingProfile, ...newProfiles]
        : newProfiles;

    if (allProfiles.length > 0) {
      const combined = combineProfiles(allProfiles);
      const metrics = calculateLoadMetrics(combined);

      set({
        loadProfile: combined,
        loadMetrics: metrics,
        hasData: true,
        results: null,
      });

      get().calculate();
    }
  },

  /**
   * Aggiunge un PDF con dati bolletta confermati dall'utente (flusso LLM)
   */
  addPDFWithConfirmedData: (file: File, confirmedBillData: BillDataInfo) => {
    const profile = generateProfileFromBillDataInfo(confirmedBillData);
    const metrics = calculateLoadMetrics(profile);

    const uploadedFile: UploadedFile = {
      id: `file-${Date.now()}-0`,
      name: file.name,
      type: "pdf",
      size: file.size,
      dataPoints: profile.length,
      pMax: metrics.pMax,
      totalConsumption: confirmedBillData.totalConsumption || (confirmedBillData.f1 + confirmedBillData.f2 + confirmedBillData.f3),
      status: "success",
      billData: {
        ...confirmedBillData,
        dataQuality: {
          confidence: 90,
          validated: true,
          errors: [],
        },
      },
    };

    const currentFiles = get().uploadedFiles;
    const existingProfile = get().loadProfile;
    const allProfiles = existingProfile.length > 0 ? [existingProfile, profile] : [profile];
    const combined = combineProfiles(allProfiles);
    const combinedMetrics = calculateLoadMetrics(combined);

    // Auto-fill prezzo medio nei parametri finanziari (Feature 2)
    const financialUpdate = confirmedBillData.prezzoMedio && confirmedBillData.prezzoMedio > 0
      ? { financial: { ...get().financial, purchasePrice: confirmedBillData.prezzoMedio } }
      : {};

    // Location-based PV config (Feature 1)
    let configUpdate: Partial<Record<string, unknown>> = {};
    if (confirmedBillData.city) {
      const cityData = findCityData(confirmedBillData.city);
      if (cityData) {
        configUpdate = {
          config: {
            ...get().config,
            latitude: cityData.lat,
            equivalentHours: cityData.equivalentHours,
            city: confirmedBillData.city,
          },
        };
      }
    }

    set({
      uploadedFiles: [...currentFiles, uploadedFile],
      loadProfile: combined,
      loadMetrics: combinedMetrics,
      hasData: true,
      results: null,
      ...financialUpdate,
      ...configUpdate,
    });

    get().calculate();
  },

  /**
   * Rimuove un file caricato
   */
  removeFile: (fileId: string) => {
    const state = get();
    const remainingFiles = state.uploadedFiles.filter((f) => f.id !== fileId);

    set({ uploadedFiles: remainingFiles });

    // Se non ci sono piu file, reset
    if (remainingFiles.length === 0) {
      set({
        loadProfile: [],
        loadMetrics: null,
        hasData: false,
        results: null,
      });
    }
    // Nota: non ricalcoliamo automaticamente perche non abbiamo piu i dati raw
    // In una versione piu avanzata potremmo salvare i profili individuali
  },

  /**
   * Aggiorna i dati di input manuale
   */
  setManualInput: (data: Partial<ManualInputData>) => {
    set((state) => ({
      manualInput: { ...state.manualInput, ...data },
    }));
  },

  /**
   * Applica l'input manuale generando un profilo di carico sintetico
   * Genera un profilo orario distribuito uniformemente o con pattern tipico
   */
  applyManualInput: () => {
    const state = get();
    const { annualConsumption_kWh, averagePrice_euroKWh } = state.manualInput;

    if (!annualConsumption_kWh || annualConsumption_kWh <= 0) {
      return;
    }

    // Genera un profilo di carico sintetico basato sul consumo annuo
    // Usa un pattern tipico C&I (ufficio/industriale)
    const profile = generateSyntheticLoadProfile(annualConsumption_kWh);
    const metrics = calculateLoadMetrics(profile);

    // Crea un file fittizio per rappresentare l'input manuale
    const manualFile: UploadedFile = {
      id: "manual-input",
      name: "Input Manuale",
      type: "csv",
      size: 0,
      dataPoints: HOURS_PER_YEAR,
      pMax: metrics.pMax,
      totalConsumption: annualConsumption_kWh,
      status: "success",
    };

    // Aggiorna il prezzo medio se fornito
    const newFinancial = averagePrice_euroKWh
      ? { purchasePrice: averagePrice_euroKWh }
      : {};

    set({
      loadProfile: profile,
      loadMetrics: metrics,
      hasData: true,
      uploadedFiles: [manualFile],
      results: null,
      ...(averagePrice_euroKWh ? { financial: { ...state.financial, ...newFinancial } } : {}),
    });

    get().calculate();
  },

  /**
   * Aggiorna i dati mensili nella tabella F1/F2/F3
   */
  setMonthlyData: (data: MonthlyConsumptionRow[]) => {
    set((state) => ({
      manualInput: { ...state.manualInput, monthlyData: data },
    }));
  },

  /**
   * Applica i dati mensili F1/F2/F3 generando un profilo orario annuale
   */
  applyMonthlyInput: () => {
    const state = get();
    const { monthlyData, averagePrice_euroKWh } = state.manualInput;

    if (!monthlyData || monthlyData.length === 0) return;

    // Somma annuale F1/F2/F3
    const totalF1 = monthlyData.reduce((sum, r) => sum + (r.f1 || 0), 0);
    const totalF2 = monthlyData.reduce((sum, r) => sum + (r.f2 || 0), 0);
    const totalF3 = monthlyData.reduce((sum, r) => sum + (r.f3 || 0), 0);
    const totalConsumption = totalF1 + totalF2 + totalF3;

    if (totalConsumption <= 0) return;

    // Genera profilo orario riutilizzando la funzione esistente
    const profile = generateProfileFromBillDataInfo({
      f1: totalF1,
      f2: totalF2,
      f3: totalF3,
      totalConsumption,
      billingMonths: monthlyData.length,
    });

    const metrics = calculateLoadMetrics(profile);

    const manualFile: UploadedFile = {
      id: "monthly-input",
      name: "Tabella Consumi Mensili",
      type: "csv",
      size: 0,
      dataPoints: HOURS_PER_YEAR,
      pMax: metrics.pMax,
      totalConsumption,
      status: "success",
    };

    set({
      loadProfile: profile,
      loadMetrics: metrics,
      hasData: true,
      uploadedFiles: [manualFile],
      results: null,
      ...(averagePrice_euroKWh
        ? { financial: { ...state.financial, purchasePrice: averagePrice_euroKWh } }
        : {}),
    });

    get().calculate();
  },

  /**
   * Aggiorna la configurazione degli impianti
   */
  setConfig: (newConfig: Partial<SystemConfig>) => {
    set((state) => ({
      config: { ...state.config, ...newConfig },
      results: null,
    }));

    if (get().hasData) {
      get().calculate();
    }
  },

  /**
   * Aggiorna i parametri finanziari
   */
  setFinancial: (newParams: Partial<FinancialParams>) => {
    set((state) => ({
      financial: { ...state.financial, ...newParams },
      results: null,
    }));

    if (get().hasData) {
      get().calculate();
    }
  },

  /**
   * Cambia lo step corrente del wizard
   */
  setCurrentStep: (step: WizardStep) => {
    set({ currentStep: step });
  },

  /**
   * Esegue la simulazione completa
   */
  calculate: () => {
    const state = get();

    if (state.loadProfile.length === 0) {
      return;
    }

    set({ isCalculating: true });

    setTimeout(() => {
      try {
        const results = runSimulation(
          state.loadProfile,
          state.config,
          state.financial
        );
        set({ results, isCalculating: false });
      } catch (error) {
        console.error("Errore nel calcolo:", error);
        set({ isCalculating: false });
      }
    }, 0);
  },

  /**
   * Reset dello stato
   */
  reset: () => {
    set({
      loadProfile: [],
      loadMetrics: null,
      hasData: false,
      uploadedFiles: [],
      manualInput: {
        annualConsumption_kWh: null,
        averagePrice_euroKWh: null,
      },
      config: defaultConfig,
      financial: defaultFinancial,
      currentStep: "data",
      results: null,
      isCalculating: false,
      scenarios: [],
    });
  },

  /**
   * Carica i dati demo
   */
  loadDemoData: () => {
    const demoProfile = generateDemoLoadProfile();
    const metrics = calculateLoadMetrics(demoProfile);

    // Aggiungi un file fittizio per la lista con metriche reali
    const demoFile: UploadedFile = {
      id: "demo-data",
      name: "Dati Demo (Ufficio Tipo)",
      type: "csv",
      size: 0,
      dataPoints: demoProfile.length,
      pMax: metrics.pMax,
      totalConsumption: metrics.totalConsumption,
      status: "success",
    };

    set({
      uploadedFiles: [demoFile],
    });

    get().setLoadProfile(demoProfile);
  },

  /**
   * Salva lo scenario corrente per confronto
   */
  saveScenario: (name: string) => {
    const state = get();
    if (!state.results || !state.loadMetrics) return;

    const scenario = {
      id: Date.now().toString(),
      name,
      timestamp: Date.now(),
      config: { ...state.config },
      financial: { ...state.financial },
      results: state.results,
      loadMetrics: state.loadMetrics,
    };

    set({ scenarios: [...state.scenarios, scenario] });
  },

  /**
   * Elimina uno scenario salvato
   */
  deleteScenario: (id: string) => {
    set((state) => ({
      scenarios: state.scenarios.filter((s) => s.id !== id),
    }));
  },
}));

// ===== Selettori Derivati =====

/**
 * Hook per ottenere i KPI principali
 */
export function useKPIs() {
  const results = useEnergyStore((state) => state.results);
  const loadMetrics = useEnergyStore((state) => state.loadMetrics);

  if (!results || !loadMetrics) {
    return null;
  }

  return {
    consumoTotale: loadMetrics.totalConsumption / 1000,
    potenzaPicco: loadMetrics.pMax,
    produzioneFV: results.energyBalance.totalPVProduction / 1000,
    autoconsumo: results.energyBalance.selfConsumptionRate,
    autosufficienza: results.energyBalance.selfSufficiencyRate,
    capex: results.financial.capex,
    risparmioAnnuo: results.financial.annualSavings,
    payback: results.financial.paybackSimple,
    npv: results.financial.npv,
    irr: results.financial.irr,
    roi: results.financial.roi,
    co2Risparmiata: results.environmental.co2SavedAnnual,
    alberiEquivalenti: results.environmental.treesEquivalent,
  };
}

/**
 * Hook per validazione step
 */
export function useStepValidation() {
  const hasData = useEnergyStore((state) => state.hasData);
  const config = useEnergyStore((state) => state.config);

  return {
    canGoToConfig: hasData,
    canGoToFinancials: hasData && config.pvPower_kWp > 0,
    canGoToResults:
      hasData &&
      (config.pvPower_kWp > 0 ||
        config.bessCapacity_kWh > 0 ||
        config.heatPumpPower_kW > 0 ||
        config.ledSavings_percent > 0),
  };
}
