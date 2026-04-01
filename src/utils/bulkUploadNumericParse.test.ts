import { describe, it, expect } from 'vitest';
import { parseBulkUploadNumericValue } from './bulkUploadNumericParse';

describe('parseBulkUploadNumericValue (VALOR + BP plantilla)', () => {
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
