/**
 * Lista de proveedores de subastas (Preselección, Subastas, Compras).
 * Orden alfabético para el campo Proveedor.
 */
const AUCTION_SUPPLIERS_RAW: readonly string[] = [
  'GREEN',
  'GUIA',
  'HCMJ',
  'HCMJ / KANAMOTO',
  'JEN',
  'KANEHARU',
  'KIXNET',
  'NORI',
  'ONAGA',
  'SOGO',
  'THI',
  'TOZAI',
  'WAKITA',
  'YUMAC',
  'YUVASA',
  'AOI',
  'NDT',
  'EUROAUCTIONS / UK',
  'EUROAUCTIONS / GER',
  'EUROAUCTIONS / ESP',
  'RITCHIE / USA / PE USA',
  'RITCHIE / CAN / PE USA',
  'ROYAL - PROXY / USA / PE USA',
  'ACME / USA / PE USA',
  'GDF',
  'GOSHO',
  'JTF',
  'KATAGIRI',
  'MONJI',
  'REIBRIDGE',
  'IRON PLANET / USA / PE USA',
  'SHOJI',
  'YIWU ELI TRADING COMPANY / CHINA',
  'E&F / USA / PE USA',
  'DIESEL',
];

export const AUCTION_SUPPLIERS: string[] = [...AUCTION_SUPPLIERS_RAW].sort((a, b) =>
  a.localeCompare(b, 'es')
);
