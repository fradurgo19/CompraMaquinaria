/**
 * Hook personalizado para gestión de envíos
 */

import { useState, useEffect } from 'react';
import type { Shipping, ShippingFormData } from '../types/database';
import * as shippingService from '../services/shipping.service';

export function useShipping() {
  const [shippings, setShippings] = useState<Shipping[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchShippings = async () => {
    setLoading(true);
    setError(null);
    
    const { data, error: err } = await shippingService.getShippings();
    
    if (err) {
      setError(err);
    } else if (data) {
      setShippings(data);
    }
    
    setLoading(false);
  };

  const createShipping = async (formData: ShippingFormData) => {
    setLoading(true);
    setError(null);
    
    const { data, error: err } = await shippingService.createShipping(formData);
    
    if (err) {
      setError(err);
      setLoading(false);
      return { success: false, data: null };
    }
    
    await fetchShippings();
    setLoading(false);
    return { success: true, data };
  };

  const updateShipping = async (id: string, formData: Partial<ShippingFormData>) => {
    setLoading(true);
    setError(null);
    
    const { data, error: err } = await shippingService.updateShipping(id, formData);
    
    if (err) {
      setError(err);
      setLoading(false);
      return { success: false, data: null };
    }
    
    await fetchShippings();
    setLoading(false);
    return { success: true, data };
  };

  const deleteShipping = async (id: string) => {
    setLoading(true);
    setError(null);
    
    const { success, error: err } = await shippingService.deleteShipping(id);
    
    if (err) {
      setError(err);
      setLoading(false);
      return { success: false };
    }
    
    await fetchShippings();
    setLoading(false);
    return { success };
  };

  const markArrived = async (id: string, arrivalDate?: string) => {
    return updateShipping(id, { 
      actual_arrival: arrivalDate || new Date().toISOString().split('T')[0] 
    });
  };

  useEffect(() => {
    fetchShippings();
  }, []);

  return {
    shippings,
    loading,
    error,
    fetchShippings,
    createShipping,
    updateShipping,
    deleteShipping,
    markArrived
  };
}

export function useShippingByPurchase(purchaseId: string | null) {
  const [shipping, setShipping] = useState<Shipping | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!purchaseId) {
      setShipping(null);
      return;
    }

    const fetchShipping = async () => {
      setLoading(true);
      setError(null);
      
      const { data, error: err } = await shippingService.getShippingByPurchaseId(purchaseId);
      
      if (err) {
        setError(err);
      } else {
        setShipping(data);
      }
      
      setLoading(false);
    };

    fetchShipping();
  }, [purchaseId]);

  return { shipping, loading, error };
}

export function useShipmentsInTransit() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInTransit = async () => {
    setLoading(true);
    setError(null);
    
    const { data, error: err } = await shippingService.getShipmentsInTransit();
    
    if (err) {
      setError(err);
    } else if (data) {
      setShipments(data);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchInTransit();
  }, []);

  return { shipments, loading, error, refresh: fetchInTransit };
}

export function useDelayedShipments() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDelayed = async () => {
    setLoading(true);
    setError(null);
    
    const { data, error: err } = await shippingService.getDelayedShipments();
    
    if (err) {
      setError(err);
    } else if (data) {
      setShipments(data);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchDelayed();
  }, []);

  return { shipments, loading, error, refresh: fetchDelayed };
}

