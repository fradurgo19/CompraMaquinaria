import { describe, it, expect } from 'vitest';
import { parseBulkUploadNumericValue } from './bulkUploadNumericParse';

describe('parseBulkUploadNumericValue (EUR/GBP plantilla)', () => {
  it('reconoce £38,612.50', () => {
    expect(parseBulkUploadNumericValue('£38,612.50')).toBe(38612.5);
  });

  it('reconoce € 113,087.50 con espacio tras símbolo', () => {
    expect(parseBulkUploadNumericValue('€ 113,087.50')).toBe(113087.5);
  });

  it('reconoce variante con espacio inicial y narrow NBSP (Excel)', () => {
    expect(parseBulkUploadNumericValue(` \u20AC\u202F113,087.50 `)).toBe(113087.5);
  });

  it('reconoce comillas en celda Excel', () => {
    expect(parseBulkUploadNumericValue('"£38,612.50"')).toBe(38612.5);
  });
});

/** Formatos reales columna VALOR+BP / GASTOS / DESENSAMBLAJE / CONTRAVALOR / TRM (plantilla JPY). */
describe('parseBulkUploadNumericValue (plantilla ¥ / $ como en UNION_DOE_DOP)', () => {
  it('VALOR + BP y GASTOS con miles y ¥', () => {
    expect(parseBulkUploadNumericValue('¥6,120,000')).toBe(6_120_000);
    expect(parseBulkUploadNumericValue(' ¥275,000 ')).toBe(275_000);
    expect(parseBulkUploadNumericValue('¥149,500')).toBe(149_500);
  });

  it('DESENSAMBLAJE: ¥- = 0; con decimales', () => {
    expect(parseBulkUploadNumericValue('¥-')).toBe(0);
    expect(parseBulkUploadNumericValue('¥135,000.00')).toBe(135_000);
    expect(parseBulkUploadNumericValue('¥62,000.00')).toBe(62_000);
  });

  it('CONTRAVALOR sin símbolo', () => {
    expect(parseBulkUploadNumericValue('152.84')).toBe(152.84);
    expect(parseBulkUploadNumericValue('151.45')).toBe(151.45);
  });

  it('TRM con $ y miles', () => {
    expect(parseBulkUploadNumericValue('$ 4,355.00')).toBe(4355);
    expect(parseBulkUploadNumericValue('$ 4,386.44')).toBe(4386.44);
  });
});