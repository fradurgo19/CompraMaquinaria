/**
 * Página de Compras - Diseño Premium Empresarial
 */

import { useState, useRef, useEffect } from 'react';
import { Plus, Search, Download, Package, DollarSign, Truck, FileText, Eye, Pencil, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../atoms/Button';
import { Card } from '../molecules/Card';
import { Modal } from '../molecules/Modal';
import { Select } from '../atoms/Select';
import { DataTable, Column } from '../organisms/DataTable';
import { PurchaseWithRelations, PaymentStatus } from '../types/database';
import { PurchaseFormNew } from '../components/PurchaseFormNew';
import { usePurchases } from '../hooks/usePurchases';
import { showSuccess } from '../components/Toast';
import { MachineFiles } from '../components/MachineFiles';
import { ChangeHistory } from '../components/ChangeHistory';

export const PurchasesPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseWithRelations | null>(null);
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | ''>('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Refs para scroll sincronizado
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const { purchases, isLoading, refetch } = usePurchases();

  const filteredPurchases = purchases
    .filter((purchase) => purchase.condition !== 'NUEVO') // Solo USADOS en este módulo
    .filter((purchase) => {
      if (statusFilter && purchase.payment_status !== statusFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          purchase.machine?.model?.toLowerCase().includes(search) ||
          purchase.machine?.serial?.toLowerCase().includes(search) ||
          purchase.invoice_number?.toLowerCase().includes(search)
        );
      }
      return true;
    });

  // Estadísticas
  const totalPending = filteredPurchases.filter(p => p.payment_status === 'PENDIENTE').length;
  const totalPaid = filteredPurchases.filter(p => p.payment_status === 'COMPLETADO').length;
  const totalInProgress = filteredPurchases.filter(p => p.payment_status === 'DESBOLSADO').length;
  
  // Compras Activas (con estado PENDIENTE o DESBOLSADO)
  const activePurchases = filteredPurchases.filter(p => 
    p.payment_status === 'PENDIENTE' || p.payment_status === 'DESBOLSADO'
  ).length;
  
  // Pagos Pendientes - calcular monto total
  const pendingPaymentsAmount = filteredPurchases
    .filter(p => p.payment_status === 'PENDIENTE')
    .reduce((sum, p) => {
      const exw = parseFloat(p.exw_value_formatted?.replace(/[^0-9.-]/g, '') || '0');
      const disassembly = parseFloat(p.disassembly_load_value || '0');
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

  // Funciones helper para estilos elegantes
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

  const getPuertoEmbarqueStyle = (puerto: string | null | undefined) => {
    if (!puerto || puerto === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md';
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

  const getFechaStyle = (fecha: string | null | undefined) => {
    if (!fecha || fecha === '-' || fecha === 'PDTE') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md';
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

  const getMarcaStyle = (marca: string | null | undefined) => {
    if (!marca || marca === '-') return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md';
  };

  const renderPendiente = (value: string | null | undefined) => {
    if (!value || value === 'PDTE' || value === '') {
      return <span className="text-red-600 font-semibold">PDTE</span>;
    }
    return <span className="text-gray-700">{value}</span>;
  };

  const columns: Column<PurchaseWithRelations>[] = [
    { key: 'mq', label: 'MQ', sortable: true, render: (row: any) => <span className="font-mono">{row.mq || '-'}</span> },
    {
      key: 'purchase_type', 
      label: 'TIPO', 
      sortable: true,
      render: (row: any) => {
        const tipo = row.purchase_type || '-';
        // Formatear el texto para mostrar
        const tipoDisplay = tipo === 'COMPRA_DIRECTA' ? 'COMPRA DIRECTA' : tipo;
        return (
          <span className={getTipoCompraStyle(tipo)}>
            {tipoDisplay}
          </span>
        );
      }
    },
    {
      key: 'condition',
      label: 'CONDICIÓN',
      sortable: true,
      render: (row: any) => {
        const condition = row.condition || 'USADO';
        return condition === 'NUEVO' ? (
          <span className="px-3 py-1 rounded-full font-semibold text-sm bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md">
            NUEVO
          </span>
        ) : (
          <span className="px-3 py-1 rounded-full font-semibold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md">
            USADO
          </span>
        );
      }
    },
    { 
      key: 'shipment_type_v2', 
      label: 'SHIPMENT', 
      sortable: true, 
      render: (row: any) => (
        row.shipment_type_v2 ? (
          <span className={getShipmentStyle(row.shipment_type_v2)}>
            {row.shipment_type_v2}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      )
    },
    { 
      key: 'supplier_name', 
      label: 'PROVEEDOR', 
      sortable: true, 
      render: (row: any) => (
        row.supplier_name ? (
          <span className={getProveedorStyle(row.supplier_name)}>
            {row.supplier_name}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      )
    },
    { 
      key: 'brand', 
      label: 'MARCA', 
      sortable: true, 
      render: (row: any) => (
        row.brand ? (
          <span className={getMarcaStyle(row.brand)}>
            {row.brand}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      )
    },
    { 
      key: 'model', 
      label: 'MODELO', 
      sortable: true, 
      render: (row: any) => (
        row.model ? (
          <span className={getModeloStyle(row.model)}>
            {row.model}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      )
    },
    { 
      key: 'serial', 
      label: 'SERIAL', 
      sortable: true, 
      render: (row: any) => (
        row.serial ? (
          <span className={getSerialStyle(row.serial)}>
            {row.serial}
          </span>
        ) : (
          <span className="text-gray-400 font-mono">-</span>
        )
      )
    },
    { 
      key: 'purchase_order', 
      label: 'ORDEN DE COMPRA', 
      sortable: true, 
      render: (row: any) => (
        <span className="text-sm text-gray-700">{row.purchase_order || '-'}</span>
      )
    },
    { 
      key: 'invoice_number', 
      label: 'No. FACTURA', 
      sortable: true, 
      render: (row: any) => (
        <span className="text-sm font-semibold text-blue-700">{row.invoice_number || '-'}</span>
      )
    },
    { 
      key: 'invoice_date', 
      label: 'FECHA FACTURA', 
      sortable: true,
      render: (row: any) => {
        if (!row.invoice_date) return <span className="text-gray-400">-</span>;
        try {
          const date = new Date(row.invoice_date);
          const dateStr = date.toLocaleDateString('es-CO', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
          });
          return (
            <span className={getFechaFacturaStyle(dateStr)}>
              {dateStr}
            </span>
          );
        } catch {
          return <span className={getFechaFacturaStyle(row.invoice_date)}>{row.invoice_date}</span>;
        }
      }
    },
    { 
      key: 'location', 
      label: 'UBICACIÓN MÁQUINA', 
      sortable: true, 
      render: (row: any) => (
        row.location ? (
          <span className={getUbicacionStyle(row.location)}>
            {row.location}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      )
    },
    { 
      key: 'incoterm', 
      label: 'INCOTERM', 
      sortable: true, 
      render: (row: any) => (
        row.incoterm ? (
          <span className={getIncotermStyle(row.incoterm)}>
            {row.incoterm}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      )
    },
    { 
      key: 'currency_type', 
      label: 'MONEDA', 
      sortable: true, 
      render: (row: any) => (
        row.currency_type ? (
          <span className={getMonedaStyle(row.currency_type)}>
            {row.currency_type}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      )
    },
    { 
      key: 'port_of_embarkation', 
      label: 'PUERTO EMBARQUE', 
      sortable: true, 
      render: (row: any) => (
        row.port_of_embarkation ? (
          <span className={getPuertoEmbarqueStyle(row.port_of_embarkation)}>
            {row.port_of_embarkation}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      )
    },
    { 
      key: 'exw_value_formatted', 
      label: 'VALOR EXW + BP', 
      sortable: true,
      render: (row: any) => {
        const symbol = row.currency_type === 'USD' ? '$' : '¥';
        return <span className="font-semibold">{symbol}{row.exw_value_formatted || '-'}</span>;
      }
    },
    {
      key: 'fob_expenses', 
      label: 'GASTOS FOB + LAVADO', 
      sortable: true,
      render: (row: any) => {
        const isFOB = row.incoterm === 'FOB';
        const symbol = row.currency_type === 'USD' ? '$' : '¥';
        return (
          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
            isFOB 
              ? 'bg-gray-200 text-gray-500 line-through' 
              : 'bg-green-100 text-green-800 font-semibold'
          }`}>
            {isFOB ? 'N/A' : `${symbol}${row.fob_expenses || '0'}`}
          </span>
        );
      }
    },
    {
      key: 'disassembly_load_value', 
      label: 'DESENSAMBLAJE + CARGUE', 
      sortable: true,
      render: (row: any) => {
        const isFOB = row.incoterm === 'FOB';
        const symbol = row.currency_type === 'USD' ? '$' : '¥';
        const value = row.disassembly_load_value || 0;
        return (
          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
            isFOB 
              ? 'bg-gray-200 text-gray-500 line-through' 
              : 'bg-green-100 text-green-800 font-semibold'
          }`}>
            {isFOB ? 'N/A' : `${symbol}${value > 0 ? value.toLocaleString('es-CO') : '0'}`}
          </span>
        );
      }
    },
    { 
      key: 'fob_total', 
      label: 'VALOR FOB (SUMA)', 
      sortable: true,
      render: (row: any) => {
        // Calcular suma: EXW + BP + Gastos FOB + Lavado + Desensamblaje + Cargue
        const exw = parseFloat(row.exw_value_formatted?.replace(/[^0-9.-]/g, '') || '0');
        const fobExpenses = parseFloat(row.fob_expenses || '0');
        const disassembly = parseFloat(row.disassembly_load_value || '0');
        const total = exw + fobExpenses + disassembly;
        
        const symbol = row.currency_type === 'USD' ? '$' : '¥';
        
        return total > 0 ? (
          <span className="font-bold text-green-700">{symbol}{total.toLocaleString('es-CO')}</span>
        ) : (
          <span className="text-gray-400">-</span>
        );
      }
    },
    { key: 'usd_jpy_rate', label: 'USD/JPY', sortable: true, render: (row: any) => renderPendiente(row.usd_jpy_rate?.toString()) },
    { key: 'trm_rate', label: 'TRM', sortable: true, render: (row: any) => renderPendiente(row.trm_rate?.toString()) },
    { 
      key: 'payment_date', 
      label: 'FECHA DE PAGO', 
      sortable: true, 
      render: (row: any) => {
        if (!row.payment_date) return <span className="text-red-600 font-semibold">PDTE</span>;
        const date = new Date(row.payment_date);
        return <span className="text-xs">{date.toLocaleDateString('es-CO', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        })}</span>;
      }
    },
    { 
      key: 'shipment_departure_date', 
      label: 'EMBARQUE SALIDA', 
      sortable: true, 
      render: (row: any) => {
        if (!row.shipment_departure_date) return <span className="text-red-600 font-semibold">PDTE</span>;
        const date = new Date(row.shipment_departure_date);
        return <span className="text-xs">{date.toLocaleDateString('es-CO', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        })}</span>;
      }
    },
    { 
      key: 'shipment_arrival_date', 
      label: 'EMBARQUE LLEGADA', 
      sortable: true, 
      render: (row: any) => {
        if (!row.shipment_arrival_date) return <span className="text-red-600 font-semibold">PDTE</span>;
        const date = new Date(row.shipment_arrival_date);
        return <span className="text-xs">{date.toLocaleDateString('es-CO', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        })}</span>;
      }
    },
    { 
      key: 'sales_reported', 
      label: 'REPORTADO VENTAS', 
      sortable: true, 
      render: (row: any) => (
        <span className={row.sales_reported === 'PDTE' ? 'text-red-600 font-semibold' : 'text-green-600'}>{row.sales_reported || 'PDTE'}</span>
      )
    },
    { 
      key: 'commerce_reported', 
      label: 'REPORTADO COMERCIO', 
      sortable: true, 
      render: (row: any) => (
        <span className={row.commerce_reported === 'PDTE' ? 'text-red-600 font-semibold' : 'text-green-600'}>{row.commerce_reported || 'PDTE'}</span>
      )
    },
    { 
      key: 'luis_lemus_reported', 
      label: 'REPORTE LUIS LEMUS', 
      sortable: true,
      render: (row: any) => (
        <span className={row.luis_lemus_reported === 'PDTE' ? 'text-red-600 font-semibold' : 'text-green-600'}>{row.luis_lemus_reported || 'PDTE'}</span>
      )
    },
    {
      key: 'actions',
      label: 'ACCIONES',
      sortable: false,
      render: (row: any) => (
        <div className="flex items-center gap-1.5 justify-end">
          <button
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-white border-2 border-brand-gray text-brand-gray hover:bg-gray-50 hover:border-brand-red hover:text-brand-red shadow-sm transition-all"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenView(row);
            }}
          >
            <Eye className="w-3.5 h-3.5" /> Ver
          </button>
          <button
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-white border-2 border-orange-500 text-orange-600 hover:bg-orange-50 shadow-sm transition-all"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPurchase(row);
              setIsHistoryOpen(true);
            }}
            title="Ver historial de cambios"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          <button
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-gradient-to-r from-brand-red to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenModal(row);
            }}
          >
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
        </div>
      )
    },
  ];

  const handleOpenModal = (purchase?: PurchaseWithRelations) => {
    setSelectedPurchase(purchase || null);
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
                      placeholder="Buscar por modelo, serial o factura..."
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

            {/* Table */}
        <DataTable
          data={filteredPurchases}
          columns={columns}
          onRowClick={handleOpenModal}
          isLoading={isLoading}
          scrollRef={tableScrollRef}
          rowClassName={(row: any) => 
            row.invoice_date 
              ? 'bg-green-50 hover:bg-green-100' 
              : 'bg-gray-50 hover:bg-gray-100'
          }
        />
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

      {/* View Modal */}
      <Modal
        isOpen={isViewOpen}
        onClose={handleCloseView}
        title="Detalle de la Compra"
        size="lg"
      >
        {selectedPurchase && (
          <div className="space-y-6">
            {/* Sección: Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl">
              <div>
                <p className="text-xs text-gray-500 mb-1">MQ</p>
                {selectedPurchase.mq ? (
                  <span className={getMQStyle(selectedPurchase.mq)}>
                    {selectedPurchase.mq}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400 font-mono">-</span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">TIPO</p>
                {selectedPurchase.purchase_type ? (
                  <span className={getTipoCompraStyle(selectedPurchase.purchase_type)}>
                    {selectedPurchase.purchase_type}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">SHIPMENT</p>
                {selectedPurchase.shipment_type_v2 ? (
                  <span className={getShipmentStyle(selectedPurchase.shipment_type_v2)}>
                    {selectedPurchase.shipment_type_v2}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">-</span>
                )}
              </div>
            </div>

            {/* Sección: Máquina */}
            <div className="border rounded-xl p-4 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Máquina</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">PROVEEDOR</p>
                  {selectedPurchase.supplier_name ? (
                    <span className={getProveedorStyle(selectedPurchase.supplier_name)}>
                      {selectedPurchase.supplier_name}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">MODELO</p>
                  {selectedPurchase.model ? (
                    <span className={getModeloStyle(selectedPurchase.model)}>
                      {selectedPurchase.model}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">SERIAL</p>
                  {selectedPurchase.serial ? (
                    <span className={getSerialStyle(selectedPurchase.serial)}>
                      {selectedPurchase.serial}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400 font-mono">-</span>
                  )}
                </div>
              </div>
            </div>

            {/* Sección: Fechas y Ubicación */}
            <div className="border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Fechas y Ubicación</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">FECHA FACTURA</p>
                  {selectedPurchase.invoice_date ? (
                    <span className={getFechaFacturaStyle(new Date(selectedPurchase.invoice_date).toLocaleDateString('es-CO'))}>
                      {new Date(selectedPurchase.invoice_date).toLocaleDateString('es-CO')}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">UBICACIÓN MÁQUINA</p>
                  {selectedPurchase.location ? (
                    <span className={getUbicacionStyle(selectedPurchase.location)}>
                      {selectedPurchase.location}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">INCOTERM</p>
                  {selectedPurchase.incoterm ? (
                    <span className={getIncotermStyle(selectedPurchase.incoterm)}>
                      {selectedPurchase.incoterm}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">MONEDA</p>
                  {selectedPurchase.currency_type ? (
                    <span className={getMonedaStyle(selectedPurchase.currency_type)}>
                      {selectedPurchase.currency_type}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
              </div>
            </div>

            {/* Sección: Envío */}
            <div className="border rounded-xl p-4 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Envío</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">PUERTO EMBARQUE</p>
                  {selectedPurchase.port_of_embarkation ? (
                    <span className={getPuertoEmbarqueStyle(selectedPurchase.port_of_embarkation)}>
                      {selectedPurchase.port_of_embarkation}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">EMBARQUE SALIDA</p>
                  {selectedPurchase.shipment_departure_date ? (
                    <span className={getFechaStyle(new Date(selectedPurchase.shipment_departure_date).toLocaleDateString('es-CO'))}>
                      {new Date(selectedPurchase.shipment_departure_date).toLocaleDateString('es-CO')}
                    </span>
                  ) : (
                    <span className="text-sm text-red-600 font-semibold">PDTE</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">EMBARQUE LLEGADA</p>
                  {selectedPurchase.shipment_arrival_date ? (
                    <span className={getFechaStyle(new Date(selectedPurchase.shipment_arrival_date).toLocaleDateString('es-CO'))}>
                      {new Date(selectedPurchase.shipment_arrival_date).toLocaleDateString('es-CO')}
                    </span>
                  ) : (
                    <span className="text-sm text-red-600 font-semibold">PDTE</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">FECHA DE PAGO</p>
                  {selectedPurchase.payment_date ? (
                    <span className={getFechaStyle(new Date(selectedPurchase.payment_date).toLocaleDateString('es-CO'))}>
                      {new Date(selectedPurchase.payment_date).toLocaleDateString('es-CO')}
                    </span>
                  ) : (
                    <span className="text-sm text-red-600 font-semibold">PDTE</span>
                  )}
                </div>
              </div>
            </div>

            {/* Sección: Tasas */}
            <div className="border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Tasas de Cambio</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">USD/JPY</p>
                  {selectedPurchase.usd_jpy_rate && selectedPurchase.usd_jpy_rate !== 'PDTE' ? (
                    <span className={getTasaStyle(selectedPurchase.usd_jpy_rate)}>
                      {selectedPurchase.usd_jpy_rate}
                    </span>
                  ) : (
                    <span className="text-sm text-red-600 font-semibold">PDTE</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">TRM</p>
                  {selectedPurchase.trm_rate && selectedPurchase.trm_rate !== 'PDTE' ? (
                    <span className={getTasaStyle(selectedPurchase.trm_rate)}>
                      {selectedPurchase.trm_rate}
                    </span>
                  ) : (
                    <span className="text-sm text-red-600 font-semibold">PDTE</span>
                  )}
                </div>
              </div>
            </div>

            {/* Sección: Valores */}
            <div className="border rounded-xl p-4 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Valores</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">VALOR EXW + BP</p>
                  {selectedPurchase.exw_value_formatted ? (
                    <span className={getValorStyle(selectedPurchase.exw_value_formatted)}>
                      {selectedPurchase.exw_value_formatted}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">GASTOS FOB + LAVADO</p>
                  {selectedPurchase.incoterm === 'FOB' ? (
                    <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-200 text-gray-500 line-through">
                      N/A (FOB)
                    </span>
                  ) : selectedPurchase.fob_expenses ? (
                    <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-100 text-green-800">
                      {selectedPurchase.fob_expenses}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">DESENSAMBLAJE + CARGUE</p>
                  {selectedPurchase.incoterm === 'FOB' ? (
                    <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-200 text-gray-500 line-through">
                      N/A (FOB)
                    </span>
                  ) : selectedPurchase.disassembly_load_value ? (
                    <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-100 text-green-800">
                      {selectedPurchase.disassembly_load_value}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">VALOR FOB (SUMA)</p>
                  {(() => {
                    const exw = parseFloat(String(selectedPurchase.exw_value_formatted || '').replace(/[^0-9.-]/g, '') || '0');
                    const fobExpenses = parseFloat(String(selectedPurchase.fob_expenses || '0'));
                    const disassembly = parseFloat(String(selectedPurchase.disassembly_load_value || '0'));
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

            {/* Sección: Reportes */}
            <div className="border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Reportes</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">REPORTADO VENTAS</p>
                  <span className={getReporteStyle(selectedPurchase.sales_reported)}>
                    {selectedPurchase.sales_reported || 'PDTE'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">REPORTADO COMERCIO</p>
                  <span className={getReporteStyle(selectedPurchase.commerce_reported)}>
                    {selectedPurchase.commerce_reported || 'PDTE'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">REPORTE LUIS LEMUS</p>
                  <span className={getReporteStyle(selectedPurchase.luis_lemus_reported)}>
                    {selectedPurchase.luis_lemus_reported || 'PDTE'}
                  </span>
                </div>
              </div>
            </div>

            {/* Sección: Archivos */}
            <div className="border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Archivos</h3>
              <MachineFiles 
                machineId={selectedPurchase.machine_id} 
                allowUpload={false} 
                allowDelete={false}
                currentScope="COMPRAS"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title="Historial de Cambios - Todos los Módulos"
        size="lg"
      >
        {selectedPurchase && (
          <ChangeHistory 
            tableName="purchases" 
            recordId={selectedPurchase.id}
            purchaseId={selectedPurchase.id}
          />
        )}
      </Modal>
      </div>
    </div>
  );
};
