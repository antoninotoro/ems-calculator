// ============================================
// Demo Data - Profilo di carico tipico C&I
// ============================================

import { HOURS_PER_YEAR } from "@/lib/types/energy";

/**
 * PRNG deterministico (mulberry32) per risultati ripetibili
 */
function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Genera un profilo di carico annuale tipico per un edificio commerciale/industriale
 *
 * Caratteristiche:
 * - Picco ~150 kW
 * - Consumo annuale ~400 MWh
 * - Pattern: piu consumo giorni feriali, meno weekend
 * - Orari ufficio: 8:00-18:00
 * - Stagionalita: piu consumo estate (condizionamento)
 */
export function generateDemoLoadProfile(): number[] {
  const profile: number[] = new Array(HOURS_PER_YEAR).fill(0);

  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Fattori stagionali (climatizzazione estiva)
  const monthlyFactors = [
    0.7, // Gennaio
    0.7, // Febbraio
    0.75, // Marzo
    0.8, // Aprile
    0.9, // Maggio
    1.1, // Giugno
    1.2, // Luglio
    1.2, // Agosto
    1.0, // Settembre
    0.85, // Ottobre
    0.75, // Novembre
    0.7, // Dicembre
  ];

  // Pattern orario giorno feriale (0-23)
  const weekdayPattern = [
    15, 12, 10, 10, 12, 15, 25, 50, 90, 110, 120, 125, 115, 120, 125, 110, 90,
    70, 45, 30, 25, 20, 18, 16,
  ];

  // Pattern orario weekend
  const weekendPattern = [
    12, 10, 10, 10, 10, 10, 12, 15, 20, 22, 25, 25, 22, 22, 22, 20, 18, 16, 14,
    13, 12, 12, 12, 12,
  ];

  // Carico base continuo (kW) - server, refrigerazione, etc.
  const baseLoad = 10;

  let hourIndex = 0;
  let dayOfYear = 0;
  const rng = seededRandom(12345);

  for (let month = 0; month < 12; month++) {
    const monthFactor = monthlyFactors[month];

    for (let day = 0; day < daysPerMonth[month]; day++) {
      // Determina se e weekend (0=domenica, 6=sabato)
      // Partendo da lunedi 1 gennaio
      const dayOfWeek = (dayOfYear + 1) % 7; // +1 per iniziare da lunedi
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const pattern = isWeekend ? weekendPattern : weekdayPattern;

      for (let hour = 0; hour < 24; hour++) {
        // Carico orario con fattore stagionale
        let load = pattern[hour] * monthFactor;

        // Aggiungi variabilita casuale deterministica (±10%)
        const randomFactor = 0.9 + rng() * 0.2;
        load *= randomFactor;

        // Aggiungi carico base
        load += baseLoad;

        profile[hourIndex] = Math.round(load * 10) / 10;
        hourIndex++;
      }

      dayOfYear++;
    }
  }

  return profile;
}

/**
 * Dati di esempio per i grafici
 */
export const sampleChartData = {
  // Dati per grafico mensile
  monthlyData: [
    { month: "Gen", consumo: 28500, produzione: 4200 },
    { month: "Feb", consumo: 26800, produzione: 5800 },
    { month: "Mar", consumo: 29200, produzione: 9500 },
    { month: "Apr", consumo: 27500, produzione: 12000 },
    { month: "Mag", consumo: 31000, produzione: 14500 },
    { month: "Giu", consumo: 38500, produzione: 16200 },
    { month: "Lug", consumo: 42000, produzione: 17000 },
    { month: "Ago", consumo: 40500, produzione: 15800 },
    { month: "Set", consumo: 35200, produzione: 12500 },
    { month: "Ott", consumo: 30800, produzione: 8800 },
    { month: "Nov", consumo: 28200, produzione: 5200 },
    { month: "Dic", consumo: 27800, produzione: 3800 },
  ],

  // Dati per grafico giornaliero tipico
  dailyData: Array.from({ length: 24 }, (_, hour) => ({
    ora: `${hour.toString().padStart(2, "0")}:00`,
    carico: [
      15, 12, 10, 10, 12, 15, 25, 50, 90, 110, 120, 125, 115, 120, 125, 110, 90,
      70, 45, 30, 25, 20, 18, 16,
    ][hour],
    produzione: [
      0, 0, 0, 0, 0, 0, 2, 15, 35, 55, 70, 80, 85, 82, 75, 60, 40, 20, 5, 0, 0,
      0, 0, 0,
    ][hour],
    autoconsumo: [
      0, 0, 0, 0, 0, 0, 2, 15, 35, 55, 70, 80, 85, 82, 75, 60, 40, 20, 5, 0, 0,
      0, 0, 0,
    ][hour],
  })),
};

/**
 * Configurazione di default
 */
export const defaultConfig = {
  pvPower_kWp: 100,
  bessCapacity_kWh: 50,
  bessPower_kW: 25,
  heatPumpPower_kW: 0,
  ledSavings_percent: 0,
  latitude: 42,
  equivalentHours: 1200,
};

/**
 * Parametri finanziari di default
 */
export const defaultFinancial = {
  purchasePrice: 0.25, // €/kWh
  sellingPrice: 0.1, // €/kWh
  pvCost: 1000, // €/kWp
  bessCost: 400, // €/kWh
  heatPumpCost: 500, // €/kW
  ledCost: 5000, // € fisso
  discountRate: 0.05, // 5%
  energyInflation: 0.03, // 3%
  pvDegradation: 0.005, // 0.5%
  maintenanceCost: 0.01, // 1% del CAPEX
};
