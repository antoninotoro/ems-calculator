// ============================================
// PDF Parser - Estrazione dati bollette italiane
// Supporta fasce orarie F1/F2/F3 e consumi mensili
// ============================================

import { HOURS_PER_YEAR } from "@/lib/types/energy";

// ===== Interfacce =====

export interface ExtractedData {
  timestamp?: Date;
  power_kw?: number;
  energy_kwh?: number;
  rawText?: string;
}

/**
 * Dati estratti da una bolletta italiana
 */
export interface BillData {
  // Dati generali cliente
  ragioneSociale?: string;         // Nome azienda/cliente
  podCode?: string;                // Codice POD (IT001E...)
  supplier?: string;               // Fornitore (Enel, Sorgenia, etc.)

  // Dati contrattuali potenza
  potenzaImpegnata?: number;       // Potenza impegnata contrattuale (kW)
  potenzaDisponibile?: number;     // Potenza disponibile (kW)
  contractPower?: number;          // Alias per compatibilità

  // Consumi per fascia del periodo (kWh)
  f1: number;
  f2: number;
  f3: number;
  totalConsumption: number;

  // Periodo fatturazione
  startDate?: Date;
  endDate?: Date;
  billingMonths: number;

  // Storico consumi mensili (12-18 mesi)
  monthlyConsumption: MonthlyConsumption[];

  // Dati economici
  prezzoMedio?: number;            // Prezzo medio bolletta (€/kWh)
  costiUnitari?: {
    pun?: number;                  // Prezzo Unico Nazionale (€/kWh)
    spread?: number;               // Spread/Fee fornitore (€/kWh)
    perditeRete?: number;          // Perdite di rete (%)
    dispaccamento?: number;        // Costi dispacciamento (€/kWh)
    oneriSistema?: number;         // Oneri di sistema (€/kWh)
    trasporto?: number;            // Costi trasporto (€/kWh)
  };

  // Flag validazione
  dataQuality: DataQualityInfo;
}

/**
 * Informazioni sulla qualità dei dati estratti
 */
export interface DataQualityInfo {
  consumptionValidated: boolean;   // F1+F2+F3 = Total verificato
  monthsExtracted: number;         // Numero mesi storico estratti
  hasMaxPower: boolean;            // Dati potenza max disponibili
  hasPricing: boolean;             // Dati economici disponibili
  validationErrors: string[];      // Errori di validazione
  confidence: number;              // 0-100% confidenza estrazione
}

/**
 * Consumo mensile con dettaglio fasce e potenza
 */
export interface MonthlyConsumption {
  month: number;                   // 0-11
  year: number;
  f1: number;                      // Consumo F1 (kWh)
  f2: number;                      // Consumo F2 (kWh)
  f3: number;                      // Consumo F3 (kWh)
  total: number;                   // Totale (kWh)
  maxPower?: number;               // Potenza massima prelevata (kW)
  validated: boolean;              // F1+F2+F3 ≈ Total
  validationDelta?: number;        // Differenza % se non validato
}

export interface PDFInfo {
  fileName: string;
  pageCount: number;
  extractedValues: number;
  dataType: "bill" | "hourly" | "daily" | "monthly" | "generic";
  sampleValues: number[];
  billData?: BillData;
  rawText?: string; // Testo grezzo per debug
}

// ===== Costanti fasce orarie italiane =====

// F1: Lun-Ven 8:00-19:00 (esclusi festivi)
// F2: Lun-Ven 7:00-8:00 e 19:00-23:00, Sab 7:00-23:00
// F3: Lun-Sab 23:00-7:00, Dom e festivi tutto il giorno

const HOURS_F1 = 11 * 5; // 11 ore x 5 giorni = 55 ore/settimana
const HOURS_F2 = (1 + 4) * 5 + 16; // (1+4)*5 feriali + 16 sabato = 41 ore/settimana
const HOURS_F3 = 7 * 5 + 7 + 24; // 7*5 notti feriali + 7 notte sab + 24 dom = 66 ore/settimana

// Distribuzione oraria tipica per fascia (0-23)
const HOURLY_DISTRIBUTION = {
  // Pesi relativi per ogni ora del giorno (normalizzati)
  weekday: [
    0.02, 0.02, 0.02, 0.02, 0.02, 0.03, // 0-5: F3
    0.04, 0.05, // 6-7: F3, F2
    0.08, 0.09, 0.09, 0.09, // 8-11: F1
    0.08, 0.09, 0.09, 0.09, 0.08, 0.07, 0.06, // 12-18: F1
    0.05, 0.04, 0.03, 0.03, 0.02 // 19-23: F2, F3
  ],
  saturday: [
    0.02, 0.02, 0.02, 0.02, 0.02, 0.03, // 0-5: F3
    0.04, 0.05, 0.06, 0.07, 0.07, 0.07, // 6-11: F3, F2
    0.06, 0.06, 0.06, 0.06, 0.05, 0.05, 0.05, // 12-18: F2
    0.04, 0.04, 0.03, 0.03, 0.02 // 19-23: F2, F3
  ],
  sunday: [
    0.02, 0.02, 0.02, 0.02, 0.02, 0.02, // 0-5: F3
    0.03, 0.04, 0.05, 0.06, 0.06, 0.06, // 6-11: F3
    0.06, 0.06, 0.06, 0.06, 0.05, 0.05, 0.05, // 12-18: F3
    0.04, 0.04, 0.03, 0.03, 0.02 // 19-23: F3
  ]
};

// Fattori stagionali mensili (indice 0 = gennaio)
const SEASONAL_FACTORS = [
  1.15, // Gennaio - più consumo (riscaldamento/illuminazione)
  1.10, // Febbraio
  1.00, // Marzo
  0.90, // Aprile
  0.85, // Maggio
  0.95, // Giugno - inizio condizionamento
  1.10, // Luglio - condizionamento
  1.05, // Agosto - condizionamento (meno uffici)
  0.90, // Settembre
  0.95, // Ottobre
  1.05, // Novembre
  1.15  // Dicembre
];

// ===== Funzioni di caricamento PDF =====

async function loadPdfJs() {
  if (typeof window === "undefined") {
    throw new Error("PDF parsing is only available in the browser");
  }

  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

  return pdfjsLib;
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await loadPdfJs();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => {
        if ("str" in item) {
          return item.str;
        }
        return "";
      })
      .join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
}

// ===== Estrazione dati bolletta =====

/**
 * Risultato estrazione formato Sorgenia con dati completi
 */
interface SorgeniaExtractionResult {
  monthlyData: MonthlyConsumption[];
  totaleValues: number[];           // Riga TOTALE
  maxPowerValues: number[];         // Riga POTENZA MAX / P. MAX
  months: Array<{month: number, year: number}>;
}

/**
 * Estrae dati dal formato Sorgenia - tabella storico consumi
 * Formato: righe F1/F2/F3/TOTALE/P.MAX con valori per colonna (mesi)
 * Es: "MAG 24 GIU 24 ... F1 5.112 660 661 ... F2 1.102 528 ... F3 1.845 1.503 ... TOTALE 8.059 ..."
 */
function extractSorgeniaFormat(text: string, monthAbbr: string[]): MonthlyConsumption[] {
  const result = extractSorgeniaFormatFull(text, monthAbbr);
  return result.monthlyData;
}

/**
 * Estrazione completa formato Sorgenia con TOTALE e POTENZA MAX
 * APPROCCIO SEMPLIFICATO: legge i numeri direttamente dopo le etichette F1/F2/F3/TOTALE
 */
function extractSorgeniaFormatFull(text: string, monthAbbr: string[]): SorgeniaExtractionResult {
  const emptyResult: SorgeniaExtractionResult = {
    monthlyData: [],
    totaleValues: [],
    maxPowerValues: [],
    months: []
  };

  // Log il testo completo per debug
  console.log('[PDFParser] ===== TESTO COMPLETO PER ANALISI =====');
  console.log(text);
  console.log('[PDFParser] ===== FINE TESTO =====');

  // Cerca la sezione "INFORMAZIONI STORICHE" o "CONSUMI FATTURATI"
  let sectionText = text;
  const historicMatch = text.match(/INFORMAZIONI\s*STORICHE[^]*?(?=DETTAGLIO|CONDIZIONI|RIEPILOGO\s*IMPORTI|Per\s*contattare|$)/i);
  if (historicMatch) {
    sectionText = historicMatch[0];
    console.log('[PDFParser] Sezione INFORMAZIONI STORICHE trovata, lunghezza:', sectionText.length);
  }

  // Cerca intestazioni mesi nel formato "MAG 24 GIU 24 LUG 24..."
  const monthsPattern = new RegExp(`(${monthAbbr.join('|')})\\s*(\\d{2})`, 'gi');
  const months: Array<{month: number, year: number}> = [];
  const seenMonths = new Set<string>();
  let monthMatch;

  while ((monthMatch = monthsPattern.exec(sectionText)) !== null) {
    const monthName = monthMatch[1].toLowerCase();
    const monthIndex = monthAbbr.findIndex(m => m.toLowerCase() === monthName);
    if (monthIndex >= 0) {
      const year = 2000 + parseInt(monthMatch[2]);
      const key = `${year}-${monthIndex}`;
      if (!seenMonths.has(key)) {
        seenMonths.add(key);
        months.push({ month: monthIndex, year });
      }
    }
    if (months.length >= 18) break;
  }

  console.log('[PDFParser] Mesi trovati:', months.length, months.map(m => `${monthAbbr[m.month]} ${m.year}`));

  if (months.length < 3) {
    console.log('[PDFParser] Meno di 3 mesi trovati, estrazione fallita');
    return emptyResult;
  }

  // NUOVO APPROCCIO: Cerca il pattern della tabella Sorgenia
  // La tabella ha il formato:
  // F1 [numeri separati da spazi]
  // F2 [numeri separati da spazi]
  // F3 [numeri separati da spazi]
  // TOTALE [numeri separati da spazi]

  // Funzione per estrarre tutti i numeri dopo un'etichetta fino alla prossima etichetta
  const extractRowNumbers = (label: string, nextLabels: string[]): number[] => {
    // Crea pattern per trovare da label fino a nextLabel
    const nextPattern = nextLabels.length > 0 ? `(?=${nextLabels.join('|')})` : '';
    const pattern = new RegExp(`\\b${label}\\b[^a-zA-Z]*?([\\d\\s.,]+?)${nextPattern}`, 'is');

    const match = sectionText.match(pattern);
    if (!match) {
      console.log(`[PDFParser] Nessun match per ${label}`);
      return [];
    }

    const numbersStr = match[1];
    console.log(`[PDFParser] Stringa numeri per ${label}:`, numbersStr.substring(0, 200));

    // Estrai tutti i numeri (formato italiano: 2.412 o 741 o 1.148)
    // Pattern: numero con possibile punto come separatore migliaia
    const numberMatches = numbersStr.match(/\d{1,3}(?:\.\d{3})*|\d+/g) || [];

    const values: number[] = [];
    for (const numStr of numberMatches) {
      // Converti formato italiano: "2.412" -> 2412
      const cleanNum = numStr.replace(/\./g, '');
      const value = parseInt(cleanNum, 10);

      // Valori ragionevoli per consumi mensili: 50 - 100.000 kWh
      // Abbassato il minimo per includere mesi con basso consumo (es. 741 kWh)
      if (value >= 50 && value <= 100000) {
        values.push(value);
      }

      if (values.length >= months.length) break;
    }

    console.log(`[PDFParser] Valori estratti per ${label}:`, values);
    return values;
  };

  // Estrai i valori per ogni riga
  const f1Values = extractRowNumbers('F1', ['F2', 'TOTALE']);
  const f2Values = extractRowNumbers('F2', ['F3', 'TOTALE']);
  const f3Values = extractRowNumbers('F3', ['TOTALE', 'POTENZA']);
  const totaleValues = extractRowNumbers('TOTALE', ['POTENZA', 'LIVELLO', 'kW']);

  // Se l'estrazione non ha funzionato, prova un approccio alternativo
  // Cerca pattern "F1 numero numero numero..."
  if (f1Values.length < 3 || f2Values.length < 3 || f3Values.length < 3) {
    console.log('[PDFParser] Primo metodo fallito, provo approccio alternativo...');

    // Cerca specificamente il pattern CONSUMI FATTURATI
    const consumiMatch = sectionText.match(/CONSUMI\s*FATTURATI[^]*?POTENZA/i);
    if (consumiMatch) {
      const consumiText = consumiMatch[0];
      console.log('[PDFParser] Sezione CONSUMI FATTURATI:', consumiText.substring(0, 500));

      // Estrai righe F1, F2, F3, TOTALE
      const extractLineNumbers = (line: string): number[] => {
        const nums = line.match(/\d{1,3}(?:\.\d{3})*|\d+/g) || [];
        return nums.map(n => parseInt(n.replace(/\./g, ''), 10))
                   .filter(v => v >= 100 && v <= 50000);
      };

      // Trova le righe
      const f1Match = consumiText.match(/F1[^\n\r]*?([\d\s.,]+)/i);
      const f2Match = consumiText.match(/F2[^\n\r]*?([\d\s.,]+)/i);
      const f3Match = consumiText.match(/F3[^\n\r]*?([\d\s.,]+)/i);
      const totMatch = consumiText.match(/TOTALE[^\n\r]*?([\d\s.,]+)/i);

      if (f1Match) {
        const extracted = extractLineNumbers(f1Match[1]);
        if (extracted.length > f1Values.length) { f1Values.length = 0; f1Values.push(...extracted); }
      }
      if (f2Match) {
        const extracted = extractLineNumbers(f2Match[1]);
        if (extracted.length > f2Values.length) { f2Values.length = 0; f2Values.push(...extracted); }
      }
      if (f3Match) {
        const extracted = extractLineNumbers(f3Match[1]);
        if (extracted.length > f3Values.length) { f3Values.length = 0; f3Values.push(...extracted); }
      }
      if (totMatch) {
        const extracted = extractLineNumbers(totMatch[1]);
        if (extracted.length > totaleValues.length) { totaleValues.length = 0; totaleValues.push(...extracted); }
      }
    }
  }

  // TERZO APPROCCIO: Se ancora non funziona, cerca numeri dopo "Effettivi" o direttamente dopo F1/F2/F3
  if (f1Values.length < 3 || f2Values.length < 3 || f3Values.length < 3) {
    console.log('[PDFParser] Secondo metodo fallito, provo terzo approccio...');

    // Cerca tutti i numeri nel formato italiano dopo ogni etichetta
    const extractAllAfterLabel = (label: string): number[] => {
      // Pattern: etichetta seguita da qualsiasi cosa fino a trovare numeri
      const regex = new RegExp(`\\b${label}\\b[^\\d]*((?:\\d{1,3}(?:\\.\\d{3})*|\\d+)(?:[\\s,]+(?:\\d{1,3}(?:\\.\\d{3})*|\\d+))*)`, 'i');
      const match = sectionText.match(regex);

      if (!match) return [];

      const numStr = match[1];
      console.log(`[PDFParser] Terzo approccio - ${label}:`, numStr.substring(0, 100));

      // Estrai numeri
      const nums = numStr.match(/\d{1,3}(?:\.\d{3})*|\d+/g) || [];
      return nums.map(n => parseInt(n.replace(/\./g, ''), 10))
                 .filter(v => v >= 50 && v <= 100000)
                 .slice(0, months.length);
    };

    const altF1 = extractAllAfterLabel('F1');
    const altF2 = extractAllAfterLabel('F2');
    const altF3 = extractAllAfterLabel('F3');
    const altTot = extractAllAfterLabel('TOTALE');

    if (altF1.length > f1Values.length) { f1Values.length = 0; f1Values.push(...altF1); }
    if (altF2.length > f2Values.length) { f2Values.length = 0; f2Values.push(...altF2); }
    if (altF3.length > f3Values.length) { f3Values.length = 0; f3Values.push(...altF3); }
    if (altTot.length > totaleValues.length) { totaleValues.length = 0; totaleValues.push(...altTot); }
  }

  console.log('[PDFParser] RISULTATO ESTRAZIONE:');
  console.log('[PDFParser] F1 values:', f1Values);
  console.log('[PDFParser] F2 values:', f2Values);
  console.log('[PDFParser] F3 values:', f3Values);
  console.log('[PDFParser] TOTALE values:', totaleValues);

  // Verifica dati sufficienti
  const minLength = Math.min(months.length, f1Values.length, f2Values.length, f3Values.length);
  if (minLength < 3) {
    console.log('[PDFParser] Dati insufficienti, minLength:', minLength);
    return emptyResult;
  }

  // Costruisci i risultati mensili
  const monthlyData: MonthlyConsumption[] = [];
  for (let i = 0; i < minLength; i++) {
    const extractedTotal = totaleValues[i] || 0;
    const calculatedTotal = f1Values[i] + f2Values[i] + f3Values[i];
    const total = extractedTotal > 0 ? extractedTotal : calculatedTotal;

    let validated = true;
    let validationDelta: number | undefined;
    if (extractedTotal > 0) {
      const delta = Math.abs(calculatedTotal - extractedTotal) / extractedTotal;
      validated = delta <= 0.05; // 5% tolleranza
      validationDelta = delta * 100;
    }

    monthlyData.push({
      month: months[i].month,
      year: months[i].year,
      f1: f1Values[i],
      f2: f2Values[i],
      f3: f3Values[i],
      total,
      validated,
      validationDelta
    });
  }

  // Ordina per data
  monthlyData.sort((a, b) => a.year === b.year ? a.month - b.month : a.year - b.year);

  // Calcola somme per verifica
  const sumF1 = monthlyData.reduce((s, m) => s + m.f1, 0);
  const sumF2 = monthlyData.reduce((s, m) => s + m.f2, 0);
  const sumF3 = monthlyData.reduce((s, m) => s + m.f3, 0);
  console.log('[PDFParser] SOMME PERIODO:', { F1: sumF1, F2: sumF2, F3: sumF3, Totale: sumF1 + sumF2 + sumF3 });

  return {
    monthlyData,
    totaleValues,
    maxPowerValues: [],
    months
  };
}

/**
 * Parsa numero con punto come separatore migliaia (formato italiano)
 * "5.112" -> 5112, "660" -> 660
 */
function parseItalianThousands(str: string): number {
  if (!str) return 0;
  // Se il numero ha un solo punto e nessuna virgola,
  // e la parte dopo il punto ha 3 cifre, è un separatore migliaia
  const parts = str.split('.');
  if (parts.length === 2 && parts[1].length === 3 && !str.includes(',')) {
    // 5.112 -> 5112 (punto è separatore migliaia)
    return parseInt(parts.join(''), 10);
  }
  // Altrimenti usa parseItalianNumber standard
  return parseItalianNumber(str);
}

/**
 * Estrae i dati di consumo per fascia dalla bolletta
 */
function extractBandConsumption(text: string): { f1: number; f2: number; f3: number } {
  let f1 = 0, f2 = 0, f3 = 0;

  // Pattern per fasce orarie italiane
  // Cerca "F1" seguito da numero, con possibili varianti
  const patterns = {
    // Pattern standard: "F1 1234" o "F1: 1234" o "F1 1.234,56"
    f1: [
      /F1\s*[:=]?\s*(\d+[.,]?\d*)\s*(?:kWh)?/gi,
      /fascia\s*1\s*[:=]?\s*(\d+[.,]?\d*)\s*(?:kWh)?/gi,
      /(?:energia\s+)?attiva\s+F1\s*[:=]?\s*(\d+[.,]?\d*)/gi,
      /F1\s*\(\s*[^)]*\)\s*[:=]?\s*(\d+[.,]?\d*)/gi,
    ],
    f2: [
      /F2\s*[:=]?\s*(\d+[.,]?\d*)\s*(?:kWh)?/gi,
      /fascia\s*2\s*[:=]?\s*(\d+[.,]?\d*)\s*(?:kWh)?/gi,
      /(?:energia\s+)?attiva\s+F2\s*[:=]?\s*(\d+[.,]?\d*)/gi,
      /F2\s*\(\s*[^)]*\)\s*[:=]?\s*(\d+[.,]?\d*)/gi,
    ],
    f3: [
      /F3\s*[:=]?\s*(\d+[.,]?\d*)\s*(?:kWh)?/gi,
      /fascia\s*3\s*[:=]?\s*(\d+[.,]?\d*)\s*(?:kWh)?/gi,
      /(?:energia\s+)?attiva\s+F3\s*[:=]?\s*(\d+[.,]?\d*)/gi,
      /F3\s*\(\s*[^)]*\)\s*[:=]?\s*(\d+[.,]?\d*)/gi,
    ],
  };

  // Estrai F1
  for (const pattern of patterns.f1) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const value = parseItalianNumber(match[1]);
      if (value > 0 && value < 10000000) {
        f1 = Math.max(f1, value);
      }
    }
  }

  // Estrai F2
  for (const pattern of patterns.f2) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const value = parseItalianNumber(match[1]);
      if (value > 0 && value < 10000000) {
        f2 = Math.max(f2, value);
      }
    }
  }

  // Estrai F3
  for (const pattern of patterns.f3) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const value = parseItalianNumber(match[1]);
      if (value > 0 && value < 10000000) {
        f3 = Math.max(f3, value);
      }
    }
  }

  return { f1, f2, f3 };
}

/**
 * Estrae il consumo totale dalla bolletta
 */
function extractTotalConsumption(text: string): number {
  const patterns = [
    /consumo\s*(?:totale|complessivo)\s*[:=]?\s*(\d+[.,]?\d*)\s*(?:kWh)?/gi,
    /totale\s*(?:consumo|energia|prelievo)\s*[:=]?\s*(\d+[.,]?\d*)\s*(?:kWh)?/gi,
    /energia\s*(?:attiva|prelevata)\s*(?:totale)?\s*[:=]?\s*(\d+[.,]?\d*)\s*(?:kWh)?/gi,
    /prelievo\s*(?:totale)?\s*[:=]?\s*(\d+[.,]?\d*)\s*(?:kWh)?/gi,
    /kWh\s*(?:totali|consumati)\s*[:=]?\s*(\d+[.,]?\d*)/gi,
  ];

  let total = 0;

  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const value = parseItalianNumber(match[1]);
      if (value > 0 && value < 10000000) {
        total = Math.max(total, value);
      }
    }
  }

  return total;
}

/**
 * Estrae il periodo di fatturazione
 */
function extractBillingPeriod(text: string): { startDate?: Date; endDate?: Date; months: number } {
  // Pattern per periodo: "dal 01/01/2024 al 28/02/2024" o "gennaio - febbraio 2024"
  const dateRangePattern = /dal?\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\s*al?\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/gi;

  const match = dateRangePattern.exec(text);
  if (match) {
    const startYear = match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3]);
    const endYear = match[6].length === 2 ? 2000 + parseInt(match[6]) : parseInt(match[6]);

    const startDate = new Date(startYear, parseInt(match[2]) - 1, parseInt(match[1]));
    const endDate = new Date(endYear, parseInt(match[5]) - 1, parseInt(match[4]));

    // Calcola mesi di differenza
    const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                   (endDate.getMonth() - startDate.getMonth()) + 1;

    return { startDate, endDate, months: Math.max(1, Math.min(12, months)) };
  }

  // Pattern alternativo con nomi mesi
  const monthNames = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
                      "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const monthPattern = new RegExp(
    `(${monthNames.join("|")})\\s*[-–]?\\s*(${monthNames.join("|")})?\\s*(\\d{4})`,
    "gi"
  );

  const monthMatch = monthPattern.exec(text);
  if (monthMatch) {
    const startMonthIdx = monthNames.indexOf(monthMatch[1].toLowerCase());
    const endMonthIdx = monthMatch[2] ? monthNames.indexOf(monthMatch[2].toLowerCase()) : startMonthIdx;
    const year = parseInt(monthMatch[3]);

    if (startMonthIdx >= 0) {
      const months = endMonthIdx >= startMonthIdx ?
                     endMonthIdx - startMonthIdx + 1 :
                     12 - startMonthIdx + endMonthIdx + 1;

      return {
        startDate: new Date(year, startMonthIdx, 1),
        endDate: new Date(year, endMonthIdx, 28),
        months: Math.max(1, Math.min(12, months))
      };
    }
  }

  // Default: assume bolletta bimestrale
  return { months: 2 };
}

/**
 * Estrae consumi mensili dallo storico in bolletta
 * Cerca tabelle con formato: Mese | F1 | F2 | F3 o simili
 * Supporta formato Sorgenia e altri fornitori italiani
 */
function extractMonthlyBreakdown(text: string): MonthlyConsumption[] {
  const monthlyData: MonthlyConsumption[] = [];
  const foundMonths = new Set<number>(); // indice mese (0-11)

  const monthNames = ["gen", "feb", "mar", "apr", "mag", "giu",
                      "lug", "ago", "set", "ott", "nov", "dic"];
  const fullMonthNames = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
                          "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

  // Prima prova il formato Sorgenia (righe F1, F2, F3 con valori per colonna)
  const sorgeniaData = extractSorgeniaFormat(text, monthNames);
  if (sorgeniaData.length >= 6) {
    return sorgeniaData;
  }

  // Normalizza il testo per facilitare il parsing
  const normalizedText = text
    .replace(/\s+/g, " ")
    .replace(/\n/g, " ")
    .toLowerCase();

  // Pattern 1: Cerca righe con mese seguito da 3 numeri (F1 F2 F3)
  // Es: "gen 150 80 120" o "gennaio 150 80 120"
  for (let i = 0; i < 12; i++) {
    if (foundMonths.has(i)) continue;

    // Pattern: mese (anno opzionale) seguito da 3 numeri
    const patterns = [
      // "gen 24 150 80 120" o "gen 2024 150 80 120"
      new RegExp(`\\b(${fullMonthNames[i]}|${monthNames[i]})\\s*'?(\\d{2,4})?\\s+(\\d+[.,]?\\d*)\\s+(\\d+[.,]?\\d*)\\s+(\\d+[.,]?\\d*)`, "gi"),
      // "gen f1 150 f2 80 f3 120"
      new RegExp(`\\b(${fullMonthNames[i]}|${monthNames[i]})\\s*'?(\\d{2,4})?\\s*f1\\s*:?\\s*(\\d+[.,]?\\d*)\\s*f2\\s*:?\\s*(\\d+[.,]?\\d*)\\s*f3\\s*:?\\s*(\\d+[.,]?\\d*)`, "gi"),
      // "01/2024 150 80 120" (formato numerico mese)
      new RegExp(`\\b0?${i + 1}[/\\-](\\d{2,4})\\s+(\\d+[.,]?\\d*)\\s+(\\d+[.,]?\\d*)\\s+(\\d+[.,]?\\d*)`, "gi"),
    ];

    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      const matches = [...text.matchAll(pattern)];

      for (const match of matches) {
        let year = new Date().getFullYear();
        let values: number[] = [];

        if (match[2] && /^\d{2,4}$/.test(match[2])) {
          year = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
          values = [
            parseItalianNumber(match[3]),
            parseItalianNumber(match[4]),
            parseItalianNumber(match[5])
          ];
        } else {
          values = [
            parseItalianNumber(match[3] || match[2]),
            parseItalianNumber(match[4] || match[3]),
            parseItalianNumber(match[5] || match[4])
          ];
        }

        // Verifica che i valori siano ragionevoli (tra 1 e 100000 kWh)
        if (values.every(v => v >= 0 && v < 100000) && values.some(v => v > 0)) {
          monthlyData.push({
            month: i,
            year,
            f1: values[0],
            f2: values[1],
            f3: values[2],
            total: values[0] + values[1] + values[2],
            validated: true // Validato perché calcolato
          });
          foundMonths.add(i);
          break;
        }
      }
    }
  }

  // Pattern 2: Cerca tabella storico con formato colonne
  // Cerca sequenze di numeri dopo intestazioni come "F1 F2 F3" o "Fascia 1 Fascia 2 Fascia 3"
  if (monthlyData.length < 6) {
    const tablePattern = /storico|riepilogo|consumi\s*(?:mensili|annuali)|dettaglio\s*consumi/gi;
    const tableMatch = tablePattern.exec(normalizedText);

    if (tableMatch) {
      // Cerca nel contesto vicino alla sezione storico
      const startIdx = Math.max(0, tableMatch.index - 100);
      const endIdx = Math.min(normalizedText.length, tableMatch.index + 2000);
      const tableSection = text.substring(startIdx, endIdx);

      // Cerca righe con mese e numeri
      for (let i = 0; i < 12; i++) {
        if (foundMonths.has(i)) continue;

        // Pattern piu permissivo per tabelle
        const rowPattern = new RegExp(
          `(${fullMonthNames[i]}|${monthNames[i]})[^\\d]*(\\d+[.,]?\\d*)[^\\d]*(\\d+[.,]?\\d*)[^\\d]*(\\d+[.,]?\\d*)`,
          "gi"
        );

        const rowMatch = rowPattern.exec(tableSection);
        if (rowMatch) {
          const values = [
            parseItalianNumber(rowMatch[2]),
            parseItalianNumber(rowMatch[3]),
            parseItalianNumber(rowMatch[4])
          ];

          if (values.every(v => v >= 0 && v < 100000) && values.some(v => v > 0)) {
            monthlyData.push({
              month: i,
              year: new Date().getFullYear(),
              f1: values[0],
              f2: values[1],
              f3: values[2],
              total: values[0] + values[1] + values[2],
              validated: true
            });
            foundMonths.add(i);
          }
        }
      }
    }
  }

  // Pattern 3: Cerca solo totali mensili se non troviamo le fasce
  if (monthlyData.length < 3) {
    for (let i = 0; i < 12; i++) {
      if (foundMonths.has(i)) continue;

      // "gennaio: 350 kWh" o "gen 350"
      const totalPattern = new RegExp(
        `\\b(${fullMonthNames[i]}|${monthNames[i]})\\s*'?(\\d{2,4})?\\s*:?\\s*(\\d+[.,]?\\d*)\\s*(?:kwh)?\\b`,
        "gi"
      );

      const matches = [...text.matchAll(totalPattern)];
      for (const match of matches) {
        const total = parseItalianNumber(match[3]);

        // Verifica che sia un consumo ragionevole (almeno 50 kWh/mese per C&I)
        if (total >= 50 && total < 500000) {
          // Stima distribuzione fasce tipica C&I (non validato: fasce stimate)
          monthlyData.push({
            month: i,
            year: match[2] ? (match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2])) : new Date().getFullYear(),
            f1: total * 0.45,
            f2: total * 0.25,
            f3: total * 0.30,
            total,
            validated: false // Fasce stimate, non estratte
          });
          foundMonths.add(i);
          break;
        }
      }
    }
  }

  // Ordina per mese
  monthlyData.sort((a, b) => a.month - b.month);

  return monthlyData;
}

/**
 * Estrae info POD e fornitore
 */
function extractMetadata(text: string): { supplier?: string; podCode?: string; contractPower?: number } {
  let supplier: string | undefined;
  let podCode: string | undefined;
  let contractPower: number | undefined;

  // POD code pattern: IT001E12345678
  const podPattern = /(?:POD|punto\s*di\s*prelievo)\s*[:=]?\s*(IT\d{3}E\d{8,})/gi;
  const podMatch = podPattern.exec(text);
  if (podMatch) {
    podCode = podMatch[1];
  }

  // Potenza contrattuale
  const powerPattern = /potenza\s*(?:contrattuale|impegnata|disponibile)\s*[:=]?\s*(\d+[.,]?\d*)\s*(?:kW)?/gi;
  const powerMatch = powerPattern.exec(text);
  if (powerMatch) {
    contractPower = parseItalianNumber(powerMatch[1]);
  }

  // Fornitori comuni
  const suppliers = ["enel", "eni", "edison", "a2a", "iren", "hera", "acea", "sorgenia", "illumia", "plenitude"];
  const textLower = text.toLowerCase();
  for (const s of suppliers) {
    if (textLower.includes(s)) {
      supplier = s.charAt(0).toUpperCase() + s.slice(1);
      break;
    }
  }

  return { supplier, podCode, contractPower };
}

/**
 * Parsa un numero in formato italiano (1.234,56 -> 1234.56)
 */
function parseItalianNumber(str: string): number {
  if (!str) return 0;
  // Rimuovi spazi
  str = str.trim();
  // Se contiene sia punto che virgola, il punto è separatore migliaia
  if (str.includes(".") && str.includes(",")) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (str.includes(",")) {
    // Solo virgola: è decimale
    str = str.replace(",", ".");
  } else if (str.includes(".")) {
    // Solo punto, nessuna virgola: verifica se è separatore migliaia italiano
    // In formato italiano: "1.234", "12.345", "1.234.567"
    // Tutti i gruppi dopo il punto devono essere esattamente 3 cifre
    const parts = str.split(".");
    const allGroupsAreThreeDigits = parts.slice(1).every(p => /^\d{3}$/.test(p));
    if (allGroupsAreThreeDigits && parts.length >= 2) {
      // Punto usato come separatore migliaia: rimuovi tutti i punti
      str = parts.join("");
    }
    // Altrimenti è un decimale inglese (es. "0.5"), lascia com'è
  }

  const value = parseFloat(str);
  return isNaN(value) ? 0 : value;
}

// ===== Nuove funzioni estrazione avanzata =====

/**
 * Estrae la ragione sociale del cliente
 */
function extractCompanyData(text: string): { ragioneSociale?: string } {
  let ragioneSociale: string | undefined;

  // Pattern comuni per ragione sociale
  const patterns = [
    /(?:ragione\s*sociale|intestatario|cliente|spett\.?le?)\s*[:=]?\s*([A-Z][A-Za-z0-9\s&.,'-]{3,50})/gi,
    /(?:fattura\s*(?:a|intestata\s*a))\s*[:=]?\s*([A-Z][A-Za-z0-9\s&.,'-]{3,50})/gi,
    // Pattern per società: S.R.L., S.P.A., etc.
    /([A-Z][A-Za-z0-9\s&.,'-]{2,40}\s*(?:S\.?R\.?L\.?|S\.?P\.?A\.?|S\.?N\.?C\.?|S\.?A\.?S\.?))/gi,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      const candidate = match[1].trim();
      // Filtra valori troppo corti o che sembrano codici
      if (candidate.length > 5 && !/^\d+$/.test(candidate)) {
        ragioneSociale = candidate;
        break;
      }
    }
  }

  return { ragioneSociale };
}

/**
 * Estrae i dati di potenza contrattuale (impegnata e disponibile)
 */
function extractPowerData(text: string): {
  potenzaImpegnata?: number;
  potenzaDisponibile?: number;
} {
  let potenzaImpegnata: number | undefined;
  let potenzaDisponibile: number | undefined;

  // Pattern per potenza impegnata
  const impegnataPatterns = [
    /potenza\s*impegnata\s*[:=]?\s*(\d+[.,]?\d*)\s*(?:kW)?/gi,
    /p\.?\s*impegnata\s*[:=]?\s*(\d+[.,]?\d*)\s*(?:kW)?/gi,
    /impegnata\s*[:=]?\s*(\d+[.,]?\d*)\s*kW/gi,
  ];

  for (const pattern of impegnataPatterns) {
    const match = pattern.exec(text);
    if (match) {
      const value = parseItalianNumber(match[1]);
      if (value > 0 && value < 10000) {
        potenzaImpegnata = value;
        break;
      }
    }
  }

  // Pattern per potenza disponibile
  const disponibilePatterns = [
    /potenza\s*disponibile\s*[:=]?\s*(\d+[.,]?\d*)\s*(?:kW)?/gi,
    /p\.?\s*disponibile\s*[:=]?\s*(\d+[.,]?\d*)\s*(?:kW)?/gi,
    /disponibile\s*[:=]?\s*(\d+[.,]?\d*)\s*kW/gi,
  ];

  for (const pattern of disponibilePatterns) {
    const match = pattern.exec(text);
    if (match) {
      const value = parseItalianNumber(match[1]);
      if (value > 0 && value < 10000) {
        potenzaDisponibile = value;
        break;
      }
    }
  }

  return { potenzaImpegnata, potenzaDisponibile };
}

/**
 * Estrae la potenza massima mensile dallo storico
 * Fondamentale per valutazione infrastruttura ricarica EV (Dynamic Load Management)
 */
function extractMonthlyMaxPower(text: string, monthAbbr: string[]): Map<string, number> {
  const maxPowerMap = new Map<string, number>();

  // Cerca sezione potenza massima
  const sections = [
    /(?:POTENZA\s*MAX|POTENZA\s*MASSIMA|P\.?\s*MAX|PICCO)[^]*?(?=F1|F2|F3|TOTALE|$)/gi,
    /(?:potenza\s*massima\s*prelevata)[^]*?(?=energia|consumo|$)/gi,
  ];

  for (const sectionPattern of sections) {
    const sectionMatch = sectionPattern.exec(text);
    if (sectionMatch) {
      const sectionText = sectionMatch[0];

      // Estrai valori numerici dalla riga
      const numbers = sectionText.match(/\d+[.,]?\d*/g) || [];

      // Cerca intestazioni mesi nella sezione precedente
      const monthsPattern = new RegExp(`(${monthAbbr.join('|')})\\s*(\\d{2})`, 'gi');
      let monthMatch;
      let monthIndex = 0;

      // Reset pattern per nuova ricerca
      monthsPattern.lastIndex = 0;
      const fullText = text;

      while ((monthMatch = monthsPattern.exec(fullText)) !== null && monthIndex < numbers.length) {
        const monthName = monthMatch[1].toLowerCase();
        const monthIdx = monthAbbr.findIndex(m => m.toLowerCase() === monthName);
        const year = 2000 + parseInt(monthMatch[2]);

        if (monthIdx >= 0 && numbers[monthIndex]) {
          const power = parseItalianThousands(numbers[monthIndex]);
          if (power > 0 && power < 10000) {
            const key = `${year}-${monthIdx}`;
            maxPowerMap.set(key, power);
          }
        }
        monthIndex++;
      }
    }
  }

  // Pattern alternativo: cerca righe con "Potenza Max" o "P. Max" seguite da valori
  if (maxPowerMap.size === 0) {
    const rowPattern = /(?:potenza\s*max|p\.?\s*max|picco)\s*(?:kW)?\s*[:=]?\s*([\d.,\s]+)/gi;
    let rowMatch;

    while ((rowMatch = rowPattern.exec(text)) !== null) {
      const numbersStr = rowMatch[1];
      const numbers = numbersStr.match(/\d+[.,]?\d*/g) || [];

      // Associa ai mesi se possibile
      numbers.forEach((num, idx) => {
        const power = parseItalianThousands(num);
        if (power > 0 && power < 10000) {
          // Usa indice come fallback
          maxPowerMap.set(`unknown-${idx}`, power);
        }
      });
    }
  }

  return maxPowerMap;
}

/**
 * Estrae i dati economici dalla bolletta
 */
function extractEconomicData(text: string): {
  prezzoMedio?: number;
  costiUnitari?: {
    pun?: number;
    spread?: number;
    perditeRete?: number;
    dispaccamento?: number;
    oneriSistema?: number;
    trasporto?: number;
  };
} {
  let prezzoMedio: number | undefined;
  const costiUnitari: {
    pun?: number;
    spread?: number;
    perditeRete?: number;
    dispaccamento?: number;
    oneriSistema?: number;
    trasporto?: number;
  } = {};

  // Prezzo medio (€/kWh)
  const prezzoMedioPatterns = [
    /prezzo\s*medio\s*[:=]?\s*(\d+[.,]\d+)\s*(?:€|EUR)?(?:\/kWh)?/gi,
    /costo\s*medio\s*(?:energia)?\s*[:=]?\s*(\d+[.,]\d+)\s*(?:€|EUR)?(?:\/kWh)?/gi,
    /(?:€|EUR)\s*(\d+[.,]\d+)\s*(?:\/kWh|per\s*kWh)/gi,
  ];

  for (const pattern of prezzoMedioPatterns) {
    const match = pattern.exec(text);
    if (match) {
      const value = parseItalianNumber(match[1]);
      // Prezzo ragionevole: 0.05 - 1.00 €/kWh
      if (value > 0.05 && value < 1.0) {
        prezzoMedio = value;
        break;
      }
    }
  }

  // PUN (Prezzo Unico Nazionale)
  const punPatterns = [
    /PUN\s*[:=]?\s*(\d+[.,]\d+)\s*(?:€|EUR)?(?:\/kWh)?/gi,
    /prezzo\s*unico\s*nazionale\s*[:=]?\s*(\d+[.,]\d+)/gi,
  ];

  for (const pattern of punPatterns) {
    const match = pattern.exec(text);
    if (match) {
      const value = parseItalianNumber(match[1]);
      if (value > 0.01 && value < 1.0) {
        costiUnitari.pun = value;
        break;
      }
    }
  }

  // Spread/Fee fornitore
  const spreadPatterns = [
    /(?:spread|fee|margine)\s*[:=]?\s*(\d+[.,]\d+)\s*(?:€|EUR)?(?:\/kWh)?/gi,
    /componente\s*(?:fornitore|commerciale)\s*[:=]?\s*(\d+[.,]\d+)/gi,
  ];

  for (const pattern of spreadPatterns) {
    const match = pattern.exec(text);
    if (match) {
      const value = parseItalianNumber(match[1]);
      if (value > 0 && value < 0.5) {
        costiUnitari.spread = value;
        break;
      }
    }
  }

  // Perdite di rete (%)
  const perditePatterns = [
    /perdite\s*(?:di\s*)?rete\s*[:=]?\s*(\d+[.,]?\d*)\s*%?/gi,
    /fattore\s*perdite\s*[:=]?\s*(\d+[.,]?\d*)\s*%?/gi,
  ];

  for (const pattern of perditePatterns) {
    const match = pattern.exec(text);
    if (match) {
      const value = parseItalianNumber(match[1]);
      // Perdite tipiche: 2-15%
      if (value > 0 && value < 20) {
        costiUnitari.perditeRete = value;
        break;
      }
    }
  }

  // Dispacciamento
  const dispPatterns = [
    /dispacciamento\s*[:=]?\s*(\d+[.,]\d+)\s*(?:€|EUR)?(?:\/kWh)?/gi,
    /oneri\s*dispacciamento\s*[:=]?\s*(\d+[.,]\d+)/gi,
  ];

  for (const pattern of dispPatterns) {
    const match = pattern.exec(text);
    if (match) {
      const value = parseItalianNumber(match[1]);
      if (value > 0 && value < 0.2) {
        costiUnitari.dispaccamento = value;
        break;
      }
    }
  }

  // Oneri di sistema
  const oneriPatterns = [
    /oneri\s*(?:di\s*)?sistema\s*[:=]?\s*(\d+[.,]\d+)\s*(?:€|EUR)?(?:\/kWh)?/gi,
  ];

  for (const pattern of oneriPatterns) {
    const match = pattern.exec(text);
    if (match) {
      const value = parseItalianNumber(match[1]);
      if (value > 0 && value < 0.3) {
        costiUnitari.oneriSistema = value;
        break;
      }
    }
  }

  // Trasporto
  const trasportoPatterns = [
    /(?:trasporto|distribuzione)\s*[:=]?\s*(\d+[.,]\d+)\s*(?:€|EUR)?(?:\/kWh)?/gi,
  ];

  for (const pattern of trasportoPatterns) {
    const match = pattern.exec(text);
    if (match) {
      const value = parseItalianNumber(match[1]);
      if (value > 0 && value < 0.2) {
        costiUnitari.trasporto = value;
        break;
      }
    }
  }

  return {
    prezzoMedio,
    costiUnitari: Object.keys(costiUnitari).length > 0 ? costiUnitari : undefined
  };
}

/**
 * Valida i dati di consumo mensile (F1 + F2 + F3 = Total)
 * Tolleranza: 2% per errori di arrotondamento
 */
function validateMonthlyConsumption(data: MonthlyConsumption[]): MonthlyConsumption[] {
  const TOLERANCE = 0.02; // 2%

  return data.map(month => {
    const calculatedTotal = month.f1 + month.f2 + month.f3;
    const expectedTotal = month.total;

    // Se total era 0 (non estratto), usa il calcolato
    if (expectedTotal === 0 || expectedTotal === calculatedTotal) {
      return {
        ...month,
        total: calculatedTotal,
        validated: true,
        validationDelta: 0
      };
    }

    // Calcola differenza percentuale
    const delta = Math.abs(calculatedTotal - expectedTotal) / expectedTotal;
    const validated = delta <= TOLERANCE;

    return {
      ...month,
      validated,
      validationDelta: delta * 100 // Percentuale
    };
  });
}

/**
 * Calcola la qualità complessiva dei dati estratti
 */
function calculateDataQuality(
  monthlyData: MonthlyConsumption[],
  hasMaxPower: boolean,
  hasPricing: boolean,
  f1: number,
  f2: number,
  f3: number,
  total: number
): DataQualityInfo {
  const errors: string[] = [];
  let confidence = 0;

  // Verifica dati mensili
  const validatedMonths = monthlyData.filter(m => m.validated).length;
  const monthsExtracted = monthlyData.length;

  if (monthsExtracted >= 12) {
    confidence += 40;
  } else if (monthsExtracted >= 6) {
    confidence += 25;
  } else if (monthsExtracted > 0) {
    confidence += 10;
  }

  // Verifica validazione incrociata
  const allValidated = monthlyData.length > 0 && validatedMonths === monthlyData.length;
  if (allValidated) {
    confidence += 20;
  } else if (validatedMonths > 0) {
    confidence += 10;
    errors.push(`${monthlyData.length - validatedMonths} mesi con discrepanza F1+F2+F3 ≠ Total`);
  }

  // Verifica dati fasce periodo
  if (f1 + f2 + f3 > 0) {
    const calculatedTotal = f1 + f2 + f3;
    if (total > 0) {
      const delta = Math.abs(calculatedTotal - total) / total;
      if (delta <= 0.02) {
        confidence += 15;
      } else {
        errors.push(`Discrepanza fasce periodo: ${(delta * 100).toFixed(1)}%`);
      }
    } else {
      confidence += 10;
    }
  }

  // Bonus per dati aggiuntivi
  if (hasMaxPower) {
    confidence += 15;
  }
  if (hasPricing) {
    confidence += 10;
  }

  // Cap a 100
  confidence = Math.min(100, confidence);

  return {
    consumptionValidated: allValidated,
    monthsExtracted,
    hasMaxPower,
    hasPricing,
    validationErrors: errors,
    confidence
  };
}

// ===== Generazione profilo orario =====

/**
 * Genera un profilo orario annuale (8760 valori) basato sui dati della bolletta
 */
function generateHourlyProfileFromBill(billData: BillData): number[] {
  const profile: number[] = new Array(HOURS_PER_YEAR).fill(0);

  // Se abbiamo dati mensili dettagliati, usiamo quelli
  if (billData.monthlyConsumption.length > 0) {
    return generateFromMonthlyData(billData.monthlyConsumption);
  }

  // Altrimenti distribuiamo i consumi per fascia su tutto l'anno
  return generateFromBandData(billData);
}

/**
 * Genera profilo da dati mensili dettagliati (storico bollette)
 * Interpola i mesi mancanti usando la media dei dati disponibili e fattori stagionali
 */
function generateFromMonthlyData(monthlyData: MonthlyConsumption[]): number[] {
  const profile: number[] = new Array(HOURS_PER_YEAR).fill(0);
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Mappa mesi disponibili
  const monthMap = new Map<number, MonthlyConsumption>();
  for (const m of monthlyData) {
    monthMap.set(m.month, m);
  }

  // Calcola media mensile dai dati disponibili
  let avgF1 = 0, avgF2 = 0, avgF3 = 0;
  if (monthlyData.length > 0) {
    avgF1 = monthlyData.reduce((sum, m) => sum + m.f1, 0) / monthlyData.length;
    avgF2 = monthlyData.reduce((sum, m) => sum + m.f2, 0) / monthlyData.length;
    avgF3 = monthlyData.reduce((sum, m) => sum + m.f3, 0) / monthlyData.length;
  }

  // Per ogni mese
  let hourIndex = 0;
  for (let month = 0; month < 12; month++) {
    const days = daysPerMonth[month];
    const monthData = monthMap.get(month);
    const seasonalFactor = SEASONAL_FACTORS[month];

    // Se abbiamo dati per questo mese, usali; altrimenti interpola dalla media
    let f1Total: number, f2Total: number, f3Total: number;

    if (monthData) {
      f1Total = monthData.f1;
      f2Total = monthData.f2;
      f3Total = monthData.f3;
    } else {
      // Interpola usando la media e il fattore stagionale
      f1Total = avgF1 * seasonalFactor;
      f2Total = avgF2 * seasonalFactor;
      f3Total = avgF3 * seasonalFactor;
    }

    // Calcola primo giorno del mese (2024 come anno di riferimento)
    const firstDay = new Date(2024, month, 1).getDay(); // 0 = domenica

    // Conta giorni feriali, sabati e domeniche nel mese
    let weekdays = 0, saturdays = 0, sundays = 0;
    for (let d = 0; d < days; d++) {
      const dow = (firstDay + d) % 7;
      if (dow === 0) sundays++;
      else if (dow === 6) saturdays++;
      else weekdays++;
    }

    // Calcola ore totali per fascia nel mese
    const f1Hours = weekdays * 11; // 8-19 feriali
    const f2Hours = weekdays * 5 + saturdays * 16; // 7-8, 19-23 feriali + 7-23 sabato
    const f3Hours = weekdays * 8 + saturdays * 8 + sundays * 24; // notte + domenica

    // kWh per ora per fascia
    const kwhPerF1Hour = f1Hours > 0 ? f1Total / f1Hours : 0;
    const kwhPerF2Hour = f2Hours > 0 ? f2Total / f2Hours : 0;
    const kwhPerF3Hour = f3Hours > 0 ? f3Total / f3Hours : 0;

    for (let day = 0; day < days; day++) {
      const dayOfWeek = (firstDay + day) % 7;
      const isSaturday = dayOfWeek === 6;
      const isSunday = dayOfWeek === 0;

      let distribution: number[];
      if (isSunday) distribution = HOURLY_DISTRIBUTION.sunday;
      else if (isSaturday) distribution = HOURLY_DISTRIBUTION.saturday;
      else distribution = HOURLY_DISTRIBUTION.weekday;

      const distSum = distribution.reduce((a, b) => a + b, 0);

      for (let hour = 0; hour < 24; hour++) {
        let baseKwh = 0;

        if (isSunday) {
          baseKwh = kwhPerF3Hour;
        } else if (isSaturday) {
          if (hour >= 7 && hour < 23) baseKwh = kwhPerF2Hour;
          else baseKwh = kwhPerF3Hour;
        } else {
          if (hour >= 8 && hour < 19) baseKwh = kwhPerF1Hour;
          else if ((hour >= 7 && hour < 8) || (hour >= 19 && hour < 23)) baseKwh = kwhPerF2Hour;
          else baseKwh = kwhPerF3Hour;
        }

        // Applica distribuzione oraria
        const hourlyFactor = (distribution[hour] / distSum) * 24;
        profile[hourIndex] = Math.max(0, baseKwh * hourlyFactor);
        hourIndex++;
      }
    }
  }

  return profile;
}

/**
 * Genera profilo da dati per fascia (annuali o del periodo bolletta)
 */
function generateFromBandData(billData: BillData): number[] {
  const profile: number[] = new Array(HOURS_PER_YEAR).fill(0);
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  // Annualizza i consumi se la bolletta copre meno di 12 mesi
  const annualizationFactor = 12 / billData.billingMonths;
  const f1Annual = billData.f1 * annualizationFactor;
  const f2Annual = billData.f2 * annualizationFactor;
  const f3Annual = billData.f3 * annualizationFactor;

  // Conta ore per fascia nell'anno
  let totalF1Hours = 0, totalF2Hours = 0, totalF3Hours = 0;

  let hourIndex = 0;
  for (let month = 0; month < 12; month++) {
    const days = daysPerMonth[month];
    const firstDay = new Date(2024, month, 1).getDay();

    for (let day = 0; day < days; day++) {
      const dayOfWeek = (firstDay + day) % 7;
      const isSaturday = dayOfWeek === 6;
      const isSunday = dayOfWeek === 0;

      for (let hour = 0; hour < 24; hour++) {
        if (isSunday) {
          totalF3Hours++;
        } else if (isSaturday) {
          if (hour >= 7 && hour < 23) totalF2Hours++;
          else totalF3Hours++;
        } else {
          if (hour >= 8 && hour < 19) totalF1Hours++;
          else if ((hour >= 7 && hour < 8) || (hour >= 19 && hour < 23)) totalF2Hours++;
          else totalF3Hours++;
        }
        hourIndex++;
      }
    }
  }

  // Calcola kWh medi per ora per fascia
  const kwhPerF1Hour = f1Annual / totalF1Hours;
  const kwhPerF2Hour = f2Annual / totalF2Hours;
  const kwhPerF3Hour = f3Annual / totalF3Hours;

  // Genera profilo
  hourIndex = 0;
  for (let month = 0; month < 12; month++) {
    const days = daysPerMonth[month];
    const seasonalFactor = SEASONAL_FACTORS[month];
    const firstDay = new Date(2024, month, 1).getDay();

    for (let day = 0; day < days; day++) {
      const dayOfWeek = (firstDay + day) % 7;
      const isSaturday = dayOfWeek === 6;
      const isSunday = dayOfWeek === 0;

      let distribution: number[];
      if (isSunday) distribution = HOURLY_DISTRIBUTION.sunday;
      else if (isSaturday) distribution = HOURLY_DISTRIBUTION.saturday;
      else distribution = HOURLY_DISTRIBUTION.weekday;

      // Normalizza distribuzione
      const distSum = distribution.reduce((a, b) => a + b, 0);

      for (let hour = 0; hour < 24; hour++) {
        let baseKwh = 0;

        if (isSunday) {
          baseKwh = kwhPerF3Hour;
        } else if (isSaturday) {
          if (hour >= 7 && hour < 23) baseKwh = kwhPerF2Hour;
          else baseKwh = kwhPerF3Hour;
        } else {
          if (hour >= 8 && hour < 19) baseKwh = kwhPerF1Hour;
          else if ((hour >= 7 && hour < 8) || (hour >= 19 && hour < 23)) baseKwh = kwhPerF2Hour;
          else baseKwh = kwhPerF3Hour;
        }

        // Applica fattore stagionale e distribuzione oraria
        const hourlyFactor = (distribution[hour] / distSum) * 24;
        profile[hourIndex] = Math.max(0, baseKwh * seasonalFactor * hourlyFactor);
        hourIndex++;
      }
    }
  }

  return profile;
}

// ===== Funzioni pubbliche =====

/**
 * Parsa una bolletta PDF e restituisce il profilo orario annuale
 */
export async function parsePDFData(file: File): Promise<number[]> {
  const text = await extractTextFromPDF(file);

  // Prima prova a estrarre come bolletta italiana
  const billData = extractBillData(text);

  if (billData.totalConsumption > 0 || (billData.f1 + billData.f2 + billData.f3) > 0) {
    // Calcola totale se non trovato direttamente
    if (billData.totalConsumption === 0) {
      billData.totalConsumption = billData.f1 + billData.f2 + billData.f3;
    }

    // Se mancano le fasce ma c'è il totale, stima le fasce
    if (billData.f1 === 0 && billData.f2 === 0 && billData.f3 === 0 && billData.totalConsumption > 0) {
      // Distribuzione tipica C&I
      billData.f1 = billData.totalConsumption * 0.45;
      billData.f2 = billData.totalConsumption * 0.25;
      billData.f3 = billData.totalConsumption * 0.30;
    }

    return generateHourlyProfileFromBill(billData);
  }

  // Fallback ai metodi precedenti se non è una bolletta
  let data = tryExtractHourlyData(text);
  if (data.length > 0) return normalizeData(data);

  data = tryExtractDailyData(text);
  if (data.length > 0) return expandDailyToHourly(data);

  data = tryExtractMonthlyDataLegacy(text);
  if (data.length > 0) return expandMonthlyToHourly(data);

  data = tryExtractGenericNumbers(text);
  if (data.length > 0) return normalizeData(data);

  throw new Error(
    "Impossibile estrarre dati di consumo dal PDF. Formato non riconosciuto."
  );
}

/**
 * Estrae tutti i dati della bolletta con validazione completa
 */
export function extractBillData(text: string): BillData {
  const monthNames = ["gen", "feb", "mar", "apr", "mag", "giu",
                      "lug", "ago", "set", "ott", "nov", "dic"];

  // Estrazione dati base dal periodo fatturato
  const extractedBands = extractBandConsumption(text);
  const totalConsumption = extractTotalConsumption(text);
  const { startDate, endDate, months } = extractBillingPeriod(text);
  const { supplier, podCode, contractPower } = extractMetadata(text);

  // Nuove estrazioni avanzate
  const { ragioneSociale } = extractCompanyData(text);
  const { potenzaImpegnata, potenzaDisponibile } = extractPowerData(text);
  const { prezzoMedio, costiUnitari } = extractEconomicData(text);

  // Estrazione mensile con formato Sorgenia (include TOTALE e P.MAX)
  const sorgeniaResult = extractSorgeniaFormatFull(text, monthNames);
  let monthlyConsumption: MonthlyConsumption[];

  if (sorgeniaResult.monthlyData.length >= 6) {
    // Usa dati Sorgenia già validati
    monthlyConsumption = sorgeniaResult.monthlyData;
  } else {
    // Fallback al metodo tradizionale con validazione
    const rawMonthly = extractMonthlyBreakdown(text);
    monthlyConsumption = validateMonthlyConsumption(rawMonthly);
  }

  // Estrai potenza massima mensile se non già presente nei dati Sorgenia
  const maxPowerMap = extractMonthlyMaxPower(text, monthNames);
  if (maxPowerMap.size > 0) {
    monthlyConsumption = monthlyConsumption.map(m => {
      const key = `${m.year}-${m.month}`;
      const maxPower = maxPowerMap.get(key);
      return maxPower ? { ...m, maxPower } : m;
    });
  }

  // ===== AGGREGAZIONE E ANNUALIZZAZIONE DATI =====
  // Calcola F1/F2/F3 come SOMMA di tutti i mesi estratti
  // Se lo storico copre meno di 12 mesi, annualizza proporzionalmente
  let f1: number, f2: number, f3: number;
  const monthsCount = monthlyConsumption.length;

  console.log('[PDFParser] extractBillData - Mesi estratti:', monthsCount);
  console.log('[PDFParser] extractBillData - monthlyConsumption:', monthlyConsumption);

  if (monthsCount >= 3) {
    // SOMMA tutti i valori mensili per ottenere il totale del periodo
    const rawF1 = monthlyConsumption.reduce((sum, m) => sum + m.f1, 0);
    const rawF2 = monthlyConsumption.reduce((sum, m) => sum + m.f2, 0);
    const rawF3 = monthlyConsumption.reduce((sum, m) => sum + m.f3, 0);

    console.log('[PDFParser] Somma grezza - F1:', rawF1, 'F2:', rawF2, 'F3:', rawF3, 'Totale:', rawF1 + rawF2 + rawF3);

    // Annualizza se necessario (proietta su 12 mesi)
    if (monthsCount < 12) {
      const annualizationFactor = 12 / monthsCount;
      f1 = Math.round(rawF1 * annualizationFactor);
      f2 = Math.round(rawF2 * annualizationFactor);
      f3 = Math.round(rawF3 * annualizationFactor);
      console.log('[PDFParser] Annualizzato (x', annualizationFactor.toFixed(2), ') - F1:', f1, 'F2:', f2, 'F3:', f3);
    } else {
      // Se >= 12 mesi, prendi gli ultimi 12 mesi per il totale annuale
      const last12Months = monthlyConsumption.slice(-12);
      f1 = last12Months.reduce((sum, m) => sum + m.f1, 0);
      f2 = last12Months.reduce((sum, m) => sum + m.f2, 0);
      f3 = last12Months.reduce((sum, m) => sum + m.f3, 0);
      console.log('[PDFParser] Ultimi 12 mesi - F1:', f1, 'F2:', f2, 'F3:', f3);
    }
  } else {
    // Usa i valori estratti dal periodo fatturato
    f1 = extractedBands.f1;
    f2 = extractedBands.f2;
    f3 = extractedBands.f3;
    console.log('[PDFParser] Usando valori periodo fatturato - F1:', f1, 'F2:', f2, 'F3:', f3);
  }

  console.log('[PDFParser] RISULTATO FINALE - F1:', f1, 'F2:', f2, 'F3:', f3, 'Totale Annuale:', f1 + f2 + f3);

  // Calcola il consumo totale annuale
  const aggregatedTotal = f1 + f2 + f3;
  // Usa il totale aggregato se disponibile, altrimenti quello estratto
  const finalTotal = aggregatedTotal > 0 ? aggregatedTotal : (totalConsumption || 0);

  // Calcola qualità dati
  const hasMaxPower = monthlyConsumption.some(m => m.maxPower !== undefined);
  const hasPricing = prezzoMedio !== undefined || costiUnitari !== undefined;

  const dataQuality = calculateDataQuality(
    monthlyConsumption,
    hasMaxPower,
    hasPricing,
    f1,
    f2,
    f3,
    finalTotal
  );

  return {
    // Dati cliente
    ragioneSociale,
    podCode,
    supplier,

    // Potenze
    potenzaImpegnata,
    potenzaDisponibile,
    contractPower: contractPower || potenzaImpegnata,

    // Consumi per fascia (aggregati dallo storico mensile)
    f1,
    f2,
    f3,
    totalConsumption: finalTotal,

    // Periodo
    startDate,
    endDate,
    billingMonths: months,

    // Storico mensile
    monthlyConsumption,

    // Economici
    prezzoMedio,
    costiUnitari,

    // Qualità
    dataQuality
  };
}

/**
 * Analizza un PDF e restituisce informazioni dettagliate
 */
export async function analyzePDF(file: File): Promise<PDFInfo> {
  const pdfjsLib = await loadPdfJs();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const text = await extractTextFromPDF(file);

  // Prova prima estrazione bolletta
  const billData = extractBillData(text);

  // Log il testo grezzo per debug
  console.log('[PDFParser] ===== TESTO GREZZO PDF =====');
  console.log(text.substring(0, 5000)); // Primi 5000 caratteri
  console.log('[PDFParser] ===== FINE TESTO GREZZO =====');

  if (billData.totalConsumption > 0 || (billData.f1 + billData.f2 + billData.f3) > 0) {
    return {
      fileName: file.name,
      pageCount: pdf.numPages,
      extractedValues: 3, // F1, F2, F3
      dataType: "bill",
      sampleValues: [billData.f1, billData.f2, billData.f3, billData.totalConsumption],
      billData,
      rawText: text.substring(0, 10000) // Primi 10000 caratteri per debug
    };
  }

  // Fallback
  let dataType: PDFInfo["dataType"] = "generic";
  let extractedValues: number[] = [];

  extractedValues = tryExtractHourlyData(text);
  if (extractedValues.length > 100) {
    dataType = "hourly";
  } else {
    extractedValues = tryExtractDailyData(text);
    if (extractedValues.length > 10) {
      dataType = "daily";
    } else {
      extractedValues = tryExtractMonthlyDataLegacy(text);
      if (extractedValues.length > 0) {
        dataType = "monthly";
      } else {
        extractedValues = tryExtractGenericNumbers(text);
      }
    }
  }

  return {
    fileName: file.name,
    pageCount: pdf.numPages,
    extractedValues: extractedValues.length,
    dataType,
    sampleValues: extractedValues.slice(0, 10),
    rawText: text.substring(0, 10000) // Primi 10000 caratteri per debug
  };
}

// ===== Funzioni legacy per compatibilità =====

function tryExtractHourlyData(text: string): number[] {
  const data: number[] = [];
  const hourlyPattern = /(\d{1,2}[:.]\d{2})\s*[-:;,]\s*(\d+[.,]?\d*)\s*(?:kW|kWh)?/gi;
  let match;

  while ((match = hourlyPattern.exec(text)) !== null) {
    const value = parseItalianNumber(match[2]);
    if (value > 0 && value < 10000) {
      data.push(value);
    }
  }

  return data;
}

function tryExtractDailyData(text: string): number[] {
  const data: number[] = [];
  const dailyPattern = /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s*[-:;,]?\s*(\d+[.,]?\d*)\s*(?:kWh)?/gi;
  let match;

  while ((match = dailyPattern.exec(text)) !== null) {
    const value = parseItalianNumber(match[2]);
    if (value > 0 && value < 100000) {
      data.push(value);
    }
  }

  return data;
}

function tryExtractMonthlyDataLegacy(text: string): number[] {
  const data: number[] = [];
  const months = [
    "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
    "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
    "gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic",
  ];

  const monthPattern = new RegExp(
    `(${months.join("|")})\\s*[-:;,]?\\s*(\\d+[.,]?\\d*)\\s*(?:kWh)?`,
    "gi"
  );
  let match;

  while ((match = monthPattern.exec(text)) !== null) {
    const value = parseItalianNumber(match[2]);
    if (value > 0 && value < 1000000) {
      data.push(value);
    }
  }

  return data;
}

function tryExtractGenericNumbers(text: string): number[] {
  const data: number[] = [];
  const pattern = /(\d+[.,]?\d*)\s*(?:kW|kWh)/gi;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const value = parseItalianNumber(match[1]);
    if (value > 0 && value < 1000000) {
      data.push(value);
    }
  }

  return data;
}

function normalizeData(data: number[]): number[] {
  if (data.length === 0) return new Array(HOURS_PER_YEAR).fill(0);
  if (data.length === HOURS_PER_YEAR) return data;

  const result: number[] = [];
  for (let i = 0; i < HOURS_PER_YEAR; i++) {
    result.push(data[i % data.length]);
  }

  return result;
}

function expandDailyToHourly(dailyData: number[]): number[] {
  const hourlyData: number[] = [];
  const hourlyFactors = [
    0.02, 0.02, 0.02, 0.02, 0.02, 0.03, 0.04, 0.06, 0.08, 0.08, 0.08, 0.08,
    0.07, 0.08, 0.08, 0.07, 0.06, 0.04, 0.03, 0.02, 0.02, 0.02, 0.02, 0.02,
  ];

  for (const dailyValue of dailyData) {
    for (let hour = 0; hour < 24; hour++) {
      hourlyData.push(dailyValue * hourlyFactors[hour]);
    }
  }

  return normalizeData(hourlyData);
}

function expandMonthlyToHourly(monthlyData: number[]): number[] {
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const hourlyData: number[] = [];
  const hourlyFactors = [
    0.02, 0.02, 0.02, 0.02, 0.02, 0.03, 0.04, 0.06, 0.08, 0.08, 0.08, 0.08,
    0.07, 0.08, 0.08, 0.07, 0.06, 0.04, 0.03, 0.02, 0.02, 0.02, 0.02, 0.02,
  ];

  for (let month = 0; month < 12; month++) {
    const monthValue = monthlyData[month % monthlyData.length] || 0;
    const days = daysPerMonth[month];
    const dailyAvg = monthValue / days;

    for (let day = 0; day < days; day++) {
      for (let hour = 0; hour < 24; hour++) {
        hourlyData.push(dailyAvg * hourlyFactors[hour]);
      }
    }
  }

  return hourlyData;
}

/**
 * Genera un profilo orario da dati BillDataInfo confermati dall'utente.
 * Usato dopo la conferma del modal LLM.
 */
export function generateProfileFromBillDataInfo(info: {
  f1: number;
  f2: number;
  f3: number;
  totalConsumption?: number;
  billingMonths: number;
  prezzoMedio?: number;
}): number[] {
  const billData: BillData = {
    f1: info.f1,
    f2: info.f2,
    f3: info.f3,
    totalConsumption: info.totalConsumption || (info.f1 + info.f2 + info.f3),
    billingMonths: info.billingMonths,
    monthlyConsumption: [],
    dataQuality: {
      consumptionValidated: true,
      monthsExtracted: 0,
      hasMaxPower: false,
      hasPricing: !!info.prezzoMedio,
      validationErrors: [],
      confidence: 90,
    },
  };
  return generateHourlyProfileFromBill(billData);
}
