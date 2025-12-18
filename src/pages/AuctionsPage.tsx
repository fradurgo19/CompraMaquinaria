/**
 * Página de Subastas - Diseño Premium Empresarial
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Plus, Folder, Search, Download, Calendar, TrendingUp, Eye, Mail, Clock, FileText, Trash2, Layers, Save, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../atoms/Button';
import { Card } from '../molecules/Card';
import { Modal } from '../molecules/Modal';
import { Select } from '../atoms/Select';
import { AuctionWithRelations, AuctionStatus } from '../types/database';
import { AuctionForm } from '../organisms/AuctionForm';
import { useAuctions } from '../hooks/useAuctions';
import { FileManager } from '../components/FileManager';
import { showSuccess, showError } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { ChangeHistory } from '../components/ChangeHistory';
import { InlineFieldEditor } from '../components/InlineFieldEditor';
import { BRAND_OPTIONS } from '../constants/brands';
import { MODEL_OPTIONS } from '../constants/models';
import { AUCTION_SUPPLIERS } from '../organisms/PreselectionForm';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { apiPost, apiGet } from '../services/api';
import { useBatchModeGuard } from '../hooks/useBatchModeGuard';

const COLOMBIA_TIMEZONE = 'America/Bogota';

const resolveAuctionColombiaDate = (auction: AuctionWithRelations) => {
  if (auction.preselection?.colombia_time) {
    const stored = new Date(auction.preselection.colombia_time);
    if (!Number.isNaN(stored.getTime())) return stored;
  }
  const fallback = auction.auction_date || auction.date;
  if (!fallback) return null;
  const parsed = new Date(fallback);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const buildAuctionColombiaKey = (auction: AuctionWithRelations) => {
  const colombiaDate = resolveAuctionColombiaDate(auction);
  if (!colombiaDate) {
    const fallback = (auction.auction_date || auction.date || '').split('T')[0] || 'SIN_FECHA';
    return { key: fallback, colombiaDate: null };
  }
  return { key: colombiaDate.toISOString().split('T')[0], colombiaDate };
};

const formatGroupColombiaLabel = (date?: Date | null, fallback?: string) => {
  if (date) {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: COLOMBIA_TIMEZONE,
    }).format(date);
  }
  if (fallback) {
    const parsed = new Date(fallback);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
  }
  return 'Sin fecha definida';
};

type InlineChangeItem = {
  field_name: string;
  field_label: string;
  old_value: string | number | null;
  new_value: string | number | null;
};

type InlineChangeIndicator = {
  id: string;
  fieldName: string;
  fieldLabel: string;
  oldValue: string | number | null;
  newValue: string | number | null;
  reason?: string;
  changedAt: string;
  moduleName?: string | null;
};

export const AuctionsPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOneDriveModalOpen, setIsOneDriveModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<AuctionWithRelations | null>(null);
  const [statusFilter, setStatusFilter] = useState<AuctionStatus | ''>('');
  const [dateFilter, setDateFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [sendingReminder, setSendingReminder] = useState(false);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeModalItems, setChangeModalItems] = useState<InlineChangeItem[]>([]);
  const [inlineChangeIndicators, setInlineChangeIndicators] = useState<Record<string, InlineChangeIndicator[]>>({});
  const [openChangePopover, setOpenChangePopover] = useState<{ auctionId: string; fieldName: string } | null>(null);
  const [selectedAuctionIds, setSelectedAuctionIds] = useState<Set<string>>(new Set());
  const [batchModeEnabled, setBatchModeEnabled] = useState(false);
  const [pendingBatchChanges, setPendingBatchChanges] = useState<
    Map<string, { auctionId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>
  >(new Map());
  const pendingChangeRef = useRef<{
    auctionId: string;
    updates: Record<string, unknown>;
    changes: InlineChangeItem[];
  } | null>(null);
  const pendingResolveRef = useRef<((value?: void | PromiseLike<void>) => void) | null>(null);
  const pendingRejectRef = useRef<((reason?: unknown) => void) | null>(null);
  
  // Refs para scroll sincronizado
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const { auctions, isLoading, refetch, updateAuctionFields, deleteAuction } = useAuctions();
  const { user } = useAuth();

  // Helper para verificar si el usuario es administrador
  const isAdmin = () => {
    if (!user?.email) return false;
    return user.email.toLowerCase() === 'admin@partequipos.com';
  };

  // Handler para eliminar subasta
  const handleDeleteAuction = async (auctionId: string, auctionInfo: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar esta subasta?\n\n${auctionInfo}\n\nEsta acción no se puede deshacer.`)) {
      return;
    }

    try {
      await deleteAuction(auctionId);
      showSuccess('Subasta eliminada exitosamente');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar la subasta';
      showError(message);
    }
  };

  // Cargar indicadores de cambios desde el backend
  useEffect(() => {
    const loadChangeIndicators = async () => {
      if (auctions.length === 0) return;
      
      try {
        const indicatorsMap: Record<string, InlineChangeIndicator[]> = {};
        
        // Cargar cambios para cada subasta
        await Promise.all(
          auctions.map(async (auction) => {
            try {
              const changes = await apiGet<Array<{
                id: string;
                field_name: string;
                field_label: string;
                old_value: string | number | null;
                new_value: string | number | null;
                change_reason: string | null;
                changed_at: string;
                module_name: string | null;
              }>>(`/api/change-logs/auctions/${auction.id}`);
              
              if (changes && changes.length > 0) {
                indicatorsMap[auction.id] = changes.slice(0, 10).map((change) => ({
                  id: change.id,
                  fieldName: change.field_name,
                  fieldLabel: change.field_label,
                  oldValue: change.old_value,
                  newValue: change.new_value,
                  reason: change.change_reason || undefined,
                  changedAt: change.changed_at,
                  moduleName: change.module_name || undefined,
                }));
              }
            } catch (error) {
              // Silenciar errores individuales (puede que no haya cambios)
              console.debug('No se encontraron cambios para subasta:', auction.id);
            }
          })
        );
        
        setInlineChangeIndicators(indicatorsMap);
      } catch (error) {
        console.error('Error al cargar indicadores de cambios:', error);
      }
    };
    
    if (!isLoading && auctions.length > 0) {
      loadChangeIndicators();
    }
  }, [auctions, isLoading]);

  const supplierOptions = useMemo(
    () =>
      AUCTION_SUPPLIERS.map((supplier) => ({
        value: supplier,
        label: supplier,
      })),
    []
  );

  const brandSelectOptions = useMemo(
    () => BRAND_OPTIONS.map((brand) => ({ value: brand, label: brand })),
    []
  );

  const modelSelectOptions = useMemo(
    () => MODEL_OPTIONS.map((model) => ({ value: model, label: model })),
    []
  );

  const purchaseTypeOptions = useMemo(
    () => [
      { value: 'SUBASTA', label: 'Subasta' },
      { value: 'COMPRA_DIRECTA', label: 'Compra directa' },
    ],
    []
  );

  const statusOptions = useMemo(
    () => [
      { value: 'PENDIENTE', label: 'Pendiente' },
      { value: 'GANADA', label: 'Ganada' },
      { value: 'PERDIDA', label: 'Perdida' },
    ],
    []
  );

  const now = Date.now();
  const handleSaveWithToasts = async (action: () => Promise<unknown>) => {
    try {
      await action();
      if (!batchModeEnabled) {
        showSuccess('Dato actualizado');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el dato';
      showError(message);
      throw error;
    }
  };

  const queueInlineChange = (
    auctionId: string,
    updates: Record<string, unknown>,
    changeItem: InlineChangeItem
  ) => {
    // Si el modo batch está activo, acumular cambios en lugar de abrir el modal
    if (batchModeEnabled) {
      setPendingBatchChanges((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(auctionId);
        
        if (existing) {
          // Combinar updates y agregar el nuevo cambio
          const mergedUpdates = { ...existing.updates, ...updates };
          const mergedChanges = [...existing.changes, changeItem];
          newMap.set(auctionId, {
            auctionId,
            updates: mergedUpdates,
            changes: mergedChanges,
          });
        } else {
          newMap.set(auctionId, {
            auctionId,
            updates,
            changes: [changeItem],
          });
        }
        
        return newMap;
      });
      
      // En modo batch, guardar en BD inmediatamente para reflejar cambios visualmente
      // pero NO registrar en control de cambios hasta que se confirme
      return updateAuctionFields(auctionId, updates)
        .catch((error) => {
          console.error('Error guardando cambio en modo batch:', error);
          throw error;
        });
    }
    
    // Modo normal: abrir modal inmediatamente
    return new Promise<void>((resolve, reject) => {
      pendingChangeRef.current = {
        auctionId,
        updates,
        changes: [changeItem],
      };
      pendingResolveRef.current = resolve;
      pendingRejectRef.current = reject;
      setChangeModalItems([changeItem]);
      setChangeModalOpen(true);
    });
  };

  const beginInlineChange = (
    auction: AuctionWithRelations,
    fieldName: string,
    fieldLabel: string,
    oldValue: string | number | null,
    newValue: string | number | null,
    updates: Record<string, unknown>
  ) => {
    if (normalizeForCompare(oldValue) === normalizeForCompare(newValue)) {
      return Promise.resolve();
    }
    return queueInlineChange(auction.id, updates, {
      field_name: fieldName,
      field_label: fieldLabel,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
    });
  };

  const handleConfirmInlineChange = async (reason?: string) => {
    const pending = pendingChangeRef.current;
    if (!pending) return;
    
    // Si es modo batch, usar la función especial
    if (pending.auctionId === 'BATCH_MODE') {
      await confirmBatchChanges(reason);
      return;
    }
    
    try {
      await handleSaveWithToasts(() => updateAuctionFields(pending.auctionId, pending.updates));
      await apiPost('/api/change-logs', {
        table_name: 'auctions',
        record_id: pending.auctionId,
        changes: pending.changes,
        change_reason: reason || null,
        module_name: 'subasta',
      });
      const indicator: InlineChangeIndicator = {
        id: `${pending.auctionId}-${Date.now()}`,
        fieldName: pending.changes[0].field_name,
        fieldLabel: pending.changes[0].field_label,
        oldValue: pending.changes[0].old_value,
        newValue: pending.changes[0].new_value,
        reason,
        changedAt: new Date().toISOString(),
      };
      setInlineChangeIndicators((prev) => ({
        ...prev,
        [pending.auctionId]: [indicator, ...(prev[pending.auctionId] || [])].slice(0, 10),
      }));
      pendingResolveRef.current?.();
    } catch (error) {
      pendingRejectRef.current?.(error);
      return;
    } finally {
      pendingChangeRef.current = null;
      pendingResolveRef.current = null;
      pendingRejectRef.current = null;
      setChangeModalOpen(false);
    }
  };

  const handleCancelInlineChange = () => {
    pendingRejectRef.current?.(new Error('CHANGE_CANCELLED'));
    pendingChangeRef.current = null;
    pendingResolveRef.current = null;
    pendingRejectRef.current = null;
    setChangeModalOpen(false);
  };

  // Función para confirmar cambios batch (llamada desde handleConfirmInlineChange)
  const confirmBatchChanges = async (reason?: string) => {
    // Recuperar datos del estado
    const allUpdatesByAuction = new Map<string, { auctionId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>();
    const allChanges: InlineChangeItem[] = [];
    
    pendingBatchChanges.forEach((batch) => {
      allChanges.push(...batch.changes);
      allUpdatesByAuction.set(batch.auctionId, batch);
    });

    try {
      // Solo registrar cambios en el log (los datos ya están guardados en BD)
      const logPromises = Array.from(allUpdatesByAuction.values()).map(async (batch) => {
        // Registrar cambios en el log
        await apiPost('/api/change-logs', {
          table_name: 'auctions',
          record_id: batch.auctionId,
          changes: batch.changes,
          change_reason: reason || null,
          module_name: 'subasta',
        });

        // Actualizar indicadores
        batch.changes.forEach((change) => {
          const indicator: InlineChangeIndicator = {
            id: `${batch.auctionId}-${change.field_name}-${Date.now()}`,
            fieldName: change.field_name,
            fieldLabel: change.field_label,
            oldValue: change.old_value,
            newValue: change.new_value,
            reason,
            changedAt: new Date().toISOString(),
          };
          setInlineChangeIndicators((prev) => ({
            ...prev,
            [batch.auctionId]: [indicator, ...(prev[batch.auctionId] || [])].slice(0, 10),
          }));
        });
      });

      await Promise.all(logPromises);
      
      // Limpiar cambios pendientes
      setPendingBatchChanges(new Map());
      setChangeModalOpen(false);
      pendingChangeRef.current = null;
      
      showSuccess(`${allChanges.length} cambio(s) registrado(s) exitosamente`);
    } catch (error) {
      console.error('Error confirmando cambios batch:', error);
      showError('Error al registrar cambios en el control de cambios');
      throw error;
    }
  };

  const handleSaveBatchChanges = useCallback(async () => {
    if (pendingBatchChanges.size === 0) {
      showError('No hay cambios pendientes para guardar');
      return;
    }

    // Agrupar todos los cambios para mostrar en el modal
    const allChanges: InlineChangeItem[] = [];
    pendingBatchChanges.forEach((batch) => {
      allChanges.push(...batch.changes);
    });

    // Abrir modal con todos los cambios
    setChangeModalItems(allChanges);

    // Configurar el pendingChangeRef para que handleConfirmInlineChange sepa que es batch
    pendingChangeRef.current = {
      auctionId: 'BATCH_MODE',
      updates: {},
      changes: allChanges,
    };
    
    setChangeModalOpen(true);
  }, [pendingBatchChanges, setChangeModalItems, setChangeModalOpen]);

  // Protección contra pérdida de datos en modo masivo
  useBatchModeGuard({
    batchModeEnabled,
    pendingBatchChanges,
    onSave: handleSaveBatchChanges,
    moduleName: 'Subasta'
  });

  // Cancelar todos los cambios pendientes
  const handleCancelBatchChanges = () => {
    if (pendingBatchChanges.size === 0) return;
    
    const totalChanges = Array.from(pendingBatchChanges.values()).reduce((sum, batch) => sum + batch.changes.length, 0);
    const message = `¿Deseas cancelar ${totalChanges} cambio(s) pendiente(s)?\n\nNota: Los cambios ya están guardados en la base de datos, pero no se registrarán en el control de cambios.`;
    
    if (window.confirm(message)) {
      setPendingBatchChanges(new Map());
      showSuccess('Registro de cambios cancelado. Los datos permanecen guardados.');
      // No necesitamos refetch, los datos ya están actualizados en el estado local
    }
  };

  const toggleAuctionSelection = (auctionId: string) => {
    setSelectedAuctionIds((prev) => {
      const next = new Set(prev);
      if (next.has(auctionId)) {
        next.delete(auctionId);
      } else {
        next.add(auctionId);
      }
      return next;
    });
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.change-popover') && !target.closest('.change-indicator-btn')) {
        setOpenChangePopover(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const toggleDateExpansion = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const handleIndicatorClick = (
    event: React.MouseEvent,
    auctionId: string,
    fieldName: string
  ) => {
    event.stopPropagation();
    setOpenChangePopover((prev) =>
      prev && prev.auctionId === auctionId && prev.fieldName === fieldName
        ? null
        : { auctionId, fieldName }
    );
  };

  useEffect(() => {
    if (dateFilter) {
      setExpandedDates(new Set([dateFilter]));
    } else {
      setExpandedDates(new Set());
    }
  }, [dateFilter]);

  const filteredAuctions = auctions
    .filter((auction) => {
    if (statusFilter && auction.status !== statusFilter) return false;
      
      // Comparar solo la parte de fecha (YYYY-MM-DD)
      if (dateFilter) {
        const auctionDateOnly = buildAuctionColombiaKey(auction).key;
        if (auctionDateOnly !== dateFilter) return false;
      }
      
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          auction.machine?.model?.toLowerCase().includes(search) ||
          auction.machine?.serial?.toLowerCase().includes(search) ||
          (auction.lot_number || auction.lot || '').toLowerCase().includes(search)
        );
      }
    return true;
    })
    .sort((a, b) => {
      const timeA =
        resolveAuctionColombiaDate(a)?.getTime() ?? new Date(a.auction_date || a.date || 0).getTime();
      const timeB =
        resolveAuctionColombiaDate(b)?.getTime() ?? new Date(b.auction_date || b.date || 0).getTime();

      const isAFuture = timeA >= now;
      const isBFuture = timeB >= now;

      if (isAFuture !== isBFuture) {
        return isAFuture ? -1 : 1;
      }

      return isAFuture ? timeA - timeB : timeB - timeA;
    });

  // Calcular estadísticas
  const totalWon = filteredAuctions.filter(a => a.status === 'GANADA').length;
  const totalPending = filteredAuctions.filter(a => a.status === 'PENDIENTE').length;
  const totalInvestment = filteredAuctions
    .filter(a => a.purchased_price || a.price_bought)
    .reduce((sum, a) => sum + (a.purchased_price || a.price_bought || 0), 0);

  const handleOpenFiles = (auction: AuctionWithRelations) => {
    if (!auction.machine?.model || !auction.machine?.serial) {
      alert('Esta subasta no tiene máquina asociada');
      return;
    }
    setSelectedAuction(auction);
    setIsOneDriveModalOpen(true);
  };

  const handleViewDetail = (auction: AuctionWithRelations) => {
    setSelectedAuction(auction);
    setIsDetailModalOpen(true);
  };

  // Agrupar subastas por fecha (Hora Colombia)
  const groupedAuctions = useMemo(() => {
    type GroupMeta = {
      auctions: AuctionWithRelations[];
      colombiaDate: Date | null;
    };

    const groups = new Map<string, GroupMeta>();

    filteredAuctions.forEach((auction) => {
      const { key, colombiaDate } = buildAuctionColombiaKey(auction);
      if (!groups.has(key)) {
        groups.set(key, { auctions: [], colombiaDate: colombiaDate || null });
      }
      const group = groups.get(key)!;
      if (!group.colombiaDate && colombiaDate) {
        group.colombiaDate = colombiaDate;
      }
      group.auctions.push(auction);
    });

    const nowTs = Date.now();

    return Array.from(groups.entries())
      .map(([date, meta]) => ({
        date,
        colombiaDate: meta.colombiaDate,
        auctions: meta.auctions.sort((a, b) => {
          const lotA = a.lot_number || a.lot || '';
          const lotB = b.lot_number || b.lot || '';
          return lotA.localeCompare(lotB);
        }),
        totalAuctions: meta.auctions.length,
        wonCount: meta.auctions.filter(a => a.status === 'GANADA').length,
        lostCount: meta.auctions.filter(a => a.status === 'PERDIDA').length,
        pendingCount: meta.auctions.filter(a => a.status === 'PENDIENTE').length,
      }))
      .sort((a, b) => {
        const timeA = a.colombiaDate?.getTime() ?? new Date(a.date).getTime();
        const timeB = b.colombiaDate?.getTime() ?? new Date(b.date).getTime();
        const futureA = timeA >= nowTs;
        const futureB = timeB >= nowTs;
        if (futureA !== futureB) return futureA ? -1 : 1;
        return futureA ? timeA - timeB : timeB - timeA;
      });
  }, [filteredAuctions]);

  // Funciones helper para estilos elegantes
  const getTipoCompraStyle = (tipo: string | null | undefined) => {
    if (!tipo) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    const upperTipo = tipo.toUpperCase();
    if (upperTipo === 'SUBASTA') {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md';
    } else if (upperTipo === 'COMPRA_DIRECTA' || upperTipo === 'COMPRA DIRECTA') {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md';
    }
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  };

  const getMaquinaStyle = (modelo: string | null | undefined) => {
    if (!modelo) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 whitespace-nowrap';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md whitespace-nowrap';
  };

  const getYearStyle = (year: number | string | null | undefined) => {
    if (!year || year === '-' || year === '' || year === 0) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md';
  };

  const getHoursStyle = (hours: number | string | null | undefined) => {
    if (!hours || hours === '-' || hours === '' || hours === 0) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-md';
  };

  const getEstadoStyle = (estado: string) => {
    const upperEstado = estado.toUpperCase();
    if (upperEstado === 'GANADA') {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md';
    } else if (upperEstado === 'PERDIDA') {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md';
    } else if (upperEstado === 'PENDIENTE') {
      return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-yellow-400 to-amber-500 text-gray-900 shadow-md';
    }
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  };

  const getProveedorStyle = (proveedor: string | null | undefined) => {
    if (!proveedor || proveedor === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-lime-500 to-green-500 text-white shadow-md';
  };

  const getMarcaStyle = (marca: string | null | undefined) => {
    if (!marca || marca === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md';
  };

  const getSerialStyle = (serial: string | null | undefined) => {
    if (!serial || serial === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 font-mono';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-slate-600 to-gray-700 text-white shadow-md font-mono';
  };

  const getRowBackgroundByStatus = (status: string) => {
    const upperStatus = status.toUpperCase();
    if (upperStatus === 'GANADA') {
      return 'bg-emerald-100 hover:bg-emerald-200 text-gray-900';
    } else if (upperStatus === 'PERDIDA') {
      return 'bg-rose-100 hover:bg-rose-200 text-gray-900';
    } else if (upperStatus === 'PENDIENTE') {
      return 'bg-amber-100 hover:bg-amber-200 text-gray-900';
    }
    return 'bg-white hover:bg-gray-50 text-gray-900';
  };

type InlineCellProps = {
  children: React.ReactNode;
  auctionId?: string;
  fieldName?: string;
  indicators?: InlineChangeIndicator[];
  openPopover?: { auctionId: string; fieldName: string } | null;
  onIndicatorClick?: (event: React.MouseEvent, auctionId: string, fieldName: string) => void;
};

const InlineCell: React.FC<InlineCellProps> = ({
  children,
  auctionId,
  fieldName,
  indicators,
  openPopover,
  onIndicatorClick,
}) => {
  const hasIndicator = !!(auctionId && fieldName && indicators && indicators.length);
  const isOpen =
    hasIndicator && openPopover?.auctionId === auctionId && openPopover.fieldName === fieldName;

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1">
        <div className="flex-1 min-w-0">{children}</div>
        {hasIndicator && onIndicatorClick && (
          <button
            type="button"
            className="change-indicator-btn inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200"
            onClick={(e) => onIndicatorClick(e, auctionId!, fieldName!)}
            title="Ver historial del campo"
          >
            <Clock className="w-3 h-3" />
          </button>
        )}
      </div>
      {isOpen && indicators && (
        <div className="change-popover absolute z-30 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-left">
          <p className="text-xs font-semibold text-gray-500 mb-2">Cambios recientes</p>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {indicators.map((log) => {
              const moduleLabel = log.moduleName ? getModuleLabel(log.moduleName) : null;
              return (
                <div key={log.id} className="border border-gray-100 rounded-lg p-2 bg-gray-50 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-800">{log.fieldLabel}</p>
                    {moduleLabel && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                        {moduleLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Antes:{' '}
                    <span className="font-mono text-red-600">{formatChangeValue(log.oldValue)}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Ahora:{' '}
                    <span className="font-mono text-green-600">{formatChangeValue(log.newValue)}</span>
                  </p>
                  {log.reason && (
                    <p className="text-xs text-gray-600 mt-1 italic">"{log.reason}"</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(log.changedAt).toLocaleString('es-CO')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const formatCurrencyValue = (value?: number | null) => {
  if (value === null || value === undefined) return 'Sin definir';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'Sin definir';
  return `$${numeric.toLocaleString('es-CO')}`;
};

const formatHoursValue = (value?: number | null) => {
  if (value === null || value === undefined) return 'Sin horas';
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) return 'Sin horas';
  return `${numeric.toLocaleString('es-CO')} hrs`;
};

const normalizeForCompare = (value: unknown) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number') return Number.isNaN(value) ? '' : value;
  if (typeof value === 'string') return value.trim().toLowerCase();
  return value;
};

const formatChangeValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return 'Sin valor';
  if (typeof value === 'number') return value.toLocaleString('es-CO');
  return String(value);
};

const getModuleLabel = (moduleName: string | null | undefined): string => {
  if (!moduleName) return '';
  const moduleMap: Record<string, string> = {
    'preseleccion': 'Preselección',
    'subasta': 'Subasta',
    'compras': 'Compras',
    'logistica': 'Logística',
    'equipos': 'Equipos',
    'servicio': 'Servicio',
    'importaciones': 'Importaciones',
    'pagos': 'Pagos',
  };
  return moduleMap[moduleName.toLowerCase()] || moduleName;
};

const getFieldIndicators = (
  indicators: Record<string, InlineChangeIndicator[]>,
  auctionId: string,
  fieldName: string
) => {
  return (indicators[auctionId] || []).filter((log) => log.fieldName === fieldName);
};

  const handleOpenModal = (auction?: AuctionWithRelations) => {
    setSelectedAuction(auction || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAuction(null);
  };

  const handleSuccess = () => {
    handleCloseModal();
    refetch();
    showSuccess('Subasta guardada exitosamente');
  };

  const handleSendReminder = async () => {
    setSendingReminder(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/notifications/auctions/send-colombia-time', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success && data.data) {
        const { oneDayBefore, threeHoursBefore } = data.data;
        const totalSent = (oneDayBefore?.sent || 0) + (threeHoursBefore?.sent || 0);
        showSuccess(`✅ Notificaciones enviadas: ${totalSent} notificación(es) (1 día: ${oneDayBefore?.sent || 0}, 3 horas: ${threeHoursBefore?.sent || 0})`);
      } else {
        alert(data.message || 'No hay subastas que necesiten notificación');
      }
    } catch (error) {
      console.error('Error al enviar notificaciones:', error);
      showError('Error al enviar notificaciones. Revise la consola.');
    } finally {
      setSendingReminder(false);
    }
  };

  // Sincronizar scroll superior con tabla
  useEffect(() => {
    const timer = setTimeout(() => {
      const topScroll = topScrollRef.current;
      const tableScroll = tableScrollRef.current;

      if (!topScroll || !tableScroll) return;

      const handleTopScroll = () => {
        if (tableScroll) {
          tableScroll.scrollLeft = topScroll.scrollLeft;
        }
      };

      const handleTableScroll = () => {
        if (topScroll) {
          topScroll.scrollLeft = tableScroll.scrollLeft;
        }
      };

      topScroll.addEventListener('scroll', handleTopScroll);
      tableScroll.addEventListener('scroll', handleTableScroll);

      return () => {
        topScroll.removeEventListener('scroll', handleTopScroll);
        tableScroll.removeEventListener('scroll', handleTableScroll);
      };
    }, 100);

    return () => clearTimeout(timer);
  }, [groupedAuctions]);

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4 max-w-[95vw]">
        {/* Header Premium */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Panel de Subastas</h1>
                <p className="text-gray-600">Gestión integral de subastas de maquinaria usada</p>
              </div>
              <div className="flex gap-3">
                {user?.role === 'admin' && (
                  <Button 
                    onClick={handleSendReminder}
                    disabled={sendingReminder}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg"
                  >
                    <Mail className="w-5 h-5" />
                    {sendingReminder ? 'Enviando...' : 'Enviar Recordatorio'}
                  </Button>
                )}
                <Button 
                  onClick={() => handleOpenModal()} 
                  className="flex items-center gap-2 bg-gradient-to-r from-brand-red to-primary-600 hover:from-primary-600 hover:to-primary-700 shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  Nueva Subasta
          </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards - Siempre visibles */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-brand-gray">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-gray">Total</p>
                <p className="text-2xl font-bold text-brand-gray">{filteredAuctions.length}</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-brand-gray" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-gray">Ganadas</p>
                <p className="text-2xl font-bold text-green-600">{totalWon}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-gray">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{totalPending}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-brand-red">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-gray">Inversión</p>
                <p className="text-2xl font-bold text-brand-red">
                  ${(totalInvestment / 1000).toFixed(0)}K
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-brand-red" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            {/* Search and Filters */}
            <div className="mb-6 space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por modelo, serial o lote..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red shadow-sm"
                    />
                  </div>
                </div>

                {/* Modo Masivo */}
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={batchModeEnabled}
                      onChange={(e) => {
                        setBatchModeEnabled(e.target.checked);
                        if (!e.target.checked && pendingBatchChanges.size > 0) {
                          if (window.confirm('¿Deseas guardar los cambios pendientes antes de desactivar el modo masivo?')) {
                            handleSaveBatchChanges();
                          } else {
                            handleCancelBatchChanges();
                          }
                        }
                      }}
                      className="w-4 h-4 text-brand-red focus:ring-brand-red border-gray-300 rounded"
                    />
                    <Layers className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Modo Masivo</span>
                  </label>
                </div>

                {/* Filters */}
                <div className="flex gap-3">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AuctionStatus | '')}
            options={[
                      { value: '', label: 'Todos los estados' },
                      { value: 'GANADA', label: '✓ Ganada' },
                      { value: 'PERDIDA', label: '✗ Perdida' },
                      { value: 'PENDIENTE', label: '⏳ Pendiente' },
                    ]}
                    className="min-w-[180px]"
                  />
                  
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red shadow-sm"
                  />
                  
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Exportar
                  </Button>
                </div>
              </div>

              {/* Indicador de Filtros Activos */}
              {(dateFilter || statusFilter || searchTerm) && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-brand-red" />
                    <p className="text-sm text-brand-red font-medium">
                      Mostrando {filteredAuctions.length} {filteredAuctions.length === 1 ? 'subasta' : 'subastas'} 
                      {dateFilter && ` para la fecha ${new Date(dateFilter).toLocaleDateString('es-CO')}`}
                      {statusFilter && ` con estado ${statusFilter}`}
                      {searchTerm && ` que coinciden con "${searchTerm}"`}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setDateFilter('');
                      setStatusFilter('');
                      setSearchTerm('');
                    setExpandedDates(new Set());
                    }}
                    className="text-xs text-brand-red hover:text-primary-700 font-semibold underline"
                  >
                    Limpiar filtros
                  </button>
                </div>
              )}
          </div>

            {/* Barra de Scroll Superior - Sincronizada */}
            <div className="mb-3">
              <div 
                ref={topScrollRef}
                className="overflow-x-auto bg-gray-200 rounded-lg shadow-inner"
                style={{ height: '14px' }}
              >
                <div style={{ width: '2400px', height: '1px' }}></div>
              </div>
            </div>

            {/* Tabla Agrupada */}
            <div className="bg-white rounded-xl shadow-xl overflow-hidden">
              <div ref={tableScrollRef} className="overflow-x-auto">
                {isLoading ? (
                  <div className="p-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand-red border-t-transparent"></div>
                    <p className="text-gray-600 mt-4">Cargando subastas...</p>
                  </div>
                ) : groupedAuctions.length === 0 ? (
                  <div className="p-12 text-center">
                    <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-lg">No hay subastas para mostrar</p>
                  </div>
                ) : (
                  <table className="w-full table-fixed">
                    <thead className="bg-gradient-to-r from-brand-red to-primary-600 text-white">
                      <tr>
                        {batchModeEnabled && (
                          <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase" style={{ width: '40px' }}>
                            <input
                              type="checkbox"
                              checked={filteredAuctions.length > 0 && filteredAuctions.every(a => selectedAuctionIds.has(a.id))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAuctionIds(new Set(filteredAuctions.map(a => a.id)));
                                } else {
                                  setSelectedAuctionIds(new Set());
                                }
                              }}
                              className="w-4 h-4 text-white border-gray-300 rounded focus:ring-brand-red"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </th>
                        )}
                        {!batchModeEnabled && <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase" style={{ width: '40px' }}></th>}
                        <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase" style={{ width: '10%' }}>Proveedor</th>
                        <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase" style={{ width: '8%' }}>Tipo de Subasta</th>
                        <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase" style={{ width: '6%' }}>Lote</th>
                        <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase" style={{ width: '8%' }}>Marca</th>
                        <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase" style={{ width: '9%' }}>Modelo</th>
                        <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase" style={{ width: '8%' }}>Serial</th>
                        <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase" style={{ width: '6%' }}>Año</th>
                        <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase" style={{ width: '7%' }}>Horas</th>
                        <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase" style={{ width: '7%' }}>Max</th>
                        <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase" style={{ width: '8%' }}>Comprado</th>
                        <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase" style={{ width: '8%' }}>Ubicación</th>
                        <th className="px-2 py-1.5 text-left text-xs font-semibold uppercase" style={{ width: '10%' }}>Estado</th>
                        <th className="sticky right-[130px] bg-gradient-to-r from-brand-red to-primary-600 z-10 px-2 py-1.5 text-left text-xs font-semibold uppercase shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]" style={{ width: '110px' }}>Archivos</th>
                        <th className="sticky right-0 bg-gradient-to-r from-brand-red to-primary-600 z-10 px-2 py-1.5 text-left text-xs font-semibold uppercase shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]" style={{ width: '130px' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedAuctions.map((group, groupIndex) => {
                        const isExpanded = expandedDates.has(group.date);
                        const groupLabel = formatGroupColombiaLabel(group.colombiaDate, group.date);
                        
                        return (
                      <React.Fragment key={group.date}>
                            {/* Fila de Grupo */}
                            <motion.tr
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: groupIndex * 0.05 }}
                              className="bg-white border-y border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                              onClick={() => toggleDateExpansion(group.date)}
                            >
                              <td colSpan={batchModeEnabled ? 25 : 24} className="px-4 py-4">
                                <div className="flex items-center gap-4 flex-wrap">
                                  <div className="flex items-center gap-3">
                                    <Calendar className="w-5 h-5 text-brand-red" />
                                    <div>
                                      <p className="text-[11px] uppercase text-gray-500 font-semibold tracking-wide">
                                        Hora Colombia
                                      </p>
                                      <p className="text-lg font-semibold text-gray-900">{groupLabel}</p>
                                      <p className="text-sm text-gray-500">
                                        {group.totalAuctions} {group.totalAuctions === 1 ? 'subasta' : 'subastas'}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <div className="h-12 w-px bg-gray-300"></div>
                                  
                                  <div className="flex gap-2">
                                    <div className="text-center px-3 py-1 rounded-lg bg-green-50 border border-green-200 min-w-[70px]">
                                      <p className="text-lg font-bold text-green-600">{group.wonCount}</p>
                                      <p className="text-xs text-green-600 font-medium">Ganadas</p>
                                    </div>
                                    <div className="text-center px-3 py-1 rounded-lg bg-rose-50 border border-rose-200 min-w-[70px]">
                                      <p className="text-lg font-bold text-rose-600">{group.lostCount}</p>
                                      <p className="text-xs text-rose-600 font-medium">Perdidas</p>
                                    </div>
                                    <div className="text-center px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 min-w-[80px]">
                                      <p className="text-lg font-bold text-amber-600">{group.pendingCount}</p>
                                      <p className="text-xs text-amber-600 font-medium">Pendientes</p>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              
                              <td
                                className="sticky right-[110px] border-y border-gray-200 z-10"
                                style={{ minWidth: '110px', width: '110px', background: 'inherit' }}
                              ></td>
                              <td
                                className="sticky right-0 border-y border-gray-200 z-10"
                                style={{ minWidth: '150px', width: '150px', background: 'inherit' }}
                              ></td>
                            </motion.tr>

                            {/* Filas de Detalle */}
                            {isExpanded &&
                              group.auctions.map((auction, auctionIndex) => {
                                const buildCellProps = (field: string) => ({
                                  auctionId: auction.id,
                                  fieldName: field,
                                  indicators: getFieldIndicators(inlineChangeIndicators, auction.id, field),
                                  openPopover: openChangePopover,
                                  onIndicatorClick: handleIndicatorClick,
                                });

                                return (
                              <motion.tr
                                key={auction.id}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: auctionIndex * 0.03 }}
                                className={`group transition-colors border-b border-gray-200 ${getRowBackgroundByStatus(auction.status)}`}
                              >
                                {batchModeEnabled && (
                                  <td className="px-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={selectedAuctionIds.has(auction.id)}
                                      onChange={() => toggleAuctionSelection(auction.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-4 h-4 text-brand-red border-gray-300 rounded focus:ring-brand-red"
                                    />
                                  </td>
                                )}
                                {!batchModeEnabled && <td className="px-2 py-1"></td>}
                                <td className="px-2 py-1 text-sm text-gray-800">
                                  <InlineCell {...buildCellProps('supplier_id')}>
                                    <InlineFieldEditor
                                      value={auction.supplier?.name || auction.supplier_name || auction.supplier_id || ''}
                                      type="select"
                                      placeholder="Proveedor"
                                      options={supplierOptions}
                                      displayFormatter={(val) =>
                                        supplierOptions.find((opt) => opt.value === val)?.label || 'Sin proveedor'
                                      }
                                      onSave={(val) => {
                                        const displayValue = val
                                          ? supplierOptions.find((opt) => opt.value === val)?.label || val
                                          : null;
                                        return beginInlineChange(
                                          auction,
                                          'supplier_id',
                                          'Proveedor',
                                          auction.supplier?.name || auction.supplier_name || null,
                                          displayValue,
                                          { supplier_id: val, supplier_name: displayValue }
                                        );
                                      }}
                                    />
                                  </InlineCell>
                                </td>
                                <td className="px-2 py-1 text-sm text-gray-800">
                                  <InlineCell {...buildCellProps('auction_type')}>
                                    <InlineFieldEditor
                                      value={auction.preselection?.auction_type || auction.auction_type || ''}
                                      type="text"
                                      placeholder="Tipo de subasta"
                                      onSave={(val) =>
                                        beginInlineChange(
                                          auction,
                                          'auction_type',
                                          'Tipo de subasta',
                                          auction.preselection?.auction_type || auction.auction_type || null,
                                          val || null,
                                          { auction_type: val }
                                        )
                                      }
                                    />
                                  </InlineCell>
                                </td>
                                <td className="px-2 py-1 text-sm font-mono font-semibold text-gray-900">
                                  <InlineCell {...buildCellProps('lot')}>
                                    <InlineFieldEditor
                                      value={auction.lot_number || auction.lot || ''}
                                      placeholder="Lote"
                                      onSave={(val) =>
                                        beginInlineChange(
                                          auction,
                                          'lot',
                                          'Lote',
                                          auction.lot_number || auction.lot || null,
                                          val || null,
                                          { lot: val }
                                        )
                                      }
                                    />
                                  </InlineCell>
                                </td>
                                <td className="px-2 py-1 text-sm text-gray-800">
                                  <InlineCell {...buildCellProps('brand')}>
                                    <InlineFieldEditor
                                      value={auction.machine?.brand || ''}
                                      type="combobox"
                                      placeholder="Buscar o escribir marca"
                                      options={brandSelectOptions}
                                      displayFormatter={(val) => val || 'Sin marca'}
                                      onSave={(val) =>
                                        beginInlineChange(
                                          auction,
                                          'brand',
                                          'Marca',
                                          auction.machine?.brand || null,
                                          val || null,
                                          { brand: val }
                                        )
                                      }
                                    />
                                  </InlineCell>
                                </td>
                                <td className="px-2 py-1 text-sm text-gray-800 whitespace-nowrap">
                                  <InlineCell {...buildCellProps('model')}>
                                    <InlineFieldEditor
                                      value={auction.machine?.model || ''}
                                      type="combobox"
                                      placeholder="Buscar o escribir modelo"
                                      options={modelSelectOptions}
                                      displayFormatter={(val) => val || 'Sin modelo'}
                                      onSave={(val) =>
                                        beginInlineChange(
                                          auction,
                                          'model',
                                          'Modelo',
                                          auction.machine?.model || null,
                                          val || null,
                                          { model: val }
                                        )
                                      }
                                    />
                                  </InlineCell>
                                </td>
                                <td className="px-2 py-1 text-sm text-gray-800 font-mono">
                                  <InlineCell {...buildCellProps('serial')}>
                                    <InlineFieldEditor
                                      value={auction.machine?.serial || ''}
                                      placeholder="Serial"
                                      onSave={(val) =>
                                        beginInlineChange(
                                          auction,
                                          'serial',
                                          'Serial',
                                          auction.machine?.serial || null,
                                          val || null,
                                          { serial: val }
                                        )
                                      }
                                    />
                                  </InlineCell>
                                </td>
                                <td className="px-2 py-1 text-sm text-gray-800">
                                  <InlineCell {...buildCellProps('year')}>
                                    <InlineFieldEditor
                                      value={auction.machine?.year ?? ''}
                                      type="number"
                                      placeholder="Año"
                                      onSave={(val) =>
                                        beginInlineChange(
                                          auction,
                                          'year',
                                          'Año',
                                          auction.machine?.year ?? null,
                                          (val as number | null) ?? null,
                                          { year: val }
                                        )
                                      }
                                    />
                                  </InlineCell>
                                </td>
                                <td className="px-2 py-1 text-sm text-gray-800">
                                  <InlineCell {...buildCellProps('hours')}>
                                    <InlineFieldEditor
                                      value={auction.machine?.hours ?? ''}
                                      type="number"
                                      placeholder="Horas"
                                      displayFormatter={(val) => formatHoursValue(val as number | null)}
                                      onSave={(val) =>
                                        beginInlineChange(
                                          auction,
                                          'hours',
                                          'Horas',
                                          auction.machine?.hours ?? null,
                                          (val as number | null) ?? null,
                                          { hours: val }
                                        )
                                      }
                                    />
                                  </InlineCell>
                                </td>
                                <td className="px-2 py-1 text-sm font-semibold text-gray-900">
                                  <InlineCell {...buildCellProps('price_max')}>
                                    <InlineFieldEditor
                                      value={auction.max_price ?? auction.price_max ?? ''}
                                      type="number"
                                      placeholder="Precio max"
                                      displayFormatter={(val) => formatCurrencyValue(val as number | null)}
                                      onSave={(val) =>
                                        beginInlineChange(
                                          auction,
                                          'price_max',
                                          'Precio máximo',
                                          auction.max_price ?? auction.price_max ?? null,
                                          (val as number | null) ?? null,
                                          { price_max: val }
                                        )
                                      }
                                    />
                                  </InlineCell>
                                </td>
                                <td className="px-2 py-1 text-sm text-gray-900">
                                  <InlineCell {...buildCellProps('price_bought')}>
                                    <InlineFieldEditor
                                      value={auction.purchased_price ?? auction.price_bought ?? ''}
                                      type="number"
                                      placeholder="Precio compra"
                                      displayFormatter={(val) => formatCurrencyValue(val as number | null)}
                                      onSave={(val) =>
                                        beginInlineChange(
                                          auction,
                                          'price_bought',
                                          'Precio de compra',
                                          auction.purchased_price ?? auction.price_bought ?? null,
                                          (val as number | null) ?? null,
                                          { price_bought: val }
                                        )
                                      }
                                    />
                                  </InlineCell>
                                </td>
                                <td className="px-2 py-1 text-sm text-gray-800">
                                  <InlineCell {...buildCellProps('location')}>
                                    <InlineFieldEditor
                                      value={auction.location || ''}
                                      type="select"
                                      placeholder="Ubicación"
                                      options={[
                                        { value: 'KOBE', label: 'KOBE' },
                                        { value: 'YOKOHAMA', label: 'YOKOHAMA' },
                                        { value: 'NARITA', label: 'NARITA' },
                                        { value: 'HAKATA', label: 'HAKATA' },
                                        { value: 'FUJI', label: 'FUJI' },
                                        { value: 'TOMAKOMAI', label: 'TOMAKOMAI' },
                                        { value: 'SAKURA', label: 'SAKURA' },
                                        { value: 'LEBANON', label: 'LEBANON' },
                                        { value: 'LAKE WORTH', label: 'LAKE WORTH' },
                                        { value: 'NAGOYA', label: 'NAGOYA' },
                                        { value: 'HOKKAIDO', label: 'HOKKAIDO' },
                                        { value: 'OSAKA', label: 'OSAKA' },
                                        { value: 'ALBERTA', label: 'ALBERTA' },
                                        { value: 'FLORIDA', label: 'FLORIDA' },
                                        { value: 'KASHIBA', label: 'KASHIBA' },
                                        { value: 'HYOGO', label: 'HYOGO' },
                                        { value: 'MIAMI', label: 'MIAMI' }
                                      ]}
                                      displayFormatter={(val) => val || 'Sin ubicación'}
                                      onSave={(val) =>
                                        beginInlineChange(
                                          auction,
                                          'location',
                                          'Ubicación',
                                          auction.location || null,
                                          val || null,
                                          { location: val }
                                        )
                                      }
                                    />
                                  </InlineCell>
                                </td>
                                <td className="px-2 py-1 text-sm font-semibold text-gray-900">
                                  <InlineCell {...buildCellProps('status')}>
                                    <InlineFieldEditor
                                      value={auction.status || ''}
                                      type="select"
                                      placeholder="Estado"
                                      options={statusOptions}
                                      displayFormatter={(val) =>
                                        statusOptions.find((opt) => opt.value === val)?.label || 'Sin estado'
                                      }
                                      onSave={(val) =>
                                        beginInlineChange(
                                          auction,
                                          'status',
                                          'Estado',
                                          auction.status || null,
                                          val || null,
                                          { status: val }
                                        )
                                      }
                                    />
                                  </InlineCell>
                                </td>
                                <td
                                  className={`sticky right-[110px] z-10 px-2 py-1 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)] transition-colors ${getRowBackgroundByStatus(
                                    auction.status
                                  )}`}
                                  style={{ minWidth: '110px', width: '110px' }}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenFiles(auction);
                                    }}
                                    className="px-2 py-1 rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-1"
                                  >
                                    <Folder className="w-3 h-3" />
                                    Archivos
                                  </button>
                                </td>
                                <td
                                  className={`sticky right-0 z-10 px-2 py-1 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)] transition-colors ${getRowBackgroundByStatus(
                                    auction.status
                                  )}`}
                                  style={{ minWidth: '150px', width: '150px' }}
                                >
                                  <div className="flex items-center gap-1 justify-center">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleViewDetail(auction);
                                      }}
                                      className="px-2 py-1 rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-1"
                                      title="Ver detalle"
                                    >
                                      <Eye className="w-3 h-3" />
                                      Ver
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedAuction(auction);
                                        setIsHistoryOpen(true);
                                      }}
                                      className="px-2 py-1 rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-100 flex items-center gap-1"
                                      title="Historial completo"
                                    >
                                      <FileText className="w-3 h-3" />
                                      Historial
                                    </button>
                                    {isAdmin() && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteAuction(
                                            auction.id,
                                            `Lote: ${auction.lot_number || auction.lot || 'N/A'} - ${auction.machine?.brand || ''} ${auction.machine?.model || ''}`
                                          );
                                        }}
                                        className="px-2 py-1 rounded-md border-2 border-red-500 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-1 transition-all duration-200"
                                        title="Eliminar subasta"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </motion.tr>
                            );
                          })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
      </Card>
        </motion.div>

        {/* Modals */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
          title={selectedAuction ? 'Editar Subasta' : 'Nueva Subasta'}
        size="lg"
      >
        <AuctionForm auction={selectedAuction} onSuccess={handleSuccess} onCancel={handleCloseModal} />
      </Modal>

        <Modal
          isOpen={isOneDriveModalOpen}
          onClose={() => setIsOneDriveModalOpen(false)}
          title="Gestión de Archivos OneDrive"
          size="xl"
        >
          {selectedAuction?.machine && (
            <FileManager
              machineId={selectedAuction.machine_id}
              model={selectedAuction.machine.model || ''}
              serial={selectedAuction.machine.serial || ''}
              onClose={() => setIsOneDriveModalOpen(false)}
            />
          )}
        </Modal>

        {/* Modal de Detalle Completo */}
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title="Detalle de la Subasta"
          size="lg"
        >
          {selectedAuction && (
            <div className="space-y-3">
              {/* Información General */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <h3 className="text-xs font-semibold text-gray-800 mb-2">Información General</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Estado</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAuction.status}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Tipo</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedAuction.purchase_type === 'COMPRA_DIRECTA' ? 'Compra Directa' : selectedAuction.purchase_type}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Fecha</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(selectedAuction.auction_date || selectedAuction.date).toLocaleDateString('es-CO')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Lote</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAuction.lot_number || selectedAuction.lot}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Proveedor</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAuction.supplier?.name || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Información de la Máquina */}
              <div className="border border-gray-200 rounded-lg p-3">
                <h3 className="text-xs font-semibold text-gray-800 mb-2">Información de la Máquina</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Marca</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAuction.machine?.brand || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Modelo</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAuction.machine?.model || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Serial</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAuction.machine?.serial || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Año</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAuction.machine?.year || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Horas</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedAuction.machine?.hours ? `${selectedAuction.machine.hours.toLocaleString('es-CO')} hrs` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Tipo Máq</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAuction.machine?.machine_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">L.H</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAuction.machine?.wet_line || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Brazo</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAuction.machine?.arm_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Zapatas</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAuction.machine?.track_width || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Cap. Cucharón</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAuction.machine?.bucket_capacity || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Blade</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAuction.machine?.blade || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">G. Meses</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAuction.machine?.warranty_months || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">G. Horas</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAuction.machine?.warranty_hours || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Motor</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAuction.machine?.engine_brand || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Cabina</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedAuction.machine?.cabin_type || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Información Financiera */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <h3 className="text-xs font-semibold text-gray-800 mb-2">Información Financiera</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Precio Máximo</p>
                    <p className="text-lg font-bold text-gray-900">
                      ${(selectedAuction.max_price || selectedAuction.price_max || 0).toLocaleString('es-CO')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Precio de Compra</p>
                    {(selectedAuction.purchased_price || selectedAuction.price_bought) ? (
                      <p className="text-lg font-bold text-[#cf1b22]">
                        ${(selectedAuction.purchased_price || selectedAuction.price_bought || 0).toLocaleString('es-CO')}
                      </p>
                    ) : (
                      <span className="text-sm text-gray-400">No comprado</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Comentarios */}
              {selectedAuction.comments && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <h3 className="text-xs font-semibold text-gray-800 mb-2">Comentarios</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedAuction.comments}</p>
                </div>
              )}

              {/* Botones de Acción */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenFiles(selectedAuction);
                  }}
                  className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <Folder className="w-4 h-4" />
                  Ver Archivos
                </button>
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenModal(selectedAuction);
                  }}
                  className="flex-1 px-3 py-2 bg-[#cf1b22] text-white rounded-lg hover:bg-[#b8181e] transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                >
                  Editar Subasta
                </button>
              </div>
            </div>
          )}
        </Modal>

      {/* Modal de Historial */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title="Historial de Cambios"
        size="lg"
      >
        {selectedAuction && (
          <ChangeHistory 
            tableName="auctions" 
            recordId={selectedAuction.id} 
          />
        )}
      </Modal>
      <ChangeLogModal
        isOpen={changeModalOpen}
        changes={changeModalItems}
        onConfirm={handleConfirmInlineChange}
        onCancel={handleCancelInlineChange}
      />
      
      {/* Panel flotante de cambios pendientes en modo masivo */}
      {batchModeEnabled && pendingBatchChanges.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-4 right-4 z-50"
        >
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden max-w-sm">
            {/* Header compacto con gradiente institucional */}
            <div className="bg-gradient-to-r from-[#cf1b22] to-[#8a1217] px-4 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-white" />
                  <h3 className="text-sm font-bold text-white">Cambios Pendientes</h3>
                </div>
              </div>
            </div>

            {/* Contenido compacto */}
            <div className="px-4 py-3 bg-gray-50">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-lg font-bold text-gray-800 leading-tight">
                      {pendingBatchChanges.size}
                    </p>
                    <p className="text-[10px] text-gray-600 font-medium leading-tight">
                      {pendingBatchChanges.size === 1 ? 'Registro' : 'Registros'}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-gray-300"></div>
                  <div>
                    <p className="text-lg font-bold text-gray-800 leading-tight">
                      {Array.from(pendingBatchChanges.values()).reduce((sum, batch) => sum + batch.changes.length, 0)}
                    </p>
                    <p className="text-[10px] text-gray-600 font-medium leading-tight">
                      {Array.from(pendingBatchChanges.values()).reduce((sum, batch) => sum + batch.changes.length, 0) === 1 ? 'Campo' : 'Campos'}
                    </p>
                  </div>
                </div>

                {/* Botones de acción compactos */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleCancelBatchChanges}
                    variant="secondary"
                    className="px-3 py-1.5 text-xs font-semibold border border-gray-300 hover:border-gray-400 text-gray-700 hover:bg-gray-50 transition-all duration-200 rounded-md"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Cancelar</span>
                  </Button>
                  <Button
                    onClick={handleSaveBatchChanges}
                    className="px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-[#cf1b22] to-[#8a1217] hover:from-[#b8181e] hover:to-[#8a1217] text-white shadow-md hover:shadow-lg transition-all duration-200 rounded-md flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Guardar</span>
                  </Button>
                </div>
              </div>

              {/* Barra de progreso sutil */}
              <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#cf1b22] to-[#8a1217]"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(100, (Array.from(pendingBatchChanges.values()).reduce((sum, batch) => sum + batch.changes.length, 0) / 10) * 100)}%` 
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
      </div>
    </div>
  );
};
