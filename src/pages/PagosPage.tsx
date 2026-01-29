import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DollarSign, Calendar, AlertCircle, CheckCircle, Clock, Eye, Edit, History, Layers, Save, X } from 'lucide-react';
import { apiGet, apiPut, apiPost } from '../services/api';
import { ChangeHistory } from '../components/ChangeHistory';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { Card } from '../molecules/Card';
import { DataTable } from '../organisms/DataTable';
import { Modal } from '../molecules/Modal';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { Button } from '../atoms/Button';
import { Spinner } from '../atoms/Spinner';
import { InlineFieldEditor } from '../components/InlineFieldEditor';
import { showSuccess, showError } from '../components/Toast';
import { useBatchModeGuard } from '../hooks/useBatchModeGuard';
import { formatChangeValue } from '../utils/formatChangeValue';

interface Pago {
  id: string;
  mq: string;
  condition: string;
  no_factura: string;
  fecha_factura: string;
  vencimiento: string | null;
  proveedor: string;
  empresa: string;
  moneda: string;
  tasa: number;
  trm_rate: number | null;
  usd_jpy_rate: number | null;
  payment_date: string | null;
  valor_factura_proveedor: number;
  observaciones_pagos: string;
  pendiente_a: string;
  fecha_vto_fact: string;
  modelo: string;
  serie: string;
  ocean_pagos?: number | null;
  trm_ocean?: number | null;
  shipment_type_v2?: string | null;
  exw_value_formatted?: string | number | null;
  fob_expenses?: string | number | null;
  disassembly_load_value?: string | number | null;
  fob_total?: number | null;
  // Campos de múltiples pagos
  pago1_moneda?: string | null;
  pago1_fecha?: string | null;
  pago1_contravalor?: number | null;
  pago1_trm?: number | null;
  pago1_valor_girado?: number | null;
  pago1_tasa?: number | null;
  pago2_moneda?: string | null;
  pago2_fecha?: string | null;
  pago2_contravalor?: number | null;
  pago2_trm?: number | null;
  pago2_valor_girado?: number | null;
  pago2_tasa?: number | null;
  pago3_moneda?: string | null;
  pago3_fecha?: string | null;
  pago3_contravalor?: number | null;
  pago3_trm?: number | null;
  pago3_valor_girado?: number | null;
  pago3_tasa?: number | null;
}

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

const PagosPage: React.FC = () => {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPendiente, setFilterPendiente] = useState('');
  // Filtros de columnas
  const [supplierFilter, setSupplierFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [serialFilter, setSerialFilter] = useState('');
  const [mqFilter, setMqFilter] = useState('');
  const [empresaFilter, setEmpresaFilter] = useState('');
  const [selectedPago, setSelectedPago] = useState<Pago | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isChangeLogOpen, setIsChangeLogOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<Pago>>({});
  // Estados locales para inputs de Valor Girado (para evitar interferencia del formato mientras se edita)
  const [pago1ValorGiradoInput, setPago1ValorGiradoInput] = useState<string>('');
  const [pago2ValorGiradoInput, setPago2ValorGiradoInput] = useState<string>('');
  const [pago3ValorGiradoInput, setPago3ValorGiradoInput] = useState<string>('');
  // Estados locales para inputs de Contravalor
  const [pago1ContravalorInput, setPago1ContravalorInput] = useState<string>('');
  const [pago2ContravalorInput, setPago2ContravalorInput] = useState<string>('');
  const [pago3ContravalorInput, setPago3ContravalorInput] = useState<string>('');
  const [contravalorSyncInput, setContravalorSyncInput] = useState<string>('');
  // Estados locales para inputs de TRM COP
  const [pago1TrmInput, setPago1TrmInput] = useState<string>('');
  const [pago2TrmInput, setPago2TrmInput] = useState<string>('');
  const [pago3TrmInput, setPago3TrmInput] = useState<string>('');
  const [trmSyncInput, setTrmSyncInput] = useState<string>('');
  const [oceanInput, setOceanInput] = useState<string>('');
  const [trmOceanInput, setTrmOceanInput] = useState<string>('');
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeModalItems, setChangeModalItems] = useState<InlineChangeItem[]>([]);
  const [inlineChangeIndicators, setInlineChangeIndicators] = useState<
    Record<string, InlineChangeIndicator[]>
  >({});
  const [openChangePopover, setOpenChangePopover] = useState<{ recordId: string; fieldName: string } | null>(null);
  const [searchParams] = useSearchParams();
  const purchaseIdFromUrl = searchParams.get('purchaseId');
  const [batchModeEnabled, setBatchModeEnabled] = useState(false);
  const [pendingBatchChanges, setPendingBatchChanges] = useState<
    Map<string, { pagoId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>
  >(new Map());

  // Refs para scroll sincronizado
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const pendingChangeRef = useRef<{
    pagoId: string;
    updates: Record<string, unknown>;
    changes: InlineChangeItem[];
  } | null>(null);
  const pendingResolveRef = useRef<((value?: void | PromiseLike<void>) => void) | null>(null);
  const pendingRejectRef = useRef<((reason?: unknown) => void) | null>(null);

  // Cache básico en memoria para evitar recargas innecesarias
  const pagosCacheRef = useRef<{
    data: Pago[];
    timestamp: number;
  } | null>(null);
  const CACHE_DURATION = 30000; // 30 segundos de caché

  // Opciones para Pendiente A
  const pendienteOptions = [
    'PROVEEDORES MAQUITECNO',
    'PROVEEDORES PARTEQUIPOS MAQUINARIA',
    'PROVEEDORES SOREMAQ'
  ];

  useEffect(() => {
    fetchPagos();
  }, []);

  // Cargar indicadores de cambios desde el backend
  useEffect(() => {
    const loadChangeIndicators = async () => {
      if (pagos.length === 0) return;
      
      try {
        const indicatorsMap: Record<string, InlineChangeIndicator[]> = {};
        
        // Cargar cambios para cada pago
        await Promise.all(
          pagos.map(async (pago) => {
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
              }>>(`/api/change-logs/purchases/${pago.id}`);
              
              if (changes && changes.length > 0) {
                indicatorsMap[pago.id] = changes.slice(0, 10).map((change) => ({
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
              console.debug('No se encontraron cambios para pago:', pago.id);
            }
          })
        );
        
        setInlineChangeIndicators(indicatorsMap);
      } catch (error) {
        console.error('Error al cargar indicadores de cambios:', error);
      }
    };
    
    if (!loading && pagos.length > 0) {
      loadChangeIndicators();
    }
  }, [pagos, loading]);

  const fetchPagos = async (forceRefresh = false) => {
    // Verificar caché si no se fuerza refresh
    if (!forceRefresh && pagosCacheRef.current) {
      const cacheAge = Date.now() - pagosCacheRef.current.timestamp;
      if (cacheAge < CACHE_DURATION) {
        console.log('📦 [Pagos] Usando datos del caché (edad:', Math.round(cacheAge / 1000), 's)');
        setPagos(pagosCacheRef.current.data);
        setLoading(false);
        return;
      }
    }
    
    try {
      setLoading(true);
      const data = await apiGet('/api/pagos');
      
      // Actualizar caché
      pagosCacheRef.current = {
        data,
        timestamp: Date.now(),
      };
      
      setPagos(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar pagos');
      console.error('Error fetching pagos:', err);
      // Si hay error pero tenemos caché, usar datos en caché
      if (pagosCacheRef.current) {
        console.log('⚠️ [Pagos] Usando datos del caché debido a error');
        setPagos(pagosCacheRef.current.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (pago: Pago) => {
    setSelectedPago(pago);
    setEditData({
      fecha_factura: pago.fecha_factura,
      proveedor: pago.proveedor,
      no_factura: pago.no_factura,
      mq: pago.mq,
      moneda: pago.moneda,
      tasa: pago.tasa,
      trm_rate: pago.trm_rate != null ? Number(pago.trm_rate) : null,
      usd_jpy_rate: pago.usd_jpy_rate != null ? Number(pago.usd_jpy_rate) : null,
      payment_date: pago.payment_date,
      valor_factura_proveedor: pago.valor_factura_proveedor,
      observaciones_pagos: pago.observaciones_pagos,
      pendiente_a: pago.pendiente_a,
      fecha_vto_fact: pago.fecha_vto_fact,
      // Campos de múltiples pagos
      pago1_moneda: pago.pago1_moneda || null,
      pago1_fecha: pago.pago1_fecha ? (typeof pago.pago1_fecha === 'string' && pago.pago1_fecha.length >= 10 ? pago.pago1_fecha.slice(0, 10) : String(pago.pago1_fecha)) : null,
      pago1_contravalor: pago.pago1_contravalor || null,
      pago1_trm: pago.pago1_trm || null,
      pago1_valor_girado: pago.pago1_valor_girado || null,
      pago1_tasa: pago.pago1_tasa || null,
      pago2_moneda: pago.pago2_moneda || null,
      pago2_fecha: pago.pago2_fecha ? (typeof pago.pago2_fecha === 'string' && pago.pago2_fecha.length >= 10 ? pago.pago2_fecha.slice(0, 10) : String(pago.pago2_fecha)) : null,
      pago2_contravalor: pago.pago2_contravalor || null,
      pago2_trm: pago.pago2_trm || null,
      pago2_valor_girado: pago.pago2_valor_girado || null,
      pago2_tasa: pago.pago2_tasa || null,
      pago3_moneda: pago.pago3_moneda || null,
      pago3_fecha: pago.pago3_fecha ? (typeof pago.pago3_fecha === 'string' && pago.pago3_fecha.length >= 10 ? pago.pago3_fecha.slice(0, 10) : String(pago.pago3_fecha)) : null,
      pago3_contravalor: pago.pago3_contravalor || null,
      pago3_trm: pago.pago3_trm || null,
      pago3_valor_girado: pago.pago3_valor_girado || null,
      pago3_tasa: pago.pago3_tasa || null,
      shipment_type_v2: pago.shipment_type_v2 ?? null,
      exw_value_formatted: pago.exw_value_formatted ?? null,
      fob_expenses: pago.fob_expenses ?? null,
      disassembly_load_value: pago.disassembly_load_value ?? null,
      fob_total: pago.fob_total ?? null,
    });
    // Inicializar estados locales de inputs de Valor Girado
    setPago1ValorGiradoInput(pago.pago1_valor_girado != null ? formatCurrency(pago.pago1_valor_girado, 'COP') : '');
    setPago2ValorGiradoInput(pago.pago2_valor_girado != null ? formatCurrency(pago.pago2_valor_girado, 'COP') : '');
    setPago3ValorGiradoInput(pago.pago3_valor_girado != null ? formatCurrency(pago.pago3_valor_girado, 'COP') : '');
    // Inicializar estados locales de inputs de Contravalor
    setPago1ContravalorInput(pago.pago1_contravalor != null ? formatNumberWithSeparators(pago.pago1_contravalor) : '');
    setPago2ContravalorInput(pago.pago2_contravalor != null ? formatNumberWithSeparators(pago.pago2_contravalor) : '');
    setPago3ContravalorInput(pago.pago3_contravalor != null ? formatNumberWithSeparators(pago.pago3_contravalor) : '');
    setContravalorSyncInput(pago.usd_jpy_rate != null ? formatCurrency(pago.usd_jpy_rate, 'USD') : '');
    // Inicializar estados locales de inputs de TRM COP
    setPago1TrmInput(pago.pago1_trm != null ? formatCurrency(pago.pago1_trm, 'COP') : '');
    setPago2TrmInput(pago.pago2_trm != null ? formatCurrency(pago.pago2_trm, 'COP') : '');
    setPago3TrmInput(pago.pago3_trm != null ? formatCurrency(pago.pago3_trm, 'COP') : '');
    setTrmSyncInput(pago.trm_rate != null ? formatCurrency(pago.trm_rate, 'COP') : '');
    setOceanInput(pago.ocean_pagos != null ? formatCurrency(pago.ocean_pagos, 'USD') : '');
    setTrmOceanInput(pago.trm_ocean != null ? formatCurrency(pago.trm_ocean, 'COP') : '');
    setIsEditModalOpen(true);
  };

  const handleView = (pago: Pago) => {
    setSelectedPago(pago);
    setIsViewModalOpen(true);
  };

  const handleViewHistory = (pago: Pago) => {
    setSelectedPago(pago);
    setIsChangeLogOpen(true);
  };

  // Función para calcular tasa (TRM / Contravalor)
  const calculateTasa = (trm: number | null | undefined, contravalor: number | null | undefined): number | null => {
    if (trm && contravalor && contravalor > 0) {
      return trm / contravalor;
    }
    return null;
  };

  // Función para formatear número con separadores de miles y 2 decimales
  const formatNumberWithSeparators = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined || value === '') return '0,00';
    // Convertir a número si es string
    const numValue = typeof value === 'string' ? parseFloat(String(value)) : Number(value);
    if (isNaN(numValue) || !isFinite(numValue)) return '0,00';
    return numValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Función para formatear con signo de moneda
  const formatCurrency = (value: number | string | null | undefined, currency: string = 'COP'): string => {
    if (value === null || value === undefined || value === '') return '';
    const numValue = typeof value === 'string' ? parseFloat(String(value)) : Number(value);
    if (isNaN(numValue) || !isFinite(numValue)) return '';
    const formatted = numValue.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const symbol = currency === 'COP' ? '$' : currency === 'USD' ? 'US$' : currency === 'JPY' ? '¥' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '';
    return symbol ? `${symbol} ${formatted}` : formatted;
  };

  // Función para formatear número sin separadores pero con 2 decimales (para inputs)
  const formatNumberForInput = (value: any): string => {
    if (value === null || value === undefined || value === '') return '';
    // Convertir cualquier tipo a número
    const numValue = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(numValue) || !isFinite(numValue)) return '';
    return numValue.toFixed(2);
  };

  // Función para parsear valor desde input (remover separadores y signos de moneda)
  const parseNumberFromInput = (value: string): number | null => {
    if (value === '' || value === '-') return null;
    // Remover signos de moneda ($, US$, ¥, €, £) y espacios
    let cleaned = value.replace(/[$US¥€£]/g, '').trim();
    // Remover puntos de separadores de miles y reemplazar coma por punto
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  };


  // Calcular tasas usando useMemo (se calculan en tiempo real pero no se guardan hasta el submit)
  const pago1Tasa = useMemo(() => {
    return calculateTasa(editData.pago1_trm, editData.pago1_contravalor);
  }, [editData.pago1_trm, editData.pago1_contravalor]);

  const pago2Tasa = useMemo(() => {
    return calculateTasa(editData.pago2_trm, editData.pago2_contravalor);
  }, [editData.pago2_trm, editData.pago2_contravalor]);

  const pago3Tasa = useMemo(() => {
    return calculateTasa(editData.pago3_trm, editData.pago3_contravalor);
  }, [editData.pago3_trm, editData.pago3_contravalor]);

  // Calcular totales
  const totalValorGirado = useMemo(() => {
    const p1 = editData.pago1_valor_girado !== null && editData.pago1_valor_girado !== undefined ? Number(editData.pago1_valor_girado) : 0;
    const p2 = editData.pago2_valor_girado !== null && editData.pago2_valor_girado !== undefined ? Number(editData.pago2_valor_girado) : 0;
    const p3 = editData.pago3_valor_girado !== null && editData.pago3_valor_girado !== undefined ? Number(editData.pago3_valor_girado) : 0;
    const total = p1 + p2 + p3;
    return total;
  }, [editData.pago1_valor_girado, editData.pago2_valor_girado, editData.pago3_valor_girado]);

  const tasaPromedio = useMemo(() => {
    const tasas: number[] = [];
    if (pago1Tasa !== null && pago1Tasa !== undefined) tasas.push(pago1Tasa);
    if (pago2Tasa !== null && pago2Tasa !== undefined) tasas.push(pago2Tasa);
    if (pago3Tasa !== null && pago3Tasa !== undefined) tasas.push(pago3Tasa);
    if (tasas.length === 0) return null;
    return tasas.reduce((sum, tasa) => sum + tasa, 0) / tasas.length;
  }, [pago1Tasa, pago2Tasa, pago3Tasa]);

  // Sugerencias ponderadas según peso de los giros (valor girado)
  const { contravalorPonderado, trmPonderada } = useMemo(() => {
    const items = [
      { valor: editData.pago1_valor_girado, contravalor: editData.pago1_contravalor, trm: editData.pago1_trm },
      { valor: editData.pago2_valor_girado, contravalor: editData.pago2_contravalor, trm: editData.pago2_trm },
      { valor: editData.pago3_valor_girado, contravalor: editData.pago3_contravalor, trm: editData.pago3_trm },
    ];

    let totalPeso = 0;
    let sumaContravalor = 0;
    let sumaTrm = 0;

    items.forEach(({ valor, contravalor, trm }) => {
      const peso = valor ?? 0;
      if (peso && peso > 0) {
        totalPeso += peso;
        if (contravalor !== null && contravalor !== undefined) {
          sumaContravalor += peso * Number(contravalor);
        }
        if (trm !== null && trm !== undefined) {
          sumaTrm += peso * Number(trm);
        }
      }
    });

    if (totalPeso <= 0) {
      return { contravalorPonderado: null, trmPonderada: null };
    }

    return {
      contravalorPonderado: sumaContravalor > 0 ? sumaContravalor / totalPeso : null,
      trmPonderada: sumaTrm > 0 ? sumaTrm / totalPeso : null,
    };
  }, [
    editData.pago1_valor_girado,
    editData.pago2_valor_girado,
    editData.pago3_valor_girado,
    editData.pago1_contravalor,
    editData.pago2_contravalor,
    editData.pago3_contravalor,
    editData.pago1_trm,
    editData.pago2_trm,
    editData.pago3_trm,
  ]);

  const handleSaveEdit = async () => {
    if (!selectedPago) return;

    try {
      // Enviar todos los campos de pagos múltiples (las tasas ya están calculadas en editData)
      await apiPut(`/api/pagos/${selectedPago.id}`, {
        observaciones_pagos: editData.observaciones_pagos || null,
        // Campos para sincronización con otros módulos
        usd_jpy_rate: editData.usd_jpy_rate || null,
        trm_rate: editData.trm_rate || null,
        ocean_pagos: editData.ocean_pagos || null,
        trm_ocean: editData.trm_ocean || null,
        payment_date: editData.payment_date || null,
        // Pago 1
        pago1_moneda: editData.pago1_moneda || null,
        pago1_fecha: editData.pago1_fecha || null,
        pago1_contravalor: editData.pago1_contravalor || null,
        pago1_trm: editData.pago1_trm || null,
        pago1_valor_girado: editData.pago1_valor_girado || null,
        pago1_tasa: pago1Tasa,
        // Pago 2
        pago2_moneda: editData.pago2_moneda || null,
        pago2_fecha: editData.pago2_fecha || null,
        pago2_contravalor: editData.pago2_contravalor || null,
        pago2_trm: editData.pago2_trm || null,
        pago2_valor_girado: editData.pago2_valor_girado || null,
        pago2_tasa: pago2Tasa,
        // Pago 3
        pago3_moneda: editData.pago3_moneda || null,
        pago3_fecha: editData.pago3_fecha || null,
        pago3_contravalor: editData.pago3_contravalor || null,
        pago3_trm: editData.pago3_trm || null,
        pago3_valor_girado: editData.pago3_valor_girado || null,
        pago3_tasa: pago3Tasa,
      });

      setIsEditModalOpen(false);
      fetchPagos(true); // Forzar refresh después de actualizar
      showSuccess('Pago actualizado correctamente');
    } catch (err: any) {
      console.error('Error updating pago:', err);
      showError('Error al actualizar el pago');
    }
  };

  // Funciones para manejar cambios inline
  const getFieldIndicators = (
    indicators: Record<string, InlineChangeIndicator[]>,
    recordId: string,
    fieldName: string
  ) => {
    return (indicators[recordId] || []).filter((log) => log.fieldName === fieldName);
  };

  const getModuleLabel = (moduleName: string | null | undefined): string => {
    if (!moduleName) return 'Pagos';
    const moduleMap: Record<string, string> = {
      'compras': 'Compras',
      'pagos': 'Pagos',
      'preselections': 'Preselección',
      'auctions': 'Subastas',
      'management': 'Consolidado',
      'logistics': 'Logística',
      'importations': 'Importaciones',
      'equipments': 'Equipos',
      'service': 'Servicio',
    };
    return moduleMap[moduleName.toLowerCase()] || moduleName;
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
                const moduleLabel = log.moduleName ? getModuleLabel(log.moduleName) : getModuleLabel('pagos');
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

  const normalizeForCompare = (value: string | number | boolean | null): string => {
    if (value === null || value === undefined) return '';
    return String(value).trim().toLowerCase();
  };

  /**
   * Determina si un valor está "vacío" (null, undefined, string vacío, etc.)
   * Esto se usa para decidir si agregar un valor inicial requiere control de cambios
   */
  const isValueEmpty = (value: unknown): boolean => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (typeof value === 'number') return Number.isNaN(value);
    if (typeof value === 'boolean') return false; // Los booleanos nunca están "vacíos"
    return false;
  };

  const mapValueForLog = (value: string | number | boolean | null): string | number | null => {
    return value;
  };

  const queueInlineChange = (
    pagoId: string,
    updates: Record<string, unknown>,
    changeItem: InlineChangeItem
  ) => {
    // Si el modo batch está activo, acumular cambios en lugar de abrir el modal
    if (batchModeEnabled) {
      setPendingBatchChanges((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(pagoId);
        
        if (existing) {
          // Combinar updates y agregar el nuevo cambio
          const mergedUpdates = { ...existing.updates, ...updates };
          const mergedChanges = [...existing.changes, changeItem];
          newMap.set(pagoId, {
            pagoId,
            updates: mergedUpdates,
            changes: mergedChanges,
          });
        } else {
          newMap.set(pagoId, {
            pagoId,
            updates,
            changes: [changeItem],
          });
        }
        
        return newMap;
      });
      
      // En modo batch, guardar en BD inmediatamente para reflejar cambios visualmente
      // pero NO registrar en control de cambios hasta que se confirme
      return apiPut(`/api/pagos/${pagoId}`, updates)
        .then(() => fetchPagos(true)) // Forzar refresh después de guardar cambios en batch
        .catch((error) => {
          console.error('Error guardando cambio en modo batch:', error);
          throw error;
        });
    }
    
    // Modo normal: abrir modal inmediatamente
    return new Promise<void>((resolve, reject) => {
      pendingChangeRef.current = {
        pagoId,
        updates,
        changes: [changeItem],
      };
      pendingResolveRef.current = resolve;
      pendingRejectRef.current = reject;
      setChangeModalItems([changeItem]);
      setChangeModalOpen(true);
    });
  };

  const confirmBatchChanges = async (reason?: string) => {
    // Recuperar datos del estado
    const allUpdatesByPago = new Map<string, { pagoId: string; updates: Record<string, unknown>; changes: InlineChangeItem[] }>();
    const allChanges: InlineChangeItem[] = [];
    
    pendingBatchChanges.forEach((batch) => {
      allChanges.push(...batch.changes);
      allUpdatesByPago.set(batch.pagoId, batch);
    });

    try {
      // Solo registrar cambios en el log (los datos ya están guardados en BD)
      const logPromises = Array.from(allUpdatesByPago.values()).map(async (batch) => {
        // Registrar cambios en el log
        await apiPost('/api/change-logs', {
          table_name: 'purchases',
          record_id: batch.pagoId,
          changes: batch.changes,
          change_reason: reason || null,
          module_name: 'pagos',
        });

        // Actualizar indicadores
        batch.changes.forEach((change) => {
          const indicator: InlineChangeIndicator = {
            id: `${batch.pagoId}-${change.field_name}-${Date.now()}`,
            fieldName: change.field_name,
            fieldLabel: change.field_label,
            oldValue: change.old_value,
            newValue: change.new_value,
            reason,
            changedAt: new Date().toISOString(),
          };
          setInlineChangeIndicators((prev) => ({
            ...prev,
            [batch.pagoId]: [indicator, ...(prev[batch.pagoId] || [])].slice(0, 10),
          }));
        });
      });

      await Promise.all(logPromises);
      
      // Limpiar cambios pendientes
      setPendingBatchChanges(new Map());
      setChangeModalOpen(false);
      pendingChangeRef.current = null;
      
      showSuccess(`${allChanges.length} cambio(s) registrado(s) en control de cambios`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al registrar cambios';
      showError(message);
      throw error;
    }
  };

  const handleConfirmInlineChange = async (reason?: string) => {
    const pending = pendingChangeRef.current;
    if (!pending) return;
    
    // Si es modo batch, usar la función especial
    if (pending.pagoId === 'BATCH_MODE') {
      await confirmBatchChanges(reason);
      return;
    }
    
    try {
      await apiPut(`/api/pagos/${pending.pagoId}`, pending.updates);
      await apiPost('/api/change-logs', {
        table_name: 'purchases',
        record_id: pending.pagoId,
        changes: pending.changes,
        change_reason: reason || null,
        module_name: 'pagos',
      });
      const indicator: InlineChangeIndicator = {
        id: `${pending.pagoId}-${Date.now()}`,
        fieldName: pending.changes[0].field_name,
        fieldLabel: pending.changes[0].field_label,
        oldValue: pending.changes[0].old_value,
        newValue: pending.changes[0].new_value,
        reason,
        changedAt: new Date().toISOString(),
      };
      setInlineChangeIndicators((prev) => ({
        ...prev,
        [pending.pagoId]: [indicator, ...(prev[pending.pagoId] || [])].slice(0, 10),
      }));
      pendingResolveRef.current?.();
      showSuccess('Dato actualizado');
      fetchPagos(true); // Forzar refresh después de actualizar campo inline
    } catch (error) {
      pendingRejectRef.current?.(error);
      showError('Error al actualizar el dato');
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
    record: Pago,
    fieldName: string
  ): string | number | boolean | null => {
    const typedRecord = record as unknown as Record<string, string | number | boolean | null | undefined>;
    const value = typedRecord[fieldName];
    return (value === undefined ? null : value) as string | number | boolean | null;
  };

  const beginInlineChange = (
    pago: Pago,
    fieldName: string,
    fieldLabel: string,
    oldValue: string | number | boolean | null,
    newValue: string | number | boolean | null,
    updates: Record<string, unknown>
  ) => {
    if (normalizeForCompare(oldValue) === normalizeForCompare(newValue)) {
      return Promise.resolve();
    }
    return queueInlineChange(pago.id, updates, {
      field_name: fieldName,
      field_label: fieldLabel,
      old_value: mapValueForLog(oldValue),
      new_value: mapValueForLog(newValue),
    });
  };

  const requestFieldUpdate = async (
    pago: Pago,
    fieldName: string,
    fieldLabel: string,
    newValue: string | number | boolean | null,
    updates?: Record<string, unknown>
  ) => {
    const currentValue = getRecordFieldValue(pago, fieldName);
    
    // MEJORA: Si el campo está vacío y se agrega un valor, NO solicitar control de cambios
    // Solo solicitar control de cambios cuando se MODIFICA un valor existente
    const isCurrentValueEmpty = isValueEmpty(currentValue);
    const isNewValueEmpty = isValueEmpty(newValue);
    
    // Si el campo estaba vacío y ahora se agrega un valor, guardar directamente sin control de cambios
    if (isCurrentValueEmpty && !isNewValueEmpty) {
      const updatesToApply = updates ?? { [fieldName]: newValue };
      await apiPut(`/api/pagos/${pago.id}`, updatesToApply);
      // Actualizar estado local
      setPagos(prev => prev.map(r => 
        r.id === pago.id ? { ...r, ...updatesToApply } : r
      ));
      showSuccess('Dato actualizado');
      return;
    }
    
    // Si ambos están vacíos, no hay cambio real
    if (isCurrentValueEmpty && isNewValueEmpty) {
      return;
    }
    
    // Para otros casos (modificar un valor existente), usar control de cambios normal
    return beginInlineChange(
      pago,
      fieldName,
      fieldLabel,
      currentValue,
      newValue,
      updates ?? { [fieldName]: newValue }
    );
  };

  // Guardar todos los cambios acumulados en modo batch
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
      pagoId: 'BATCH_MODE',
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
    moduleName: 'Pagos'
  });

  // Cancelar todos los cambios pendientes
  const handleCancelBatchChanges = () => {
    if (pendingBatchChanges.size === 0) return;
    
    const totalChanges = Array.from(pendingBatchChanges.values()).reduce((sum, batch) => sum + batch.changes.length, 0);
    const message = `¿Deseas cancelar ${totalChanges} cambio(s) pendiente(s)?\n\nNota: Los cambios ya están guardados en la base de datos, pero no se registrarán en el control de cambios.`;
    
    if (window.confirm(message)) {
      setPendingBatchChanges(new Map());
      showSuccess('Registro de cambios cancelado. Los datos permanecen guardados.');
    }
  };

  const buildCellProps = (recordId: string, field: string) => ({
    recordId,
    fieldName: field,
    indicators: getFieldIndicators(inlineChangeIndicators, recordId, field),
    openPopover: openChangePopover,
    onIndicatorClick: handleIndicatorClick,
  });

  // Filtrado
  const filteredPagos = pagos.filter((pago) => {
    const matchesSearch =
      searchTerm === '' ||
      pago.mq?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pago.proveedor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pago.no_factura?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pago.modelo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pago.serie?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPendiente =
      filterPendiente === '' || pago.pendiente_a === filterPendiente;

    // Filtros de columnas
    if (supplierFilter && pago.proveedor !== supplierFilter) return false;
    if (modelFilter && pago.modelo !== modelFilter) return false;
    if (serialFilter && pago.serie !== serialFilter) return false;
    if (mqFilter && pago.mq !== mqFilter) return false;
    if (empresaFilter && pago.empresa !== empresaFilter) return false;

    return matchesSearch && matchesPendiente;
  });

  // Valores únicos para filtros de columnas
  const uniqueSuppliers = useMemo(
    () => [...new Set(pagos.map(item => item.proveedor).filter(Boolean))].sort() as string[],
    [pagos]
  );
  const uniqueModels = useMemo(
    () => [...new Set(pagos.map(item => item.modelo).filter(Boolean))].sort() as string[],
    [pagos]
  );
  const uniqueSerials = useMemo(
    () => [...new Set(pagos.map(item => item.serie).filter(Boolean))].sort() as string[],
    [pagos]
  );
  const uniqueMqs = useMemo(
    () => [...new Set(pagos.map(item => item.mq).filter(Boolean))].sort() as string[],
    [pagos]
  );
  const uniqueEmpresas = useMemo(
    () => [...new Set(pagos.map(item => item.empresa).filter(Boolean))].sort() as string[],
    [pagos]
  );

  // Configuración de columnas
  // Helper function to get header background color based on column key and module origin
  const getColumnHeaderBgColor = (columnKey: string): string => {
    // Column MQ from Importations (amber-100)
    if (columnKey === 'mq') {
      return 'bg-amber-100';
    }
    // All other columns from Pagos (orange-100)
    return 'bg-orange-100';
  };

  const columns = [
    {
      key: 'proveedor',
      label: 'PROVEEDOR',
      sortable: true,
      filter: (
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {uniqueSuppliers.map(supplier => (
            <option key={supplier || ''} value={supplier || ''}>{supplier}</option>
          ))}
        </select>
      ),
      render: (row: Pago) => (
        <span className="text-sm text-gray-700">{row.proveedor || '-'}</span>
      )
    },
    {
      key: 'modelo',
      label: 'MODELO',
      sortable: true,
      filter: (
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {uniqueModels.map(model => (
            <option key={model || ''} value={model || ''}>{model}</option>
          ))}
        </select>
      ),
      render: (row: Pago) => <span className="text-sm text-gray-700">{row.modelo || '-'}</span>
    },
    {
      key: 'serie',
      label: 'SERIE',
      sortable: true,
      filter: (
        <select
          value={serialFilter}
          onChange={(e) => setSerialFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {uniqueSerials.map(serial => (
            <option key={serial || ''} value={serial || ''}>{serial}</option>
          ))}
        </select>
      ),
      render: (row: Pago) => <span className="text-sm text-gray-700">{row.serie || '-'}</span>
    },
    {
      key: 'condition',
      label: 'CONDICIÓN',
      sortable: true,
      render: (row: Pago) => {
        const condition = row.condition || 'USADO';
        const isNuevo = condition === 'NUEVO';
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isNuevo
                ? 'bg-green-100 text-green-800'
                : 'bg-blue-100 text-blue-800'
            }`}
          >
            {condition}
          </span>
        );
      }
    },
    {
      key: 'mq',
      label: 'MQ',
      sortable: true,
      filter: (
        <select
          value={mqFilter}
          onChange={(e) => setMqFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          {uniqueMqs.map(mq => (
            <option key={mq || ''} value={mq || ''}>{mq}</option>
          ))}
        </select>
      ),
      render: (row: Pago) => (
        <span className="text-sm text-gray-700">{row.mq || '-'}</span>
      )
    },
    {
      key: 'empresa',
      label: 'EMPRESA',
      sortable: true,
      filter: (
        <select
          value={empresaFilter}
          onChange={(e) => setEmpresaFilter(e.target.value)}
          className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas</option>
          {uniqueEmpresas.map(empresa => (
            <option key={empresa || ''} value={empresa || ''}>{empresa}</option>
          ))}
        </select>
      ),
      render: (row: Pago) => (
        <span className="text-sm text-gray-700">{row.empresa || '-'}</span>
      )
    },
    {
      key: 'no_factura',
      label: 'NO. FACTURA',
      sortable: true,
      render: (row: Pago) => (
        <span className="text-sm text-gray-700">{row.no_factura || '-'}</span>
      )
    },
    {
      key: 'fecha_factura',
      label: 'FECHA FACTURA',
      sortable: true,
      render: (row: Pago) => (
        <span className="text-sm text-gray-700">
          {row.fecha_factura ? new Date(row.fecha_factura).toLocaleDateString('es-CO') : '-'}
        </span>
      )
    },
    {
      key: 'vencimiento',
      label: 'VENCIMIENTO',
      sortable: true,
      render: (row: Pago) => {
        // ✅ Mostrar vencimiento para todos los registros (purchases y new_purchases)
        return (
          <span className="text-sm text-gray-700">
            {row.vencimiento ? new Date(row.vencimiento).toLocaleDateString('es-CO') : '-'}
          </span>
        );
      }
    },
    {
      key: 'moneda',
      label: 'MONEDA',
      sortable: true,
      render: (row: Pago) => (
        <span className="text-sm text-gray-700">{row.moneda || '-'}</span>
      )
    },
    {
      key: 'usd_jpy_rate',
      label: 'CONTRAVALOR',
      sortable: true,
      render: (row: Pago) => (
        <InlineCell {...buildCellProps(row.id, 'usd_jpy_rate')}>
          <InlineFieldEditor
            type="number"
            value={row.usd_jpy_rate ?? null}
            placeholder="PDTE"
            displayFormatter={() =>
              row.usd_jpy_rate !== null && row.usd_jpy_rate !== undefined
                ? parseFloat(String(row.usd_jpy_rate)).toFixed(2)
                : 'PDTE'
            }
            onSave={(val) => {
              const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
              return requestFieldUpdate(row, 'usd_jpy_rate', 'Contravalor', numeric);
            }}
          />
        </InlineCell>
      )
    },
    {
      key: 'trm_rate',
      label: 'TRM (COP)',
      sortable: true,
      render: (row: Pago) => (
        <InlineCell {...buildCellProps(row.id, 'trm_rate')}>
          <InlineFieldEditor
            type="number"
            value={row.trm_rate ?? null}
            placeholder="PDTE"
            displayFormatter={() =>
              row.trm_rate !== null && row.trm_rate !== undefined
                ? `$ ${row.trm_rate.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : 'PDTE'
            }
            onSave={(val) => {
              const numeric = typeof val === 'number' ? val : val === null ? null : Number(val);
              return requestFieldUpdate(row, 'trm_rate', 'TRM (COP)', numeric);
            }}
          />
        </InlineCell>
      )
    },
    {
      key: 'payment_date',
      label: 'FECHA DE PAGO',
      sortable: true,
      render: (row: Pago) => (
        <InlineCell {...buildCellProps(row.id, 'payment_date')}>
          <InlineFieldEditor
            type="date"
            value={row.payment_date ? new Date(row.payment_date).toISOString().split('T')[0] : null}
            placeholder="PDTE"
            displayFormatter={() =>
              row.payment_date
                ? new Date(row.payment_date).toLocaleDateString('es-CO')
                : 'PDTE'
            }
            onSave={(val) => {
              return requestFieldUpdate(row, 'payment_date', 'Fecha de Pago', val);
            }}
          />
        </InlineCell>
      )
    },
    {
      key: 'actions',
      label: 'ACCIONES',
      sortable: false,
      render: (row: Pago) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => handleView(row)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Ver detalles"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleEdit(row)}
            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="Editar"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleViewHistory(row)}
            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title="Historial de cambios"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  // Color coding de filas: amarillo cuando se llega desde notificación (Ver → registro modificado en Compras)
  const getRowClassName = (row: Pago) => {
    if (purchaseIdFromUrl && row.id === purchaseIdFromUrl) {
      return 'bg-amber-100 hover:bg-amber-200 border-l-4 border-amber-500';
    }
    return 'bg-white hover:bg-gray-50';
  };

  // Sincronizar scroll superior con tabla
  useEffect(() => {
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
  }, [filteredPagos]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="rounded-xl shadow-md p-3" style={{ backgroundColor: '#ea580c' }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
              <h1 className="text-lg font-semibold text-white">Pagos</h1>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600 font-semibold uppercase">Total Pagos</p>
              <p className="text-2xl font-bold text-blue-800">{filteredPagos.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-600 font-semibold uppercase">Con Valor</p>
              <p className="text-2xl font-bold text-green-800">
                {filteredPagos.filter(p => p.valor_factura_proveedor && p.valor_factura_proveedor > 0).length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-orange-600 font-semibold uppercase">Próximos a Vencer</p>
              <p className="text-2xl font-bold text-orange-800">
                {filteredPagos.filter(p => {
                  if (!p.fecha_vto_fact) return false;
                  const dias = Math.ceil((new Date(p.fecha_vto_fact).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                  return dias > 0 && dias <= 7;
                }).length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-orange-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-red-600 font-semibold uppercase">Vencidos</p>
              <p className="text-2xl font-bold text-red-800">
                {filteredPagos.filter(p => {
                  if (!p.fecha_vto_fact) return false;
                  const dias = Math.ceil((new Date(p.fecha_vto_fact).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                  return dias < 0;
                }).length}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-500 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Buscar"
            placeholder="MQ, proveedor, factura, modelo, serie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select
            label="Filtrar por Pendiente A"
            value={filterPendiente}
            onChange={(e) => setFilterPendiente(e.target.value)}
            options={[
              { value: '', label: 'Todos' },
              ...pendienteOptions.map(opt => ({ value: opt, label: opt }))
            ]}
          />
        </div>
        {/* Toggle Modo Masivo */}
        <div className="mt-4 pt-4 border-t border-gray-200">
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
              className="w-4 h-4 text-[#cf1b22] focus:ring-[#cf1b22] border-gray-300 rounded"
            />
            <Layers className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Modo Masivo</span>
          </label>
        </div>
      </Card>

      {error && (
        <Card className="p-4 bg-red-50 border-l-4 border-red-500">
          <p className="text-red-700">{error}</p>
        </Card>
      )}

      {/* Tabla */}
      <Card>
        {/* Barra de Scroll Superior - Sincronizada */}
        <div className="mb-3">
          <div 
            ref={topScrollRef}
            className="overflow-x-auto bg-gradient-to-r from-red-100 to-gray-100 rounded-lg shadow-inner"
            style={{ height: '14px' }}
          >
            <div style={{ width: '3000px', height: '1px' }}></div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredPagos}
          rowClassName={getRowClassName}
          scrollRef={tableScrollRef}
          getHeaderBgColor={getColumnHeaderBgColor}
        />
      </Card>

      {/* Modal Ver */}
      {selectedPago && (
        <Modal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          title={`Ver Pago - ${selectedPago.mq || 'Sin MQ'}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">MQ</p>
                <p className="text-lg font-bold text-brand-red">{selectedPago.mq || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">No. Factura</p>
                <p className="text-lg font-semibold text-indigo-600">{selectedPago.no_factura || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Fecha Factura</p>
                <p className="text-sm">
                  {selectedPago.fecha_factura ? new Date(selectedPago.fecha_factura).toLocaleDateString('es-CO') : '-'}
                </p>
              </div>
              {/* ✅ VENCIMIENTO: Solo para registros de new_purchases */}
              {selectedPago.condition === 'NUEVO' && (
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Vencimiento</p>
                  <p className="text-sm">
                    {selectedPago.vencimiento ? new Date(selectedPago.vencimiento).toLocaleDateString('es-CO') : '-'}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Proveedor</p>
                <p className="text-sm font-medium">{selectedPago.proveedor || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Empresa</p>
                <p className="text-sm font-medium">{selectedPago.empresa || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Modelo</p>
                <p className="text-sm">{selectedPago.modelo || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Serie</p>
                <p className="text-sm">{selectedPago.serie || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Moneda</p>
                <p className="text-sm font-semibold text-purple-600">{selectedPago.moneda || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Contravalor</p>
                <p className="text-sm font-semibold text-gray-800">
                  {selectedPago.usd_jpy_rate !== null && selectedPago.usd_jpy_rate !== undefined
                    ? parseFloat(String(selectedPago.usd_jpy_rate)).toFixed(2)
                    : 'PDTE'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">TRM</p>
                <p className="text-sm font-semibold text-gray-800">
                  {selectedPago.trm_rate !== null && selectedPago.trm_rate !== undefined
                    ? selectedPago.trm_rate.toLocaleString('es-CO')
                    : 'PDTE'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Fecha de Pago</p>
                <p className="text-sm text-gray-700">
                  {selectedPago.payment_date
                    ? new Date(selectedPago.payment_date).toLocaleDateString('es-CO')
                    : 'PDTE'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Tasa</p>
                <p className="text-sm">{selectedPago.tasa ? selectedPago.tasa.toLocaleString('es-CO') : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Valor Factura</p>
                <p className="text-lg font-bold text-green-600">
                  {selectedPago.valor_factura_proveedor
                    ? `$${selectedPago.valor_factura_proveedor.toLocaleString('es-CO')}`
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Pendiente A</p>
                <p className="text-sm font-medium">{selectedPago.pendiente_a || '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 uppercase font-semibold">Fecha Vencimiento</p>
                <p className="text-sm">
                  {selectedPago.fecha_vto_fact ? new Date(selectedPago.fecha_vto_fact).toLocaleDateString('es-CO') : '-'}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 uppercase font-semibold">Observaciones</p>
                <p className="text-sm text-gray-700">{selectedPago.observaciones_pagos || '-'}</p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Editar */}
      {selectedPago && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Editar Pago - ${selectedPago.mq || 'Sin MQ'}${selectedPago.modelo ? ` | ${selectedPago.modelo}` : ''}${selectedPago.serie ? ` | ${selectedPago.serie}` : ''}`}
          size="lg"
        >
          <div className="space-y-3 p-5 max-h-[80vh] overflow-y-auto">
            {/* Información de solo lectura */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Información del Pago</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">MQ</p>
                  <p className="text-gray-800 font-medium">{selectedPago.mq || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">No. Factura</p>
                  <p className="text-gray-800 font-medium">{selectedPago.no_factura || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Proveedor</p>
                  <p className="text-gray-800 font-medium">{selectedPago.proveedor || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Moneda</p>
                  <p className="text-gray-800 font-medium">{selectedPago.moneda || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">SHIPMENT</p>
                  <p className="text-gray-800 font-medium">{editData.shipment_type_v2 || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">VALOR + BP</p>
                  <p className="text-gray-800 font-medium">{editData.exw_value_formatted ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">GASTOS + LAVADO</p>
                  <p className="text-gray-800 font-medium">{editData.fob_expenses ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">DESENSAMBLAJE + CARGUE</p>
                  <p className="text-gray-800 font-medium">{editData.disassembly_load_value ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">VALOR FOB (SUMA)</p>
                  <p className="text-gray-800 font-medium">
                    {editData.fob_total != null
                      ? formatCurrency(editData.fob_total, selectedPago.moneda || 'USD')
                      : '-'}
                  </p>
                </div>
              </div>
            </div>

            {/* Campos editables - Múltiples Pagos */}
            <div className="space-y-3">
              {/* PAGO 1 */}
              <div className="border border-primary-200 rounded-lg p-3 bg-gradient-to-br from-white to-primary-50/30 shadow-sm">
                <h3 className="text-xs font-bold text-brand-red mb-2 uppercase tracking-wide border-b border-primary-200 pb-1.5">PAGO 1</h3>
                <div className="grid grid-cols-6 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Moneda</label>
                    <select
                      value={editData.pago1_moneda || ''}
                      onChange={(e) => setEditData({ ...editData, pago1_moneda: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-red focus:border-transparent text-sm"
                    >
                      <option value="">Seleccionar</option>
                      <option value="JPY">JPY</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
                    <input
                      type="date"
                      value={editData.pago1_fecha || ''}
                      onChange={(e) => setEditData({ ...editData, pago1_fecha: e.target.value || null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-red focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Contravalor</label>
                    <input
                      type="text"
                      value={pago1ContravalorInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setPago1ContravalorInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, pago1_contravalor: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, pago1_contravalor: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setPago1ContravalorInput('');
                          setEditData({ ...editData, pago1_contravalor: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, pago1_contravalor: val });
                            setPago1ContravalorInput(formatNumberWithSeparators(val));
                          } else {
                            setPago1ContravalorInput(editData.pago1_contravalor != null ? formatNumberWithSeparators(editData.pago1_contravalor) : '');
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">TRM (COP)</label>
                    <input
                      type="text"
                      value={pago1TrmInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setPago1TrmInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, pago1_trm: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, pago1_trm: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setPago1TrmInput('');
                          setEditData({ ...editData, pago1_trm: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, pago1_trm: val });
                            setPago1TrmInput(formatCurrency(val, 'COP'));
                          } else {
                            setPago1TrmInput(editData.pago1_trm != null ? formatCurrency(editData.pago1_trm, 'COP') : '');
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Valor Girado</label>
                    <input
                      type="text"
                      value={pago1ValorGiradoInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        // Actualizar estado local (permite editar libremente)
                        setPago1ValorGiradoInput(inputVal);
                        // Parsear y actualizar editData solo si es un número válido
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, pago1_valor_girado: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, pago1_valor_girado: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        // Al perder el foco, formatear el valor si es válido
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setPago1ValorGiradoInput('');
                          setEditData({ ...editData, pago1_valor_girado: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, pago1_valor_girado: val });
                            setPago1ValorGiradoInput(formatCurrency(val, 'COP'));
                          } else {
                            // Si no es válido, restaurar el valor anterior
                            setPago1ValorGiradoInput(editData.pago1_valor_girado != null ? formatCurrency(editData.pago1_valor_girado, 'COP') : '');
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
              />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Tasa</label>
                    <input
                      type="text"
                      value={pago1Tasa !== null && pago1Tasa !== undefined
                        ? formatNumberForInput(pago1Tasa)
                        : '-'}
                      readOnly
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md bg-secondary-100 text-xs font-medium text-secondary-700"
                    />
                  </div>
                </div>
              </div>

              {/* PAGO 2 */}
              <div className="border border-primary-200 rounded-lg p-3 bg-gradient-to-br from-white to-primary-50/30 shadow-sm">
                <h3 className="text-xs font-bold text-brand-red mb-2 uppercase tracking-wide border-b border-primary-200 pb-1.5">PAGO 2</h3>
                <div className="grid grid-cols-6 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Moneda</label>
                    <select
                      value={editData.pago2_moneda || ''}
                      onChange={(e) => setEditData({ ...editData, pago2_moneda: e.target.value || null })}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    >
                      <option value="">Seleccionar</option>
                      <option value="JPY">JPY</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Fecha</label>
                    <input
                      type="date"
                      value={editData.pago2_fecha || ''}
                      onChange={(e) => setEditData({ ...editData, pago2_fecha: e.target.value || null })}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Contravalor</label>
                    <input
                      type="text"
                      value={pago2ContravalorInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setPago2ContravalorInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, pago2_contravalor: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, pago2_contravalor: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setPago2ContravalorInput('');
                          setEditData({ ...editData, pago2_contravalor: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, pago2_contravalor: val });
                            setPago2ContravalorInput(formatNumberWithSeparators(val));
                          } else {
                            setPago2ContravalorInput(editData.pago2_contravalor != null ? formatNumberWithSeparators(editData.pago2_contravalor) : '');
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">TRM (COP)</label>
                    <input
                      type="text"
                      value={pago2TrmInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setPago2TrmInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, pago2_trm: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, pago2_trm: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setPago2TrmInput('');
                          setEditData({ ...editData, pago2_trm: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, pago2_trm: val });
                            setPago2TrmInput(formatCurrency(val, 'COP'));
                          } else {
                            setPago2TrmInput(editData.pago2_trm != null ? formatCurrency(editData.pago2_trm, 'COP') : '');
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Valor Girado</label>
                    <input
                      type="text"
                      value={pago2ValorGiradoInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        // Actualizar estado local (permite editar libremente)
                        setPago2ValorGiradoInput(inputVal);
                        // Parsear y actualizar editData solo si es un número válido
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, pago2_valor_girado: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, pago2_valor_girado: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        // Al perder el foco, formatear el valor si es válido
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setPago2ValorGiradoInput('');
                          setEditData({ ...editData, pago2_valor_girado: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, pago2_valor_girado: val });
                            setPago2ValorGiradoInput(formatCurrency(val, 'COP'));
                          } else {
                            // Si no es válido, restaurar el valor anterior
                            setPago2ValorGiradoInput(editData.pago2_valor_girado != null ? formatCurrency(editData.pago2_valor_girado, 'COP') : '');
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Tasa</label>
                    <input
                      type="text"
                      value={pago2Tasa !== null && pago2Tasa !== undefined
                        ? formatNumberForInput(pago2Tasa)
                        : '-'}
                      readOnly
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md bg-secondary-100 text-xs font-medium text-secondary-700"
                    />
                  </div>
                </div>
              </div>

              {/* PAGO 3 */}
              <div className="border border-primary-200 rounded-lg p-3 bg-gradient-to-br from-white to-primary-50/30 shadow-sm">
                <h3 className="text-xs font-bold text-brand-red mb-2 uppercase tracking-wide border-b border-primary-200 pb-1.5">PAGO 3</h3>
                <div className="grid grid-cols-6 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Moneda</label>
                    <select
                      value={editData.pago3_moneda || ''}
                      onChange={(e) => setEditData({ ...editData, pago3_moneda: e.target.value || null })}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    >
                      <option value="">Seleccionar</option>
                      <option value="JPY">JPY</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Fecha</label>
                    <input
                      type="date"
                      value={editData.pago3_fecha || ''}
                      onChange={(e) => setEditData({ ...editData, pago3_fecha: e.target.value || null })}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Contravalor</label>
                    <input
                      type="text"
                      value={pago3ContravalorInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setPago3ContravalorInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, pago3_contravalor: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, pago3_contravalor: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setPago3ContravalorInput('');
                          setEditData({ ...editData, pago3_contravalor: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, pago3_contravalor: val });
                            setPago3ContravalorInput(formatNumberWithSeparators(val));
                          } else {
                            setPago3ContravalorInput(editData.pago3_contravalor != null ? formatNumberWithSeparators(editData.pago3_contravalor) : '');
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">TRM (COP)</label>
                    <input
                      type="text"
                      value={pago3TrmInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setPago3TrmInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, pago3_trm: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, pago3_trm: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setPago3TrmInput('');
                          setEditData({ ...editData, pago3_trm: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, pago3_trm: val });
                            setPago3TrmInput(formatCurrency(val, 'COP'));
                          } else {
                            setPago3TrmInput(editData.pago3_trm != null ? formatCurrency(editData.pago3_trm, 'COP') : '');
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Valor Girado</label>
                    <input
                      type="text"
                      value={pago3ValorGiradoInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        // Actualizar estado local (permite editar libremente)
                        setPago3ValorGiradoInput(inputVal);
                        // Parsear y actualizar editData solo si es un número válido
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, pago3_valor_girado: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, pago3_valor_girado: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        // Al perder el foco, formatear el valor si es válido
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setPago3ValorGiradoInput('');
                          setEditData({ ...editData, pago3_valor_girado: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, pago3_valor_girado: val });
                            setPago3ValorGiradoInput(formatCurrency(val, 'COP'));
                          } else {
                            // Si no es válido, restaurar el valor anterior
                            setPago3ValorGiradoInput(editData.pago3_valor_girado != null ? formatCurrency(editData.pago3_valor_girado, 'COP') : '');
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
              />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">Tasa</label>
                    <input
                      type="text"
                      value={pago3Tasa !== null && pago3Tasa !== undefined
                        ? formatNumberForInput(pago3Tasa)
                        : '-'}
                      readOnly
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md bg-secondary-100 text-xs font-medium text-secondary-700"
                    />
                  </div>
                </div>
              </div>

              {/* TOTALES */}
              <div className="border-2 border-brand-red rounded-lg p-3 bg-gradient-to-r from-primary-50 to-brand-red/5">
                <h3 className="text-xs font-bold text-brand-red mb-2 uppercase tracking-wide border-b-2 border-brand-red pb-1.5">TOTALES</h3>
                <div className="grid grid-cols-5 gap-2">
                  <div></div>
                  <div></div>
                  <div></div>
                  <div>
                    <label className="block text-[10px] font-bold text-brand-red uppercase mb-1 tracking-wide">Total Valor Girado</label>
                    <input
                      type="text"
                      value={totalValorGirado !== null && totalValorGirado !== undefined && !isNaN(totalValorGirado) 
                        ? formatCurrency(totalValorGirado, 'COP')
                        : '$ 0,00'}
                      readOnly
                      className="w-full px-2 py-1.5 border-2 border-brand-red rounded-md bg-white font-bold text-xs text-brand-red"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-brand-red uppercase mb-1 tracking-wide">Tasa Promedio</label>
                    <input
                      type="text"
                      value={tasaPromedio !== null && tasaPromedio !== undefined
                        ? formatNumberForInput(tasaPromedio)
                        : '-'}
                      readOnly
                      className="w-full px-2 py-1.5 border-2 border-brand-red rounded-md bg-white font-bold text-xs text-brand-red"
                    />
                  </div>
                </div>
                {/* Sugerencias ponderadas */}
                <div className="mt-3 grid grid-cols-5 gap-2 items-end">
                  <div></div>
                  <div></div>
                  <div>
                    <p className="text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">
                      Sugerencias (ponderadas por Valor Girado)
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">
                      Contravalor Ponderado
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={
                          contravalorPonderado !== null && contravalorPonderado !== undefined
                            ? formatNumberWithSeparators(contravalorPonderado)
                            : '-'
                        }
                        readOnly
                        className="w-full px-2 py-1.5 border border-secondary-300 rounded-md bg-secondary-50 text-xs"
                      />
                      <button
                        type="button"
                        disabled={contravalorPonderado === null || contravalorPonderado === undefined}
                        onClick={() => {
                          if (contravalorPonderado === null || contravalorPonderado === undefined) return;
                          setEditData(prev => ({ ...prev, usd_jpy_rate: contravalorPonderado }));
                          setContravalorSyncInput(formatNumberWithSeparators(contravalorPonderado));
                        }}
                        className="px-2 py-1 text-[10px] font-semibold text-white bg-brand-red rounded-md disabled:opacity-50"
                      >
                        Usar
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">
                      TRM (COP) Ponderada
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={
                          trmPonderada !== null && trmPonderada !== undefined
                            ? formatNumberForInput(trmPonderada)
                            : '-'
                        }
                        readOnly
                        className="w-full px-2 py-1.5 border border-secondary-300 rounded-md bg-secondary-50 text-xs"
                      />
                      <button
                        type="button"
                        disabled={trmPonderada === null || trmPonderada === undefined}
                        onClick={() => {
                          if (trmPonderada === null || trmPonderada === undefined) return;
                          setEditData(prev => ({ ...prev, trm_rate: trmPonderada }));
                          setTrmSyncInput(formatNumberForInput(trmPonderada));
                        }}
                        className="px-2 py-1 text-[10px] font-semibold text-white bg-brand-red rounded-md disabled:opacity-50"
                      >
                        Usar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">
                  Observaciones
                </label>
                <textarea
                  value={editData.observaciones_pagos || ''}
                  onChange={(e) => setEditData({ ...editData, observaciones_pagos: e.target.value })}
                  rows={2}
                  className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs resize-none"
                />
              </div>

              {/* Campos para sincronización con otros módulos */}
              <div className="border-t-2 border-secondary-200 pt-3">
                <h3 className="text-xs font-bold text-brand-gray mb-1.5 uppercase tracking-wide">Campos para Sincronización</h3>
                <p className="text-[10px] text-secondary-500 mb-2">
                  Valores utilizados para sincronizar con otros módulos
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">CONTRAVALOR</label>
                    <input
                      type="text"
                      value={contravalorSyncInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setContravalorSyncInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, usd_jpy_rate: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, usd_jpy_rate: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setContravalorSyncInput('');
                          setEditData({ ...editData, usd_jpy_rate: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, usd_jpy_rate: val });
                            setContravalorSyncInput(formatNumberWithSeparators(val));
                          } else {
                            setContravalorSyncInput(editData.usd_jpy_rate != null ? formatNumberWithSeparators(editData.usd_jpy_rate) : '');
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">TRM (COP)</label>
                    <input
                      type="text"
                      value={trmSyncInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setTrmSyncInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, trm_rate: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, trm_rate: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setTrmSyncInput('');
                          setEditData({ ...editData, trm_rate: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, trm_rate: val });
                            setTrmSyncInput(formatCurrency(val, 'COP'));
                          } else {
                            setTrmSyncInput(editData.trm_rate != null ? formatCurrency(editData.trm_rate, 'COP') : '');
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">FECHA DE PAGO</label>
                    <input
                      type="date"
                      value={editData.payment_date ? new Date(editData.payment_date).toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        const dateValue = e.target.value ? e.target.value : null;
                        setEditData({ ...editData, payment_date: dateValue });
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                    />
                  </div>
                </div>

                {/* Campos OCEAN */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">OCEAN (USD)</label>
                    <input
                      type="text"
                      value={oceanInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setOceanInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, ocean_pagos: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, ocean_pagos: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setOceanInput('');
                          setEditData({ ...editData, ocean_pagos: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, ocean_pagos: val });
                            setOceanInput(formatCurrency(val, 'USD'));
                          } else {
                            setOceanInput(editData.ocean_pagos != null ? formatCurrency(editData.ocean_pagos, 'USD') : '');
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                      placeholder="$ 0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">TRM OCEAN (COP)</label>
                    <input
                      type="text"
                      value={trmOceanInput}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        setTrmOceanInput(inputVal);
                        if (inputVal === '' || inputVal === '-') {
                          setEditData({ ...editData, trm_ocean: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, trm_ocean: val });
                          }
                        }
                      }}
                      onBlur={(e) => {
                        const inputVal = e.target.value.trim();
                        if (inputVal === '' || inputVal === '-') {
                          setTrmOceanInput('');
                          setEditData({ ...editData, trm_ocean: null });
                        } else {
                          const val = parseNumberFromInput(inputVal);
                          if (val !== null) {
                            setEditData({ ...editData, trm_ocean: val });
                            setTrmOceanInput(formatCurrency(val, 'COP'));
                          } else {
                            setTrmOceanInput(editData.trm_ocean != null ? formatCurrency(editData.trm_ocean, 'COP') : '');
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-secondary-300 rounded-md focus:ring-2 focus:ring-brand-red focus:border-brand-red text-xs"
                      placeholder="$ 0.00"
                    />
                  </div>
                </div>
              <div className="mt-2">
                <label className="block text-[10px] font-semibold text-secondary-600 uppercase mb-1 tracking-wide">OCEAN (COP)</label>
                <input
                  type="text"
                  value={
                    editData.ocean_pagos != null && editData.trm_ocean != null
                      ? formatCurrency(editData.ocean_pagos * editData.trm_ocean, 'COP')
                      : ''
                  }
                  readOnly
                  className="w-full px-2 py-1.5 border border-secondary-200 rounded-md bg-secondary-50 text-xs text-gray-700"
                  placeholder="$ 0.00"
                />
              </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-secondary-200">
              <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit}>
                Guardar Cambios
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Historial de Cambios */}
      {selectedPago && (
        <Modal
          isOpen={isChangeLogOpen}
          onClose={() => setIsChangeLogOpen(false)}
          title={`Historial de Cambios - ${selectedPago.mq || 'Pago'}`}
        >
          <ChangeHistory
            tableName="purchases"
            recordId={selectedPago.id}
          />
        </Modal>
      )}

      {/* Modal de Control de Cambios */}
      <ChangeLogModal
        isOpen={changeModalOpen}
        changes={changeModalItems}
        onConfirm={(reason) => {
          handleConfirmInlineChange(reason);
        }}
        onCancel={() => {
          handleCancelInlineChange();
        }}
      />

        {/* Botón flotante para guardar cambios en modo batch */}
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
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-md backdrop-blur-sm">
                    <Layers className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-sm truncate">Modo Masivo</h3>
                    <p className="text-white/90 text-[10px] font-medium truncate">
                      Cambios pendientes
                    </p>
                  </div>
                </div>
              </div>

              {/* Contenido compacto */}
              <div className="px-4 py-3 bg-gradient-to-br from-gray-50 to-white">
                <div className="flex items-center justify-between gap-4">
                  {/* Estadísticas compactas */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-[#cf1b22] rounded-full animate-pulse"></div>
                      <div>
                        <p className="text-lg font-bold text-[#cf1b22] leading-tight">
                          {pendingBatchChanges.size}
                        </p>
                        <p className="text-[10px] text-gray-600 font-medium leading-tight">
                          {pendingBatchChanges.size === 1 ? 'Registro' : 'Registros'}
                        </p>
                      </div>
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
              </div>

              {/* Barra de progreso sutil */}
              <div className="h-0.5 bg-gray-100">
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
          </motion.div>
        )}
    </div>
  );
};

export default PagosPage;

