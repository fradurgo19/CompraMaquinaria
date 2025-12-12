/**
 * Servicio de Base de Datos
 * Funciones auxiliares para operaciones comunes en la base de datos
 */

import { supabase } from './supabase';
import type { UserRole } from '../types/database';

/**
 * Obtiene el perfil del usuario actual
 */
export async function getCurrentUserProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { data: null, error: 'No hay usuario autenticado' };
  }

  const { data, error } = await supabase
    .from('users_profile')
    .select('*')
    .eq('id', user.id)
    .single();

  return { data, error };
}

/**
 * Obtiene el rol del usuario actual
 */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  const { data } = await getCurrentUserProfile();
  return data?.role || null;
}

/**
 * Verifica si el usuario tiene un rol específico
 */
export async function hasRole(roles: UserRole | UserRole[]): Promise<boolean> {
  const currentRole = await getCurrentUserRole();
  if (!currentRole) return false;
  
  const roleArray = Array.isArray(roles) ? roles : [roles];
  return roleArray.includes(currentRole);
}

/**
 * Verifica si el usuario es administrador
 */
export async function isAdmin(): Promise<boolean> {
  return hasRole('admin');
}

/**
 * Verifica si el usuario es gerencia
 */
export async function isGerencia(): Promise<boolean> {
  return hasRole(['gerencia', 'admin']);
}

/**
 * Verifica si el usuario es Sebastián
 */
export async function isSebastian(): Promise<boolean> {
  return hasRole(['sebastian', 'admin']);
}

/**
 * Verifica si el usuario es Eliana
 */
export async function isEliana(): Promise<boolean> {
  return hasRole(['eliana', 'admin']);
}

/**
 * Verifica permisos para ver subastas
 */
export async function canViewAuctions(): Promise<boolean> {
  return hasRole(['sebastian', 'gerencia', 'admin']);
}

/**
 * Verifica permisos para crear subastas
 */
export async function canCreateAuctions(): Promise<boolean> {
  return hasRole(['sebastian', 'admin']);
}

/**
 * Verifica permisos para ver compras
 */
export async function canViewPurchases(): Promise<boolean> {
  return hasRole(['eliana', 'gerencia', 'admin', 'sebastian']);
}

/**
 * Verifica permisos para crear compras
 */
export async function canCreatePurchases(): Promise<boolean> {
  return hasRole(['eliana', 'admin']);
}

/**
 * Verifica permisos para ver el consolidado de gerencia
 */
export async function canViewManagementTable(): Promise<boolean> {
  return hasRole(['gerencia', 'admin']);
}

/**
 * Verifica permisos para editar el consolidado de gerencia
 */
export async function canEditManagementTable(): Promise<boolean> {
  return hasRole(['gerencia', 'admin']);
}

/**
 * Manejo de errores de base de datos
 */
export function handleDatabaseError(error: any): string {
  if (!error) return 'Error desconocido';
  
  // Errores de Supabase
  if (error.message) {
    // RLS policy violation
    if (error.message.includes('row-level security')) {
      return 'No tienes permisos para realizar esta acción';
    }
    
    // Unique constraint violation
    if (error.code === '23505') {
      return 'Este registro ya existe en la base de datos';
    }
    
    // Foreign key violation
    if (error.code === '23503') {
      return 'No se puede eliminar este registro porque tiene datos relacionados';
    }
    
    // Not null violation
    if (error.code === '23502') {
      return 'Faltan campos requeridos';
    }
    
    return error.message;
  }
  
  return 'Error al procesar la solicitud';
}

/**
 * Formatea fechas para la base de datos
 */
export function formatDateForDB(date: Date | string): string {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  return date.toISOString().split('T')[0];
}

/**
 * Formatea números decimales para la base de datos
 */
export function formatDecimalForDB(value: number | string): number {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return Math.round(num * 100) / 100; // 2 decimales
}

/**
 * Calcula el valor FOB automáticamente
 */
export function calculateFOBValue(
  exw_value: number,
  fob_additional: number = 0,
  disassembly_load: number = 0
): number {
  return formatDecimalForDB(exw_value + fob_additional + disassembly_load);
}

/**
 * Calcula la fecha estimada de llegada (departure + 45 días)
 */
export function calculateEstimatedArrival(departureDate: Date | string): string {
  const date = new Date(departureDate);
  date.setDate(date.getDate() + 45);
  return formatDateForDB(date);
}

/**
 * Formatea moneda para visualización
 */
export function formatCurrency(
  amount: number,
  currency: 'USD' | 'COP' | 'JPY' | 'EUR' = 'USD'
): string {
  const formatters: Record<string, Intl.NumberFormat> = {
    USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    COP: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }),
    JPY: new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }),
    EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
  };
  
  return formatters[currency]?.format(amount) || amount.toString();
}

/**
 * Formatea fecha para visualización
 */
export function formatDate(date: string | Date, locale: string = 'es-CO'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Genera un query builder con paginación
 */
export function paginateQuery<T>(
  query: any,
  page: number = 1,
  pageSize: number = 10
) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  return query.range(from, to);
}

/**
 * Obtiene el total de registros de una tabla
 */
export async function getTableCount(
  tableName: string,
  filters?: Record<string, any>
): Promise<number> {
  let query = supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });
  
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });
  }
  
  const { count, error } = await query;
  
  if (error) {
    console.error('Error getting table count:', error);
    return 0;
  }
  
  return count || 0;
}

/**
 * Valida formato de email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida formato de teléfono (básico)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 7;
}

/**
 * Limpia y valida números
 */
export function sanitizeNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * Exporta datos a CSV
 */
export function exportToCSV(data: any[], filename: string): void {
  if (!data || data.length === 0) {
    console.error('No hay datos para exportar');
    return;
  }
  
  // Obtener encabezados
  const headers = Object.keys(data[0]);
  
  // Crear contenido CSV
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Escapar comillas y comas
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  // Crear blob y descargar
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
}

/**
 * Genera un ID único para tracking
 */
export function generateTrackingId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}${timestamp}${random}`.toUpperCase();
}

