/**
 * Servicio para gestión de items de costo (Cost Items)
 */

import { supabase } from './supabase';
import type { CostItem, CostItemFormData, CostItemType, Currency } from '../types/database';
import { handleDatabaseError, formatDecimalForDB } from './database.service';

/**
 * Obtiene todos los cost items de una compra
 */
export async function getCostItemsByPurchaseId(purchaseId: string) {
  const { data, error } = await supabase
    .from('cost_items')
    .select('*')
    .eq('purchase_id', purchaseId)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Obtiene un cost item por ID
 */
export async function getCostItemById(id: string) {
  const { data, error } = await supabase
    .from('cost_items')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Crea un nuevo cost item
 */
export async function createCostItem(formData: CostItemFormData) {
  const costItemData = {
    ...formData,
    amount: formatDecimalForDB(formData.amount)
  };

  const { data, error } = await supabase
    .from('cost_items')
    .insert(costItemData)
    .select()
    .single();

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Actualiza un cost item
 */
export async function updateCostItem(id: string, formData: Partial<CostItemFormData>) {
  const updateData = {
    ...formData,
    amount: formData.amount ? formatDecimalForDB(formData.amount) : undefined
  };

  const { data, error } = await supabase
    .from('cost_items')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Elimina un cost item
 */
export async function deleteCostItem(id: string) {
  const { error } = await supabase
    .from('cost_items')
    .delete()
    .eq('id', id);

  if (error) {
    return { success: false, error: handleDatabaseError(error) };
  }

  return { success: true, error: null };
}

/**
 * Calcula el total de costos de una compra por tipo
 */
export async function getTotalCostsByType(purchaseId: string) {
  const { data, error } = await getCostItemsByPurchaseId(purchaseId);
  
  if (error || !data) {
    return {
      inland: 0,
      gastos_pto: 0,
      flete: 0,
      trasld: 0,
      repuestos: 0,
      mant_ejec: 0,
      total: 0
    };
  }

  const totals = {
    inland: 0,
    gastos_pto: 0,
    flete: 0,
    trasld: 0,
    repuestos: 0,
    mant_ejec: 0,
    total: 0
  };

  data.forEach((item: CostItem) => {
    const amount = item.amount || 0;
    
    switch (item.type) {
      case 'INLAND':
        totals.inland += amount;
        break;
      case 'GASTOS_PTO':
        totals.gastos_pto += amount;
        break;
      case 'FLETE':
        totals.flete += amount;
        break;
      case 'TRASLD':
        totals.trasld += amount;
        break;
      case 'REPUESTOS':
        totals.repuestos += amount;
        break;
      case 'MANT_EJEC':
        totals.mant_ejec += amount;
        break;
    }
    
    totals.total += amount;
  });

  return totals;
}

/**
 * Crea múltiples cost items en una sola transacción
 */
export async function createMultipleCostItems(items: CostItemFormData[]) {
  const costItemsData = items.map(item => ({
    ...item,
    amount: formatDecimalForDB(item.amount)
  }));

  const { data, error } = await supabase
    .from('cost_items')
    .insert(costItemsData)
    .select();

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Obtiene resumen de costos por tipo
 */
export async function getCostsSummary(purchaseId: string) {
  const totals = await getTotalCostsByType(purchaseId);
  
  const summary = [
    { type: 'INLAND', label: 'Inland', amount: totals.inland },
    { type: 'GASTOS_PTO', label: 'Gastos de Puerto', amount: totals.gastos_pto },
    { type: 'FLETE', label: 'Flete', amount: totals.flete },
    { type: 'TRASLD', label: 'Traslado', amount: totals.trasld },
    { type: 'REPUESTOS', label: 'Repuestos', amount: totals.repuestos },
    { type: 'MANT_EJEC', label: 'Mantenimiento Ejecutado', amount: totals.mant_ejec },
  ];
  
  return { summary, total: totals.total };
}

/**
 * Convierte monto entre monedas (requiere tasa de cambio)
 */
export function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  exchangeRate: number
): number {
  if (fromCurrency === toCurrency) return amount;
  
  // Lógica básica de conversión
  // En producción, usar tasas de cambio de currency_rates table
  return formatDecimalForDB(amount * exchangeRate);
}

/**
 * Obtiene tipos de costo disponibles
 */
export function getCostItemTypes(): Array<{ value: CostItemType; label: string }> {
  return [
    { value: 'INLAND', label: 'Inland' },
    { value: 'GASTOS_PTO', label: 'Gastos de Puerto' },
    { value: 'FLETE', label: 'Flete' },
    { value: 'TRASLD', label: 'Traslado' },
    { value: 'REPUESTOS', label: 'Repuestos' },
    { value: 'MANT_EJEC', label: 'Mantenimiento Ejecutado' },
  ];
}

