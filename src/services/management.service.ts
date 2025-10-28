/**
 * Servicio para gestión del consolidado de gerencia (Management Table)
 */

import { supabase } from './supabase';
import type { ManagementRecord, ManagementConsolidado, ManagementFilters } from '../types/database';
import { handleDatabaseError } from './database.service';

/**
 * Obtiene todos los registros del consolidado
 */
export async function getManagementRecords(filters?: ManagementFilters) {
  let query = supabase
    .from('management_table')
    .select('*')
    .order('created_at', { ascending: false });

  // Aplicar filtros
  if (filters?.sales_state) {
    query = query.eq('sales_state', filters.sales_state);
  }
  if (filters?.tipo_compra) {
    query = query.eq('tipo_compra', filters.tipo_compra);
  }
  if (filters?.tipo_incoterm) {
    query = query.eq('tipo_incoterm', filters.tipo_incoterm);
  }
  if (filters?.currency) {
    query = query.eq('currency', filters.currency);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Obtiene el consolidado completo usando la vista
 */
export async function getManagementConsolidado(filters?: ManagementFilters) {
  let query = supabase
    .from('v_management_consolidado')
    .select('*')
    .order('created_at', { ascending: false });

  // Aplicar filtros
  if (filters?.sales_state) {
    query = query.eq('sales_state', filters.sales_state);
  }
  if (filters?.tipo_compra) {
    query = query.eq('tipo_compra', filters.tipo_compra);
  }
  if (filters?.tipo_incoterm) {
    query = query.eq('tipo_incoterm', filters.tipo_incoterm);
  }
  if (filters?.currency) {
    query = query.eq('currency', filters.currency);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Obtiene un registro por ID
 */
export async function getManagementRecordById(id: string) {
  const { data, error } = await supabase
    .from('management_table')
    .select(`
      *,
      machine:machines(*),
      auction:auctions(*),
      purchase:purchases(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Obtiene un registro por machine_id
 */
export async function getManagementRecordByMachineId(machineId: string) {
  const { data, error } = await supabase
    .from('management_table')
    .select(`
      *,
      machine:machines(*),
      auction:auctions(*),
      purchase:purchases(*)
    `)
    .eq('machine_id', machineId)
    .single();

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Actualiza un registro del consolidado
 * (Solo Gerencia puede actualizar ciertos campos)
 */
export async function updateManagementRecord(
  id: string,
  updates: Partial<ManagementRecord>
) {
  const { data, error } = await supabase
    .from('management_table')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Actualiza el estado de venta
 */
export async function updateSalesState(
  id: string,
  salesState: 'OK' | 'X' | 'BLANCO'
) {
  return updateManagementRecord(id, { sales_state: salesState });
}

/**
 * Actualiza los comentarios de post-compra
 */
export async function updateComments(id: string, comments: string) {
  return updateManagementRecord(id, { comentarios_pc: comments });
}

/**
 * Actualiza proyecciones
 */
export async function updateProjections(
  id: string,
  proyectado?: number,
  pvp_est?: number
) {
  return updateManagementRecord(id, {
    proyectado,
    pvp_est
  });
}

/**
 * Calcula totales del consolidado
 */
export async function getConsolidadoTotals() {
  const { data, error } = await getManagementRecords();

  if (error || !data) {
    return {
      total_machines: 0,
      total_fob: 0,
      total_cif: 0,
      total_costs: 0,
      total_projected: 0,
      by_state: {
        OK: 0,
        X: 0,
        BLANCO: 0
      },
      by_type: {
        SUBASTA: 0,
        STOCK: 0
      }
    };
  }

  const totals = {
    total_machines: data.length,
    total_fob: 0,
    total_cif: 0,
    total_costs: 0,
    total_projected: 0,
    by_state: {
      OK: 0,
      X: 0,
      BLANCO: 0
    },
    by_type: {
      SUBASTA: 0,
      STOCK: 0
    }
  };

  data.forEach((record: ManagementRecord) => {
    totals.total_fob += record.precio_fob || 0;
    totals.total_cif += record.cif_usd || 0;
    
    const costs = (record.inland || 0) + 
                  (record.gastos_pto || 0) + 
                  (record.flete || 0) + 
                  (record.trasld || 0) + 
                  (record.rptos || 0) + 
                  (record.mant_ejec || 0);
    totals.total_costs += costs;
    
    totals.total_projected += record.proyectado || 0;

    // Contar por estado
    if (record.sales_state === 'OK') totals.by_state.OK++;
    else if (record.sales_state === 'X') totals.by_state.X++;
    else totals.by_state.BLANCO++;

    // Contar por tipo
    if (record.tipo_compra === 'SUBASTA') totals.by_type.SUBASTA++;
    else if (record.tipo_compra === 'STOCK') totals.by_type.STOCK++;
  });

  return totals;
}

/**
 * Exporta el consolidado a formato para Excel
 */
export async function exportConsolidado() {
  const { data, error } = await getManagementConsolidado();

  if (error || !data) {
    return { data: null, error: error || 'No hay datos para exportar' };
  }

  // Mapear datos al formato de exportación
  const exportData = data.map((record: ManagementConsolidado) => ({
    'Estado': record.sales_state || '',
    'Modelo': record.model || '',
    'Serial': record.serial || '',
    'Año': record.year || '',
    'Tipo Compra': record.tipo_compra || '',
    'Incoterm': record.tipo_incoterm || '',
    'Moneda': record.currency || '',
    'Tasa': record.tasa || '',
    'Precio FOB': record.precio_fob || 0,
    'Inland': record.inland || 0,
    'CIF USD': record.cif_usd || 0,
    'CIF Local': record.cif_local || 0,
    'Gastos Pto': record.gastos_pto || 0,
    'Flete': record.flete || 0,
    'Traslado': record.trasld || 0,
    'Repuestos': record.rptos || 0,
    'Mant. Ejec.': record.mant_ejec || 0,
    'Cost. Arancel': record.cost_total_arancel || 0,
    'Proyectado': record.proyectado || 0,
    'PVP Est.': record.pvp_est || 0,
    'Comentarios': record.comentarios_pc || '',
    'Fecha Subasta': record.auction_date || '',
    'Fecha Factura': record.invoice_date || '',
    'Nro. Factura': record.invoice_number || ''
  }));

  return { data: exportData, error: null };
}

/**
 * Recalcula todos los valores del consolidado desde las fuentes
 * (Útil para sincronizar datos después de cambios masivos)
 */
export async function recalculateAllRecords() {
  // Esta función dispara un recalculo forzado
  // En producción, esto debería hacerse mediante un job o tarea programada
  
  const { data: machines, error } = await supabase
    .from('machines')
    .select('id');

  if (error || !machines) {
    return { success: false, updated: 0, error: handleDatabaseError(error) };
  }

  let updated = 0;
  
  for (const machine of machines) {
    // Para cada máquina, obtener su auction y purchase más reciente
    const { data: auction } = await supabase
      .from('auctions')
      .select('*')
      .eq('machine_id', machine.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const { data: purchase } = await supabase
      .from('purchases')
      .select('*')
      .eq('machine_id', machine.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (auction || purchase) {
      // El trigger se encargará de actualizar management_table
      // Solo necesitamos hacer un update dummy para disparar el trigger
      if (auction) {
        await supabase
          .from('auctions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', auction.id);
        updated++;
      }
      
      if (purchase) {
        await supabase
          .from('purchases')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', purchase.id);
        updated++;
      }
    }
  }

  return { success: true, updated, error: null };
}

/**
 * Obtiene estadísticas del consolidado
 */
export async function getConsolidadoStats() {
  const totals = await getConsolidadoTotals();
  const { data, error } = await getManagementRecords();

  if (error || !data) {
    return { stats: null, error: error || 'Error al obtener estadísticas' };
  }

  // Calcular margen promedio
  let totalMargin = 0;
  let machinesWithMargin = 0;

  data.forEach((record: ManagementRecord) => {
    if (record.pvp_est && record.cif_usd) {
      const margin = ((record.pvp_est - record.cif_usd) / record.pvp_est) * 100;
      totalMargin += margin;
      machinesWithMargin++;
    }
  });

  const averageMargin = machinesWithMargin > 0 
    ? totalMargin / machinesWithMargin 
    : 0;

  const stats = {
    ...totals,
    average_margin: Math.round(averageMargin * 100) / 100,
    machines_with_projections: data.filter((r: ManagementRecord) => r.proyectado).length,
    pending_arrivals: 0, // TODO: Calcular desde shipping
  };

  return { stats, error: null };
}

