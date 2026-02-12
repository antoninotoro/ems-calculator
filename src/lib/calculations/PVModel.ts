// ============================================
// PV Model - Modello Fotovoltaico
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
 * Interpola linearmente tra due valori in base a un fattore 0-1
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Fattori stagionali mensili per 3 fasce latitudinali italiane.
 * Interpolati linearmente in base alla latitudine reale.
 */
function getMonthlyFactors(latitude: number): number[] {
  // Nord Italia (lat >= 45): inverni piu bui, estati meno intense
  const nord = [0.35, 0.50, 0.80, 1.00, 1.20, 1.30, 1.35, 1.25, 0.95, 0.65, 0.40, 0.30];
  // Centro Italia (lat ~42): baseline originale
  const centro = [0.50, 0.65, 0.85, 1.00, 1.15, 1.25, 1.30, 1.20, 1.00, 0.75, 0.55, 0.45];
  // Sud Italia (lat <= 38): inverni piu luminosi, radiazione piu uniforme
  const sud = [0.65, 0.75, 0.90, 1.00, 1.10, 1.20, 1.25, 1.20, 1.05, 0.85, 0.70, 0.60];

  // Interpolazione: Nord (>=46) → Centro (42) → Sud (<=38)
  if (latitude >= 46) return nord;
  if (latitude <= 38) return sud;

  if (latitude >= 42) {
    // Interpola Nord-Centro (46 → 42)
    const t = (latitude - 42) / (46 - 42);
    return centro.map((c, i) => lerp(c, nord[i], t));
  } else {
    // Interpola Centro-Sud (42 → 38)
    const t = (42 - latitude) / (42 - 38);
    return centro.map((c, i) => lerp(c, sud[i], t));
  }
}

/**
 * Calcola ore di alba approssimative per mese in base alla latitudine.
 * Formula semplificata basata su declinazione solare.
 */
function getSunriseHours(latitude: number): number[] {
  const latRad = (latitude * Math.PI) / 180;
  // Declinazione solare media per ogni mese (gradi)
  const declinations = [-20.9, -13.0, -2.4, 9.4, 18.8, 23.1, 21.2, 13.5, 2.2, -9.6, -18.9, -23.0];

  return declinations.map((decl) => {
    const declRad = (decl * Math.PI) / 180;
    const cosHourAngle = -Math.tan(latRad) * Math.tan(declRad);
    const clamped = Math.max(-1, Math.min(1, cosHourAngle));
    const hourAngle = Math.acos(clamped);
    const daylightHours = (2 * hourAngle * 180) / (Math.PI * 15);
    return 12 - daylightHours / 2;
  });
}

/**
 * Calcola ore di tramonto approssimative per mese in base alla latitudine.
 */
function getSunsetHours(latitude: number): number[] {
  const latRad = (latitude * Math.PI) / 180;
  const declinations = [-20.9, -13.0, -2.4, 9.4, 18.8, 23.1, 21.2, 13.5, 2.2, -9.6, -18.9, -23.0];

  return declinations.map((decl) => {
    const declRad = (decl * Math.PI) / 180;
    const cosHourAngle = -Math.tan(latRad) * Math.tan(declRad);
    const clamped = Math.max(-1, Math.min(1, cosHourAngle));
    const hourAngle = Math.acos(clamped);
    const daylightHours = (2 * hourAngle * 180) / (Math.PI * 15);
    return 12 + daylightHours / 2;
  });
}

/**
 * Genera il profilo di produzione FV annuale
 * Basato su distribuzione sinusoidale stagionale
 *
 * @param peakPower_kWp - Potenza di picco installata (kWp)
 * @param equivalentHours - Ore equivalenti annuali (default 1200)
 * @param latitude - Latitudine per fattore stagionale (default 42 - Italia centrale)
 * @returns Array di 8760 valori orari di produzione (kWh)
 */
export function generatePVProfile(
  peakPower_kWp: number,
  equivalentHours: number = 1200,
  latitude: number = 42
): number[] {
  if (peakPower_kWp <= 0) {
    return new Array(HOURS_PER_YEAR).fill(0);
  }

  const profile: number[] = new Array(HOURS_PER_YEAR).fill(0);

  // Calcola la produzione annuale totale target
  const annualProduction = peakPower_kWp * equivalentHours;

  // Fattori stagionali mensili interpolati in base alla latitudine
  const monthlyFactors = getMonthlyFactors(latitude);

  // Ore di luce per mese calcolate in base alla latitudine
  const sunriseHours = getSunriseHours(latitude);
  const sunsetHours = getSunsetHours(latitude);

  // Giorni per mese
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  let hourIndex = 0;
  let totalGenerated = 0;
  const rng = seededRandom(42);

  // Genera profilo orario per ogni mese
  for (let month = 0; month < 12; month++) {
    const days = daysPerMonth[month];
    const sunrise = sunriseHours[month];
    const sunset = sunsetHours[month];
    const dayLength = sunset - sunrise;
    const monthFactor = monthlyFactors[month];

    for (let day = 0; day < days; day++) {
      for (let hour = 0; hour < 24; hour++) {
        let production = 0;

        // Calcola produzione solo durante le ore di luce
        if (hour >= sunrise && hour < sunset) {
          // Posizione relativa nel giorno (0 = alba, 1 = tramonto)
          const dayPosition = (hour - sunrise) / dayLength;

          // Distribuzione sinusoidale della produzione
          // Massimo a mezzogiorno solare
          const hourlyFactor = Math.sin(dayPosition * Math.PI);

          // Produzione oraria (kW -> kWh assumendo 1 ora)
          production = peakPower_kWp * monthFactor * hourlyFactor;

          // Aggiungi variabilita casuale leggera (±5%)
          const randomFactor = 0.95 + rng() * 0.1;
          production *= randomFactor;
        }

        profile[hourIndex] = Math.max(0, production);
        totalGenerated += profile[hourIndex];
        hourIndex++;
      }
    }
  }

  // Normalizza per raggiungere la produzione annuale target
  if (totalGenerated > 0) {
    const normalizationFactor = annualProduction / totalGenerated;
    for (let i = 0; i < HOURS_PER_YEAR; i++) {
      profile[i] *= normalizationFactor;
    }
  }

  return profile;
}

/**
 * Applica il degrado annuale alla produzione FV
 *
 * @param baseProfile - Profilo base anno 1
 * @param year - Anno (1-indexed)
 * @param degradationRate - Tasso di degrado annuale (default 0.5%)
 * @returns Profilo degradato
 */
export function applyPVDegradation(
  baseProfile: number[],
  year: number,
  degradationRate: number = 0.005
): number[] {
  const degradationFactor = Math.pow(1 - degradationRate, year - 1);
  return baseProfile.map((p) => p * degradationFactor);
}

/**
 * Calcola la produzione annuale totale
 */
export function calculateAnnualProduction(pvProfile: number[]): number {
  return pvProfile.reduce((sum, p) => sum + p, 0);
}

/**
 * Calcola la produzione mensile
 */
export function calculateMonthlyProduction(pvProfile: number[]): number[] {
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const monthlyProduction: number[] = [];

  let hourIndex = 0;
  for (let month = 0; month < 12; month++) {
    const hoursInMonth = daysPerMonth[month] * 24;
    let monthTotal = 0;

    for (let h = 0; h < hoursInMonth; h++) {
      if (hourIndex < pvProfile.length) {
        monthTotal += pvProfile[hourIndex];
        hourIndex++;
      }
    }

    monthlyProduction.push(monthTotal);
  }

  return monthlyProduction;
}

/**
 * Genera un profilo giornaliero tipico estivo
 */
export function getTypicalSummerDay(peakPower_kWp: number): number[] {
  const dailyProfile: number[] = new Array(24).fill(0);
  const sunrise = 5.5;
  const sunset = 21;
  const dayLength = sunset - sunrise;

  for (let hour = 0; hour < 24; hour++) {
    if (hour >= sunrise && hour < sunset) {
      const dayPosition = (hour - sunrise) / dayLength;
      dailyProfile[hour] = peakPower_kWp * 1.2 * Math.sin(dayPosition * Math.PI);
    }
  }

  return dailyProfile;
}

/**
 * Genera un profilo giornaliero tipico invernale
 */
export function getTypicalWinterDay(peakPower_kWp: number): number[] {
  const dailyProfile: number[] = new Array(24).fill(0);
  const sunrise = 7.5;
  const sunset = 17;
  const dayLength = sunset - sunrise;

  for (let hour = 0; hour < 24; hour++) {
    if (hour >= sunrise && hour < sunset) {
      const dayPosition = (hour - sunrise) / dayLength;
      dailyProfile[hour] = peakPower_kWp * 0.5 * Math.sin(dayPosition * Math.PI);
    }
  }

  return dailyProfile;
}
