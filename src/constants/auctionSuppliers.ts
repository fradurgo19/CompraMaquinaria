/**
 * Lista de proveedores de subastas (Preselección, Subastas, Compras).
 * Orden alfabético para el campo Proveedor.
 * Incluye HCMJ/ONAGA, RITCHIE/ESP, JTF SHOJI, TOYOKAMI, entre otros.
 */
const AUCTION_SUPPLIERS_RAW: readonly string[] = [
  'GREEN',
  'GUIA',
  'HCMJ',
  'HCMJ / ONAGA',
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
  'RITCHIE / ESP',
  'ROYAL - PROXY / USA / PE USA',
  'ACME / USA / PE USA',
  'GDF',
  'GOSHO',
  'JTF SHOJI',
  'JTF',
  'KATAGIRI',
  'MONJI',
  'REIBRIDGE',
  'TOYOKAMI',
  'IRON PLANET / USA / PE USA',
  'IRON PLANET / BOOM & BUCKET / USA / PE USA',
  'MULTISERVICIOS / USA / PE USA',
  'SHOJI',
  'YIWU ELI / CHINA',
  'YIWU ELI TRADING COMPANY / CHINA',
  'E&F / USA / PE USA',
  'YUASA',
  'DIESEL',
];

export const AUCTION_SUPPLIERS: string[] = [...AUCTION_SUPPLIERS_RAW].sort((a, b) =>
  a.localeCompare(b, 'es')
);
