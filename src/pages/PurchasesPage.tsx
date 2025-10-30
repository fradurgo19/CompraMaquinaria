/**
 * Página de Compras - Diseño Premium Empresarial
 */

import { useState } from 'react';
import { Plus, Search, Download, Package, DollarSign, Truck, FileText, Eye, Pencil } from 'lucide-react';
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

export const PurchasesPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseWithRelations | null>(null);
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  const { purchases, isLoading, refetch } = usePurchases();

  const filteredPurchases = purchases.filter((purchase) => {
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
        const isSubasta = row.purchase_type === 'SUBASTA';
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
            isSubasta 
              ? 'bg-blue-100 text-blue-800' 
              : 'bg-purple-100 text-purple-800'
          }`}>
            {isSubasta ? 'SUBASTA' : 'STOCK'}
          </span>
        );
      }
    },
    { key: 'shipment_type_v2', label: 'SHIPMENT', sortable: true, render: (row: any) => <span>{row.shipment_type_v2 || '-'}</span> },
    { key: 'supplier_name', label: 'PROVEEDOR', sortable: true, render: (row: any) => <span>{row.supplier_name || '-'}</span> },
    { key: 'model', label: 'MODELO', sortable: true, render: (row: any) => <span className="font-semibold">{row.model || '-'}</span> },
    { key: 'serial', label: 'SERIAL', sortable: true, render: (row: any) => <span className="font-mono">{row.serial || '-'}</span> },
    { 
      key: 'invoice_date', 
      label: 'FECHA FACTURA', 
      sortable: true,
      render: (row: any) => {
        if (!row.invoice_date) return <span>-</span>;
        try {
          const date = new Date(row.invoice_date);
          return <span className="text-xs">{date.toLocaleDateString('es-CO', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
          })}</span>;
        } catch {
          return <span>{row.invoice_date}</span>;
        }
      }
    },
    { key: 'location', label: 'UBICACIÓN MÁQUINA', sortable: true, render: (row: any) => <span>{row.location || '-'}</span> },
    { key: 'incoterm', label: 'INCOTERM', sortable: true, render: (row: any) => <span>{row.incoterm || '-'}</span> },
    { key: 'currency_type', label: 'MONEDA', sortable: true, render: (row: any) => <span>{row.currency_type || '-'}</span> },
    { key: 'port_of_embarkation', label: 'PUERTO EMBARQUE', sortable: true, render: (row: any) => <span>{row.port_of_embarkation || '-'}</span> },
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
        const symbol = row.currency_type === 'USD' ? '$' : '¥';
        return <span className="text-xs">{symbol}{row.fob_expenses || '-'}</span>;
      }
    },
    {
      key: 'disassembly_load_value', 
      label: 'DESENSAMBLAJE + CARGUE', 
      sortable: true,
      render: (row: any) => {
        const symbol = row.currency_type === 'USD' ? '$' : '¥';
        const value = row.disassembly_load_value || 0;
        return <span className="font-semibold">{symbol}{value > 0 ? value.toLocaleString('es-CO') : '-'}</span>;
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
          <Button
            variant="secondary"
            size="sm"
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenView(row);
            }}
          >
            <Eye className="w-3.5 h-3.5" /> Ver
          </Button>
          <Button
            size="sm"
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenModal(row);
            }}
          >
            <Pencil className="w-3.5 h-3.5" /> Editar
          </Button>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
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
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg"
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
          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Compras Activas</p>
                <p className="text-2xl font-bold text-purple-600">{activePurchases}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pagos Pendientes</p>
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

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-indigo-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Completados</p>
                <p className="text-2xl font-bold text-indigo-600">{totalPaidCorrected}</p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-lg">
                <FileText className="w-6 h-6 text-indigo-600" />
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
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm"
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

            {/* Table */}
        <DataTable
          data={filteredPurchases}
          columns={columns}
          onRowClick={handleOpenModal}
          isLoading={isLoading}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">MQ</p>
                <p className="text-sm font-semibold font-mono">{selectedPurchase.mq || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">TIPO</p>
                <p className="text-sm font-semibold">{selectedPurchase.purchase_type || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">SHIPMENT</p>
                <p className="text-sm font-semibold">{selectedPurchase.shipment_type_v2 || '-'}</p>
              </div>
            </div>

            {/* Sección: Máquina */}
            <div className="border rounded-xl p-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500">PROVEEDOR</p>
                  <p className="text-sm font-semibold">{selectedPurchase.supplier_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">MODELO</p>
                  <p className="text-sm font-semibold">{selectedPurchase.model || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">SERIAL</p>
                  <p className="text-sm font-semibold font-mono">{selectedPurchase.serial || '-'}</p>
                </div>
              </div>
            </div>

            {/* Sección: Fechas y Ubicación */}
            <div className="border rounded-xl p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">FECHA FACTURA</p>
                  <p className="text-sm">{selectedPurchase.invoice_date ? new Date(selectedPurchase.invoice_date).toLocaleDateString('es-CO') : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">UBICACIÓN MÁQUINA</p>
                  <p className="text-sm font-semibold">{selectedPurchase.location || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">INCOTERM</p>
                  <p className="text-sm font-semibold">{selectedPurchase.incoterm || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">MONEDA</p>
                  <p className="text-sm font-semibold">{selectedPurchase.currency_type || '-'}</p>
                </div>
              </div>
            </div>

            {/* Sección: Envío */}
            <div className="border rounded-xl p-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">PUERTO EMBARQUE</p>
                  <p className="text-sm font-semibold">{selectedPurchase.port_of_embarkation || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">EMBARQUE SALIDA</p>
                  <p className="text-sm">{selectedPurchase.shipment_departure_date ? new Date(selectedPurchase.shipment_departure_date).toLocaleDateString('es-CO') : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">EMBARQUE LLEGADA</p>
                  <p className="text-sm">{selectedPurchase.shipment_arrival_date ? new Date(selectedPurchase.shipment_arrival_date).toLocaleDateString('es-CO') : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">FECHA DE PAGO</p>
                  <p className="text-sm">{selectedPurchase.payment_date ? new Date(selectedPurchase.payment_date).toLocaleDateString('es-CO') : '-'}</p>
                </div>
              </div>
            </div>

            {/* Sección: Tasas */}
            <div className="border rounded-xl p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">USD/JPY</p>
                  <p className="text-sm font-semibold">{selectedPurchase.usd_jpy_rate ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">TRM</p>
                  <p className="text-sm font-semibold">{selectedPurchase.trm_rate ?? '-'}</p>
                </div>
              </div>
            </div>

            {/* Sección: Valores */}
            <div className="border rounded-xl p-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">VALOR EXW + BP</p>
                  <p className="text-sm font-semibold">{selectedPurchase.exw_value_formatted || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">GASTOS FOB + LAVADO</p>
                  <p className="text-sm">{selectedPurchase.fob_expenses || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">DESENSAMBLAJE + CARGUE</p>
                  <p className="text-sm font-semibold">{selectedPurchase.disassembly_load_value || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">VALOR FOB (SUMA)</p>
                  <p className="text-sm font-bold text-green-700">
                    {(() => {
                      const exw = parseFloat(String(selectedPurchase.exw_value_formatted || '').replace(/[^0-9.-]/g, '') || '0');
                      const fobExpenses = parseFloat(String(selectedPurchase.fob_expenses || '0'));
                      const disassembly = parseFloat(String(selectedPurchase.disassembly_load_value || '0'));
                      const total = exw + fobExpenses + disassembly;
                      return total > 0 ? total.toLocaleString('es-CO') : '-';
                    })()}
                  </p>
                </div>
              </div>
            </div>

            {/* Sección: Reportes */}
            <div className="border rounded-xl p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500">REPORTADO VENTAS</p>
                  <p className={`text-sm font-semibold ${selectedPurchase.sales_reported === 'PDTE' ? 'text-red-600' : 'text-green-600'}`}>{selectedPurchase.sales_reported || 'PDTE'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">REPORTADO COMERCIO</p>
                  <p className={`text-sm font-semibold ${selectedPurchase.commerce_reported === 'PDTE' ? 'text-red-600' : 'text-green-600'}`}>{selectedPurchase.commerce_reported || 'PDTE'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">REPORTE LUIS LEMUS</p>
                  <p className={`text-sm font-semibold ${selectedPurchase.luis_lemus_reported === 'PDTE' ? 'text-red-600' : 'text-green-600'}`}>{selectedPurchase.luis_lemus_reported || 'PDTE'}</p>
                </div>
              </div>
            </div>

            {/* Sección: Archivos */}
            <div className="border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Archivos</h3>
              <MachineFiles machineId={selectedPurchase.machine_id} allowUpload={false} />
            </div>
          </div>
        )}
      </Modal>
      </div>
    </div>
  );
};
