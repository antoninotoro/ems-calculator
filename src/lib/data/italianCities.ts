// ============================================
// Italian Cities - Latitude & PV Equivalent Hours
// ============================================

export const DEFAULT_LATITUDE = 42;
export const DEFAULT_EQUIVALENT_HOURS = 1200;

interface CityData {
  lat: number;
  equivalentHours: number;
}

// Capoluoghi di provincia + citta principali
// Ore equivalenti basate su dati PVGIS per impianto ottimale (inclinazione e orientamento ottimali)
const italianCitiesMap: Record<string, CityData> = {
  // --- Piemonte ---
  "torino": { lat: 45.07, equivalentHours: 1100 },
  "alessandria": { lat: 44.91, equivalentHours: 1100 },
  "asti": { lat: 44.90, equivalentHours: 1100 },
  "biella": { lat: 45.56, equivalentHours: 1050 },
  "cuneo": { lat: 44.39, equivalentHours: 1100 },
  "novara": { lat: 45.45, equivalentHours: 1100 },
  "verbania": { lat: 45.92, equivalentHours: 1050 },
  "vercelli": { lat: 45.33, equivalentHours: 1100 },

  // --- Valle d'Aosta ---
  "aosta": { lat: 45.74, equivalentHours: 1050 },

  // --- Lombardia ---
  "milano": { lat: 45.46, equivalentHours: 1100 },
  "bergamo": { lat: 45.70, equivalentHours: 1080 },
  "brescia": { lat: 45.54, equivalentHours: 1100 },
  "como": { lat: 45.81, equivalentHours: 1050 },
  "cremona": { lat: 45.13, equivalentHours: 1120 },
  "lecco": { lat: 45.86, equivalentHours: 1050 },
  "lodi": { lat: 45.31, equivalentHours: 1120 },
  "mantova": { lat: 45.16, equivalentHours: 1120 },
  "monza": { lat: 45.58, equivalentHours: 1100 },
  "pavia": { lat: 45.19, equivalentHours: 1120 },
  "sondrio": { lat: 46.17, equivalentHours: 1020 },
  "varese": { lat: 45.82, equivalentHours: 1050 },

  // --- Trentino-Alto Adige ---
  "trento": { lat: 46.07, equivalentHours: 1050 },
  "bolzano": { lat: 46.50, equivalentHours: 1020 },

  // --- Veneto ---
  "venezia": { lat: 45.44, equivalentHours: 1100 },
  "belluno": { lat: 46.14, equivalentHours: 1020 },
  "padova": { lat: 45.41, equivalentHours: 1120 },
  "rovigo": { lat: 45.07, equivalentHours: 1130 },
  "treviso": { lat: 45.67, equivalentHours: 1100 },
  "verona": { lat: 45.44, equivalentHours: 1120 },
  "vicenza": { lat: 45.55, equivalentHours: 1100 },

  // --- Friuli-Venezia Giulia ---
  "trieste": { lat: 45.65, equivalentHours: 1080 },
  "gorizia": { lat: 45.94, equivalentHours: 1060 },
  "pordenone": { lat: 45.96, equivalentHours: 1060 },
  "udine": { lat: 46.07, equivalentHours: 1060 },

  // --- Liguria ---
  "genova": { lat: 44.41, equivalentHours: 1150 },
  "imperia": { lat: 43.89, equivalentHours: 1200 },
  "la spezia": { lat: 44.10, equivalentHours: 1180 },
  "savona": { lat: 44.31, equivalentHours: 1160 },

  // --- Emilia-Romagna ---
  "bologna": { lat: 44.49, equivalentHours: 1150 },
  "ferrara": { lat: 44.84, equivalentHours: 1130 },
  "forli": { lat: 44.22, equivalentHours: 1170 },
  "cesena": { lat: 44.14, equivalentHours: 1180 },
  "modena": { lat: 44.65, equivalentHours: 1140 },
  "parma": { lat: 44.80, equivalentHours: 1130 },
  "piacenza": { lat: 45.05, equivalentHours: 1120 },
  "ravenna": { lat: 44.42, equivalentHours: 1160 },
  "reggio emilia": { lat: 44.70, equivalentHours: 1140 },
  "rimini": { lat: 44.06, equivalentHours: 1180 },

  // --- Toscana ---
  "firenze": { lat: 43.77, equivalentHours: 1220 },
  "arezzo": { lat: 43.46, equivalentHours: 1230 },
  "grosseto": { lat: 42.76, equivalentHours: 1280 },
  "livorno": { lat: 43.55, equivalentHours: 1240 },
  "lucca": { lat: 43.84, equivalentHours: 1210 },
  "massa": { lat: 44.04, equivalentHours: 1190 },
  "pisa": { lat: 43.72, equivalentHours: 1230 },
  "pistoia": { lat: 43.93, equivalentHours: 1210 },
  "prato": { lat: 43.88, equivalentHours: 1220 },
  "siena": { lat: 43.32, equivalentHours: 1240 },

  // --- Umbria ---
  "perugia": { lat: 43.11, equivalentHours: 1250 },
  "terni": { lat: 42.56, equivalentHours: 1270 },

  // --- Marche ---
  "ancona": { lat: 43.62, equivalentHours: 1230 },
  "ascoli piceno": { lat: 42.85, equivalentHours: 1260 },
  "fermo": { lat: 43.16, equivalentHours: 1250 },
  "macerata": { lat: 43.30, equivalentHours: 1240 },
  "pesaro": { lat: 43.91, equivalentHours: 1210 },
  "urbino": { lat: 43.73, equivalentHours: 1220 },

  // --- Lazio ---
  "roma": { lat: 41.90, equivalentHours: 1300 },
  "frosinone": { lat: 41.64, equivalentHours: 1310 },
  "latina": { lat: 41.47, equivalentHours: 1320 },
  "rieti": { lat: 42.40, equivalentHours: 1260 },
  "viterbo": { lat: 42.42, equivalentHours: 1260 },

  // --- Abruzzo ---
  "l'aquila": { lat: 42.35, equivalentHours: 1260 },
  "chieti": { lat: 42.35, equivalentHours: 1270 },
  "pescara": { lat: 42.46, equivalentHours: 1270 },
  "teramo": { lat: 42.66, equivalentHours: 1260 },

  // --- Molise ---
  "campobasso": { lat: 41.56, equivalentHours: 1320 },
  "isernia": { lat: 41.59, equivalentHours: 1310 },

  // --- Campania ---
  "napoli": { lat: 40.85, equivalentHours: 1370 },
  "avellino": { lat: 40.91, equivalentHours: 1350 },
  "benevento": { lat: 41.13, equivalentHours: 1340 },
  "caserta": { lat: 41.07, equivalentHours: 1350 },
  "salerno": { lat: 40.68, equivalentHours: 1380 },

  // --- Puglia ---
  "bari": { lat: 41.13, equivalentHours: 1400 },
  "barletta": { lat: 41.32, equivalentHours: 1390 },
  "brindisi": { lat: 40.63, equivalentHours: 1420 },
  "foggia": { lat: 41.46, equivalentHours: 1380 },
  "lecce": { lat: 40.35, equivalentHours: 1430 },
  "taranto": { lat: 40.48, equivalentHours: 1420 },

  // --- Basilicata ---
  "potenza": { lat: 40.64, equivalentHours: 1370 },
  "matera": { lat: 40.67, equivalentHours: 1390 },

  // --- Calabria ---
  "catanzaro": { lat: 38.91, equivalentHours: 1450 },
  "cosenza": { lat: 39.30, equivalentHours: 1430 },
  "crotone": { lat: 39.08, equivalentHours: 1450 },
  "reggio calabria": { lat: 38.11, equivalentHours: 1480 },
  "vibo valentia": { lat: 38.68, equivalentHours: 1460 },

  // --- Sicilia ---
  "palermo": { lat: 38.12, equivalentHours: 1480 },
  "agrigento": { lat: 37.31, equivalentHours: 1520 },
  "caltanissetta": { lat: 37.49, equivalentHours: 1510 },
  "catania": { lat: 37.50, equivalentHours: 1510 },
  "enna": { lat: 37.57, equivalentHours: 1500 },
  "messina": { lat: 38.19, equivalentHours: 1470 },
  "ragusa": { lat: 36.93, equivalentHours: 1540 },
  "siracusa": { lat: 37.07, equivalentHours: 1530 },
  "trapani": { lat: 38.02, equivalentHours: 1490 },

  // --- Sardegna ---
  "cagliari": { lat: 39.22, equivalentHours: 1470 },
  "nuoro": { lat: 40.32, equivalentHours: 1420 },
  "oristano": { lat: 39.90, equivalentHours: 1440 },
  "sassari": { lat: 40.73, equivalentHours: 1400 },
  "olbia": { lat: 40.92, equivalentHours: 1390 },
};

/**
 * Cerca i dati di una citta italiana per nome.
 * Matching case-insensitive con supporto per nomi parziali.
 */
export function findCityData(name: string): CityData | null {
  if (!name) return null;

  const normalized = name.toLowerCase().trim();

  // Match esatto
  if (italianCitiesMap[normalized]) {
    return italianCitiesMap[normalized];
  }

  // Match parziale (il nome cercato contiene o e contenuto nel nome della citta)
  for (const [cityName, data] of Object.entries(italianCitiesMap)) {
    if (normalized.includes(cityName) || cityName.includes(normalized)) {
      return data;
    }
  }

  return null;
}
