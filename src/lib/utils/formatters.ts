// ============================================
// Utility di Formattazione
// ============================================

/**
 * Formatta un numero come valuta (Euro)
 */
export function formatCurrency(
  value: number,
  decimals: number = 0
): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formatta un numero con separatori delle migliaia
 */
export function formatNumber(
  value: number,
  decimals: number = 0
): string {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formatta come percentuale
 */
export function formatPercent(
  value: number,
  decimals: number = 1
): string {
  return `${formatNumber(value, decimals)}%`;
}

/**
 * Formatta energia in kWh o MWh
 */
export function formatEnergy(
  value_kWh: number,
  autoScale: boolean = true
): string {
  if (autoScale && Math.abs(value_kWh) >= 1000) {
    return `${formatNumber(value_kWh / 1000, 1)} MWh`;
  }
  return `${formatNumber(value_kWh, 0)} kWh`;
}

/**
 * Formatta potenza in kW o MW
 */
export function formatPower(
  value_kW: number,
  autoScale: boolean = true
): string {
  if (autoScale && Math.abs(value_kW) >= 1000) {
    return `${formatNumber(value_kW / 1000, 2)} MW`;
  }
  return `${formatNumber(value_kW, 1)} kW`;
}

/**
 * Formatta anni con decimali
 */
export function formatYears(value: number): string {
  if (!isFinite(value) || value > 50) {
    return "> 50 anni";
  }
  if (value < 1) {
    return `${formatNumber(value * 12, 0)} mesi`;
  }
  return `${formatNumber(value, 1)} anni`;
}

/**
 * Formatta CO2 in tonnellate o kg
 */
export function formatCO2(value_tons: number): string {
  if (Math.abs(value_tons) < 1) {
    return `${formatNumber(value_tons * 1000, 0)} kg`;
  }
  return `${formatNumber(value_tons, 1)} ton`;
}

/**
 * Formatta un valore compatto (es. 1.2M, 500k)
 */
export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `${formatNumber(value / 1000000, 1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${formatNumber(value / 1000, 1)}k`;
  }
  return formatNumber(value, 0);
}

/**
 * Formatta timestamp per grafici
 */
export function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

/**
 * Nomi dei mesi in italiano
 */
export const MONTH_NAMES = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

export const MONTH_NAMES_SHORT = [
  "Gen",
  "Feb",
  "Mar",
  "Apr",
  "Mag",
  "Giu",
  "Lug",
  "Ago",
  "Set",
  "Ott",
  "Nov",
  "Dic",
];

/**
 * Nomi dei giorni in italiano
 */
export const DAY_NAMES = [
  "Domenica",
  "Lunedi",
  "Martedi",
  "Mercoledi",
  "Giovedi",
  "Venerdi",
  "Sabato",
];

export const DAY_NAMES_SHORT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
