/**
 * Servicio para gestión de envíos (Shipping)
 */

import { supabase } from './supabase';
import type { Shipping, ShippingFormData } from '../types/database';
import { handleDatabaseError, calculateEstimatedArrival } from './database.service';

/**
 * Obtiene todos los envíos
 */
export async function getShippings() {
  const { data, error } = await supabase
    .from('shipping')
    .select(`
      *,
      purchase:purchases (
        id,
        machine:machines (
          model,
          serial
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Obtiene un envío por ID
 */
export async function getShippingById(id: string) {
  const { data, error } = await supabase
    .from('shipping')
    .select(`
      *,
      purchase:purchases (
        *,
        machine:machines (*),
        supplier:suppliers (*)
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Obtiene el envío de una compra
 */
export async function getShippingByPurchaseId(purchaseId: string) {
  const { data, error } = await supabase
    .from('shipping')
    .select('*')
    .eq('purchase_id', purchaseId)
    .single();

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Crea un nuevo envío
 */
export async function createShipping(formData: ShippingFormData) {
  // Si hay fecha de salida pero no fecha estimada, calcularla automáticamente
  const shippingData = {
    ...formData,
    estimated_arrival: formData.estimated_arrival || 
      (formData.departure_date ? calculateEstimatedArrival(formData.departure_date) : null)
  };

  const { data, error } = await supabase
    .from('shipping')
    .insert(shippingData)
    .select()
    .single();

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Actualiza un envío
 */
export async function updateShipping(id: string, formData: Partial<ShippingFormData>) {
  const { data, error } = await supabase
    .from('shipping')
    .update(formData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Elimina un envío
 */
export async function deleteShipping(id: string) {
  const { error } = await supabase
    .from('shipping')
    .delete()
    .eq('id', id);

  if (error) {
    return { success: false, error: handleDatabaseError(error) };
  }

  return { success: true, error: null };
}

/**
 * Obtiene envíos en tránsito (con fecha de salida pero sin llegada)
 */
export async function getShipmentsInTransit() {
  const { data, error } = await supabase
    .from('shipping')
    .select(`
      *,
      purchase:purchases (
        id,
        invoice_number,
        machine:machines (
          model,
          serial
        )
      )
    `)
    .not('departure_date', 'is', null)
    .is('actual_arrival', null)
    .order('estimated_arrival', { ascending: true });

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Obtiene envíos atrasados (fecha estimada pasada sin llegada)
 */
export async function getDelayedShipments() {
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('shipping')
    .select(`
      *,
      purchase:purchases (
        id,
        invoice_number,
        machine:machines (
          model,
          serial
        )
      )
    `)
    .not('estimated_arrival', 'is', null)
    .lt('estimated_arrival', today)
    .is('actual_arrival', null)
    .order('estimated_arrival', { ascending: true });

  if (error) {
    return { data: null, error: handleDatabaseError(error) };
  }

  return { data, error: null };
}

/**
 * Marca un envío como llegado
 */
export async function markShipmentArrived(id: string, arrivalDate?: string) {
  const actualArrival = arrivalDate || new Date().toISOString().split('T')[0];
  
  return updateShipping(id, { actual_arrival: actualArrival });
}

/**
 * Actualiza el tracking de un envío
 */
export async function updateTracking(id: string, carrier: string, trackingNumber: string) {
  return updateShipping(id, { carrier, tracking_number: trackingNumber });
}

