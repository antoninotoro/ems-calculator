// ============================================
// Energy Calculator - Core Engine Orchestrator
// ============================================

import {
  SystemConfig,
  FinancialParams,
  SimulationResults,
  EnvironmentalImpact,
  CO2_FACTOR,
  TREES_CO2_ABSORPTION,
  CAR_CO2_EMISSION,
} from "@/lib/types/energy";
import { calculateLoadMetrics } from "./CSVParser";
import { generatePVProfile, applyPVDegradation } from "./PVModel";
import { simulateEnergyBalance, calculateAnnualBalance } from "./BESSModel";
import { calculateFinancialResults } from "./FinancialCalculator";

/**
 * Applica modifiche al carico (LED, pompe di calore, etc.)
 */
export function applyLoadModifications(
  baseLoad: number[],
  config: SystemConfig
): number[] {
  // Risparmio LED: riduce il carico uniformemente
  const ledFactor = 1 - config.ledSavings_percent / 100;

  // Incremento pompa di calore (approssimazione)
  // Assume che la PdC sostituisca gas/gasolio, quindi aggiunge carico elettrico
  // In inverno (mesi 1,2,11,12) e stagione intermedia (3,4,9,10)
  const hpLoad = calculateHeatPumpLoad(baseLoad.length, config.heatPumpPower_kW);

  return baseLoad.map((load, i) => {
    const modifiedLoad = load * ledFactor + hpLoad[i];
    return Math.max(0, modifiedLoad);
  });
}

/**
 * Calcola il profilo di carico della pompa di calore
 */
function calculateHeatPumpLoad(hours: number, power_kW: number): number[] {
  if (power_kW <= 0) {
    return new Array(hours).fill(0);
  }

  const hpLoad: number[] = new Array(hours).fill(0);
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Fattori di utilizzo mensili (riscaldamento invernale)
  const monthlyFactors = [
    0.8, // Gennaio
    0.7, // Febbraio
    0.4, // Marzo
    0.2, // Aprile
    0.0, // Maggio
    0.0, // Giugno
    0.0, // Luglio
    0.0, // Agosto
    0.0, // Settembre
    0.2, // Ottobre
    0.5, // Novembre
    0.7, // Dicembre
  ];

  // Pattern giornaliero (picco mattina/sera)
  const hourlyPattern = [
    0.3, 0.2, 0.2, 0.2, 0.3, 0.5, 0.8, 1.0, 0.9, 0.7, 0.5, 0.4,
    0.3, 0.3, 0.3, 0.4, 0.5, 0.7, 0.9, 1.0, 0.8, 0.6, 0.4, 0.3,
  ];

  let hourIndex = 0;
  for (let month = 0; month < 12; month++) {
    for (let day = 0; day < daysPerMonth[month]; day++) {
      for (let hour = 0; hour < 24; hour++) {
        hpLoad[hourIndex] =
          power_kW * monthlyFactors[month] * hourlyPattern[hour];
        hourIndex++;
      }
    }
  }

  return hpLoad;
}

/**
 * Calcola l'impatto ambientale
 */
export function calculateEnvironmentalImpact(
  gridReduction: number, // kWh/anno risparmiati dalla rete
  years: number = 20,
  pvDegradation: number = 0.005
): EnvironmentalImpact {
  // CO2 risparmiata anno 1
  const co2SavedAnnual = (gridReduction * CO2_FACTOR) / 1000; // ton

  // CO2 lifetime con degrado
  let co2SavedLifetime = 0;
  for (let year = 1; year <= years; year++) {
    const degradationFactor = Math.pow(1 - pvDegradation, year - 1);
    co2SavedLifetime += co2SavedAnnual * degradationFactor;
  }

  // Equivalenze
  const treesEquivalent = Math.round(
    (co2SavedAnnual * 1000) / TREES_CO2_ABSORPTION
  );
  const carsEquivalent = (co2SavedAnnual * 1000) / CAR_CO2_EMISSION;

  return {
    co2SavedAnnual,
    co2SavedLifetime,
    treesEquivalent,
    carsEquivalent,
  };
}

/**
 * Esegue la simulazione completa
 */
export function runSimulation(
  loadProfile: number[],
  config: SystemConfig,
  financial: FinancialParams
): SimulationResults {
  // 1. Modifica il carico base
  const modifiedLoad = applyLoadModifications(loadProfile, config);

  // 2. Genera profilo FV (usa latitude e ore equivalenti dal config)
  const pvProfile = generatePVProfile(config.pvPower_kWp, config.equivalentHours, config.latitude);

  // 3. Simula bilancio energetico con BESS
  const hourlyBalance = simulateEnergyBalance(modifiedLoad, pvProfile, {
    capacity_kWh: config.bessCapacity_kWh,
    power_kW: config.bessPower_kW,
  });

  // 4. Calcola bilancio annuale
  const energyBalance = calculateAnnualBalance(hourlyBalance);

  // 5. Calcola risultati finanziari
  const { cashFlow, results: financialResults } = calculateFinancialResults(
    config,
    energyBalance,
    financial
  );

  // 6. Calcola impatto ambientale
  const gridReduction =
    energyBalance.totalSelfConsumption + energyBalance.totalBatteryDischarge;

  const environmental = calculateEnvironmentalImpact(
    gridReduction,
    20,
    financial.pvDegradation
  );

  return {
    energyBalance,
    hourlyBalance,
    cashFlow,
    financial: financialResults,
    environmental,
  };
}

/**
 * Ricalcola metriche principali (per aggiornamenti real-time)
 */
export function quickCalculate(
  loadProfile: number[],
  config: SystemConfig,
  financial: FinancialParams
): {
  selfConsumptionRate: number;
  selfSufficiencyRate: number;
  annualSavings: number;
  payback: number;
  npv: number;
  irr: number;
  co2Saved: number;
} {
  const results = runSimulation(loadProfile, config, financial);

  return {
    selfConsumptionRate: results.energyBalance.selfConsumptionRate,
    selfSufficiencyRate: results.energyBalance.selfSufficiencyRate,
    annualSavings: results.financial.annualSavings,
    payback: results.financial.paybackSimple,
    npv: results.financial.npv,
    irr: results.financial.irr,
    co2Saved: results.environmental.co2SavedAnnual,
  };
}
