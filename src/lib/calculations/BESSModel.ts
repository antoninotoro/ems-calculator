// ============================================
// BESS Model - Battery Energy Storage System
// ============================================

import { HourlyBalance, AnnualEnergyBalance, HOURS_PER_YEAR } from "@/lib/types/energy";

export interface BESSConfig {
  capacity_kWh: number;     // Capacita totale (kWh)
  power_kW: number;         // Potenza max carica/scarica (kW)
  efficiency: number;       // Efficienza round-trip (default 0.9)
  minSoC: number;           // SoC minimo (default 0.1 = 10%)
  maxSoC: number;           // SoC massimo (default 0.9 = 90%)
  initialSoC: number;       // SoC iniziale (default 0.5 = 50%)
}

const DEFAULT_BESS_CONFIG: Partial<BESSConfig> = {
  efficiency: 0.90,
  minSoC: 0.10,
  maxSoC: 0.90,
  initialSoC: 0.50,
};

/**
 * Simula il bilancio energetico orario con FV e batteria
 *
 * Priorita operativa:
 * 1. Autoconsumo diretto (PV -> Load)
 * 2. Carica batteria (PV surplus -> BESS)
 * 3. Immissione in rete (PV surplus -> Grid)
 * 4. Scarica batteria (BESS -> Load deficit)
 * 5. Prelievo da rete (Grid -> Load deficit)
 */
export function simulateEnergyBalance(
  loadProfile: number[],
  pvProfile: number[],
  bessConfig: Partial<BESSConfig>
): HourlyBalance[] {
  const config: BESSConfig = {
    capacity_kWh: bessConfig.capacity_kWh || 0,
    power_kW: bessConfig.power_kW || (bessConfig.capacity_kWh || 0) / 2, // C-rate 0.5 default
    efficiency: bessConfig.efficiency ?? DEFAULT_BESS_CONFIG.efficiency!,
    minSoC: bessConfig.minSoC ?? DEFAULT_BESS_CONFIG.minSoC!,
    maxSoC: bessConfig.maxSoC ?? DEFAULT_BESS_CONFIG.maxSoC!,
    initialSoC: bessConfig.initialSoC ?? DEFAULT_BESS_CONFIG.initialSoC!,
  };

  const hourlyBalance: HourlyBalance[] = [];
  let currentSoC = config.capacity_kWh * config.initialSoC; // kWh

  const minEnergy = config.capacity_kWh * config.minSoC;
  const maxEnergy = config.capacity_kWh * config.maxSoC;
  const sqrtEfficiency = Math.sqrt(config.efficiency);

  for (let hour = 0; hour < HOURS_PER_YEAR; hour++) {
    const load = loadProfile[hour] || 0;
    const pvProduction = pvProfile[hour] || 0;

    let selfConsumption = 0;
    let batteryCharge = 0;
    let batteryDischarge = 0;
    let gridExport = 0;
    let gridImport = 0;

    // Calcola il bilancio netto
    const netBalance = pvProduction - load;

    if (netBalance >= 0) {
      // Surplus di produzione FV
      selfConsumption = load; // Tutto il carico e coperto dal FV

      let surplus = netBalance;

      // Prova a caricare la batteria con il surplus
      if (config.capacity_kWh > 0) {
        const maxChargeEnergy = Math.min(
          config.power_kW, // Limite potenza
          (maxEnergy - currentSoC) / sqrtEfficiency // Spazio disponibile
        );
        batteryCharge = Math.min(surplus, maxChargeEnergy);
        surplus -= batteryCharge;
        currentSoC += batteryCharge * sqrtEfficiency;
      }

      // Il resto va in rete
      gridExport = surplus;
    } else {
      // Deficit - il carico supera la produzione FV
      selfConsumption = pvProduction; // Tutto il FV e autoconsumato

      let deficit = Math.abs(netBalance);

      // Prova a scaricare la batteria per coprire il deficit
      if (config.capacity_kWh > 0) {
        const maxDischargeEnergy = Math.min(
          config.power_kW, // Limite potenza
          (currentSoC - minEnergy) * sqrtEfficiency // Energia disponibile
        );
        batteryDischarge = Math.min(deficit, maxDischargeEnergy);
        deficit -= batteryDischarge;
        currentSoC -= batteryDischarge / sqrtEfficiency;
      }

      // Il resto viene prelevato dalla rete
      gridImport = deficit;
    }

    hourlyBalance.push({
      hour,
      load,
      pvProduction,
      selfConsumption,
      batteryCharge,
      batteryDischarge,
      gridExport,
      gridImport,
      batterySoC: currentSoC,
    });
  }

  return hourlyBalance;
}

/**
 * Calcola il bilancio energetico annuale aggregato
 */
export function calculateAnnualBalance(
  hourlyBalance: HourlyBalance[]
): AnnualEnergyBalance {
  const totals = hourlyBalance.reduce(
    (acc, h) => ({
      totalLoad: acc.totalLoad + h.load,
      totalPVProduction: acc.totalPVProduction + h.pvProduction,
      totalSelfConsumption: acc.totalSelfConsumption + h.selfConsumption,
      totalBatteryCharge: acc.totalBatteryCharge + h.batteryCharge,
      totalBatteryDischarge: acc.totalBatteryDischarge + h.batteryDischarge,
      totalGridExport: acc.totalGridExport + h.gridExport,
      totalGridImport: acc.totalGridImport + h.gridImport,
    }),
    {
      totalLoad: 0,
      totalPVProduction: 0,
      totalSelfConsumption: 0,
      totalBatteryCharge: 0,
      totalBatteryDischarge: 0,
      totalGridExport: 0,
      totalGridImport: 0,
    }
  );

  // Autoconsumo totale = autoconsumo diretto + scarica batteria
  const totalSelfConsumed = totals.totalSelfConsumption + totals.totalBatteryDischarge;

  // Tasso di autoconsumo = energia autoconsumata / produzione totale
  const selfConsumptionRate =
    totals.totalPVProduction > 0
      ? (totalSelfConsumed / totals.totalPVProduction) * 100
      : 0;

  // Tasso di autosufficienza = energia autoconsumata / carico totale
  const selfSufficiencyRate =
    totals.totalLoad > 0
      ? (totalSelfConsumed / totals.totalLoad) * 100
      : 0;

  return {
    ...totals,
    selfConsumptionRate,
    selfSufficiencyRate,
  };
}

/**
 * Genera dati per grafico giornaliero tipico
 */
export function getDailyBalancePattern(
  hourlyBalance: HourlyBalance[]
): { hour: number; load: number; pv: number; selfConsumption: number; grid: number }[] {
  const hoursPerDay = 24;
  const days = Math.floor(hourlyBalance.length / hoursPerDay);

  const dailyPattern = [];

  for (let h = 0; h < hoursPerDay; h++) {
    let loadSum = 0;
    let pvSum = 0;
    let scSum = 0;
    let gridSum = 0;

    for (let d = 0; d < days; d++) {
      const idx = d * hoursPerDay + h;
      if (idx < hourlyBalance.length) {
        const balance = hourlyBalance[idx];
        loadSum += balance.load;
        pvSum += balance.pvProduction;
        scSum += balance.selfConsumption + balance.batteryDischarge;
        gridSum += balance.gridImport - balance.gridExport;
      }
    }

    dailyPattern.push({
      hour: h,
      load: loadSum / days,
      pv: pvSum / days,
      selfConsumption: scSum / days,
      grid: gridSum / days,
    });
  }

  return dailyPattern;
}

/**
 * Calcola statistiche batteria
 */
export function calculateBatteryStats(
  hourlyBalance: HourlyBalance[],
  capacity_kWh: number
): {
  cyclesPerYear: number;
  avgSoC: number;
  minSoC: number;
  maxSoC: number;
} {
  if (capacity_kWh <= 0) {
    return { cyclesPerYear: 0, avgSoC: 0, minSoC: 0, maxSoC: 0 };
  }

  const totalCharged = hourlyBalance.reduce((sum, h) => sum + h.batteryCharge, 0);
  const cyclesPerYear = totalCharged / capacity_kWh;

  const socs = hourlyBalance.map((h) => h.batterySoC / capacity_kWh);
  const avgSoC = socs.reduce((sum, s) => sum + s, 0) / socs.length;
  const minSoC = Math.min(...socs);
  const maxSoC = Math.max(...socs);

  return {
    cyclesPerYear,
    avgSoC: avgSoC * 100,
    minSoC: minSoC * 100,
    maxSoC: maxSoC * 100,
  };
}
