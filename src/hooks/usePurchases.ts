import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPut, apiDelete } from '../services/api';
import { PurchaseWithRelations } from '../types/database';
import { normalizePurchaseCurrencyType } from '../utils/purchaseCurrency';

export const usePurchases = () => {
  const [purchases, setPurchases] = useState<PurchaseWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Cache básico en memoria para evitar recargas innecesarias
  const purchasesCacheRef = useRef<{
    data: PurchaseWithRelations[];
    timestamp: number;
  } | null>(null);
  const CACHE_DURATION = 30000; // 30 segundos de caché

  const fetchPurchases = async (forceRefresh = false) => {
    // Verificar caché si no se fuerza refresh
    if (!forceRefresh && purchasesCacheRef.current) {
      const cacheAge = Date.now() - purchasesCacheRef.current.timestamp;
      if (cacheAge < CACHE_DURATION) {
        console.log('📦 [Purchases] Usando datos del caché (edad:', Math.round(cacheAge / 1000), 's)');
        setPurchases(purchasesCacheRef.current.data);
        setIsLoading(false);
        return;
      }
    }
    
    setIsLoading(true);
    try {
      const data = await apiGet<any[]>('/api/purchases');
      const purchasesData = data || [];

      const withCanonicalCurrency: PurchaseWithRelations[] = purchasesData.map((p) => {
        const canonical = normalizePurchaseCurrencyType(p.currency_type);
        if (
          p.currency_type &&
          canonical &&
          String(p.currency_type).trim().toUpperCase() !== canonical
        ) {
          return { ...p, currency_type: canonical };
        }
        return p;
      });

      purchasesCacheRef.current = {
        data: withCanonicalCurrency,
        timestamp: Date.now(),
      };

      setPurchases(withCanonicalCurrency);

      void (async () => {
        for (const p of purchasesData) {
          const canonical = normalizePurchaseCurrencyType(p.currency_type);
          if (
            !p.currency_type ||
            !canonical ||
            String(p.currency_type).trim().toUpperCase() === canonical
          ) {
            continue;
          }
          try {
            await apiPut(`/api/purchases/${p.id}`, { currency_type: canonical });
          } catch (err) {
            console.warn('[Purchases] No se pudo persistir moneda canónica:', p.id, err);
          }
        }
      })();
    } catch (error) {
      console.error('Error fetching purchases:', error);
      // Si hay error pero tenemos caché, usar datos en caché
      if (purchasesCacheRef.current) {
        console.log('⚠️ [Purchases] Usando datos del caché debido a error');
        setPurchases(purchasesCacheRef.current.data);
      } else {
        setPurchases([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const updatePurchaseFields = async (
    id: string,
    updates: Partial<PurchaseWithRelations>,
    opts?: { skipRefetch?: boolean }
  ) => {
    let normalizedUpdates = updates;
    if (
      Object.prototype.hasOwnProperty.call(updates, 'currency_type') &&
      updates.currency_type != null &&
      updates.currency_type !== ''
    ) {
      const canonical = normalizePurchaseCurrencyType(String(updates.currency_type));
      if (canonical) {
        normalizedUpdates = { ...updates, currency_type: canonical };
      }
    }
    // Campos “rápidos” (no reordenan ni requieren refetch inmediato)
    const reportFields = new Set([
      'sales_reported',
      'commerce_reported',
      'luis_lemus_reported',
      'envio_originales',
    ]);
    const isReportField = Object.keys(normalizedUpdates).some((key) => reportFields.has(key));
    const skipRefetch = opts?.skipRefetch === true;

    const applyLocalUpdate = (updater: (prev: PurchaseWithRelations[]) => PurchaseWithRelations[]) => {
      setPurchases((prev) => {
        const next = updater(prev);
        purchasesCacheRef.current = { data: next, timestamp: Date.now() };
        return next;
      });
    };

    // Optimista: aplicar de inmediato para que la fila no “desaparezca” ni se contraiga al guardar inline.
    // Se aplica para (1) campos de reporte y (2) cualquier actualización con skipRefetch (edición inline).
    if (isReportField || skipRefetch) {
      applyLocalUpdate((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...normalizedUpdates } : p))
      );
    }

    try {
      const updated = await apiPut<PurchaseWithRelations>(`/api/purchases/${id}`, normalizedUpdates);

      // Fusionar respuesta del backend sin perder campos que GET devuelve pero PUT no
      // (ej. mq calculado con COALESCE, relaciones machine/supplier). Solo sobrescribir
      // con valores definidos en la respuesta; preservar del row anterior cualquier clave
      // ausente o undefined en la respuesta para que el registro no pierda MQ ni se mueva.
      applyLocalUpdate((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const merged = { ...p } as PurchaseWithRelations;
          for (const k of Object.keys(updated)) {
            if ((updated as Record<string, unknown>)[k] !== undefined) {
              (merged as Record<string, unknown>)[k] = (updated as Record<string, unknown>)[k];
            }
          }
          for (const k of Object.keys(p)) {
            if (!Object.prototype.hasOwnProperty.call(updated, k)) {
              (merged as Record<string, unknown>)[k] = (p as Record<string, unknown>)[k];
            }
          }
          // GET devuelve mq calculado (COALESCE); PUT devuelve mq crudo que puede ser null.
          // No borrar MQ si el usuario ya lo tenía y la respuesta trae null/vacío.
          const prevMq = (p as Record<string, unknown>).mq;
          const newMq = (merged as Record<string, unknown>).mq;
          if ((prevMq != null && prevMq !== '') && (newMq == null || newMq === '')) {
            (merged as Record<string, unknown>).mq = prevMq;
          }
          // Preservar marca, modelo y serie si la respuesta los trae vacíos y el registro ya los tenía
          const displayFields = ['brand', 'model', 'serial'] as const;
          for (const key of displayFields) {
            const prevVal = (p as Record<string, unknown>)[key];
            const newVal = (merged as Record<string, unknown>)[key];
            if ((prevVal != null && prevVal !== '') && (newVal == null || newVal === '')) {
              (merged as Record<string, unknown>)[key] = prevVal;
            }
          }
          return merged;
        })
      );

      // Solo refetch si no es campo rápido y no se pidió skipRefetch
      if (!isReportField && !skipRefetch) {
        await fetchPurchases(true);
      }

      return updated;
    } catch (error) {
      console.error('Error updating purchase:', error);
      // Revertir a datos de backend si falla
      await fetchPurchases(true);
      throw error;
    }
  };

  const deletePurchase = async (id: string) => {
    try {
      await apiDelete(`/api/purchases/${id}`);
      setPurchases(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting purchase:', error);
      throw error;
    }
  };

  return { purchases, isLoading, refetch: fetchPurchases, updatePurchaseFields, deletePurchase };
};
