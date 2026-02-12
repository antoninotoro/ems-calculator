// ============================================
// Sensitivity Analysis
// ============================================

import { SystemConfig, FinancialParams } from "@/lib/types/energy";
import { runSimulation } from "./EnergyCalculator";

export interface SensitivityVariation {
  delta: number;   // -20, -10, 0, +10, +20
  npv: number;
  payback: number;
  irr: number;
}

export interface SensitivityResult {
  parameter: string;
  label: string;
  unit: string;
  baseValue: number;
  variations: SensitivityVariation[];
}

const DELTAS = [-20, -10, 0, 10, 20];

/**
 * Esegue l'analisi di sensibilita variando i parametri chiave ±20%
 */
export function runSensitivityAnalysis(
  loadProfile: number[],
  config: SystemConfig,
  financial: FinancialParams
): SensitivityResult[] {
  const baseResults = runSimulation(loadProfile, config, financial);
  const baseNPV = baseResults.financial.npv;
  const basePayback = baseResults.financial.paybackSimple;
  const baseIRR = baseResults.financial.irr;

  const parameters: {
    key: string;
    label: string;
    unit: string;
    getBase: () => number;
    apply: (factor: number) => { config: SystemConfig; financial: FinancialParams };
  }[] = [
    {
      key: "pvPower",
      label: "Potenza FV",
      unit: "kWp",
      getBase: () => config.pvPower_kWp,
      apply: (factor) => ({
        config: { ...config, pvPower_kWp: config.pvPower_kWp * factor },
        financial,
      }),
    },
    {
      key: "bessCapacity",
      label: "Capacita Batteria",
      unit: "kWh",
      getBase: () => config.bessCapacity_kWh,
      apply: (factor) => ({
        config: { ...config, bessCapacity_kWh: config.bessCapacity_kWh * factor },
        financial,
      }),
    },
    {
      key: "purchasePrice",
      label: "Prezzo Acquisto",
      unit: "EUR/kWh",
      getBase: () => financial.purchasePrice,
      apply: (factor) => ({
        config,
        financial: { ...financial, purchasePrice: financial.purchasePrice * factor },
      }),
    },
    {
      key: "sellingPrice",
      label: "Prezzo Vendita",
      unit: "EUR/kWh",
      getBase: () => financial.sellingPrice,
      apply: (factor) => ({
        config,
        financial: { ...financial, sellingPrice: financial.sellingPrice * factor },
      }),
    },
    {
      key: "pvCost",
      label: "Costo FV",
      unit: "EUR/kWp",
      getBase: () => financial.pvCost,
      apply: (factor) => ({
        config,
        financial: { ...financial, pvCost: financial.pvCost * factor },
      }),
    },
  ];

  return parameters.map((param) => {
    const variations: SensitivityVariation[] = DELTAS.map((delta) => {
      if (delta === 0) {
        return { delta: 0, npv: baseNPV, payback: basePayback, irr: baseIRR };
      }

      const factor = 1 + delta / 100;
      const { config: modConfig, financial: modFinancial } = param.apply(factor);

      try {
        const res = runSimulation(loadProfile, modConfig, modFinancial);
        return {
          delta,
          npv: res.financial.npv,
          payback: res.financial.paybackSimple,
          irr: res.financial.irr,
        };
      } catch {
        return { delta, npv: baseNPV, payback: basePayback, irr: baseIRR };
      }
    });

    return {
      parameter: param.key,
      label: param.label,
      unit: param.unit,
      baseValue: param.getBase(),
      variations,
    };
  });
}
