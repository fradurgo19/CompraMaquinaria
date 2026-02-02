import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleDatabaseError,
  formatDateForDB,
  formatDecimalForDB,
  calculateFOBValue,
  calculateEstimatedArrival,
  formatCurrency,
  getCurrentUserProfile,
  getCurrentUserRole,
  hasRole,
  isAdmin,
  isGerencia,
} from './database.service';
import { supabase } from './supabase';

const { mockChain } = vi.hoisted(() => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };
  return { mockChain: chain };
});

vi.mock('./supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(() => mockChain),
  },
}));

describe('database.service', () => {
  describe('handleDatabaseError', () => {
    it('returns default for null/undefined', () => {
      expect(handleDatabaseError(null)).toBe('Error desconocido');
    });

    it('returns message for generic error', () => {
      expect(handleDatabaseError({ message: 'DB error' })).toBe('DB error');
    });

    it('returns RLS message for row-level security', () => {
      expect(handleDatabaseError({ message: 'row-level security policy' })).toBe(
        'No tienes permisos para realizar esta acción'
      );
    });

    it('returns unique constraint message for code 23505', () => {
      expect(handleDatabaseError({ code: '23505', message: 'x' })).toBe(
        'Este registro ya existe en la base de datos'
      );
    });

    it('returns foreign key message for code 23503', () => {
      expect(handleDatabaseError({ code: '23503', message: 'x' })).toBe(
        'No se puede eliminar este registro porque tiene datos relacionados'
      );
    });

    it('returns not null message for code 23502', () => {
      expect(handleDatabaseError({ code: '23502', message: 'x' })).toBe('Faltan campos requeridos');
    });
  });

  describe('formatDateForDB', () => {
    it('formats Date to YYYY-MM-DD', () => {
      expect(formatDateForDB(new Date('2025-06-15T12:00:00Z'))).toBe('2025-06-15');
    });

    it('accepts string date', () => {
      expect(formatDateForDB('2025-06-15')).toBe('2025-06-15');
    });
  });

  describe('formatDecimalForDB', () => {
    it('rounds to 2 decimals', () => {
      expect(formatDecimalForDB(1.234)).toBe(1.23);
      expect(formatDecimalForDB('1.236')).toBe(1.24);
    });
  });

  describe('calculateFOBValue', () => {
    it('sums exw_value, fob_additional and disassembly_load', () => {
      expect(calculateFOBValue(100, 10, 5)).toBe(115);
    });

    it('defaults optional args to 0', () => {
      expect(calculateFOBValue(100)).toBe(100);
    });
  });

  describe('calculateEstimatedArrival', () => {
    it('returns date + 45 days in YYYY-MM-DD', () => {
      const d = new Date('2025-01-01');
      expect(calculateEstimatedArrival(d)).toBe('2025-02-15');
    });
  });

  describe('formatCurrency', () => {
    it('formats USD', () => {
      const result = formatCurrency(1234.56, 'USD');
      expect(result).toMatch(/\$1,234\.56/);
    });

    it('formats COP', () => {
      const result = formatCurrency(1000000, 'COP');
      expect(result).toMatch(/1.000.000/);
    });
  });

  describe('getCurrentUserProfile (mocked)', () => {
    beforeEach(() => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: '1' } },
        error: null,
      });
      mockChain.single.mockResolvedValue({ data: { id: '1', role: 'admin' }, error: null });
    });

    it('returns profile when user is authenticated', async () => {
      const result = await getCurrentUserProfile();
      expect(result.data).toEqual({ id: '1', role: 'admin' });
      expect(result.error).toBeNull();
    });
  });

  describe('getCurrentUserRole (mocked)', () => {
    beforeEach(() => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: '1' } },
        error: null,
      });
      mockChain.single.mockResolvedValue({ data: { id: '1', role: 'gerencia' }, error: null });
    });

    it('returns role from profile', async () => {
      const role = await getCurrentUserRole();
      expect(role).toBe('gerencia');
    });
  });

  describe('hasRole (mocked)', () => {
    beforeEach(() => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: '1' } },
        error: null,
      });
      mockChain.single.mockResolvedValue({ data: { id: '1', role: 'admin' }, error: null });
    });

    it('returns true when user has role', async () => {
      expect(await hasRole('admin')).toBe(true);
      expect(await hasRole(['admin', 'gerencia'])).toBe(true);
    });

    it('returns false when user does not have role', async () => {
      expect(await hasRole('sebastian')).toBe(false);
    });
  });

  describe('isAdmin', () => {
    beforeEach(() => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: '1' } },
        error: null,
      });
      mockChain.single.mockResolvedValue({ data: { id: '1', role: 'admin' }, error: null });
    });

    it('returns true for admin role', async () => {
      expect(await isAdmin()).toBe(true);
    });
  });

  describe('isGerencia', () => {
    beforeEach(() => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: '1' } },
        error: null,
      });
      mockChain.single.mockResolvedValue({ data: { id: '1', role: 'gerencia' }, error: null });
    });

    it('returns true for gerencia role', async () => {
      expect(await isGerencia()).toBe(true);
    });
  });
});
