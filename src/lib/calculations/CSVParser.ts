// ============================================
// Data Parser - Gestione file di consumo (CSV e PDF)
// ============================================

import { HourlyData, LoadMetrics, HOURS_PER_YEAR } from "@/lib/types/energy";
import { parsePDFData, analyzePDF, PDFInfo } from "./PDFParser";

/**
 * Informazioni su un file caricato
 */
export interface FileInfo {
  id: string;
  name: string;
  type: "csv" | "pdf";
  size: number;
  dataPoints: number;
  pMax: number;
  totalConsumption: number;
  status: "pending" | "processing" | "success" | "error";
  error?: string;
  data?: number[];
}

/**
 * Parsa un file (CSV o PDF) e restituisce i dati normalizzati
 */
export async function parseFile(file: File): Promise<number[]> {
  const extension = file.name.toLowerCase().split(".").pop();

  if (extension === "csv") {
    const data = await parseCSV(file);
    return normalizeToYearly(data);
  } else if (extension === "pdf") {
    return await parsePDFData(file);
  } else {
    throw new Error(`Formato file non supportato: ${extension}`);
  }
}

/**
 * Parsa file multipli e combina i dati
 * Strategia: somma i profili (utile per piu POD)
 */
export async function parseMultipleFiles(
  files: File[],
  onProgress?: (fileIndex: number, status: string) => void
): Promise<{ combined: number[]; fileInfos: FileInfo[] }> {
  const fileInfos: FileInfo[] = [];
  const profiles: number[][] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileInfo: FileInfo = {
      id: `file-${Date.now()}-${i}`,
      name: file.name,
      type: file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "csv",
      size: file.size,
      dataPoints: 0,
      pMax: 0,
      totalConsumption: 0,
      status: "processing",
    };

    onProgress?.(i, "processing");

    try {
      const data = await parseFile(file);
      const metrics = calculateLoadMetrics(data);

      fileInfo.data = data;
      fileInfo.dataPoints = data.length;
      fileInfo.pMax = metrics.pMax;
      fileInfo.totalConsumption = metrics.totalConsumption;
      fileInfo.status = "success";

      profiles.push(data);
    } catch (error) {
      fileInfo.status = "error";
      fileInfo.error = error instanceof Error ? error.message : "Errore sconosciuto";
    }

    fileInfos.push(fileInfo);
    onProgress?.(i, fileInfo.status);
  }

  // Combina i profili sommandoli
  const combined = combineProfiles(profiles);

  return { combined, fileInfos };
}

/**
 * Combina piu profili sommandoli ora per ora
 */
export function combineProfiles(profiles: number[][]): number[] {
  if (profiles.length === 0) {
    return new Array(HOURS_PER_YEAR).fill(0);
  }

  if (profiles.length === 1) {
    return profiles[0];
  }

  const combined: number[] = new Array(HOURS_PER_YEAR).fill(0);

  for (const profile of profiles) {
    for (let i = 0; i < HOURS_PER_YEAR; i++) {
      combined[i] += profile[i] || 0;
    }
  }

  return combined;
}

/**
 * Parsa un file CSV con formato timestamp,power_kw
 */
export async function parseCSV(file: File): Promise<HourlyData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.trim().split("\n");

        // Salta l'header
        const dataLines = lines.slice(1);

        const data: HourlyData[] = dataLines
          .map((line) => {
            const [timestampStr, powerStr] = line.split(",").map((s) => s.trim());
            const timestamp = new Date(timestampStr);
            const power_kw = parseFloat(powerStr);

            if (isNaN(timestamp.getTime()) || isNaN(power_kw)) {
              return null;
            }

            return { timestamp, power_kw: Math.max(0, power_kw) };
          })
          .filter((item): item is HourlyData => item !== null);

        resolve(data);
      } catch (error) {
        reject(new Error("Errore nel parsing del file CSV"));
      }
    };

    reader.onerror = () => reject(new Error("Errore nella lettura del file"));
    reader.readAsText(file);
  });
}

/**
 * Normalizza i dati a 8760 ore (un anno completo)
 * Riempie i valori mancanti con 0
 */
export function normalizeToYearly(data: HourlyData[]): number[] {
  if (data.length === 0) {
    return new Array(HOURS_PER_YEAR).fill(0);
  }

  // Se abbiamo esattamente 8760 valori, restituiscili direttamente
  if (data.length === HOURS_PER_YEAR) {
    return data.map((d) => d.power_kw);
  }

  // Se abbiamo meno dati, estrapoliamo/ripetiamo
  const result: number[] = new Array(HOURS_PER_YEAR).fill(0);

  if (data.length < HOURS_PER_YEAR) {
    // Strategia: ripeti il pattern disponibile
    const pattern = data.map((d) => d.power_kw);
    for (let i = 0; i < HOURS_PER_YEAR; i++) {
      result[i] = pattern[i % pattern.length];
    }
  } else {
    // Se abbiamo piu dati, prendiamo i primi 8760
    for (let i = 0; i < HOURS_PER_YEAR; i++) {
      result[i] = data[i].power_kw;
    }
  }

  return result;
}

/**
 * Estrae solo i valori di potenza da un array di HourlyData
 */
export function extractPowerValues(data: HourlyData[]): number[] {
  return data.map((d) => d.power_kw);
}

/**
 * Calcola le metriche di carico da un profilo orario
 */
export function calculateLoadMetrics(loadProfile: number[]): LoadMetrics {
  if (loadProfile.length === 0) {
    return {
      pMax: 0,
      pMin: 0,
      pAvg: 0,
      totalConsumption: 0,
    };
  }

  const pMax = Math.max(...loadProfile);
  const pMin = Math.min(...loadProfile);
  const totalConsumption = loadProfile.reduce((sum, p) => sum + p, 0); // kWh (assumendo 1 ora per punto)
  const pAvg = totalConsumption / loadProfile.length;

  return {
    pMax,
    pMin,
    pAvg,
    totalConsumption,
  };
}

/**
 * Genera un pattern di carico settimanale tipico per visualizzazione
 */
export function getWeeklyPattern(loadProfile: number[]): number[] {
  const hoursPerWeek = 168; // 24 * 7
  const weeks = Math.floor(loadProfile.length / hoursPerWeek);

  if (weeks === 0) {
    return loadProfile.slice(0, hoursPerWeek);
  }

  // Media settimanale
  const weeklyPattern: number[] = new Array(hoursPerWeek).fill(0);

  for (let h = 0; h < hoursPerWeek; h++) {
    let sum = 0;
    let count = 0;
    for (let w = 0; w < weeks; w++) {
      const idx = w * hoursPerWeek + h;
      if (idx < loadProfile.length) {
        sum += loadProfile[idx];
        count++;
      }
    }
    weeklyPattern[h] = count > 0 ? sum / count : 0;
  }

  return weeklyPattern;
}

/**
 * Genera un pattern giornaliero medio
 */
export function getDailyPattern(loadProfile: number[]): number[] {
  const hoursPerDay = 24;
  const days = Math.floor(loadProfile.length / hoursPerDay);

  if (days === 0) {
    return loadProfile.slice(0, hoursPerDay);
  }

  // Media giornaliera
  const dailyPattern: number[] = new Array(hoursPerDay).fill(0);

  for (let h = 0; h < hoursPerDay; h++) {
    let sum = 0;
    let count = 0;
    for (let d = 0; d < days; d++) {
      const idx = d * hoursPerDay + h;
      if (idx < loadProfile.length) {
        sum += loadProfile[idx];
        count++;
      }
    }
    dailyPattern[h] = count > 0 ? sum / count : 0;
  }

  return dailyPattern;
}
