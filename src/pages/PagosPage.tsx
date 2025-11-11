import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Calendar, AlertCircle, CheckCircle, Clock, Eye, Edit, History } from 'lucide-react';
import { apiGet, apiPut } from '../services/api';
import { ChangeHistory } from '../components/ChangeHistory';
import { Card } from '../molecules/Card';
import { DataTable } from '../organisms/DataTable';
import { Modal } from '../molecules/Modal';
import { Input } from '../atoms/Input';
import { Select } from '../atoms/Select';
import { Button } from '../atoms/Button';
import { Spinner } from '../atoms/Spinner';

interface Pago {
  id: string;
  mq: string;
  no_factura: string;
  fecha_factura: string;
  proveedor: string;
  moneda: string;
  tasa: number;
  valor_factura_proveedor: number;
  observaciones_pagos: string;
  pendiente_a: string;
  fecha_vto_fact: string;
  modelo: string;
  serie: string;
}

const PagosPage: React.FC = () => {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPendiente, setFilterPendiente] = useState('');
  const [selectedPago, setSelectedPago] = useState<Pago | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isChangeLogOpen, setIsChangeLogOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<Pago>>({});

  // Opciones para Pendiente A
  const pendienteOptions = [
    'PROVEEDORES MAQUITECNO',
    'PROVEEDORES PARTEQUIPOS MAQUINARIA',
    'PROVEEDORES SOREMAQ'
  ];

  useEffect(() => {
    fetchPagos();
  }, []);

  const fetchPagos = async () => {
    try {
      setLoading(true);
      const data = await apiGet('/api/pagos');
      setPagos(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar pagos');
      console.error('Error fetching pagos:', err);
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
      valor_factura_proveedor: pago.valor_factura_proveedor,
      observaciones_pagos: pago.observaciones_pagos,
      pendiente_a: pago.pendiente_a,
      fecha_vto_fact: pago.fecha_vto_fact
    });
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

  const handleSaveEdit = async () => {
    if (!selectedPago) return;

    try {
      await apiPut(`/api/pagos/${selectedPago.id}`, {
        invoice_date: editData.fecha_factura,
        supplier_name: editData.proveedor,
        invoice_number: editData.no_factura,
        mq: editData.mq,
        currency: editData.moneda,
        trm: editData.tasa,
        valor_factura_proveedor: editData.valor_factura_proveedor,
        observaciones_pagos: editData.observaciones_pagos,
        pendiente_a: editData.pendiente_a,
        fecha_vto_fact: editData.fecha_vto_fact
      });

      setIsEditModalOpen(false);
      fetchPagos();
    } catch (err: any) {
      console.error('Error updating pago:', err);
      alert('Error al actualizar el pago');
    }
  };

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

    return matchesSearch && matchesPendiente;
  });

  // Configuración de columnas
  const columns = [
    {
      key: 'fecha_factura',
      label: 'FECHA FACTURA',
      sortable: true,
      render: (row: Pago) => (
        <span className="text-sm font-semibold text-blue-700">
          {row.fecha_factura ? new Date(row.fecha_factura).toLocaleDateString('es-CO') : '-'}
        </span>
      )
    },
    {
      key: 'proveedor',
      label: 'PROVEEDOR',
      sortable: true,
      render: (row: Pago) => (
        <span className="text-sm font-medium text-gray-800">{row.proveedor || '-'}</span>
      )
    },
    {
      key: 'no_factura',
      label: 'NO. FACTURA',
      sortable: true,
      render: (row: Pago) => (
        <span className="text-sm font-semibold text-indigo-600">{row.no_factura || '-'}</span>
      )
    },
    {
      key: 'mq',
      label: 'MQ',
      sortable: true,
      render: (row: Pago) => (
        <span className="text-sm font-bold text-brand-red">{row.mq || '-'}</span>
      )
    },
    {
      key: 'modelo',
      label: 'MODELO',
      sortable: true,
      render: (row: Pago) => <span className="text-sm text-gray-700">{row.modelo || '-'}</span>
    },
    {
      key: 'serie',
      label: 'SERIE',
      sortable: true,
      render: (row: Pago) => <span className="text-sm text-gray-600">{row.serie || '-'}</span>
    },
    {
      key: 'moneda',
      label: 'MONEDA',
      sortable: true,
      render: (row: Pago) => (
        <span className="text-sm font-medium text-purple-600">{row.moneda || '-'}</span>
      )
    },
    {
      key: 'tasa',
      label: 'TASA',
      sortable: true,
      render: (row: Pago) => (
        <span className="text-sm text-gray-700">
          {row.tasa ? row.tasa.toLocaleString('es-CO') : '-'}
        </span>
      )
    },
    {
      key: 'valor_factura_proveedor',
      label: 'VALOR FACTURA',
      sortable: true,
      render: (row: Pago) => (
        <span className="text-sm font-bold text-green-600">
          {row.valor_factura_proveedor
            ? `$${row.valor_factura_proveedor.toLocaleString('es-CO')}`
            : '-'}
        </span>
      )
    },
    {
      key: 'pendiente_a',
      label: 'PENDIENTE A',
      sortable: true,
      render: (row: Pago) => {
        if (!row.pendiente_a) return <span className="text-sm text-gray-400">-</span>;
        
        const colorMap: Record<string, string> = {
          'PROVEEDORES MAQUITECNO': 'bg-blue-100 text-blue-800',
          'PROVEEDORES PARTEQUIPOS MAQUINARIA': 'bg-green-100 text-green-800',
          'PROVEEDORES SOREMAQ': 'bg-purple-100 text-purple-800'
        };

        return (
          <span className={`px-2 py-1 rounded text-xs font-semibold ${colorMap[row.pendiente_a] || 'bg-gray-100 text-gray-800'}`}>
            {row.pendiente_a}
          </span>
        );
      }
    },
    {
      key: 'fecha_vto_fact',
      label: 'FECHA V/TO',
      sortable: true,
      render: (row: Pago) => {
        if (!row.fecha_vto_fact) return <span className="text-sm text-gray-400">-</span>;

        const vencimiento = new Date(row.fecha_vto_fact);
        const hoy = new Date();
        const diasRestantes = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 3600 * 24));

        let colorClass = 'text-gray-700';
        if (diasRestantes < 0) colorClass = 'text-red-600 font-bold';
        else if (diasRestantes <= 7) colorClass = 'text-orange-600 font-semibold';
        else if (diasRestantes <= 15) colorClass = 'text-yellow-600 font-medium';

        return (
          <div className="flex flex-col">
            <span className={`text-sm ${colorClass}`}>
              {vencimiento.toLocaleDateString('es-CO')}
            </span>
            {diasRestantes < 15 && (
              <span className="text-xs text-gray-500">
                {diasRestantes < 0 ? `Vencida (${Math.abs(diasRestantes)}d)` : `${diasRestantes} días`}
              </span>
            )}
          </div>
        );
      }
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

  // Color coding de filas
  const getRowClassName = (row: Pago) => {
    if (!row.valor_factura_proveedor || row.valor_factura_proveedor === 0) {
      return 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500';
    }
    if (!row.pendiente_a || !row.fecha_vto_fact) {
      return 'bg-yellow-50 hover:bg-yellow-100 border-l-4 border-yellow-400';
    }
    
    // Verificar fecha de vencimiento
    if (row.fecha_vto_fact) {
      const vencimiento = new Date(row.fecha_vto_fact);
      const hoy = new Date();
      const diasRestantes = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 3600 * 24));
      
      if (diasRestantes < 0) {
        return 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500';
      }
      if (diasRestantes <= 7) {
        return 'bg-orange-50 hover:bg-orange-100 border-l-4 border-orange-400';
      }
    }

    return 'bg-white hover:bg-green-50';
  };

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
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
            <DollarSign className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Pagos</h1>
            <p className="text-sm text-gray-600">Gestión de pagos a proveedores</p>
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
      </Card>

      {error && (
        <Card className="p-4 bg-red-50 border-l-4 border-red-500">
          <p className="text-red-700">{error}</p>
        </Card>
      )}

      {/* Tabla */}
      <Card>
        <DataTable
          columns={columns}
          data={filteredPagos}
          rowClassName={getRowClassName}
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
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Proveedor</p>
                <p className="text-sm font-medium">{selectedPago.proveedor || '-'}</p>
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
          title={`Editar Pago - ${selectedPago.mq || 'Sin MQ'}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Fecha Factura"
                type="date"
                value={editData.fecha_factura || ''}
                onChange={(e) => setEditData({ ...editData, fecha_factura: e.target.value })}
              />
              <Input
                label="Proveedor"
                value={editData.proveedor || ''}
                onChange={(e) => setEditData({ ...editData, proveedor: e.target.value })}
              />
              <Input
                label="No. Factura"
                value={editData.no_factura || ''}
                onChange={(e) => setEditData({ ...editData, no_factura: e.target.value })}
              />
              <Input
                label="MQ"
                value={editData.mq || ''}
                onChange={(e) => setEditData({ ...editData, mq: e.target.value })}
              />
              <Select
                label="Moneda"
                value={editData.moneda || ''}
                onChange={(e) => setEditData({ ...editData, moneda: e.target.value })}
                options={[
                  { value: '', label: 'Seleccionar' },
                  { value: 'USD', label: 'USD' },
                  { value: 'COP', label: 'COP' },
                  { value: 'EUR', label: 'EUR' }
                ]}
              />
              <Input
                label="Tasa"
                type="number"
                value={editData.tasa || ''}
                onChange={(e) => setEditData({ ...editData, tasa: parseFloat(e.target.value) })}
              />
              <Input
                label="Valor Factura Proveedor"
                type="number"
                value={editData.valor_factura_proveedor || ''}
                onChange={(e) => setEditData({ ...editData, valor_factura_proveedor: parseFloat(e.target.value) })}
              />
              <Select
                label="Pendiente A"
                value={editData.pendiente_a || ''}
                onChange={(e) => setEditData({ ...editData, pendiente_a: e.target.value })}
                options={[
                  { value: '', label: 'Seleccionar' },
                  ...pendienteOptions.map(opt => ({ value: opt, label: opt }))
                ]}
              />
              <Input
                label="Fecha Vencimiento"
                type="date"
                value={editData.fecha_vto_fact || ''}
                onChange={(e) => setEditData({ ...editData, fecha_vto_fact: e.target.value })}
                className="col-span-2"
              />
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  value={editData.observaciones_pagos || ''}
                  onChange={(e) => setEditData({ ...editData, observaciones_pagos: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-red focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
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
    </div>
  );
};

export default PagosPage;

