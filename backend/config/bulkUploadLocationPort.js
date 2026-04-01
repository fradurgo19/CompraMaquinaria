/**
 * Ubicación y puerto de embarque solo para POST /api/purchases/bulk-upload.
 * No altera las listas de selects del frontend (PurchaseFormNew, etc.).
 */

/** NBSP y espacios múltiples típicos de Excel al copiar/pegar. */
export const sanitizeBulkLocationPortCell = (value) => {
  if (value === null || value === undefined || value === '') return '';
  return String(value)
    .replaceAll('\u00A0', ' ')
    .trim()
    .replaceAll(/\s+/g, ' ');
};

/** Valores canónicos permitidos para purchases.location (plantilla + constraint histórico). */
export const BULK_UPLOAD_ALLOWED_LOCATIONS = [
  'ALBERTA',
  'BALTIMORE',
  'BOSTON',
  'FLORIDA',
  'FUJI',
  'HAKATA',
  'HOKKAIDO',
  'HYOGO',
  'KASHIBA',
  'KOBE',
  'LAKE WORTH',
  'LEBANON',
  'LEEDS',
  'MIAMI',
  'NAGOYA',
  'NARITA',
  'OKINAWA',
  'OSAKA',
  'SAKURA',
  'TIANJIN',
  'TOMAKOMAI',
  'YOKOHAMA',
  'ZEEBRUGE',
];

/** Sinónimos → valor canónico de ubicación (mayúsculas). */
export const BULK_UPLOAD_LOCATION_ALIASES = {
  ALBERTA: 'ALBERTA',
  BALTIMORE: 'BALTIMORE',
  BOSTON: 'BOSTON',
  DAVENPORT: 'FLORIDA',
  'DAVENPORT FL': 'FLORIDA',
  'DAVENPORT, FL': 'FLORIDA',
  FLORIDA: 'FLORIDA',
  DORMAGEN: 'ZEEBRUGE',
  'DORMAGEN, GERMANY': 'ZEEBRUGE',
  'DORMAGEN GERMANY': 'ZEEBRUGE',
  FUJI: 'FUJI',
  HAKATA: 'HAKATA',
  HOKKAIDO: 'HOKKAIDO',
  HYOGO: 'HYOGO',
  KASHIBA: 'KASHIBA',
  KOBE: 'KOBE',
  'LAKE WORTH': 'LAKE WORTH',
  LEBANON: 'LEBANON',
  LEEDS: 'LEEDS',
  MIAMI: 'MIAMI',
  NAGOYA: 'NAGOYA',
  NARITA: 'NARITA',
  TOKIO: 'NARITA',
  TOKYO: 'NARITA',
  OKINAWA: 'OKINAWA',
  OSAKA: 'OSAKA',
  SAKURA: 'SAKURA',
  TIANJIN: 'TIANJIN',
  TOMAKOMAI: 'TOMAKOMAI',
  YOKOHAMA: 'YOKOHAMA',
  ZEEBRUGE: 'ZEEBRUGE',
};

/** Valores canónicos permitidos para purchases.port_of_embarkation (plantilla + histórico). */
export const BULK_UPLOAD_ALLOWED_PORTS = [
  'ALBERTA',
  'BALTIMORE',
  'CANADA',
  'FLORIDA',
  'FUJI',
  'HAKATA',
  'HOKKAIDO',
  'HYOGO',
  'JACKSONVILLE',
  'KASHIBA',
  'KOBE',
  'LAKE WORTH',
  'LEBANON',
  'MIAMI',
  'NAGOYA',
  'NARITA',
  'OSAKA',
  'SAVANNA',
  'SAKURA',
  'TIANJIN',
  'TOMAKOMAI',
  'YOKOHAMA',
  'ZEEBRUGE',
];

/** Variantes de Excel / ortografía → valor canónico de puerto. */
export const BULK_UPLOAD_PORT_ALIASES = {
  SAVANNAH: 'SAVANNA',
  ZEEBRUGGE: 'ZEEBRUGE',
};
