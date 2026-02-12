// ============================================
// PDF Report Generator
// ============================================

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  SimulationResults,
  SystemConfig,
  FinancialParams,
  LoadMetrics,
} from "@/lib/types/energy";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function generatePDFReport(
  results: SimulationResults,
  config: SystemConfig,
  financial: FinancialParams,
  loadMetrics: LoadMetrics,
  city?: string
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // --- Intestazione ---
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Report Simulazione EMS", pageWidth / 2, yPos, { align: "center" });
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const dateStr = new Date().toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const subtitle = city ? `${city} - ${dateStr}` : dateStr;
  doc.text(subtitle, pageWidth / 2, yPos, { align: "center" });
  yPos += 12;

  // --- Linea separatrice ---
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.5);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 10;

  // --- Configurazione Impianto ---
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Configurazione Impianto", 14, yPos);
  yPos += 6;

  autoTable(doc, {
    startY: yPos,
    head: [["Parametro", "Valore"]],
    body: [
      ["Potenza FV", `${formatNumber(config.pvPower_kWp)} kWp`],
      ["Capacita Batteria", `${formatNumber(config.bessCapacity_kWh)} kWh`],
      ["Potenza Batteria", `${formatNumber(config.bessPower_kW)} kW`],
      ...(config.heatPumpPower_kW > 0
        ? [["Pompa di Calore", `${formatNumber(config.heatPumpPower_kW)} kW`]]
        : []),
      ...(config.ledSavings_percent > 0
        ? [["Risparmio LED", `${formatPercent(config.ledSavings_percent)}`]]
        : []),
      ...(city
        ? [["Localita", `${city} (lat ${config.latitude.toFixed(1)}°, ${formatNumber(config.equivalentHours)} ore eq.)`]]
        : []),
    ],
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 10;

  // --- Bilancio Energetico ---
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Bilancio Energetico Annuale", 14, yPos);
  yPos += 6;

  const eb = results.energyBalance;
  autoTable(doc, {
    startY: yPos,
    head: [["Metrica", "Valore"]],
    body: [
      ["Consumo Totale", `${formatNumber(loadMetrics.totalConsumption)} kWh`],
      ["Potenza Massima", `${formatNumber(loadMetrics.pMax, 1)} kW`],
      ["Produzione FV", `${formatNumber(eb.totalPVProduction)} kWh`],
      ["Autoconsumo Diretto", `${formatNumber(eb.totalSelfConsumption)} kWh`],
      ["Scarica Batteria", `${formatNumber(eb.totalBatteryDischarge)} kWh`],
      ["Immissione in Rete", `${formatNumber(eb.totalGridExport)} kWh`],
      ["Prelievo da Rete", `${formatNumber(eb.totalGridImport)} kWh`],
      ["Tasso Autoconsumo", formatPercent(eb.selfConsumptionRate)],
      ["Tasso Autosufficienza", formatPercent(eb.selfSufficiencyRate)],
    ],
    theme: "striped",
    headStyles: { fillColor: [16, 185, 129] },
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 10;

  // --- KPI Finanziari ---
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("KPI Finanziari", 14, yPos);
  yPos += 6;

  const fin = results.financial;
  autoTable(doc, {
    startY: yPos,
    head: [["Indicatore", "Valore"]],
    body: [
      ["CAPEX", formatCurrency(fin.capex)],
      ["Risparmio Annuo (Anno 1)", formatCurrency(fin.annualSavings)],
      ["NPV (20 anni)", formatCurrency(fin.npv)],
      ["IRR", formatPercent(fin.irr)],
      ["Payback Semplice", `${fin.paybackSimple === Infinity ? ">20" : fin.paybackSimple.toFixed(1)} anni`],
      ["Payback Attualizzato", `${fin.paybackDiscounted === Infinity ? ">20" : fin.paybackDiscounted.toFixed(1)} anni`],
      ["ROI", formatPercent(fin.roi)],
      ["LCOE", `${fin.lcoe.toFixed(4)} EUR/kWh`],
    ],
    theme: "striped",
    headStyles: { fillColor: [245, 158, 11] },
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Nuova pagina per Cash Flow e Impatto Ambientale
  doc.addPage();
  yPos = 20;

  // --- Cash Flow 20 Anni ---
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Cash Flow 20 Anni", 14, yPos);
  yPos += 6;

  autoTable(doc, {
    startY: yPos,
    head: [["Anno", "Risparmio", "Ricavi Rete", "Manutenzione", "Netto", "Cumulativo"]],
    body: results.cashFlow.map((cf) => [
      `${cf.year}`,
      formatCurrency(cf.energySavings),
      formatCurrency(cf.gridRevenue),
      formatCurrency(cf.maintenanceCost),
      formatCurrency(cf.netCashFlow),
      formatCurrency(cf.cumulativeCashFlow),
    ]),
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 7 },
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yPos = (doc as any).lastAutoTable.finalY + 10;

  // --- Impatto Ambientale ---
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Impatto Ambientale", 14, yPos);
  yPos += 6;

  const env = results.environmental;
  autoTable(doc, {
    startY: yPos,
    head: [["Metrica", "Valore"]],
    body: [
      ["CO2 Risparmiata (Anno)", `${env.co2SavedAnnual.toFixed(1)} ton`],
      ["CO2 Risparmiata (20 anni)", `${env.co2SavedLifetime.toFixed(0)} ton`],
      ["Alberi Equivalenti", `${formatNumber(env.treesEquivalent)}`],
      ["Auto Equivalenti", `${env.carsEquivalent.toFixed(1)}`],
    ],
    theme: "striped",
    headStyles: { fillColor: [16, 185, 129] },
    margin: { left: 14, right: 14 },
  });

  // --- Footer ---
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text(
      `EMS Calculator - Pagina ${i} di ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
    doc.setTextColor(0);
  }

  // Download
  const fileName = city
    ? `Report_EMS_${city}_${new Date().toISOString().slice(0, 10)}.pdf`
    : `Report_EMS_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
