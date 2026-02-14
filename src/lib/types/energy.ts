// ============================================
// EMS Calculator - TypeScript Types
// ============================================

// Dati orari dal CSV
export interface HourlyData {
  timestamp: Date;
  power_kw: number;
}

// Metriche del carico
export interface LoadMetrics {
  pMax: number;           // Potenza massima (kW)
  pMin: number;           // Potenza minima (kW)
  pAvg: number;           // Potenza media (kW)
  totalConsumption: number; // Consumo totale annuale (kWh)
}

// Configurazione impianti
export interface SystemConfig {
  pvPower_kWp: number;        // Potenza FV installata
  bessCapacity_kWh: number;   // Capacita batteria
  bessPower_kW: number;       // Potenza batteria (C-rate)
  heatPumpPower_kW: number;   // Potenza pompa di calore
  ledSavings_percent: number; // Risparmio LED (%)
  latitude: number;           // Latitudine sito (default 42)
  equivalentHours: number;    // Ore equivalenti FV annuali
  city?: string;              // Città sito installazione
}

// Parametri finanziari
export interface FinancialParams {
  purchasePrice: number;      // Prezzo acquisto energia (euro/kWh)
  sellingPrice: number;       // Prezzo vendita/RID (euro/kWh)
  pvCost: number;             // Costo FV (euro/kWp)
  bessCost: number;           // Costo batteria (euro/kWh)
  heatPumpCost: number;       // Costo pompa di calore (euro/kW)
  ledCost: number;            // Costo relamping (euro)
  discountRate: number;       // Tasso di sconto (%)
  energyInflation: number;    // Inflazione energetica (%)
  pvDegradation: number;      // Degrado FV annuale (%)
  maintenanceCost: number;    // Costo manutenzione annuale (%)
}

// Bilancio energetico orario
export interface HourlyBalance {
  hour: number;
  load: number;               // Carico (kWh)
  pvProduction: number;       // Produzione FV (kWh)
  selfConsumption: number;    // Autoconsumo diretto (kWh)
  batteryCharge: number;      // Carica batteria (kWh)
  batteryDischarge: number;   // Scarica batteria (kWh)
  gridExport: number;         // Immissione in rete (kWh)
  gridImport: number;         // Prelievo da rete (kWh)
  batterySoC: number;         // State of Charge (kWh)
}

// Bilancio energetico annuale aggregato
export interface AnnualEnergyBalance {
  totalLoad: number;              // Consumo totale (kWh)
  totalPVProduction: number;      // Produzione FV totale (kWh)
  totalSelfConsumption: number;   // Autoconsumo totale (kWh)
  totalBatteryCharge: number;     // Energia caricata in batteria (kWh)
  totalBatteryDischarge: number;  // Energia scaricata da batteria (kWh)
  totalGridExport: number;        // Immissione totale in rete (kWh)
  totalGridImport: number;        // Prelievo totale da rete (kWh)
  selfConsumptionRate: number;    // Tasso autoconsumo (%)
  selfSufficiencyRate: number;    // Tasso autosufficienza (%)
}

// Cash flow annuale
export interface CashFlowYear {
  year: number;
  energySavings: number;      // Risparmio energia (euro)
  gridRevenue: number;        // Ricavi vendita rete (euro)
  maintenanceCost: number;    // Costo manutenzione (euro)
  netCashFlow: number;        // Cash flow netto (euro)
  cumulativeCashFlow: number; // Cash flow cumulativo (euro)
  pvProduction: number;       // Produzione FV dell'anno (kWh)
}

// Risultati finanziari
export interface FinancialResults {
  capex: number;              // Investimento iniziale (euro)
  annualSavings: number;      // Risparmio annuo primo anno (euro)
  npv: number;                // Net Present Value (euro)
  irr: number;                // Internal Rate of Return (%)
  paybackSimple: number;      // Payback semplice (anni)
  paybackDiscounted: number;  // Payback attualizzato (anni)
  roi: number;                // Return on Investment (%)
  lcoe: number;               // Levelized Cost of Energy (euro/kWh)
}

// Impatto ambientale
export interface EnvironmentalImpact {
  co2SavedAnnual: number;     // CO2 risparmiata annuale (ton)
  co2SavedLifetime: number;   // CO2 risparmiata lifetime (ton)
  treesEquivalent: number;    // Alberi equivalenti
  carsEquivalent: number;     // Auto tolte dalla strada
}

// Risultati completi della simulazione
export interface SimulationResults {
  energyBalance: AnnualEnergyBalance;
  hourlyBalance: HourlyBalance[];
  cashFlow: CashFlowYear[];
  financial: FinancialResults;
  environmental: EnvironmentalImpact;
}

// Scenario salvato per confronto
export interface SavedScenario {
  id: string;
  name: string;
  timestamp: number;
  config: SystemConfig;
  financial: FinancialParams;
  results: SimulationResults;
  loadMetrics: LoadMetrics;
}

// Step del wizard
export type WizardStep = 'data' | 'config' | 'financials' | 'results';

// Dati bolletta estratti (per UI)
export interface BillDataInfo {
  // Dati generali
  ragioneSociale?: string;         // Nome azienda/cliente
  podCode?: string;                // Codice POD
  supplier?: string;               // Fornitore

  // Potenze contrattuali
  potenzaImpegnata?: number;       // Potenza impegnata (kW)
  potenzaDisponibile?: number;     // Potenza disponibile (kW)
  contractPower?: number;          // Alias compatibilità

  // Consumi per fascia (kWh)
  f1: number;
  f2: number;
  f3: number;
  totalConsumption?: number;

  // Periodo e storico
  billingMonths: number;
  historicalMonths?: number;

  // Potenza massima storica
  maxPowerHistory?: MonthlyMaxPower[];  // Potenza max per mese

  // Dati economici
  prezzoMedio?: number;            // €/kWh medio
  costiUnitari?: {
    pun?: number;
    spread?: number;
    perditeRete?: number;
  };

  // Localizzazione
  city?: string;                   // Città fornitura
  province?: string;               // Provincia

  // Qualità dati
  dataQuality?: {
    confidence: number;            // 0-100%
    validated: boolean;
    errors?: string[];
  };
}

// Potenza massima mensile (per valutazione infrastruttura ricarica)
export interface MonthlyMaxPower {
  month: number;                   // 0-11
  year: number;
  maxPower: number;                // kW
}

// Informazioni file caricato
export interface UploadedFile {
  id: string;
  name: string;
  type: 'csv' | 'pdf';
  size: number;
  dataPoints: number;
  pMax: number;
  totalConsumption: number;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
  // Dati bolletta (solo per PDF)
  billData?: BillDataInfo;
}

// Riga della tabella consumi mensili (input manuale F1/F2/F3)
export interface MonthlyConsumptionRow {
  month: number;  // 0-11
  year: number;
  f1: number;     // kWh fascia F1
  f2: number;     // kWh fascia F2
  f3: number;     // kWh fascia F3
}

// Dati inseriti manualmente
export interface ManualInputData {
  annualConsumption_kWh: number | null;  // Consumo annuo in kWh
  averagePrice_euroKWh: number | null;    // Prezzo medio €/kWh
  monthlyData?: MonthlyConsumptionRow[];  // Tabella consumi mensili
}

// Stato dell'applicazione
export interface EnergyState {
  // Dati input
  loadProfile: number[];
  loadMetrics: LoadMetrics | null;
  hasData: boolean;
  uploadedFiles: UploadedFile[];
  manualInput: ManualInputData;

  // Configurazione
  config: SystemConfig;

  // Parametri finanziari
  financial: FinancialParams;

  // Step corrente
  currentStep: WizardStep;

  // Risultati
  results: SimulationResults | null;
  isCalculating: boolean;

  // Scenari salvati
  scenarios: SavedScenario[];

  // Azioni
  setLoadProfile: (data: number[]) => void;
  addFiles: (files: File[]) => Promise<void>;
  addPDFWithConfirmedData: (file: File, billData: BillDataInfo) => void;
  removeFile: (fileId: string) => void;
  setManualInput: (data: Partial<ManualInputData>) => void;
  applyManualInput: () => void;
  setMonthlyData: (data: MonthlyConsumptionRow[]) => void;
  applyMonthlyInput: () => void;
  setConfig: (config: Partial<SystemConfig>) => void;
  setFinancial: (params: Partial<FinancialParams>) => void;
  setCurrentStep: (step: WizardStep) => void;
  calculate: () => void;
  reset: () => void;
  loadDemoData: () => void;
  saveScenario: (name: string) => void;
  deleteScenario: (id: string) => void;
}

// Costanti
export const HOURS_PER_YEAR = 8760;
export const CO2_FACTOR = 0.4; // kg CO2 per kWh
export const TREES_CO2_ABSORPTION = 21; // kg CO2 per albero/anno
export const CAR_CO2_EMISSION = 4600; // kg CO2 per auto/anno
