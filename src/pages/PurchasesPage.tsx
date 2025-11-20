/**
 * Página de Compras - Diseño Premium Empresarial
 */

import { useState, useRef, useEffect } from 'react';
import { Plus, Search, Download, Package, DollarSign, Truck, FileText, Eye, Edit, History, AlertCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../atoms/Button';
import { Card } from '../molecules/Card';
import { Modal } from '../molecules/Modal';
import { Select } from '../atoms/Select';
import { DataTable, Column } from '../organisms/DataTable';
import { PurchaseWithRelations, PaymentStatus } from '../types/database';
import { PurchaseFormNew } from '../components/PurchaseFormNew';
import { usePurchases } from '../hooks/usePurchases';
import { showSuccess, showError } from '../components/Toast';
import { MachineFiles } from '../components/MachineFiles';
import { ChangeHistory } from '../components/ChangeHistory';
import { InlineFieldEditor } from '../components/InlineFieldEditor';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { apiPatch, apiPost, apiGet } from '../services/api';

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

const INCOTERM_OPTIONS = [
  { value: 'EXW', label: 'EXW' },
  { value: 'FOB', label: 'FOB' },
  { value: 'CIF', label: 'CIF' },
  { value: 'DAP', label: 'DAP' },
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'JPY', label: 'JPY' },
  { value: 'EUR', label: 'EUR' },
  { value: 'COP', label: 'COP' },
];

const getShipmentStyle = (shipment: string | null | undefined) => {
  if (!shipment) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  const upperShipment = shipment.toUpperCase();
  if (upperShipment.includes('RORO')) {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md';
  } else if (upperShipment.includes('1X40')) {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md';
  }
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
};

const getMQStyle = (mq: string | null | undefined) => {
  if (!mq || mq === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 font-mono';
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-gray to-secondary-600 text-white shadow-md font-mono';
};

const getTipoCompraStyle = (tipo: string | null | undefined) => {
  if (!tipo || tipo === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  const upperTipo = tipo.toUpperCase();
  if (upperTipo.includes('SUBASTA')) {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md';
  } else if (upperTipo.includes('COMPRA_DIRECTA') || upperTipo.includes('COMPRA DIRECTA')) {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md';
  }
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
};

const getProveedorStyle = (proveedor: string | null | undefined) => {
  if (!proveedor || proveedor === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-lime-500 to-green-500 text-white shadow-md';
};

const getModeloStyle = (modelo: string | null | undefined) => {
  if (!modelo) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md';
};

const getSerialStyle = (serial: string | null | undefined) => {
  if (!serial) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200 font-mono';
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-slate-600 to-gray-700 text-white shadow-md font-mono';
};

const getFechaFacturaStyle = (fecha: string | null | undefined) => {
  if (!fecha || fecha === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md';
};

const getUbicacionStyle = (ubicacion: string | null | undefined) => {
  if (!ubicacion || ubicacion === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md';
};

const getIncotermStyle = (incoterm: string | null | undefined) => {
  if (!incoterm) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  const upperIncoterm = incoterm.toUpperCase();
  if (upperIncoterm === 'EXW') {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md';
  } else if (upperIncoterm === 'FOB') {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md';
  }
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
};

const getMonedaStyle = (moneda: string | null | undefined) => {
  if (!moneda || moneda === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  const upperMoneda = moneda.toUpperCase();
  if (upperMoneda === 'USD') {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md';
  } else if (upperMoneda === 'JPY') {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md';
  } else if (upperMoneda === 'EUR') {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-yellow-500 to-amber-500 text-gray-900 shadow-md';
  }
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
};

const getTasaStyle = (tasa: string | number | null | undefined) => {
  if (!tasa || tasa === '-' || tasa === 'PDTE' || tasa === '') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-red-100 text-red-600 border border-red-200';
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md';
};

const getValorStyle = (valor: string | number | null | undefined) => {
  if (!valor || valor === '-' || valor === 0 || valor === '0') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md';
};

const getReporteStyle = (reporte: string | null | undefined) => {
  if (!reporte || reporte === 'PDTE' || reporte === '') {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md';
  }
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md';
};

const getPaymentStatusStyle = (status: PaymentStatus | null | undefined) => {
  if (!status) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
  if (status === 'PENDIENTE') {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-md';
  } else if (status === 'DESBOLSADO') {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md';
  } else if (status === 'COMPLETADO') {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md';
  }
  return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
};

const SHIPMENT_OPTIONS = [
  { value: 'RORO', label: 'RORO' },
  { value: '1X40', label: '1 x 40' },
  { value: '1X20', label: '1 x 20' },
  { value: 'LCL', label: 'LCL' },
  { value: 'AEREO', label: 'Aéreo' },
];

const REPORT_STATUS_OPTIONS = [
  { value: '', label: 'PDTE' },
  { value: 'REPORTADO', label: 'Reportado' },
  { value: 'EN_PROCESO', label: 'En proceso' },
  { value: 'NO_APLICA', label: 'No aplica' },
];

const parseCurrencyValue = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isNaN(numeric) ? null : numeric;
};

const formatCurrencyDisplay = (
  currency: string | null | undefined,
  value: string | number | null | undefined
) => {
  const numeric = parseCurrencyValue(value);
  if (numeric === null) {
    return <span className="text-gray-400">Sin definir</span>;
  }
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: (currency as Intl.NumberFormatOptions['currency']) || 'USD',
      maximumFractionDigits: 0,
    }).format(numeric);
  } catch {
    return numeric.toLocaleString('es-CO');
  }
};

export const PurchasesPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseWithRelations | null>(null);
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | ''>('');
  const [searchTerm, setSearchTerm] = useState('');
  // Filtros de columnas
  const [supplierFilter, setSupplierFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [invoiceDateFilter, setInvoiceDateFilter] = useState('');
  const [paymentDateFilter, setPaymentDateFilter] = useState('');
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeModalItems, setChangeModalItems] = useState<InlineChangeItem[]>([]);
  const [inlineChangeIndicators, setInlineChangeIndicators] = useState<
    Record<string, InlineChangeIndicator[]>
  >({});
  const [openChangePopover, setOpenChangePopover] = useState<{ recordId: string; fieldName: string } | null>(null);
  const pendingChangeRef = useRef<{
    purchaseId: string;
    updates: Record<string, unknown>;
    changes: InlineChangeItem[];
  } | null>(null);
  const pendingResolveRef = useRef<((value?: void | PromiseLike<void>) => void) | null>(null);
  const pendingRejectRef = useRef<((reason?: unknown) => void) | null>(null);
  
  // Refs para scroll sincronizado
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const { purchases, isLoading, refetch, updatePurchaseFields } = usePurchases();

  // Cargar indicadores de cambios desde el backend
  useEffect(() => {
    const loadChangeIndicators = async () => {
      if (purchases.length === 0) return;
      
      try {
        const indicatorsMap: Record<string, InlineChangeIndicator[]> = {};
        
        // Cargar cambios para cada compra
        await Promise.all(
          purchases.map(async (purchase) => {
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
              }>>(`/api/change-logs/purchases/${purchase.id}`);
              
              if (changes && changes.length > 0) {
                indicatorsMap[purchase.id] = changes.slice(0, 10).map((change) => ({
                  id: change.id,
                  fieldName: change.field_name,
                  fieldLabel: change.field_label,
                  oldValue: change.old_value,
                  newValue: change.new_value,
                  reason: change.change_reason || undefined,
                  changedAt: change.changed_at,
                  moduleName: change.module_name || null,
                }));
              }
            } catch {
              // Silenciar errores individuales (puede que no haya cambios)
              console.debug('No se encontraron cambios para compra:', purchase.id);
            }
          })
        );
        
        setInlineChangeIndicators(indicatorsMap);
      } catch (error) {
        console.error('Error al cargar indicadores de cambios:', error);
      }
    };
    
    if (!isLoading && purchases.length > 0) {
      loadChangeIndicators();
    }
  }, [purchases, isLoading]);

  const filteredPurchases = purchases
    .filter((purchase) => purchase.condition !== 'NUEVO') // Solo USADOS en este módulo
    .filter((purchase) => {
      if (statusFilter && purchase.payment_status !== statusFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          purchase.mq?.toLowerCase().includes(search) ||
          purchase.machine?.serial?.toLowerCase().includes(search) ||
          purchase.port_of_embarkation?.toLowerCase().includes(search) ||
          purchase.machine?.model?.toLowerCase().includes(search) ||
          purchase.location?.toLowerCase().includes(search)
        );
      }
      // Filtros de columnas
      if (supplierFilter && purchase.supplier_name !== supplierFilter) return false;
      if (brandFilter && purchase.brand !== brandFilter) return false;
      if (modelFilter && purchase.model !== modelFilter) return false;
      if (invoiceDateFilter) {
        const invoiceDate = purchase.invoice_date ? new Date(purchase.invoice_date).toISOString().split('T')[0] : '';
        if (invoiceDate !== invoiceDateFilter) return false;
      }
      if (paymentDateFilter) {
        const paymentDate = purchase.payment_date ? new Date(purchase.payment_date).toISOString().split('T')[0] : '';
        if (paymentDate !== paymentDateFilter) return false;
      }
      return true;
    });

  // Valores únicos para filtros
  const uniqueSuppliers = Array.from(new Set(purchases.map(p => p.supplier_name).filter((s): s is string => Boolean(s)))).sort();
  const uniqueBrands = Array.from(new Set(purchases.map(p => p.brand).filter((b): b is string => Boolean(b)))).sort();
  const uniqueModels = Array.from(new Set(purchases.map(p => p.model).filter((m): m is string => Boolean(m)))).sort();
  const uniqueInvoiceDates = Array.from(new Set(
    purchases
      .map(p => p.invoice_date ? new Date(p.invoice_date).toISOString().split('T')[0] : null)
      .filter((d): d is string => Boolean(d))
  )).sort().reverse();
  const uniquePaymentDates = Array.from(new Set(
    purchases
      .map(p => p.payment_date ? new Date(p.payment_date).toISOString().split('T')[0] : null)
      .filter((d): d is string => Boolean(d))
  )).sort().reverse();

  // Estadísticas
  // Compras Activas (con estado PENDIENTE o DESBOLSADO)
  const activePurchases = filteredPurchases.filter(p => 
    p.payment_status === 'PENDIENTE' || p.payment_status === 'DESBOLSADO'
  ).length;
  
  // Pagos Pendientes - calcular monto total
  const pendingPaymentsAmount = filteredPurchases
    .filter(p => p.payment_status === 'PENDIENTE')
    .reduce((sum, p) => {
      const exw = parseFloat(p.exw_value_formatted?.replace(/[^0-9.-]/g, '') || '0');
      const disassembly = parseFloat(String(p.disassembly_load_value ?? 0));
      const total = exw + disassembly;
      return sum + total;
    }, 0);
  
  // Envíos en Tránsito (con fecha de salida pero sin llegada o fecha de llegada no cumplida)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const shipmentsInTransit = filteredPurchases.filter(p => {
    if (!p.shipment_departure_date) return false;
    // Si no tiene fecha de llegada, está en tránsito
    if (!p.shipment_arrival_date) return true;
    // Si tiene fecha de llegada pero no se ha cumplido, está en tránsito
    const arrivalDate = new Date(p.shipment_arrival_date);
    arrivalDate.setHours(0, 0, 0, 0);
    return arrivalDate > today;
  }).length;
  
  // Total Completados (los que tengan fecha de pago)
  const totalPaidCorrected = filteredPurchases.filter(p => p.payment_date).length;

  
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

  const normalizeForCompare = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number') return Number.isNaN(value) ? '' : value;
    if (typeof value === 'string') return value.trim().toLowerCase();
    if (typeof value === 'boolean') return value;
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

  const mapValueForLog = (value: string | number | boolean | null | undefined): string | number | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    return value as string | number;
  };

  const getFieldIndicators = (
    indicators: Record<string, InlineChangeIndicator[]>,
    recordId: string,
    fieldName: string
  ) => {
    return (indicators[recordId] || []).filter((log) => log.fieldName === fieldName);
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
        <div className="flex items-center gap-1">
          <div className="flex-1 min-w-0">{children}</div>
          {hasIndicator && onIndicatorClick && (
            <button
              type="button"
              className="change-indicator-btn inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200"
              title="Ver historial de cambios"
              onClick={(e) => onIndicatorClick(e, recordId!, fieldName!)}
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
                // El backend ahora siempre retorna module_name (usando table_name como fallback)
                const moduleLabel = log.moduleName ? getModuleLabel(log.moduleName) : getModuleLabel('compras');
                return (
                  <div key={log.id} className="border border-gray-100 rounded-lg p-2 bg-gray-50 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-gray-800">{log.fieldLabel}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                        {moduleLabel}
                      </span>
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

  const queueInlineChange = (
    purchaseId: string,
    updates: Record<string, unknown>,
    changeItem: InlineChangeItem
  ) => {
    return new Promise<void>((resolve, reject) => {
      pendingChangeRef.current = {
        purchaseId,
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
        updatePurchaseFields(pending.purchaseId, pending.updates as Partial<PurchaseWithRelations>)
      );
      await apiPost('/api/change-logs', {
        table_name: 'purchases',
        record_id: pending.purchaseId,
        changes: pending.changes,
        change_reason: reason || null,
        module_name: 'compras',
      });
      const indicator: InlineChangeIndicator = {
        id: `${pending.purchaseId}-${Date.now()}`,
        fieldName: pending.changes[0].field_name,
        fieldLabel: pending.changes[0].field_label,
        oldValue: pending.changes[0].old_value,
        newValue: pending.changes[0].new_value,
        reason,
        changedAt: new Date().toISOString(),
      };
      setInlineChangeIndicators((prev) => ({
        ...prev,
        [pending.purchaseId]: [indicator, ...(prev[pending.purchaseId] || [])].slice(0, 10),
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

  const getRecordFieldValue = (
    record: PurchaseWithRelations,
    fieldName: string
  ): string | number | boolean | null => {
    const typedRecord = record as unknown as Record<string, string | number | boolean | null | undefined>;
    const value = typedRecord[fieldName];
    return (value === undefined ? null : value) as string | number | boolean | null;
  };

  const beginInlineChange = (
    purchase: PurchaseWithRelations,
    fieldName: string,
    fieldLabel: string,
    oldValue: string | number | boolean | null,
    newValue: string | number | boolean | null,
    updates: Record<string, unknown>
  ) => {
    if (normalizeForCompare(oldValue) === normalizeForCompare(newValue)) {
      return Promise.resolve();
    }
    return queueInlineChange(purchase.id, updates, {
      field_name: fieldName,
      field_label: fieldLabel,
      old_value: mapValueForLog(oldValue),
      new_value: mapValueForLog(newValue),
    });
  };

  const requestFieldUpdate = (
    purchase: PurchaseWithRelations,
    fieldName: string,
    fieldLabel: string,
    newValue: string | number | boolean | null,
    updates?: Record<string, unknown>
  ) => {
    const currentValue = getRecordFieldValue(purchase, fieldName);
    return beginInlineChange(
      purchase,
      fieldName,
      fieldLabel,
      currentValue,
      newValue,
      updates ?? { [fieldName]: newValue }
    );
  };

  const buildCellProps = (recordId: string, field: string) => ({
    recordId,
    fieldName: field,
    indicators: getFieldIndicators(inlineChangeIndicators, recordId, field),
    openPopover: openChangePopover,
    onIndicatorClick: handleIndicatorClick,
  });


  // Función para toggle el marcador de pendiente
  const handleTogglePending = async (purchaseId: string) => {
    try {
      await apiPatch(`/api/purchases/${purchaseId}/toggle-pending`, {});
      await refetch();
      showSuccess('Marcador actualizado');
    } catch (error) {
      console.error('Error al actualizar marcador:', error);
      showError('Error al actualizar marcador');
    }
  };

  const columns: Column<PurchaseWithRelations>[] = [
    {
      key: 'pending_marker',
      label: '⚠️',
      sortable: false,
      render: (row: PurchaseWithRelations) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleTogglePending(row.id);
          }}
          className={`p-2 rounded-lg transition-all duration-200 ${
            row.pending_marker
              ? 'bg-red-100 text-red-600 hover:bg-red-200'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
          title={row.pending_marker ? 'Marcado como pendiente' : 'Marcar como pendiente'}
        >
          <AlertCircle className="w-5 h-5" />
        </button>
      ),
    },
    {
      key: 'mq',
      label: 'MQ',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <span className="font-mono text-gray-700">{row.mq || '-'}</span>
      ),
    },
    {
      key: 'purchase_type',
      label: 'TIPO',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <span className="text-gray-800 font-semibold">
          {row.purchase_type === 'COMPRA_DIRECTA'
            ? 'COMPRA DIRECTA'
            : row.purchase_type || 'Sin tipo'}
        </span>
      ),
    },
    {
      key: 'condition',
      label: 'CONDICIÓN',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <span className="text-gray-700">{row.condition || 'USADO'}</span>
      ),
    },
    {
      key: 'shipment_type_v2',
      label: 'SHIPMENT',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'shipment_type_v2')}>
          <InlineFieldEditor
            value={row.shipment_type_v2 || ''}
            type="select"
            placeholder="Tipo de envío"
            options={SHIPMENT_OPTIONS}
            displayFormatter={(val) =>
              val ? SHIPMENT_OPTIONS.find((opt) => opt.value === val)?.label || val : 'Sin definir'
            }
            onSave={(val) => requestFieldUpdate(row, 'shipment_type_v2', 'Tipo de envío', val)}
          />
        </InlineCell>
      ),
    },
    {
      key: 'supplier_name',
      label: 'PROVEEDOR',
      sortable: true,
      filter: (
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {uniqueSuppliers.map(supplier => (
            <option key={supplier || ''} value={supplier || ''}>{supplier}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => (
        <span className="font-semibold text-gray-900">{row.supplier_name || 'Sin proveedor'}</span>
      ),
    },
    {
      key: 'brand',
      label: 'MARCA',
      sortable: true,
      filter: (
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {uniqueBrands.map(brand => (
            <option key={brand || ''} value={brand || ''}>{brand}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => (
        <span className="text-gray-800 uppercase tracking-wide">{row.brand || 'Sin marca'}</span>
      ),
    },
    {
      key: 'model',
      label: 'MODELO',
      sortable: true,
      filter: (
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {uniqueModels.map(model => (
            <option key={model} value={model}>{model}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => (
        <span className="text-gray-800">{row.model || 'Sin modelo'}</span>
      ),
    },
    {
      key: 'serial',
      label: 'SERIAL',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <span className="text-gray-800 font-mono">{row.serial || 'Sin serial'}</span>
      ),
    },
    {
      key: 'purchase_order',
      label: 'ORDEN DE COMPRA',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'purchase_order')}>
          <InlineFieldEditor
            value={row.purchase_order || ''}
            placeholder="Orden de compra"
            onSave={(val) => requestFieldUpdate(row, 'purchase_order', 'Orden de compra', val)}
          />
        </InlineCell>
      ),
    },
    {
      key: 'invoice_number',
      label: 'No. FACTURA',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'invoice_number')}>
          <InlineFieldEditor
            value={row.invoice_number || ''}
            placeholder="No. Factura"
            onSave={(val) => requestFieldUpdate(row, 'invoice_number', 'No. Factura', val)}
          />
        </InlineCell>
      ),
    },
    {
      key: 'invoice_date',
      label: 'FECHA FACTURA',
      sortable: true,
      filter: (
        <select
          value={invoiceDateFilter}
          onChange={(e) => setInvoiceDateFilter(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas</option>
          {uniqueInvoiceDates.map(date => (
            <option key={date || ''} value={date || ''}>{date ? new Date(date).toLocaleDateString('es-CO') : ''}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'invoice_date')}>
          <InlineFieldEditor
            value={
              row.invoice_date
                ? new Date(row.invoice_date).toISOString().split('T')[0]
                : ''
            }
            type="date"
            placeholder="Fecha factura"
            onSave={(val) =>
              requestFieldUpdate(
                row,
                'invoice_date',
                'Fecha factura',
                typeof val === 'string' && val ? new Date(val).toISOString() : null,
                {
                  invoice_date: typeof val === 'string' && val ? new Date(val).toISOString() : null,
                }
              )
            }
            displayFormatter={(val) =>
              val
                ? new Date(val as string).toLocaleDateString('es-CO')
                : 'Sin fecha'
            }
          />
        </InlineCell>
      ),
    },
    {
      key: 'location',
      label: 'UBICACIÓN MÁQUINA',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'location')}>
          <InlineFieldEditor
            value={row.location || ''}
            placeholder='Ubicación'
            onSave={(val) => requestFieldUpdate(row, 'location', 'Ubicación', val)}
          />
        </InlineCell>
      ),
    },
    {
      key: 'incoterm',
      label: 'INCOTERM',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'incoterm')}>
          <InlineFieldEditor
            value={row.incoterm || ''}
            type="select"
            placeholder="Incoterm"
            options={INCOTERM_OPTIONS}
            onSave={(val) => requestFieldUpdate(row, 'incoterm', 'Incoterm', val)}
          />
        </InlineCell>
      ),
    },
    {
      key: 'currency_type',
      label: 'MONEDA',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'currency_type')}>
          <InlineFieldEditor
            value={row.currency_type || ''}
            type="select"
            placeholder="Moneda"
            options={CURRENCY_OPTIONS}
            onSave={(val) => requestFieldUpdate(row, 'currency_type', 'Moneda', val)}
          />
        </InlineCell>
      ),
    },
    {
      key: 'port_of_embarkation',
      label: 'PUERTO EMBARQUE',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'port_of_embarkation')}>
          <InlineFieldEditor
            value={row.port_of_embarkation || ''}
            placeholder="Puerto"
            onSave={(val) => requestFieldUpdate(row, 'port_of_embarkation', 'Puerto de embarque', val)}
          />
        </InlineCell>
      ),
    },
    {
      key: 'cpd',
      label: 'CPD',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'cpd')}>
          <InlineFieldEditor
            value={row.cpd || ''}
            placeholder="CPD"
            onSave={(val) => requestFieldUpdate(row, 'cpd', 'CPD', val)}
          />
        </InlineCell>
      ),
    },
    { 
      key: 'exw_value_formatted', 
      label: 'VALOR EXW + BP', 
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'exw_value_formatted')}>
          <InlineFieldEditor
            type="number"
            value={parseCurrencyValue(row.exw_value_formatted) ?? ''}
            placeholder="0"
            displayFormatter={() => formatCurrencyDisplay(row.currency_type, row.exw_value_formatted)}
            onSave={(val) => {
              const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
              const storageValue = numeric !== null ? numeric.toString() : null;
              return requestFieldUpdate(row, 'exw_value_formatted', 'Valor EXW + BP', storageValue, {
                exw_value_formatted: storageValue,
              });
            }}
          />
        </InlineCell>
      ),
    },
    {
      key: 'fob_expenses', 
      label: 'GASTOS FOB + LAVADO', 
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'fob_expenses')}>
          <InlineFieldEditor
            type="number"
            value={row.fob_expenses ?? ''}
            placeholder="0"
            disabled={row.incoterm === 'FOB'}
            displayFormatter={() =>
              row.incoterm === 'FOB'
                ? 'N/A (FOB)'
                : formatCurrencyDisplay(row.currency_type, row.fob_expenses)
            }
            onSave={(val) => {
              if (row.incoterm === 'FOB') return Promise.resolve();
              const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
              return requestFieldUpdate(row, 'fob_expenses', 'Gastos FOB + Lavado', numeric);
            }}
          />
        </InlineCell>
      ),
    },
    {
      key: 'disassembly_load_value', 
      label: 'DESENSAMBLAJE + CARGUE', 
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'disassembly_load_value')}>
          <InlineFieldEditor
            type="number"
            value={row.disassembly_load_value ?? ''}
            placeholder="0"
            disabled={row.incoterm === 'FOB'}
            displayFormatter={() =>
              row.incoterm === 'FOB'
                ? 'N/A (FOB)'
                : formatCurrencyDisplay(row.currency_type, row.disassembly_load_value)
            }
            onSave={(val) => {
              if (row.incoterm === 'FOB') return Promise.resolve();
              const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
              return requestFieldUpdate(row, 'disassembly_load_value', 'Desensamblaje + Cargue', numeric);
            }}
          />
        </InlineCell>
      ),
    },
    {
      key: 'fob_total',
      label: 'VALOR FOB (SUMA)',
      sortable: true,
      render: (row: PurchaseWithRelations) => {
        const exw = parseFloat(row.exw_value_formatted?.replace(/[^0-9.-]/g, '') || '0');
        const fobExpenses = parseFloat(String(row.fob_expenses ?? '0'));
        const disassembly = parseFloat(String(row.disassembly_load_value ?? '0'));
        const total = exw + fobExpenses + disassembly;
        const symbol = row.currency_type === 'USD' ? '$' : '¥';
        return total > 0 ? (
          <span className="text-gray-700">{symbol}{total.toLocaleString('es-CO')}</span>
        ) : (
          <span className="text-gray-400">-</span>
        );
      }
    },
    {
      key: 'usd_jpy_rate',
      label: 'CONTRAVALOR',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <span className="text-gray-700">
          {row.usd_jpy_rate ? `${row.usd_jpy_rate}` : 'PDTE'}
        </span>
      ),
    },
    {
      key: 'trm_rate',
      label: 'TRM',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <span className="text-gray-700">
          {row.trm_rate ? `${row.trm_rate}` : 'PDTE'}
        </span>
      ),
    },
    { 
      key: 'payment_date', 
      label: 'FECHA DE PAGO', 
      sortable: true,
      filter: (
        <select
          value={paymentDateFilter}
          onChange={(e) => setPaymentDateFilter(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas</option>
          {uniquePaymentDates.map(date => (
            <option key={date || ''} value={date || ''}>{date ? new Date(date).toLocaleDateString('es-CO') : ''}</option>
          ))}
        </select>
      ),
      render: (row: PurchaseWithRelations) => (
        <span className="text-gray-700">
          {row.payment_date
            ? new Date(row.payment_date).toLocaleDateString('es-CO')
            : 'PDTE'}
        </span>
      ),
    },
    {
      key: 'shipment_departure_date',
      label: 'EMBARQUE SALIDA',
      sortable: true,
      render: (row: PurchaseWithRelations) => {
        if (!row.shipment_departure_date) return <span className="text-gray-400">PDTE</span>;
        const date = new Date(row.shipment_departure_date);
        return (
          <span className="text-xs text-gray-700">
            {date.toLocaleDateString('es-CO', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </span>
        );
      },
    },
    {
      key: 'shipment_arrival_date',
      label: 'EMBARQUE LLEGADA',
      sortable: true,
      render: (row: PurchaseWithRelations) => {
        if (!row.shipment_arrival_date) return <span className="text-gray-400">PDTE</span>;
        const date = new Date(row.shipment_arrival_date);
        return (
          <span className="text-xs text-gray-700">
            {date.toLocaleDateString('es-CO', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </span>
        );
      },
    },
    {
      key: 'sales_reported',
      label: 'REPORTADO VENTAS',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'sales_reported')}>
          <InlineFieldEditor
            type="select"
            value={row.sales_reported || ''}
            options={REPORT_STATUS_OPTIONS}
            placeholder="Seleccionar"
            displayFormatter={(val) =>
              REPORT_STATUS_OPTIONS.find((opt) => opt.value === val)?.label || val || 'PDTE'
            }
            onSave={(val) => requestFieldUpdate(row, 'sales_reported', 'Reportado Ventas', val)}
          />
        </InlineCell>
      ),
    },
    {
      key: 'commerce_reported',
      label: 'REPORTADO COMERCIO',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'commerce_reported')}>
          <InlineFieldEditor
            type="select"
            value={row.commerce_reported || ''}
            options={REPORT_STATUS_OPTIONS}
            placeholder="Seleccionar"
            displayFormatter={(val) =>
              REPORT_STATUS_OPTIONS.find((opt) => opt.value === val)?.label || val || 'PDTE'
            }
            onSave={(val) => requestFieldUpdate(row, 'commerce_reported', 'Reportado Comercio', val)}
          />
        </InlineCell>
      ),
    },
    {
      key: 'luis_lemus_reported',
      label: 'REPORTE LUIS LEMUS',
      sortable: true,
      render: (row: PurchaseWithRelations) => (
        <InlineCell {...buildCellProps(row.id, 'luis_lemus_reported')}>
          <InlineFieldEditor
            type="select"
            value={row.luis_lemus_reported || ''}
            options={REPORT_STATUS_OPTIONS}
            placeholder="Seleccionar"
            displayFormatter={(val) =>
              REPORT_STATUS_OPTIONS.find((opt) => opt.value === val)?.label || val || 'PDTE'
            }
            onSave={(val) => requestFieldUpdate(row, 'luis_lemus_reported', 'Reporte Luis Lemus', val)}
          />
        </InlineCell>
      ),
    },
    {
      key: 'actions',
      label: 'ACCIONES',
      sortable: false,
      render: (row: PurchaseWithRelations) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenView(row);
            }}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Ver detalles"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenModal(row);
            }}
            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="Editar"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPurchase(row);
              setIsHistoryOpen(true);
            }}
            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title="Historial de cambios"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      )
    },
  ];

  const handleOpenModal = (purchase: PurchaseWithRelations | null = null) => {
    setSelectedPurchase(purchase);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPurchase(null);
  };

  const handleOpenView = (purchase: PurchaseWithRelations) => {
    setSelectedPurchase(purchase);
    setIsViewOpen(true);
  };

  const handleCloseView = () => {
    setIsViewOpen(false);
    setSelectedPurchase(null);
  };

  const handleSuccess = () => {
    handleCloseModal();
    refetch();
    showSuccess('Compra guardada exitosamente');
  };

  // Sincronizar scroll superior con tabla
  useEffect(() => {
    // Pequeño delay para asegurar que DataTable esté montado
    const timer = setTimeout(() => {
      const topScroll = topScrollRef.current;
      const tableScroll = tableScrollRef.current;

      if (!topScroll || !tableScroll) {
        console.log('Refs no disponibles:', { topScroll: !!topScroll, tableScroll: !!tableScroll });
        return;
      }

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
  }, [filteredPurchases]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-gray-100 py-8">
      <div className="max-w-[1800px] mx-auto px-4">
        {/* Header Premium */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Panel de Compras</h1>
                <p className="text-gray-600">Gestión de compras, pagos y seguimiento logístico</p>
              </div>
              <Button 
                onClick={() => handleOpenModal()} 
                className="flex items-center gap-2 bg-gradient-to-r from-brand-red to-primary-600 hover:from-primary-600 hover:to-primary-700 shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Nueva Compra
          </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
        >
          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-brand-red">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-gray">Compras Activas</p>
                <p className="text-2xl font-bold text-brand-red">{activePurchases}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <Package className="w-6 h-6 text-brand-red" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-gray">Pagos Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">
                  ¥{(pendingPaymentsAmount / 1000000).toFixed(1)}M
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Envíos en Tránsito</p>
                <p className="text-2xl font-bold text-green-600">{shipmentsInTransit}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Truck className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-brand-gray">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-gray">Total Completados</p>
                <p className="text-2xl font-bold text-brand-gray">{totalPaidCorrected}</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-lg">
                <FileText className="w-6 h-6 text-brand-gray" />
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
                      placeholder="Buscar por MQ, serial, puerto de embarque, modelo, ubicación..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red focus:border-brand-red shadow-sm"
                    />
                  </div>
                </div>

                {/* Filters */}
                <div className="flex gap-3">
          <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | '')}
            options={[
                      { value: '', label: 'Todos los estados' },
                      { value: 'PENDIENTE', label: '⏳ Pendiente' },
                      { value: 'DESBOLSADO', label: '💰 En Proceso' },
                      { value: 'COMPLETADO', label: '✓ Completado' },
                    ]}
                    className="min-w-[180px]"
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
            </div>

            {/* Vista Móvil - Cards */}
            <div className="md:hidden space-y-4">
              {isLoading ? (
                <div className="bg-white rounded-xl shadow-md p-8 text-center">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6 mx-auto"></div>
                  </div>
                </div>
              ) : filteredPurchases.length === 0 ? (
                <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
                  No hay datos disponibles
                </div>
              ) : (
                filteredPurchases.map((row) => (
                  <div
                    key={row.id}
                    onClick={() => handleOpenModal(row)}
                    className={`bg-white rounded-xl shadow-lg p-4 border-2 transition-all ${
                      row.pending_marker
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-brand-red hover:shadow-xl'
                    }`}
                  >
                    {/* Header de la Card */}
                    <div className="flex items-start justify-between mb-4 pb-3 border-b border-gray-200">
                      <div className="flex items-center gap-3 flex-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePending(row.id);
                          }}
                          className={`p-2 rounded-lg transition-all ${
                            row.pending_marker
                              ? 'bg-red-100 text-red-600'
                              : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          <AlertCircle className="w-5 h-5" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-semibold text-gray-700">
                              {row.mq || '-'}
                            </span>
                            {row.purchase_type && (
                              <span className={getTipoCompraStyle(row.purchase_type)}>
                                {row.purchase_type === 'COMPRA_DIRECTA' ? 'COMPRA DIRECTA' : row.purchase_type}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {row.supplier_name || 'Sin proveedor'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenModal(row);
                          }}
                          className="p-2"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsHistoryOpen(true);
                            setSelectedPurchase(row);
                          }}
                          className="p-2"
                        >
                          <History className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Campos Editables en Card */}
                    <div className="space-y-3">
                      {/* Información Básica */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">SHIPMENT</label>
                          <InlineCell {...buildCellProps(row.id, 'shipment_type_v2')}>
                            <InlineFieldEditor
                              value={row.shipment_type_v2 || ''}
                              type="select"
                              placeholder="Tipo de envío"
                              options={SHIPMENT_OPTIONS}
                              displayFormatter={(val) =>
                                val ? SHIPMENT_OPTIONS.find((opt) => opt.value === val)?.label || val : 'Sin definir'
                              }
                              onSave={(val) => requestFieldUpdate(row, 'shipment_type_v2', 'Tipo de envío', val)}
                            />
                          </InlineCell>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">UBICACIÓN</label>
                          <InlineCell {...buildCellProps(row.id, 'location')}>
                            <InlineFieldEditor
                              value={row.location || ''}
                              type="text"
                              placeholder="Ubicación"
                              onSave={(val) => requestFieldUpdate(row, 'location', 'Ubicación', val)}
                            />
                          </InlineCell>
                        </div>
                      </div>

                      {/* Máquina */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">MARCA</label>
                          <span className="text-sm text-gray-800 uppercase">{row.brand || 'Sin marca'}</span>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">MODELO</label>
                          <span className="text-sm text-gray-800">{row.model || 'Sin modelo'}</span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">SERIAL</label>
                        <span className="text-sm text-gray-800 font-mono">{row.serial || 'Sin serial'}</span>
                      </div>

                      {/* Orden de Compra y Factura */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">ORDEN DE COMPRA</label>
                          <InlineCell {...buildCellProps(row.id, 'purchase_order')}>
                            <InlineFieldEditor
                              value={row.purchase_order || ''}
                              placeholder="Orden de compra"
                              onSave={(val) => requestFieldUpdate(row, 'purchase_order', 'Orden de compra', val)}
                            />
                          </InlineCell>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">No. FACTURA</label>
                          <InlineCell {...buildCellProps(row.id, 'invoice_number')}>
                            <InlineFieldEditor
                              value={row.invoice_number || ''}
                              placeholder="No. Factura"
                              onSave={(val) => requestFieldUpdate(row, 'invoice_number', 'No. Factura', val)}
                            />
                          </InlineCell>
                        </div>
                      </div>

                      {/* Fecha Factura */}
                      <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">FECHA FACTURA</label>
                        <InlineCell {...buildCellProps(row.id, 'invoice_date')}>
                          <InlineFieldEditor
                            value={
                              row.invoice_date
                                ? new Date(row.invoice_date).toISOString().split('T')[0]
                                : ''
                            }
                            type="date"
                            placeholder="Fecha factura"
                            onSave={(val) =>
                              requestFieldUpdate(
                                row,
                                'invoice_date',
                                'Fecha factura',
                                typeof val === 'string' && val ? new Date(val).toISOString() : null,
                                {
                                  invoice_date: typeof val === 'string' && val ? new Date(val).toISOString() : null,
                                }
                              )
                            }
                            displayFormatter={(val) =>
                              val
                                ? new Date(val as string).toLocaleDateString('es-CO')
                                : 'Sin fecha'
                            }
                          />
                        </InlineCell>
                      </div>

                      {/* Incoterm y Moneda */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">INCOTERM</label>
                          <InlineCell {...buildCellProps(row.id, 'incoterm')}>
                            <InlineFieldEditor
                              value={row.incoterm || ''}
                              type="select"
                              placeholder="Incoterm"
                              options={INCOTERM_OPTIONS}
                              displayFormatter={(val) => val || 'Sin definir'}
                              onSave={(val) => requestFieldUpdate(row, 'incoterm', 'Incoterm', val)}
                            />
                          </InlineCell>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">MONEDA</label>
                          <InlineCell {...buildCellProps(row.id, 'currency_type')}>
                            <InlineFieldEditor
                              value={row.currency_type || ''}
                              type="select"
                              placeholder="Moneda"
                              options={CURRENCY_OPTIONS}
                              displayFormatter={(val) => val || 'Sin definir'}
                              onSave={(val) => requestFieldUpdate(row, 'currency_type', 'Moneda', val)}
                            />
                          </InlineCell>
                        </div>
                      </div>

                      {/* Valores */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">EXW</label>
                          <InlineCell {...buildCellProps(row.id, 'exw_value_formatted')}>
                            <InlineFieldEditor
                              type="number"
                              value={parseCurrencyValue(row.exw_value_formatted) ?? ''}
                              placeholder="0"
                              displayFormatter={() => formatCurrencyDisplay(row.currency_type, row.exw_value_formatted)}
                              onSave={(val) => {
                                const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                                return requestFieldUpdate(row, 'exw_value_formatted', 'Valor EXW', numeric);
                              }}
                            />
                          </InlineCell>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">FOB ADICIONAL</label>
                          <InlineCell {...buildCellProps(row.id, 'fob_expenses')}>
                            <InlineFieldEditor
                              type="number"
                              value={row.fob_expenses ?? ''}
                              placeholder="0"
                              disabled={row.incoterm === 'EXW'}
                              displayFormatter={() =>
                                row.incoterm === 'EXW'
                                  ? 'N/A (EXW)'
                                  : formatCurrencyDisplay(row.currency_type, row.fob_expenses)
                              }
                              onSave={(val) => {
                                if (row.incoterm === 'EXW') return Promise.resolve();
                                const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
                                return requestFieldUpdate(row, 'fob_expenses', 'FOB Adicional', numeric);
                              }}
                            />
                          </InlineCell>
                        </div>
                      </div>

                      {/* Tasas */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">CONTRAVALOR</label>
                          <span className="text-sm text-gray-700">
                            {row.usd_jpy_rate ? `${row.usd_jpy_rate}` : 'PDTE'}
                          </span>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">TRM</label>
                          <span className="text-sm text-gray-700">
                            {row.trm_rate ? `${row.trm_rate}` : 'PDTE'}
                          </span>
                        </div>
                      </div>

                      {/* Estado de Pago */}
                      <div className="pt-2 border-t border-gray-100">
                        <label className="text-xs font-semibold text-gray-500 mb-1 block">ESTADO DE PAGO</label>
                        <div className="flex items-center gap-2">
                          <span className={getPaymentStatusStyle(row.payment_status)}>
                            {row.payment_status === 'PENDIENTE' ? '⏳ Pendiente' : row.payment_status === 'DESBOLSADO' ? '💰 En Proceso' : '✓ Completado'}
                          </span>
                          {row.payment_date && (
                            <span className="text-xs text-gray-500">
                              {new Date(row.payment_date).toLocaleDateString('es-CO')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Vista Desktop - Tabla */}
            <div className="hidden md:block">
              {/* Barra de Scroll Superior - Sincronizada */}
              <div className="mb-3">
                <div 
                  ref={topScrollRef}
                  className="overflow-x-auto bg-gradient-to-r from-red-100 to-gray-100 rounded-lg shadow-inner"
                  style={{ height: '14px' }}
                >
                  <div style={{ width: '5500px', height: '1px' }}></div>
                </div>
              </div>

              {/* Table */}
              <DataTable
                data={filteredPurchases}
                columns={columns}
                isLoading={isLoading}
                scrollRef={tableScrollRef}
                rowClassName={(row: PurchaseWithRelations) => 
                  row.pending_marker 
                    ? 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500' 
                    : 'bg-white hover:bg-gray-50'
                }
              />
            </div>
      </Card>
        </motion.div>

        {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
          title={selectedPurchase ? 'Editar Compra' : 'Nueva Compra'}
          size="lg"
        >
          <PurchaseFormNew purchase={selectedPurchase} onSuccess={handleSuccess} onCancel={handleCloseModal} />
      </Modal>
      <ChangeLogModal
        isOpen={changeModalOpen}
        changes={changeModalItems}
        onConfirm={handleConfirmInlineChange}
        onCancel={handleCancelInlineChange}
      />

      {/* View Modal */}
      <Modal
        isOpen={isViewOpen}
        onClose={handleCloseView}
        title="Detalle de la Compra"
        size="lg"
      >
        {selectedPurchase ? <PurchaseDetailView purchase={selectedPurchase!} /> : null}
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title="Historial de Cambios - Todos los Módulos"
        size="lg"
      >
        {selectedPurchase ? (
          <ChangeHistory 
            tableName="purchases" 
            recordId={selectedPurchase!.id}
            purchaseId={selectedPurchase!.id}
          />
        ) : null}
      </Modal>
      </div>
    </div>
  );
};

const PurchaseDetailView: React.FC<{ purchase: PurchaseWithRelations }> = ({ purchase }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl">
      <div>
        <p className="text-xs text-gray-500 mb-1">MQ</p>
        {purchase.mq ? (
          <span className={getMQStyle(purchase.mq)}>
            {purchase.mq}
          </span>
        ) : (
          <span className="text-sm text-gray-400 font-mono">-</span>
        )}
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">TIPO</p>
        {purchase.purchase_type ? (
          <span className={getTipoCompraStyle(purchase.purchase_type)}>
            {purchase.purchase_type}
          </span>
        ) : (
          <span className="text-sm text-gray-400">-</span>
        )}
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">SHIPMENT</p>
        {purchase.shipment_type_v2 ? (
          <span className={getShipmentStyle(purchase.shipment_type_v2)}>
            {purchase.shipment_type_v2}
          </span>
        ) : (
          <span className="text-sm text-gray-400">-</span>
        )}
      </div>
    </div>

    <div className="border rounded-xl p-4 bg-gray-50">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Máquina</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">PROVEEDOR</p>
          {purchase.supplier_name ? (
            <span className={getProveedorStyle(purchase.supplier_name)}>
              {purchase.supplier_name}
            </span>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">MODELO</p>
          {purchase.model ? (
            <span className={getModeloStyle(purchase.model)}>
              {purchase.model}
            </span>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">SERIAL</p>
          {purchase.serial ? (
            <span className={getSerialStyle(purchase.serial)}>
              {purchase.serial}
            </span>
          ) : (
            <span className="text-sm text-gray-400 font-mono">-</span>
          )}
        </div>
      </div>
    </div>

    <div className="border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Fechas y Ubicación</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">FECHA FACTURA</p>
          {purchase.invoice_date ? (
            <span className={getFechaFacturaStyle(new Date(purchase.invoice_date).toLocaleDateString('es-CO'))}>
              {new Date(purchase.invoice_date).toLocaleDateString('es-CO')}
            </span>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">UBICACIÓN MÁQUINA</p>
          {purchase.location ? (
            <span className={getUbicacionStyle(purchase.location)}>
              {purchase.location}
            </span>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">INCOTERM</p>
          {purchase.incoterm ? (
            <span className={getIncotermStyle(purchase.incoterm)}>
              {purchase.incoterm}
            </span>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">MONEDA</p>
          {purchase.currency_type ? (
            <span className={getMonedaStyle(purchase.currency_type)}>
              {purchase.currency_type}
            </span>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>
      </div>
    </div>

    <div className="border rounded-xl p-4 bg-gray-50">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Envío</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">PUERTO EMBARQUE</p>
          <span className="text-gray-700">{purchase.port_of_embarkation || '-'}</span>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">CPD</p>
          <span className="text-gray-700 text-xs">{purchase.cpd || '-'}</span>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">FECHA DE PAGO</p>
          {purchase.payment_date ? (
            <span className="text-gray-700">{new Date(purchase.payment_date).toLocaleDateString('es-CO')}</span>
          ) : (
            <span className="text-gray-400">PDTE</span>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">EMBARQUE SALIDA</p>
          {purchase.shipment_departure_date ? (
            <span className="text-gray-700">{new Date(purchase.shipment_departure_date).toLocaleDateString('es-CO')}</span>
          ) : (
            <span className="text-gray-400">PDTE</span>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">EMBARQUE LLEGADA</p>
          {purchase.shipment_arrival_date ? (
            <span className="text-gray-700">{new Date(purchase.shipment_arrival_date).toLocaleDateString('es-CO')}</span>
          ) : (
            <span className="text-gray-400">PDTE</span>
          )}
        </div>
      </div>
    </div>

    <div className="border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Tasas de Cambio</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">CONTRAVALOR</p>
          {purchase.usd_jpy_rate ? (
            <span className={getTasaStyle(purchase.usd_jpy_rate)}>
              {purchase.usd_jpy_rate}
            </span>
          ) : (
            <span className="text-sm text-red-600 font-semibold">PDTE</span>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">TRM</p>
          <span className="text-gray-700 font-semibold">{purchase.trm}</span>
        </div>
      </div>
    </div>

    <div className="border rounded-xl p-4 bg-gray-50">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Valores</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">VALOR EXW + BP</p>
          {purchase.exw_value_formatted ? (
            <span className={getValorStyle(purchase.exw_value_formatted)}>
              {purchase.exw_value_formatted}
            </span>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">GASTOS FOB + LAVADO</p>
          {purchase.incoterm === 'FOB' ? (
            <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-200 text-gray-500 line-through">
              N/A (FOB)
            </span>
          ) : purchase.fob_expenses ? (
            <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-100 text-green-800">
              {purchase.fob_expenses}
            </span>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">DESENSAMBLAJE + CARGUE</p>
          {purchase.incoterm === 'FOB' ? (
            <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-200 text-gray-500 line-through">
              N/A (FOB)
            </span>
          ) : purchase.disassembly_load_value ? (
            <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-100 text-green-800">
              {purchase.disassembly_load_value}
            </span>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">VALOR FOB (SUMA)</p>
          {(() => {
            const exw = parseFloat(String(purchase.exw_value_formatted || '').replace(/[^0-9.-]/g, '') || '0');
            const fobExpenses = parseFloat(String(purchase.fob_expenses || '0'));
            const disassembly = parseFloat(String(purchase.disassembly_load_value || '0'));
            const total = exw + fobExpenses + disassembly;
            return total > 0 ? (
              <span className={getValorStyle(total)}>
                {total.toLocaleString('es-CO')}
              </span>
            ) : (
              <span className="text-sm text-gray-400">-</span>
            );
          })()}
        </div>
      </div>
    </div>

    <div className="border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Reportes</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">REPORTADO VENTAS</p>
          <span className={getReporteStyle(purchase.sales_reported)}>
            {purchase.sales_reported || 'PDTE'}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">REPORTADO COMERCIO</p>
          <span className={getReporteStyle(purchase.commerce_reported)}>
            {purchase.commerce_reported || 'PDTE'}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">REPORTE LUIS LEMUS</p>
          <span className={getReporteStyle(purchase.luis_lemus_reported)}>
            {purchase.luis_lemus_reported || 'PDTE'}
          </span>
        </div>
      </div>
    </div>

    <div className="border rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Archivos</h3>
      <MachineFiles 
        machineId={purchase.machine_id} 
        allowUpload={false} 
        allowDelete={false}
        currentScope="COMPRAS"
      />
    </div>
  </div>
);
