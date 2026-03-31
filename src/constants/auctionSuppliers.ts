/**
 * Lista de proveedores de subastas (Preselección, Subastas, Compras).
 * Orden alfabético para el campo Proveedor.
 * Incluye HCMJ/ONAGA, RITCHIE/ESP, JTF SHOJI, TOYOKAMI, entre otros.
 * Excluye proveedores deshabilitados para selects inline.
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
  'KATAGIRI',
  'MONJI',
  'REIBRIDGE',
  'TOYOKAMI',
  'IRON PLANET / USA / PE USA',
  'IRON PLANET / BOOM & BUCKET / USA / PE USA',
  'MULTISERVICIOS / USA / PE USA',
  'YIWU ELI / CHINA',
  'E&F / USA / PE USA',
  'YUASA',
  'DIESEL',
];

const INLINE_DISABLED_SUPPLIERS = new Set([
  'JTF',
  'SHOJI',
  'YIWU ELI TRADING COMPANY / CHINA',
  'YUVASA',
]);

const normalizeSupplierName = (supplier: string) => supplier.trim().toUpperCase();

export const isSupplierVisibleInInlineSelect = (supplier: string): boolean =>
  !INLINE_DISABLED_SUPPLIERS.has(normalizeSupplierName(supplier));

const DIRECT_AUCTION_SUPPLIERS_HIDDEN_FROM_SELECT = new Set([
  'ACME / USA / PE USA',
  'DIESEL',
  'E&F / USA / PE USA',
  'GDF',
  'GOSHO',
  'HCMJ / KANAMOTO',
  'IRON PLANET / BOOM & BUCKET / USA / PE USA',
  'IRON PLANET / USA / PE USA',
  'JTF SHOJI',
  'KATAGIRI',
  'MONJI',
  'MULTISERVICIOS / USA / PE USA',
  'REIBRIDGE',
  'TOYOKAMI',
  'YIWU ELI / CHINA',
  'YUASA',
].map(normalizeSupplierName));

export const isDirectAuctionSupplierHiddenFromSelect = (supplier: string): boolean =>
  DIRECT_AUCTION_SUPPLIERS_HIDDEN_FROM_SELECT.has(normalizeSupplierName(supplier));

export const AUCTION_SUPPLIERS: string[] = [...AUCTION_SUPPLIERS_RAW]
  .filter(isSupplierVisibleInInlineSelect)
  .sort((a, b) => a.localeCompare(b, 'es'));
