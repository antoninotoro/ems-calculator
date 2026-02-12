// ============================================
// Financial Calculator - Analisi Economica
// ============================================

import {
  CashFlowYear,
  FinancialResults,
  FinancialParams,
  AnnualEnergyBalance,
  SystemConfig,
} from "@/lib/types/energy";

/**
 * Calcola il CAPEX totale dell'investimento
 */
export function calculateCAPEX(
  config: SystemConfig,
  financial: FinancialParams
): number {
  const pvCapex = config.pvPower_kWp * financial.pvCost;
  const bessCapex = config.bessCapacity_kWh * financial.bessCost;
  const hpCapex = config.heatPumpPower_kW * financial.heatPumpCost;
  const ledCapex = financial.ledCost * (config.ledSavings_percent / 100);

  return pvCapex + bessCapex + hpCapex + ledCapex;
}

/**
 * Calcola il risparmio energetico annuale
 */
export function calculateAnnualSavings(
  energyBalance: AnnualEnergyBalance,
  financial: FinancialParams
): { energySavings: number; gridRevenue: number; total: number } {
  // Risparmio = energia non prelevata dalla rete
  const energySavings =
    (energyBalance.totalSelfConsumption + energyBalance.totalBatteryDischarge) *
    financial.purchasePrice;

  // Ricavi da vendita energia in rete
  const gridRevenue = energyBalance.totalGridExport * financial.sellingPrice;

  return {
    energySavings,
    gridRevenue,
    total: energySavings + gridRevenue,
  };
}

/**
 * Genera il cash flow su N anni
 */
export function generateCashFlow(
  config: SystemConfig,
  energyBalance: AnnualEnergyBalance,
  financial: FinancialParams,
  years: number = 20
): CashFlowYear[] {
  const cashFlow: CashFlowYear[] = [];
  const capex = calculateCAPEX(config, financial);

  // Risparmio anno 1
  const year1Savings = calculateAnnualSavings(energyBalance, financial);

  // Produzione FV anno 1
  const year1Production = energyBalance.totalPVProduction;

  let cumulativeCashFlow = -capex;

  for (let year = 1; year <= years; year++) {
    // Fattore degrado FV
    const pvDegradationFactor = Math.pow(1 - financial.pvDegradation, year - 1);

    // Fattore inflazione energetica
    const inflationFactor = Math.pow(1 + financial.energyInflation, year - 1);

    // Produzione FV dell'anno (con degrado)
    const pvProduction = year1Production * pvDegradationFactor;

    // Risparmio energetico (con inflazione e degrado)
    const energySavings =
      year1Savings.energySavings * pvDegradationFactor * inflationFactor;

    // Ricavi vendita (con degrado, prezzo stabile)
    const gridRevenue = year1Savings.gridRevenue * pvDegradationFactor;

    // Costo manutenzione (percentuale del CAPEX)
    const maintenanceCost = capex * financial.maintenanceCost;

    // Cash flow netto dell'anno
    const netCashFlow = energySavings + gridRevenue - maintenanceCost;

    cumulativeCashFlow += netCashFlow;

    cashFlow.push({
      year,
      energySavings,
      gridRevenue,
      maintenanceCost,
      netCashFlow,
      cumulativeCashFlow,
      pvProduction,
    });
  }

  return cashFlow;
}

/**
 * Calcola il Net Present Value (NPV / VAN)
 *
 * NPV = Sum(CFt / (1+r)^t) - CAPEX
 */
export function calculateNPV(
  cashFlow: CashFlowYear[],
  discountRate: number,
  capex: number
): number {
  const presentValues = cashFlow.map(
    (cf) => cf.netCashFlow / Math.pow(1 + discountRate, cf.year)
  );

  const sumPV = presentValues.reduce((sum, pv) => sum + pv, 0);

  return sumPV - capex;
}

/**
 * Calcola l'Internal Rate of Return (IRR / TIR) usando Newton-Raphson
 *
 * Trova il tasso r dove NPV = 0
 */
export function calculateIRR(
  cashFlow: CashFlowYear[],
  capex: number,
  tolerance: number = 0.0001,
  maxIterations: number = 100
): number {
  // Cash flows incluso CAPEX iniziale
  const flows = [-capex, ...cashFlow.map((cf) => cf.netCashFlow)];

  // Stima iniziale
  let rate = 0.1;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Calcola NPV e derivata
    let npv = 0;
    let npvDerivative = 0;

    for (let t = 0; t < flows.length; t++) {
      const discountFactor = Math.pow(1 + rate, t);
      npv += flows[t] / discountFactor;
      if (t > 0) {
        npvDerivative -= (t * flows[t]) / Math.pow(1 + rate, t + 1);
      }
    }

    // Check convergenza
    if (Math.abs(npv) < tolerance) {
      return rate;
    }

    // Newton-Raphson update
    if (npvDerivative === 0) {
      break;
    }

    const newRate = rate - npv / npvDerivative;

    // Limita il tasso a valori ragionevoli
    if (newRate < -0.99) {
      rate = -0.99;
    } else if (newRate > 10) {
      rate = 10;
    } else {
      rate = newRate;
    }
  }

  return rate;
}

/**
 * Calcola il Payback Period semplice
 */
export function calculateSimplePayback(
  cashFlow: CashFlowYear[],
  capex: number
): number {
  let cumulative = 0;

  for (const cf of cashFlow) {
    cumulative += cf.netCashFlow;
    if (cumulative >= capex) {
      // Interpolazione lineare per payback frazionario
      const prevCumulative = cumulative - cf.netCashFlow;
      const fraction = (capex - prevCumulative) / cf.netCashFlow;
      return cf.year - 1 + fraction;
    }
  }

  // Se non raggiunge il payback
  return Infinity;
}

/**
 * Calcola il Payback Period attualizzato
 */
export function calculateDiscountedPayback(
  cashFlow: CashFlowYear[],
  capex: number,
  discountRate: number
): number {
  let cumulativePV = 0;

  for (const cf of cashFlow) {
    const pv = cf.netCashFlow / Math.pow(1 + discountRate, cf.year);
    cumulativePV += pv;

    if (cumulativePV >= capex) {
      const prevCumulativePV = cumulativePV - pv;
      const fraction = (capex - prevCumulativePV) / pv;
      return cf.year - 1 + fraction;
    }
  }

  return Infinity;
}

/**
 * Calcola il ROI (Return on Investment)
 */
export function calculateROI(
  cashFlow: CashFlowYear[],
  capex: number
): number {
  const totalReturns = cashFlow.reduce((sum, cf) => sum + cf.netCashFlow, 0);
  return ((totalReturns - capex) / capex) * 100;
}

/**
 * Calcola il LCOE (Levelized Cost of Energy)
 */
export function calculateLCOE(
  cashFlow: CashFlowYear[],
  capex: number,
  discountRate: number
): number {
  // Somma dei costi attualizzati (CAPEX + O&M)
  let totalCostsPV = capex;
  let totalProductionPV = 0;

  for (const cf of cashFlow) {
    const discountFactor = Math.pow(1 + discountRate, cf.year);
    totalCostsPV += cf.maintenanceCost / discountFactor;
    totalProductionPV += cf.pvProduction / discountFactor;
  }

  if (totalProductionPV === 0) return 0;

  return totalCostsPV / totalProductionPV;
}

/**
 * Calcola tutti i risultati finanziari
 */
export function calculateFinancialResults(
  config: SystemConfig,
  energyBalance: AnnualEnergyBalance,
  financial: FinancialParams,
  years: number = 20
): { cashFlow: CashFlowYear[]; results: FinancialResults } {
  const capex = calculateCAPEX(config, financial);
  const cashFlow = generateCashFlow(config, energyBalance, financial, years);
  const annualSavings = calculateAnnualSavings(energyBalance, financial);

  const npv = calculateNPV(cashFlow, financial.discountRate, capex);
  const irr = calculateIRR(cashFlow, capex);
  const paybackSimple = calculateSimplePayback(cashFlow, capex);
  const paybackDiscounted = calculateDiscountedPayback(
    cashFlow,
    capex,
    financial.discountRate
  );
  const roi = calculateROI(cashFlow, capex);
  const lcoe = calculateLCOE(cashFlow, capex, financial.discountRate);

  return {
    cashFlow,
    results: {
      capex,
      annualSavings: annualSavings.total,
      npv,
      irr: irr * 100, // Converti in percentuale
      paybackSimple,
      paybackDiscounted,
      roi,
      lcoe,
    },
  };
}
