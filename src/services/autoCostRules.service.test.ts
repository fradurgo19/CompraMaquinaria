import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listAutoCostRules,
  createAutoCostRule,
  updateAutoCostRule,
  deleteAutoCostRule,
  suggestAutoCostRule,
  applyAutoCostRule,
} from './autoCostRules.service';
import * as api from './api';

vi.mock('./api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

describe('autoCostRules.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listAutoCostRules calls apiGet', async () => {
    const rules = [{ id: '1', name: 'Rule 1' }];
    vi.mocked(api.apiGet).mockResolvedValue(rules as any);

    const result = await listAutoCostRules();
    expect(result).toEqual(rules);
    expect(api.apiGet).toHaveBeenCalledWith('/api/auto-costs');
  });

  it('createAutoCostRule calls apiPost', async () => {
    const payload = { model_patterns: ['ZX*'], name: 'New Rule' };
    const created = { id: '1', ...payload };
    vi.mocked(api.apiPost).mockResolvedValue(created as any);

    const result = await createAutoCostRule(payload as any);
    expect(result).toEqual(created);
    expect(api.apiPost).toHaveBeenCalledWith('/api/auto-costs', payload);
  });

  it('updateAutoCostRule calls apiPut', async () => {
    const payload = { model_patterns: ['ZX*'] };
    vi.mocked(api.apiPut).mockResolvedValue({ id: '1', ...payload } as any);

    await updateAutoCostRule('1', payload as any);
    expect(api.apiPut).toHaveBeenCalledWith('/api/auto-costs/1', payload);
  });

  it('deleteAutoCostRule calls apiDelete', async () => {
    vi.mocked(api.apiDelete).mockResolvedValue(undefined as any);

    await deleteAutoCostRule('1');
    expect(api.apiDelete).toHaveBeenCalledWith('/api/auto-costs/1');
  });

  it('suggestAutoCostRule builds query and calls apiGet', async () => {
    vi.mocked(api.apiGet).mockResolvedValue({ id: '1' } as any);

    await suggestAutoCostRule({ model: 'ZX200', brand: 'Kobelco', tonnage: 20 });
    expect(api.apiGet).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/auto-costs\/suggest\?.*model=ZX200.*brand=Kobelco.*tonnage=20/)
    );
  });

  it('applyAutoCostRule calls apiPost', async () => {
    vi.mocked(api.apiPost).mockResolvedValue({ rule: {}, updates: {} } as any);

    await applyAutoCostRule({
      purchase_id: 'p1',
      model: 'ZX200',
      force: true,
    });
    expect(api.apiPost).toHaveBeenCalledWith(
      '/api/auto-costs/apply',
      expect.objectContaining({
        purchase_id: 'p1',
        model: 'ZX200',
        force: true,
      })
    );
  });
});
