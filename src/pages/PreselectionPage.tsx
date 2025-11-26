/**
 * Página de Preselección - Módulo previo a Subastas
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Search, Download, Calendar, ChevronDown, ChevronRight, CheckCircle, XCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../atoms/Button';
import { Card } from '../molecules/Card';
import { Modal } from '../molecules/Modal';
import { Select } from '../atoms/Select';
import { PreselectionWithRelations, PreselectionDecision } from '../types/database';
import { PreselectionForm, AUCTION_SUPPLIERS } from '../organisms/PreselectionForm';
import { usePreselections } from '../hooks/usePreselections';
import { showSuccess, showError } from '../components/Toast';
import { InlineFieldEditor } from '../components/InlineFieldEditor';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { MachineSpecDefaultsModal } from '../organisms/MachineSpecDefaultsModal';
import { PriceSuggestion } from '../components/PriceSuggestion';
import { apiPost, apiGet } from '../services/api';
import { BRAND_OPTIONS } from '../constants/brands';
import { MODEL_OPTIONS } from '../constants/models';
const CABIN_OPTIONS = [
  { value: 'CABINA CERRADA/AC', label: 'Cabina cerrada / AC' },
  { value: 'CABINA CERRADA', label: 'Cabina cerrada' },
  { value: 'CABINA CERRADA / AIRE ACONDICIONADO', label: 'Cabina cerrada / Aire' },
  { value: 'CANOPY', label: 'Canopy' },
];

const ARM_TYPE_OPTIONS = [
  { value: 'ESTANDAR', label: 'ESTANDAR' },
  { value: 'N/A', label: 'N/A' },
  { value: 'LONG ARM', label: 'LONG ARM' },
];

const CITY_OPTIONS = [
  { value: 'TOKYO', label: 'Tokio, Japón (GMT+9)', offset: 9 },
  { value: 'NEW_YORK', label: 'Nueva York, USA (GMT-5)', offset: -5 },
  { value: 'CALIFORNIA', label: 'California, USA (GMT-8)', offset: -8 },
  { value: 'UK', label: 'United Kingdom', offset: 0 },
];

// Mapeo de proveedores a sus valores predeterminados
const SUPPLIER_DEFAULTS: Record<string, { currency: string; location: string; city: string }> = {
  'KANEHARU': { currency: 'JPY', location: 'JAPON', city: 'TOKYO' },
  'KENKI HIT': { currency: 'JPY', location: 'JAPON', city: 'NEW_YORK' },
  'JEN CORP': { currency: 'JPY', location: 'JAPON', city: 'CALIFORNIA' },
  'EIKOH': { currency: 'JPY', location: 'JAPON', city: 'TOKYO' },
  'KATA': { currency: 'JPY', location: 'JAPON', city: 'TOKYO' },
  'SOGO': { currency: 'JPY', location: 'JAPON', city: 'TOKYO' },
  'TOYOKAMI': { currency: 'JPY', location: 'JAPON', city: 'TOKYO' },
  'HITACHI': { currency: 'JPY', location: 'JAPON', city: 'TOKYO' },
  'WAKITA': { currency: 'JPY', location: 'JAPON', city: 'TOKYO' },
  'GUIA': { currency: 'JPY', location: 'JAPON', city: 'TOKYO' },
  'ONAGA': { currency: 'JPY', location: 'JAPON', city: 'TOKYO' },
  'THI': { currency: 'JPY', location: 'JAPON', city: 'TOKYO' },
  'GREEN AUCTION': { currency: 'JPY', location: 'JAPON', city: 'TOKYO' },
  'JEN': { currency: 'JPY', location: 'JAPON', city: 'TOKYO' },
  'HIT': { currency: 'JPY', location: 'JAPON', city: 'TOKYO' },
  'TOZAI': { currency: 'JPY', location: 'JAPON', city: 'TOKYO' },
  'KIXNET': { currency: 'JPY', location: 'JAPON', city: 'TOKYO' },
  'RICHIE BROS': { currency: 'USD', location: 'EEUU', city: 'NEW_YORK' },
  'PROXYBID': { currency: 'USD', location: 'EEUU', city: 'NEW_YORK' },
  'GIOA': { currency: 'JPY', location: 'OTRO', city: 'TOKYO' },
  'EURO': { currency: 'GBP', location: 'UK', city: 'UK' },
};

const COLOMBIA_TIMEZONE = 'America/Bogota';

const getCityMeta = (city?: string | number | null) => {
  if (typeof city !== 'string') return undefined;
  return CITY_OPTIONS.find((option) => option.value === city);
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

const buildUtcDateFromLocal = (dateIso?: string | null, time?: string | null, city?: string | null) => {
  if (!dateIso) return null;
  const baseDate = new Date(dateIso);
  if (Number.isNaN(baseDate.getTime())) return null;
  const [hour, minute] = time ? time.split(':').map((part) => Number(part)) : [0, 0];
  const meta = getCityMeta(city);
  const cityOffset = meta?.offset ?? 0;

  const utcMs =
    Date.UTC(
      baseDate.getUTCFullYear(),
      baseDate.getUTCMonth(),
      baseDate.getUTCDate(),
      Number.isNaN(hour) ? 0 : hour,
      Number.isNaN(minute) ? 0 : minute
    ) - cityOffset * 60 * 60 * 1000;

  return new Date(utcMs);
};

const resolveColombiaDate = (
  colombiaTime?: string | null,
  auctionDate?: string | null,
  localTime?: string | null,
  city?: string | null
) => {
  if (colombiaTime) {
    const stored = new Date(colombiaTime);
    if (!Number.isNaN(stored.getTime())) {
      return stored;
    }
  }
  return buildUtcDateFromLocal(auctionDate, localTime, city);
};

const formatStoredColombiaTime = (
  colombiaTime?: string | null,
  auctionDate?: string | null,
  localTime?: string | null,
  city?: string | null
) => {
  const date = resolveColombiaDate(colombiaTime, auctionDate, localTime, city);
  if (!date) return 'Define fecha, hora y ciudad';

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: COLOMBIA_TIMEZONE,
  }).format(date);
};

const buildColombiaDateKey = (presel: PreselectionWithRelations) => {
  const colombiaDate = resolveColombiaDate(
    presel.colombia_time,
    presel.auction_date,
    presel.local_time,
    presel.auction_city
  );
  if (!colombiaDate) {
    const fallback = (presel.auction_date || '').split('T')[0] || 'SIN_FECHA';
    return { key: fallback, colombiaDate: null };
  }
  return { key: colombiaDate.toISOString().split('T')[0], colombiaDate };
};

const getAuctionStatusStyle = (status?: string | null) => {
  if (!status) {
    return 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200';
  }
  const upper = status.toUpperCase();
  if (upper === 'GANADA') {
    return 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow';
  }
  if (upper === 'PERDIDA') {
    return 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-rose-500 to-red-500 text-white shadow';
  }
  if (upper === 'PENDIENTE') {
    return 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow';
  }
  if (upper === 'RECHAZADA') {
    return 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-slate-500 to-gray-600 text-white shadow';
  }
  return 'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200';
};

const resolveAuctionStatusLabel = (presel: PreselectionWithRelations): string => {
  if (presel.auction_status) return presel.auction_status;
  if (presel.decision === 'NO') return 'RECHAZADA';
  return 'PENDIENTE';
};

const buildPlaceholderSerial = () => `SN-${Date.now().toString().slice(-5)}`;
const buildPlaceholderLot = () => `TMP-${Date.now().toString().slice(-4)}`;

const toNumberOrNull = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(numeric) ? null : numeric;
};

export const PreselectionPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSpecDefaultsModalOpen, setIsSpecDefaultsModalOpen] = useState(false);
  const [selectedPreselection, setSelectedPreselection] = useState<PreselectionWithRelations | null>(null);
  const [decisionFilter, setDecisionFilter] = useState<PreselectionDecision | ''>('');
  const [dateFilter, setDateFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [quickCreateDate, setQuickCreateDate] = useState('');
  const [quickCreateTime, setQuickCreateTime] = useState('');
  const [quickCreateCity, setQuickCreateCity] = useState('');
  const [quickCreateLoading, setQuickCreateLoading] = useState(false);
  const [addingMachineFor, setAddingMachineFor] = useState<string | null>(null);
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeModalItems, setChangeModalItems] = useState<InlineChangeItem[]>([]);
  const [inlineChangeIndicators, setInlineChangeIndicators] = useState<
    Record<string, InlineChangeIndicator[]>
  >({});
  const [openChangePopover, setOpenChangePopover] = useState<{ recordId: string; fieldName: string } | null>(null);
  const pendingChangeRef = useRef<{
    preselId: string;
    updates: Record<string, unknown>;
    changes: InlineChangeItem[];
  } | null>(null);
  const pendingResolveRef = useRef<((value?: void | PromiseLike<void>) => void) | null>(null);
  const pendingRejectRef = useRef<((reason?: unknown) => void) | null>(null);

  const {
    preselections,
    isLoading,
    refetch,
    updateDecision,
    updatePreselectionFields,
    createPreselection,
  } = usePreselections();

  // Cargar indicadores de cambios desde el backend
  useEffect(() => {
    const loadChangeIndicators = async () => {
      if (preselections.length === 0) return;
      
      try {
        const indicatorsMap: Record<string, InlineChangeIndicator[]> = {};
        
        // Cargar cambios para cada preselección
        await Promise.all(
          preselections.map(async (presel) => {
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
              }>>(`/api/change-logs/preselections/${presel.id}`);
              
              if (changes && changes.length > 0) {
                indicatorsMap[presel.id] = changes.slice(0, 10).map((change) => ({
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
              console.debug('No se encontraron cambios para preselección:', presel.id);
            }
          })
        );
        
        setInlineChangeIndicators(indicatorsMap);
      } catch (error) {
        console.error('Error al cargar indicadores de cambios:', error);
      }
    };
    
    if (!isLoading && preselections.length > 0) {
      loadChangeIndicators();
    }
  }, [preselections, isLoading]);
  const supplierOptions = AUCTION_SUPPLIERS.map((supplier) => ({
    value: supplier,
    label: supplier,
  }));

  const citySelectOptions = useMemo(
    () => CITY_OPTIONS.map(({ value, label }) => ({ value, label })),
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


const handleQuickCreate = async () => {
  if (!quickCreateDate || !quickCreateTime || !quickCreateCity) {
    showError('Completa fecha, hora y ciudad para crear la tarjeta');
    return;
  }

  setQuickCreateLoading(true);
  try {
    const suffix = Date.now().toString().slice(-5);
    const payload: Partial<PreselectionWithRelations> = {
      supplier_name: 'PENDIENTE',
      auction_date: quickCreateDate,
      lot_number: `TMP-${suffix}`,
      model: 'POR DEFINIR',
      serial: `SN-${suffix}`,
      local_time: quickCreateTime,
      auction_city: quickCreateCity,
      brand: null,
      year: null,
      hours: null,
      suggested_price: null,
      auction_url: null,
      comments: null,
    };

    const created = await createPreselection(payload);
    const { key: createdDateKey } = buildColombiaDateKey(created);
    setExpandedDates((prev) => {
      const next = new Set(prev);
      next.add(createdDateKey);
      return next;
    });
    setQuickCreateDate('');
    setQuickCreateTime('');
    setQuickCreateCity('');
    showSuccess('Tarjeta creada. Completa la información desde la vista.');
  } catch (error) {
    console.error('Quick preselection creation failed:', error);
    const message = error instanceof Error ? error.message : 'No se pudo crear la preselección rápida';
    showError(message);
  } finally {
    setQuickCreateLoading(false);
  }
};

const handleAddMachineToGroup = async (dateKey: string, template?: PreselectionWithRelations | null) => {
  if (!dateKey) return;
  setAddingMachineFor(dateKey);
  try {
    const payload: Partial<PreselectionWithRelations> = {
      supplier_name: template?.supplier_name || 'PENDIENTE',
      auction_date: template?.auction_date || dateKey,
      lot_number: buildPlaceholderLot(),
      brand: null,
      model: 'POR DEFINIR',
      serial: buildPlaceholderSerial(),
      year: null,
      hours: null,
      suggested_price: null,
      final_price: null,
      auction_url: template?.auction_url || null,
      currency: template?.currency || 'USD',
      location: template?.location || null,
      local_time: template?.local_time || null,
      auction_city: template?.auction_city || null,
      shoe_width_mm: null,
      spec_pip: false,
      spec_blade: false,
      spec_cabin: null,
      arm_type: null,
    };

    const created = await createPreselection(payload);
    const { key: createdDateKey } = buildColombiaDateKey(created);
    setExpandedDates((prev) => {
      const next = new Set(prev);
      next.add(createdDateKey);
      return next;
    });
    showSuccess('Equipo agregado. Completa los datos en la tarjeta.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo agregar el equipo';
    showError(message);
  } finally {
    setAddingMachineFor(null);
  }
};

  const queueInlineChange = (
    preselId: string,
    updates: Record<string, unknown>,
    changeItem: InlineChangeItem
  ) => {
    return new Promise<void>((resolve, reject) => {
      pendingChangeRef.current = {
        preselId,
        updates,
        changes: [changeItem],
      };
      pendingResolveRef.current = resolve;
      pendingRejectRef.current = reject;
      setChangeModalItems([changeItem]);
      setChangeModalOpen(true);
    });
  };

  const handleConfirmInlineChange = async (reason?: string) => {
    const pending = pendingChangeRef.current;
    if (!pending) return;
    try {
      await handleSaveWithToasts(() =>
        updatePreselectionFields(pending.preselId, pending.updates as Partial<PreselectionWithRelations>)
      );
      await apiPost('/api/change-logs', {
        table_name: 'preselections',
        record_id: pending.preselId,
        changes: pending.changes,
        change_reason: reason || null,
        module_name: 'preseleccion',
      });
      const indicator: InlineChangeIndicator = {
        id: `${pending.preselId}-${Date.now()}`,
        fieldName: pending.changes[0].field_name,
        fieldLabel: pending.changes[0].field_label,
        oldValue: pending.changes[0].old_value,
        newValue: pending.changes[0].new_value,
        reason,
        changedAt: new Date().toISOString(),
      };
      setInlineChangeIndicators((prev) => ({
        ...prev,
        [pending.preselId]: [indicator, ...(prev[pending.preselId] || [])].slice(0, 10),
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

  const handleIndicatorClick = (
    event: React.MouseEvent,
    recordId: string,
    fieldName: string
  ) => {
    event.stopPropagation();
    setOpenChangePopover((prev) =>
      prev && prev.recordId === recordId && prev.fieldName === fieldName
        ? null
        : { recordId, fieldName }
    );
  };

  const beginInlineChange = (
    presel: PreselectionWithRelations,
    fieldName: string,
    fieldLabel: string,
    oldValue: string | number | boolean | null,
    newValue: string | number | boolean | null,
    updates: Record<string, unknown>
  ) => {
    if (normalizeForCompare(oldValue) === normalizeForCompare(newValue)) {
      return Promise.resolve();
    }
    return queueInlineChange(presel.id, updates, {
      field_name: fieldName,
      field_label: fieldLabel,
      old_value: mapValueForLog(oldValue),
      new_value: mapValueForLog(newValue),
    });
  };

  const buildCellProps = (recordId: string, field: string) => ({
    recordId,
    fieldName: field,
    indicators: getFieldIndicators(inlineChangeIndicators, recordId, field),
    openPopover: openChangePopover,
    onIndicatorClick: handleIndicatorClick,
  });

  const handleSaveWithToasts = async (action: () => Promise<unknown>) => {
    try {
      await action();
      showSuccess('Dato actualizado');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el dato';
      showError(message);
      throw error;
    }
  };

  const filteredPreselections = preselections
    .filter((presel) => {
      if (decisionFilter && presel.decision !== decisionFilter) return false;
      
      if (dateFilter) {
        const preselDateOnly = buildColombiaDateKey(presel).key;
        if (preselDateOnly !== dateFilter) return false;
      }
      
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          presel.model?.toLowerCase().includes(search) ||
          presel.serial?.toLowerCase().includes(search) ||
          presel.lot_number?.toLowerCase().includes(search) ||
          presel.supplier_name?.toLowerCase().includes(search)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const dateA =
        resolveColombiaDate(a.colombia_time, a.auction_date, a.local_time, a.auction_city)?.getTime() ||
        new Date(a.auction_date).getTime();
      const dateB =
        resolveColombiaDate(b.colombia_time, b.auction_date, b.local_time, b.auction_city)?.getTime() ||
        new Date(b.auction_date).getTime();
      return dateB - dateA;
    });

  // Agrupar por fecha
  const groupedPreselections = useMemo(() => {
    type GroupMeta = {
      preselections: PreselectionWithRelations[];
      colombiaDate: Date | null;
    };
    const groups = new Map<string, GroupMeta>();
    
    filteredPreselections.forEach((presel) => {
      const { key: dateKey, colombiaDate } = buildColombiaDateKey(presel);
      if (!groups.has(dateKey)) {
        groups.set(dateKey, { preselections: [], colombiaDate: colombiaDate || null });
      }
      const group = groups.get(dateKey)!;
      if (!group.colombiaDate && colombiaDate) {
        group.colombiaDate = colombiaDate;
      }
      group.preselections.push(presel);
    });
    
    const now = Date.now();
    const asTimestamp = (group: { colombiaDate: Date | null; date: string }) => {
      if (group.colombiaDate) return group.colombiaDate.getTime();
      const parsed = new Date(group.date).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    return Array.from(groups.entries())
      .map(([date, meta]) => ({
        date,
        colombiaDate: meta.colombiaDate,
        preselections: meta.preselections.sort((a, b) => (a.lot_number || '').localeCompare(b.lot_number || '')),
        totalPreselections: meta.preselections.length,
        pendingCount: meta.preselections.filter(p => p.decision === 'PENDIENTE').length,
        approvedCount: meta.preselections.filter(p => p.decision === 'SI').length,
        rejectedCount: meta.preselections.filter(p => p.decision === 'NO').length,
      }))
      .sort((a, b) => {
        const timeA = asTimestamp(a);
        const timeB = asTimestamp(b);
        const isAFuture = timeA >= now;
        const isBFuture = timeB >= now;

        if (isAFuture !== isBFuture) {
          return isAFuture ? -1 : 1;
        }

        if (isAFuture) {
          // Ambos futuros: el más cercano primero
          return timeA - timeB;
        }

        // Ambos pasados: el más reciente primero
        return timeB - timeA;
      });
  }, [filteredPreselections]);

  const toggleDateExpansion = (date: string) => {
    setExpandedDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  useEffect(() => {
    if (dateFilter) {
      setExpandedDates(new Set([dateFilter]));
    } else {
      setExpandedDates(new Set());
    }
  }, [dateFilter]);

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

  const handleDecision = async (preselId: string, decision: 'SI' | 'NO') => {
    try {
      await updateDecision(preselId, decision);
      showSuccess(`Preselección ${decision === 'SI' ? 'aprobada' : 'rechazada'} exitosamente`);
      refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al procesar decisión';
      showError(message);
    }
  };

  const getRecordFieldValue = (
    record: PreselectionWithRelations,
    fieldName: string
  ): string | number | boolean | null => {
    const typedRecord = record as unknown as Record<string, string | number | boolean | null | undefined>;
    const value = typedRecord[fieldName];
    return (value === undefined ? null : value) as string | number | boolean | null;
  };

  const applyDefaultSpecs = async (preselId: string, brand: string | null, model: string | null) => {
    if (!brand || !model) return;
    
    try {
      const spec = await apiGet<{ id: string; brand: string; model: string; spec_blade?: boolean; spec_pip?: boolean; spec_cabin?: string; arm_type?: string; shoe_width_mm?: number }>(
        `/api/machine-spec-defaults/brand/${encodeURIComponent(brand)}/model/${encodeURIComponent(model)}`
      ).catch((error) => {
        // Si la tabla no existe o hay error 404, simplemente no aplicar specs
        if (error?.message?.includes('no existe') || error?.message?.includes('no encontrada')) {
          return null;
        }
        console.warn('Error al obtener especificaciones por defecto:', error);
        return null;
      });
      
      if (spec) {
        // Obtener la preselección actualizada
        const updatedPresel = preselections.find(p => p.id === preselId);
        if (!updatedPresel) return;
        
        const updates: Record<string, unknown> = {};
        const changes: InlineChangeItem[] = [];
        
        if (spec.spec_blade !== undefined && updatedPresel.spec_blade !== spec.spec_blade) {
          updates.spec_blade = spec.spec_blade;
          changes.push({
            field_name: 'spec_blade',
            field_label: 'Blade',
            old_value: updatedPresel.spec_blade ? 'Sí' : 'No',
            new_value: spec.spec_blade ? 'Sí' : 'No',
          });
        }
        
        if (spec.spec_pip !== undefined && updatedPresel.spec_pip !== spec.spec_pip) {
          updates.spec_pip = spec.spec_pip;
          changes.push({
            field_name: 'spec_pip',
            field_label: 'PIP',
            old_value: updatedPresel.spec_pip ? 'Sí' : 'No',
            new_value: spec.spec_pip ? 'Sí' : 'No',
          });
        }
        
        if (spec.spec_cabin && updatedPresel.spec_cabin !== spec.spec_cabin) {
          updates.spec_cabin = spec.spec_cabin;
          changes.push({
            field_name: 'spec_cabin',
            field_label: 'Cabina',
            old_value: updatedPresel.spec_cabin || 'Sin valor',
            new_value: spec.spec_cabin,
          });
        }
        
        if (spec.arm_type && updatedPresel.arm_type !== spec.arm_type) {
          updates.arm_type = spec.arm_type;
          changes.push({
            field_name: 'arm_type',
            field_label: 'Tipo de Brazo',
            old_value: updatedPresel.arm_type || 'Sin valor',
            new_value: spec.arm_type,
          });
        }
        
        if (spec.shoe_width_mm !== undefined && spec.shoe_width_mm !== null && updatedPresel.shoe_width_mm !== spec.shoe_width_mm) {
          updates.shoe_width_mm = spec.shoe_width_mm;
          changes.push({
            field_name: 'shoe_width_mm',
            field_label: 'Ancho de zapatas',
            old_value: updatedPresel.shoe_width_mm?.toString() || 'Sin valor',
            new_value: spec.shoe_width_mm.toString(),
          });
        }
        
        if (Object.keys(updates).length > 0) {
          await queueInlineChange(preselId, updates, changes);
        }
      }
    } catch (error) {
      console.error('Error applying default specs:', error);
    }
  };

  const requestFieldUpdate = async (
    presel: PreselectionWithRelations,
    fieldName: string,
    fieldLabel: string,
    newValue: string | number | boolean | null,
    updates?: Record<string, unknown>
  ) => {
    const currentValue = getRecordFieldValue(presel, fieldName);
    
    // Si se actualiza el proveedor, aplicar valores predeterminados de moneda, ubicación y ciudad
    if (fieldName === 'supplier_name' && typeof newValue === 'string') {
      const defaults = SUPPLIER_DEFAULTS[newValue];
      if (defaults) {
        const allUpdates = {
          supplier_name: newValue,
          currency: defaults.currency,
          location: defaults.location,
          auction_city: defaults.city,
          ...(updates || {})
        };
        await beginInlineChange(
          presel,
          fieldName,
          fieldLabel,
          currentValue,
          newValue,
          allUpdates
        );
        return;
      }
    }
    
    await beginInlineChange(
      presel,
      fieldName,
      fieldLabel,
      currentValue,
      newValue,
      updates ?? { [fieldName]: newValue }
    );
    
    // Si se actualiza marca o modelo, aplicar especificaciones por defecto después de un breve delay
    if (fieldName === 'model' || fieldName === 'brand') {
      setTimeout(async () => {
        await refetch(); // Recargar datos actualizados
        const updatedBrand = fieldName === 'brand' ? (newValue as string) : presel.brand;
        const updatedModel = fieldName === 'model' ? (newValue as string) : presel.model;
        await applyDefaultSpecs(presel.id, updatedBrand, updatedModel);
      }, 500);
    }
  };

  const handleToggleSpec = async (
    presel: PreselectionWithRelations,
    field: 'spec_pip' | 'spec_blade',
    label: string
  ) => {
    const currentValue = !!getRecordFieldValue(presel, field);
    await requestFieldUpdate(presel, field, label, !currentValue);
  };

  const formatCurrency = (value?: number | null, currencyCode: string | null = 'USD') => {
    if (value === null || value === undefined) return '-';
    try {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: currencyCode || 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `$${value.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
    }
  };

  const formatHours = (value?: number | null) => {
    if (!value && value !== 0) return '-';
    return `${value.toLocaleString('es-CO')} hrs`;
  };

const normalizeForCompare = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') return Number.isNaN(value) ? '' : value;
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (typeof value === 'boolean') return value;
  return value;
};

const formatChangeValue = (value: string | number | boolean | null | undefined) => {
  if (value === null || value === undefined || value === '') return 'Sin valor';
  if (typeof value === 'number') return value.toLocaleString('es-CO');
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
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
  recordId: string,
  fieldName: string
) => {
  return (indicators[recordId] || []).filter((log) => log.fieldName === fieldName);
};

const mapValueForLog = (value: string | number | boolean | null | undefined): string | number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return value as string | number;
};

const InlineTile: React.FC<{
  label: string;
  children: React.ReactNode;
  className?: string;
}> = ({ label, children, className }) => {
  const baseClasses =
    'p-1.5 border rounded-lg bg-white shadow-sm min-h-[64px] flex flex-col gap-1';
  return (
    <div className={className ? `${baseClasses} ${className}` : baseClasses}>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="text-xs text-gray-700 leading-snug w-full">{children}</div>
    </div>
  );
};

type InlineCellProps = {
  children: React.ReactNode;
  recordId?: string;
  fieldName?: string;
  indicators?: InlineChangeIndicator[];
  openPopover?: { recordId: string; fieldName: string } | null;
  onIndicatorClick?: (event: React.MouseEvent, recordId: string, fieldName: string) => void;
};

const InlineCell: React.FC<InlineCellProps> = ({
  children,
  recordId,
  fieldName,
  indicators,
  openPopover,
  onIndicatorClick,
}) => {
  const hasIndicator = !!(recordId && fieldName && indicators && indicators.length);
  const isOpen =
    hasIndicator && openPopover?.recordId === recordId && openPopover.fieldName === fieldName;

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      {hasIndicator && onIndicatorClick && (
        <button
          type="button"
          className="change-indicator-btn absolute -top-1 -left-1 z-10 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200"
          title="Ver historial de cambios"
          onClick={(e) => onIndicatorClick(e, recordId!, fieldName!)}
        >
          <Clock className="w-2.5 h-2.5" />
        </button>
      )}
      <div className="flex-1 min-w-0">{children}</div>
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

  // Estadísticas
  const totalPending = filteredPreselections.filter(p => p.decision === 'PENDIENTE').length;
  const totalApproved = filteredPreselections.filter(p => p.decision === 'SI').length;

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-[1600px] mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="bg-white rounded-2xl shadow-md px-6 py-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Panel de Preselección</h1>
                <p className="text-sm text-gray-500">Evaluación y selección de equipos para subastas</p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-1.5 bg-gray-900 text-white hover:bg-gray-800 shadow-md px-3 py-1.5 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Nueva
                </Button>
                <Button
                  onClick={() => setIsSpecDefaultsModalOpen(true)}
                  className="flex items-center gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 shadow-md px-3 py-1.5 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Especi
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
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
                <p className="text-2xl font-bold text-brand-gray">{filteredPreselections.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-brand-gray" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-gray">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{totalPending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-gray">Aprobadas</p>
                <p className="text-2xl font-bold text-green-600">{totalApproved}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            {/* Filters */}
            <div className="mb-6 space-y-4">
              <div className="p-3 rounded-2xl border border-dashed border-brand-red/50 bg-rose-50/30 shadow-sm">
                <div className="grid grid-cols-1 lg:grid-cols-[auto_auto_auto_auto] gap-3 lg:items-center">
                  <div className="flex items-center gap-3">
                    <div className="text-[10px] uppercase font-semibold text-gray-500 leading-tight min-w-[46px]">Fecha</div>
                    <div className="flex flex-col gap-0.5">
                      {!quickCreateDate && <span className="text-[11px] text-gray-400">dd/mm/aaaa</span>}
                      <input
                        type="date"
                        value={quickCreateDate}
                        onChange={(e) => setQuickCreateDate(e.target.value)}
                        className="h-9 border border-gray-300 rounded-lg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-[10px] uppercase font-semibold text-gray-500 leading-tight min-w-[70px]">Hora local</div>
                    <div className="flex flex-col gap-0.5">
                      {!quickCreateTime && <span className="text-[11px] text-gray-400">--:-- -----</span>}
                      <input
                        type="time"
                        value={quickCreateTime}
                        onChange={(e) => setQuickCreateTime(e.target.value)}
                        className="h-9 border border-gray-300 rounded-lg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-[10px] uppercase font-semibold text-gray-500 leading-tight min-w-[55px]">Ciudad</div>
                    <select
                      value={quickCreateCity}
                      onChange={(e) => setQuickCreateCity(e.target.value)}
                      className="h-9 border border-gray-300 rounded-lg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red"
                    >
                      <option value="">Seleccionar ciudad</option>
                      {citySelectOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={handleQuickCreate}
                    disabled={!quickCreateDate || !quickCreateTime || !quickCreateCity || quickCreateLoading}
                    className="bg-brand-red text-white px-4 py-2 rounded-lg shadow-sm hover:bg-primary-700 disabled:opacity-60 h-9"
                  >
                    {quickCreateLoading ? 'Creando...' : 'Crear tarjeta'}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 min-w-[220px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por modelo, serial, lote o proveedor..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red shadow-sm"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap md:flex-nowrap gap-3">
                  <Select
                    value={decisionFilter}
                    onChange={(e) => setDecisionFilter(e.target.value as PreselectionDecision | '')}
                    options={[
                      { value: '', label: 'Todas las decisiones' },
                      { value: 'PENDIENTE', label: '⏳ Pendiente' },
                      { value: 'SI', label: '✓ Aprobada' },
                      { value: 'NO', label: '✗ Rechazada' },
                    ]}
                    className="min-w-[200px]"
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

              {/* Indicador de Filtros */}
              {(dateFilter || decisionFilter || searchTerm) && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                  <p className="text-sm text-brand-red font-medium">
                    Mostrando {filteredPreselections.length} preselección{filteredPreselections.length !== 1 ? 'es' : ''}
                    {dateFilter && ` para ${new Date(dateFilter).toLocaleDateString('es-CO')}`}
                    {decisionFilter && ` ${decisionFilter.toLowerCase()}`}
                  </p>
                  <button
                    onClick={() => {
                      setDateFilter('');
                      setDecisionFilter('');
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

            {/* Colección de tarjetas */}
            <div className="space-y-6">
              {isLoading ? (
                <div className="p-12 text-center bg-white border rounded-2xl">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand-red border-t-transparent"></div>
                  <p className="text-gray-600 mt-4">Cargando preselecciones...</p>
                </div>
              ) : groupedPreselections.length === 0 ? (
                <div className="p-12 text-center bg-white border rounded-2xl">
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-lg">No hay preselecciones para mostrar</p>
                </div>
              ) : (
                groupedPreselections.map((group, groupIndex) => {
                  const isExpanded = expandedDates.has(group.date);
                  const summaryPresel = group.preselections[0];
                  const headerColombiaLabel = summaryPresel
                    ? formatStoredColombiaTime(
                        summaryPresel.colombia_time,
                        summaryPresel.auction_date,
                        summaryPresel.local_time,
                        summaryPresel.auction_city
                      )
                    : 'Define fecha, hora y ciudad';

                  return (
                    <motion.div
                      key={group.date}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: groupIndex * 0.05 }}
                      className="border border-gray-200 rounded-2xl bg-white shadow-sm"
                    >
                      <button
                        className="w-full text-left p-5 flex flex-col gap-4"
                        onClick={() => toggleDateExpansion(group.date)}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="w-6 h-6 text-brand-red" />
                            ) : (
                              <ChevronRight className="w-6 h-6 text-brand-red" />
                            )}
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
                                Hora Colombia
                              </p>
                              <div className="inline-flex items-center px-3 py-1 rounded-lg bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 border border-rose-200 text-sm font-semibold text-rose-700 shadow-sm">
                                {headerColombiaLabel}
                              </div>
                              <p className="text-sm text-gray-500">
                                {group.totalPreselections} preselección{group.totalPreselections !== 1 ? 'es' : ''}
                              </p>
                            </div>
                          </div>
                        <div className="flex gap-3">
                          <div className="px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-center">
                            <p className="text-xl font-semibold text-amber-700">{group.pendingCount}</p>
                            <p className="text-xs text-amber-600">Pendientes</p>
                          </div>
                          <div className="px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                            <p className="text-xl font-semibold text-emerald-700">{group.approvedCount}</p>
                            <p className="text-xs text-emerald-600">Aprobadas</p>
                          </div>
                        </div>
                        </div>

                        {summaryPresel && (
                          <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mt-2" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-1.5">
                              <InlineTile label="Proveedor">
                                <InlineCell {...buildCellProps(summaryPresel.id, 'supplier_name')}>
                                  <InlineFieldEditor
                                    value={summaryPresel.supplier_name}
                                    type="select"
                                    placeholder="Seleccionar proveedor"
                                    options={supplierOptions}
                                    onSave={(val) =>
                                      requestFieldUpdate(summaryPresel, 'supplier_name', 'Proveedor', val)
                                    }
                                  />
                                </InlineCell>
                              </InlineTile>
                              <InlineTile label="Tipo de subasta">
                                <InlineCell {...buildCellProps(summaryPresel.id, 'auction_type')}>
                                  <InlineFieldEditor
                                    value={summaryPresel.auction_type}
                                    type="select"
                                    placeholder="Seleccionar tipo"
                                    options={[
                                      { value: 'PARADE/LIVE', label: 'PARADE/LIVE' },
                                      { value: 'INTERNET', label: 'INTERNET' },
                                      { value: 'TENDER', label: 'TENDER' },
                                    ]}
                                    onSave={(val) =>
                                      requestFieldUpdate(summaryPresel, 'auction_type', 'Tipo de subasta', val)
                                    }
                                  />
                                </InlineCell>
                              </InlineTile>
                              <div className="md:col-span-2">
                                <InlineTile label="Fecha y hora local" className="md:col-span-2">
                                  <div className="flex flex-col gap-2.5">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                      <div className="min-w-[150px]">
                                        <p className="text-[10px] uppercase text-gray-400 font-semibold mb-0.5">Fecha</p>
                                        <InlineCell {...buildCellProps(summaryPresel.id, 'auction_date')}>
                                          <InlineFieldEditor
                                            value={
                                              summaryPresel.auction_date
                                                ? new Date(summaryPresel.auction_date).toISOString().split('T')[0]
                                                : ''
                                            }
                                            type="date"
                                            placeholder="Fecha"
                                            inputClassName="h-10"
                                            onSave={async (val) => {
                                              const dateValue =
                                                typeof val === 'string' && val
                                                  ? new Date(`${val}T00:00:00`).toISOString()
                                                  : null;
                                              return requestFieldUpdate(
                                                summaryPresel,
                                                'auction_date',
                                                'Fecha local',
                                                dateValue,
                                                { auction_date: dateValue }
                                              );
                                            }}
                                            displayFormatter={() =>
                                              summaryPresel.auction_date
                                                ? new Date(summaryPresel.auction_date).toLocaleDateString('es-CO')
                                                : 'Sin fecha'
                                            }
                                          />
                                        </InlineCell>
                                      </div>
                                      <div className="min-w-[150px]">
                                        <p className="text-[10px] uppercase text-gray-400 font-semibold mb-0.5">Hora</p>
                                        <InlineCell {...buildCellProps(summaryPresel.id, 'local_time')}>
                                          <InlineFieldEditor
                                            value={summaryPresel.local_time || ''}
                                            type="time"
                                            placeholder="Hora local"
                                            inputClassName="h-10 pr-3 pl-2"
                                            displayFormatter={(val) => (val ? `${val} hrs` : 'Sin hora')}
                                            onSave={(val) =>
                                              requestFieldUpdate(summaryPresel, 'local_time', 'Hora local', val)
                                            }
                                          />
                                        </InlineCell>
                                      </div>
                                      <div className="min-w-[150px]">
                                        <p className="text-[10px] uppercase text-gray-400 font-semibold mb-0.5">Ciudad</p>
                                        <InlineCell {...buildCellProps(summaryPresel.id, 'auction_city')}>
                                          <InlineFieldEditor
                                            value={summaryPresel.auction_city || ''}
                                            type="select"
                                            placeholder="Seleccionar ciudad"
                                            options={citySelectOptions}
                                            inputClassName="h-10"
                                            displayFormatter={(val) => getCityMeta(val)?.label || 'Sin ciudad'}
                                            onSave={(val) =>
                                              requestFieldUpdate(summaryPresel, 'auction_city', 'Ciudad', val)
                                            }
                                          />
                                        </InlineCell>
                                      </div>
                                    </div>
                                  </div>
                                </InlineTile>
                              </div>
                              <div className="md:col-span-1 lg:max-w-xs">
                                <InlineTile label="URL">
                                  <InlineCell {...buildCellProps(summaryPresel.id, 'auction_url')}>
                                    <InlineFieldEditor
                                      value={summaryPresel.auction_url}
                                      placeholder="Enlace"
                                      onSave={(val) => requestFieldUpdate(summaryPresel, 'auction_url', 'URL', val)}
                                      displayFormatter={(val) =>
                                        val ? (
                                          <a
                                            href={typeof val === 'string' ? val : ''}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-brand-red underline text-xs"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            Abrir enlace
                                          </a>
                                        ) : (
                                          <span className="text-gray-400">Sin URL</span>
                                        )
                                      }
                                    />
                                  </InlineCell>
                                </InlineTile>
                              </div>
                              <InlineTile label="Moneda">
                                <InlineCell {...buildCellProps(summaryPresel.id, 'currency')}>
                                  <InlineFieldEditor
                                    value={summaryPresel.currency}
                                    type="select"
                                    placeholder="Moneda"
                                    options={[
                                      { value: 'USD', label: 'USD' },
                                      { value: 'JPY', label: 'JPY' },
                                      { value: 'GBP', label: 'GBP' },
                                    ]}
                                    onSave={(val) => requestFieldUpdate(summaryPresel, 'currency', 'Moneda', val)}
                                  />
                                </InlineCell>
                              </InlineTile>
                              <InlineTile label="Ubicación">
                                <InlineCell {...buildCellProps(summaryPresel.id, 'location')}>
                                  <InlineFieldEditor
                                    value={summaryPresel.location}
                                    type="select"
                                    placeholder="Ubicación"
                                    options={[
                                      { value: 'EEUU', label: 'Estados Unidos' },
                                      { value: 'JAPON', label: 'Japón' },
                                      { value: 'UK', label: 'United Kingdom' },
                                      { value: 'OTRO', label: 'Otro' },
                                    ]}
                                    onSave={(val) => requestFieldUpdate(summaryPresel, 'location', 'Ubicación', val)}
                                  />
                                </InlineCell>
                              </InlineTile>
                            </div>
                          </div>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-100">
                          <div className="flex items-center justify-start px-4 py-2 bg-gray-50 border-b border-gray-100">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddMachineToGroup(group.date, summaryPresel);
                              }}
                              disabled={addingMachineFor === group.date}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-brand-red text-brand-red hover:bg-brand-red hover:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          {group.preselections.map((presel, idx) => {
                            const auctionStatusLabel = resolveAuctionStatusLabel(presel);
                            return (
                              <motion.div
                                key={presel.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.04 }}
                                className="px-4 py-5 bg-white"
                              >
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start text-sm text-gray-700">
                                  <div>
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Lote</p>
                                    <InlineCell {...buildCellProps(presel.id, 'lot_number')}>
                                      <InlineFieldEditor
                                        value={presel.lot_number}
                                        placeholder="Lote"
                                        onSave={(val) => requestFieldUpdate(presel, 'lot_number', 'Lote', val)}
                                      />
                                    </InlineCell>
                                  </div>
                                  <div>
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Marca</p>
                                    <InlineCell {...buildCellProps(presel.id, 'brand')}>
                                      <InlineFieldEditor
                                        value={presel.brand}
                                        type="select"
                                        placeholder="Seleccionar marca"
                                        options={brandSelectOptions}
                                        onSave={(val) => requestFieldUpdate(presel, 'brand', 'Marca', val)}
                                      />
                                    </InlineCell>
                                  </div>
                                  <div>
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Modelo</p>
                                    <InlineCell {...buildCellProps(presel.id, 'model')}>
                                      <InlineFieldEditor
                                        value={presel.model}
                                        type="select"
                                        placeholder="Seleccionar modelo"
                                        options={modelSelectOptions}
                                        onSave={(val) => requestFieldUpdate(presel, 'model', 'Modelo', val)}
                                      />
                                    </InlineCell>
                                  </div>
                                  <div>
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Serie</p>
                                    <InlineCell {...buildCellProps(presel.id, 'serial')}>
                                      <InlineFieldEditor
                                        value={presel.serial}
                                        placeholder="Serie"
                                        className="font-mono"
                                        onSave={(val) => requestFieldUpdate(presel, 'serial', 'Serie', val)}
                                      />
                                    </InlineCell>
                                  </div>
                                  <div>
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Año</p>
                                    <InlineCell {...buildCellProps(presel.id, 'year')}>
                                      <InlineFieldEditor
                                        value={presel.year}
                                        type="number"
                                        placeholder="Año"
                                        onSave={(val) => requestFieldUpdate(presel, 'year', 'Año', val)}
                                      />
                                    </InlineCell>
                                  </div>
                                  <div>
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Horas</p>
                                    <InlineCell {...buildCellProps(presel.id, 'hours')}>
                                      <InlineFieldEditor
                                        value={presel.hours}
                                        type="number"
                                        placeholder="Horas"
                                        displayFormatter={(val) => formatHours(toNumberOrNull(val))}
                                        onSave={(val) => requestFieldUpdate(presel, 'hours', 'Horas', val)}
                                      />
                                    </InlineCell>
                                  </div>
                                  <div className="lg:col-span-2">
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold mb-2">Especificaciones</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="min-w-0">
                                        <p className="text-[10px] uppercase text-gray-400 font-semibold mb-1">Ancho zapatas</p>
                                        <InlineCell {...buildCellProps(presel.id, 'shoe_width_mm')}>
                                          <InlineFieldEditor
                                            value={presel.shoe_width_mm}
                                            type="number"
                                            placeholder="Ancho (mm)"
                                            inputClassName="h-8 text-xs"
                                            displayFormatter={(val) => {
                                              const numeric = toNumberOrNull(val);
                                              return numeric !== null ? `${numeric.toLocaleString('es-CO')} mm` : <span className="text-gray-400 text-xs">Definir</span>;
                                            }}
                                            onSave={(val) =>
                                              requestFieldUpdate(presel, 'shoe_width_mm', 'Ancho zapatas', val)
                                            }
                                          />
                                        </InlineCell>
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-[10px] uppercase text-gray-400 font-semibold mb-1">Cabina</p>
                                        <InlineCell {...buildCellProps(presel.id, 'spec_cabin')}>
                                          <InlineFieldEditor
                                            value={presel.spec_cabin}
                                            type="select"
                                            placeholder="Seleccionar"
                                            options={CABIN_OPTIONS}
                                            inputClassName="h-8 text-xs"
                                            displayFormatter={(val) => {
                                              if (!val) {
                                                return <span className="text-gray-400 text-xs">Definir</span>;
                                              }
                                              const option = CABIN_OPTIONS.find((opt) => opt.value === val);
                                              return <span className="text-xs">{option ? option.label : val}</span>;
                                            }}
                                            onSave={(val) =>
                                              requestFieldUpdate(presel, 'spec_cabin', 'Tipo de cabina', val)
                                            }
                                          />
                                        </InlineCell>
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-[10px] uppercase text-gray-400 font-semibold mb-1">Tipo de Brazo</p>
                                        <InlineCell {...buildCellProps(presel.id, 'arm_type')}>
                                          <InlineFieldEditor
                                            value={presel.arm_type}
                                            type="select"
                                            placeholder="Seleccionar"
                                            options={ARM_TYPE_OPTIONS}
                                            inputClassName="h-8 text-xs"
                                            displayFormatter={(val) => {
                                              if (!val) {
                                                return <span className="text-gray-400 text-xs">Definir</span>;
                                              }
                                              const option = ARM_TYPE_OPTIONS.find((opt) => opt.value === val);
                                              return <span className="text-xs">{option ? option.label : val}</span>;
                                            }}
                                            onSave={(val) =>
                                              requestFieldUpdate(presel, 'arm_type', 'Tipo de brazo', val)
                                            }
                                          />
                                        </InlineCell>
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-[10px] uppercase text-gray-400 font-semibold mb-1">Accesorios</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => handleToggleSpec(presel, 'spec_pip', 'PIP')}
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                              presel.spec_pip ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'border-gray-200 text-gray-500'
                                            }`}
                                          >
                                            PIP
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleToggleSpec(presel, 'spec_blade', 'Blade')}
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                              presel.spec_blade ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'border-gray-200 text-gray-500'
                                            }`}
                                          >
                                            Blade
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Precio sugerido</p>
                                    <div className="flex flex-col gap-1">
                                      <InlineCell {...buildCellProps(presel.id, 'suggested_price')}>
                                        <InlineFieldEditor
                                          value={presel.suggested_price}
                                          type="number"
                                          placeholder="Valor sugerido"
                                          displayFormatter={(val) => formatCurrency(toNumberOrNull(val), presel.currency)}
                                          onSave={(val) =>
                                            requestFieldUpdate(presel, 'suggested_price', 'Precio sugerido', val)
                                          }
                                        />
                                      </InlineCell>
                                      {presel.model && (
                                        <PriceSuggestion
                                          type="auction"
                                          model={presel.model}
                                          year={presel.year}
                                          hours={presel.hours}
                                          autoFetch={true}
                                          compact={true}
                                          onApply={(value) => requestFieldUpdate(presel, 'suggested_price', 'Precio sugerido', value)}
                                        />
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-center">
                                    {presel.decision === 'SI' ? (
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white">
                                          <CheckCircle className="w-5 h-5" />
                                        </span>
                                        <span className="text-xs font-semibold text-emerald-700">Aprobada</span>
                                      </div>
                                    ) : presel.decision === 'NO' ? (
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-600 text-white">
                                          <XCircle className="w-5 h-5" />
                                        </span>
                                        <span className="text-xs font-semibold text-rose-700">Rechazada</span>
                                      </div>
                                    ) : (
                                      <div className="flex justify-center gap-2">
                                        <button
                                          onClick={() => handleDecision(presel.id, 'SI')}
                                          className="w-9 h-9 rounded-full border border-emerald-500 text-emerald-600 flex items-center justify-center hover:bg-emerald-50 transition"
                                          title="Aprobar"
                                        >
                                          <CheckCircle className="w-5 h-5" />
                                        </button>
                                        <button
                                          onClick={() => handleDecision(presel.id, 'NO')}
                                          className="w-9 h-9 rounded-full border border-rose-500 text-rose-600 flex items-center justify-center hover:bg-rose-50 transition"
                                          title="Rechazar"
                                        >
                                          <XCircle className="w-5 h-5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Precio compra</p>
                                    {presel.auction_price_bought !== null && presel.auction_price_bought !== undefined ? (
                                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-slate-900 to-gray-700 text-white shadow">
                                        {formatCurrency(presel.auction_price_bought, presel.currency)}
                                      </span>
                                    ) : (
                                      <InlineCell {...buildCellProps(presel.id, 'final_price')}>
                                        <InlineFieldEditor
                                          value={presel.final_price}
                                          type="number"
                                          placeholder="Precio compra"
                                          displayFormatter={(val) =>
                                            toNumberOrNull(val) !== null
                                              ? formatCurrency(toNumberOrNull(val), presel.currency)
                                              : 'Sin definir'
                                          }
                                          onSave={(val) =>
                                            requestFieldUpdate(presel, 'final_price', 'Precio compra', val)
                                          }
                                        />
                                      </InlineCell>
                                    )}
                                  </div>
                                  <div className="lg:col-span-1">
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Estado subasta</p>
                                    <span className={getAuctionStatusStyle(auctionStatusLabel)}>
                                      {auctionStatusLabel}
                                    </span>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </Card>
        </motion.div>

        {/* Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedPreselection(null);
          }}
          title={selectedPreselection ? 'Editar Preselección' : 'Nueva Preselección'}
          size="lg"
        >
          <PreselectionForm 
            preselection={selectedPreselection} 
            onSuccess={() => {
              setIsModalOpen(false);
              setSelectedPreselection(null);
              refetch();
            }} 
            onCancel={() => {
              setIsModalOpen(false);
              setSelectedPreselection(null);
            }} 
          />
        </Modal>
        <ChangeLogModal
          isOpen={changeModalOpen}
          changes={changeModalItems}
          onConfirm={handleConfirmInlineChange}
          onCancel={handleCancelInlineChange}
        />
        
        <MachineSpecDefaultsModal
          isOpen={isSpecDefaultsModalOpen}
          onClose={() => setIsSpecDefaultsModalOpen(false)}
        />
      </div>
    </div>
  );
};

