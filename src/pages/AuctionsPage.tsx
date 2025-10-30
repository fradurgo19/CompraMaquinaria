/**
 * Página de Subastas - Diseño Premium Empresarial
 */

import { useState } from 'react';
import { Plus, Filter, Folder, Search, Download, Calendar, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../atoms/Button';
import { Card } from '../molecules/Card';
import { Modal } from '../molecules/Modal';
import { FilterBar } from '../molecules/FilterBar';
import { Select } from '../atoms/Select';
import { DataTable, Column } from '../organisms/DataTable';
import { AuctionWithRelations, AuctionStatus } from '../types/database';
import { AuctionForm } from '../organisms/AuctionForm';
import { useAuctions } from '../hooks/useAuctions';
import { FileManager } from '../components/FileManager';
import { showSuccess } from '../components/Toast';

export const AuctionsPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOneDriveModalOpen, setIsOneDriveModalOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<AuctionWithRelations | null>(null);
  const [statusFilter, setStatusFilter] = useState<AuctionStatus | ''>('');
  const [dateFilter, setDateFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { auctions, isLoading, refetch } = useAuctions();

  const filteredAuctions = auctions
    .filter((auction) => {
    if (statusFilter && auction.status !== statusFilter) return false;
      
      // Comparar solo la parte de fecha (YYYY-MM-DD)
      if (dateFilter) {
        const auctionDateOnly = auction.auction_date?.split('T')[0];
        if (auctionDateOnly !== dateFilter) return false;
      }
      
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          auction.machine?.model?.toLowerCase().includes(search) ||
          auction.machine?.serial?.toLowerCase().includes(search) ||
          auction.lot_number?.toLowerCase().includes(search)
        );
      }
    return true;
    })
    .sort((a, b) => {
      // Ordenar por fecha: más recientes/cercanas primero
      const dateA = new Date(a.auction_date).getTime();
      const dateB = new Date(b.auction_date).getTime();
      
      // Orden descendente (más recientes primero)
      return dateB - dateA;
    });

  // Calcular estadísticas
  const totalWon = filteredAuctions.filter(a => a.status === 'GANADA').length;
  const totalLost = filteredAuctions.filter(a => a.status === 'PERDIDA').length;
  const totalPending = filteredAuctions.filter(a => a.status === 'PENDIENTE').length;
  const totalInvestment = filteredAuctions
    .filter(a => a.purchased_price)
    .reduce((sum, a) => sum + (a.purchased_price || 0), 0);

  const handleOpenFiles = (auction: AuctionWithRelations) => {
    if (!auction.machine?.model || !auction.machine?.serial) {
      alert('Esta subasta no tiene máquina asociada');
      return;
    }
    setSelectedAuction(auction);
    setIsOneDriveModalOpen(true);
  };

  // Funciones helper para estilos elegantes
  const getMaquinaStyle = (modelo: string | null | undefined) => {
    if (!modelo) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md';
  };

  const getYearStyle = (year: number | string | null | undefined) => {
    if (!year || year === '-' || year === '' || year === 0) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md';
  };

  const getHoursStyle = (hours: number | string | null | undefined) => {
    if (!hours || hours === '-' || hours === '' || hours === 0) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-amber-400 to-yellow-500 text-gray-900 shadow-md';
  };

  const getCompradoStyle = (precio: number | null | undefined) => {
    if (!precio || precio === 0) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md';
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

  const columns: Column<AuctionWithRelations>[] = [
    {
      key: 'auction_date',
      label: 'Fecha',
      sortable: true,
      render: (row) => {
        const date = new Date(row.auction_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const auctionDate = new Date(row.auction_date);
        auctionDate.setHours(0, 0, 0, 0);
        
        const isPast = auctionDate < today;
        const isToday = auctionDate.getTime() === today.getTime();
        const isFuture = auctionDate > today;
        
        return (
          <div>
            <p className={`text-xs font-semibold ${
              isPast ? 'text-gray-500' : 
              isToday ? 'text-blue-600' : 
              'text-green-600'
            }`}>
              {date.toLocaleDateString('es-CO', { 
                day: '2-digit', 
                month: 'short'
              })}
            </p>
            {isToday && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded">Hoy</span>}
            {isFuture && <span className="text-[10px] text-green-600">Próx</span>}
            {isPast && <span className="text-[10px] text-gray-400">Ant</span>}
          </div>
        );
      },
    },
    {
      key: 'lot_number',
      label: 'Lote',
      sortable: true,
      render: (row) => (
        <span className="font-mono font-semibold text-gray-900">{row.lot_number}</span>
      ),
    },
    {
      key: 'machine',
      label: 'Máquina',
      sortable: true,
      render: (row) => (
        row.machine?.model ? (
          <div>
            <span className={getMaquinaStyle(row.machine.model)}>
              {row.machine.model}
            </span>
            {row.machine?.serial && (
              <p className="text-[10px] text-gray-500 truncate mt-1">{row.machine.serial}</p>
            )}
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        )
      ),
    },
    {
      key: 'year',
      label: 'Año',
      sortable: true,
      render: (row) => (
        row.machine?.year ? (
          <span className={getYearStyle(row.machine.year)}>
            {row.machine.year}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      ),
    },
    {
      key: 'hours',
      label: 'Horas',
      sortable: true,
      render: (row) => (
        row.machine?.hours ? (
          <span className={getHoursStyle(row.machine.hours)}>
            {row.machine.hours.toLocaleString('es-CO')}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      ),
    },
    {
      key: 'max_price',
      label: 'Max',
      sortable: true,
      render: (row) => (
        <span className="text-xs font-semibold text-gray-900">
          ${row.max_price.toLocaleString('es-CO')}
        </span>
      ),
    },
    {
      key: 'purchased_price',
      label: 'Comprado',
      sortable: true,
      render: (row) =>
        row.purchased_price ? (
          <span className={getCompradoStyle(row.purchased_price)}>
            ${row.purchased_price.toLocaleString('es-CO')}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'status',
      label: 'Estado',
      sortable: true,
      render: (row) => {
        const statusLabels: any = {
          GANADA: 'Ganada',
          PERDIDA: 'Perdida',
          PENDIENTE: 'Pendiente',
        };
        const label = statusLabels[row.status] || row.status;
        
        return (
          <span className={getEstadoStyle(row.status)}>
            {label}
          </span>
        );
      },
    },
    {
      key: 'supplier',
      label: 'Proveedor',
      sortable: true,
      render: (row) => (
        row.supplier?.name ? (
          <span className={getProveedorStyle(row.supplier.name)}>
            {row.supplier.name}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      ),
    },
    {
      key: 'actions',
      label: 'Archivos',
      sortable: false,
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleOpenFiles(row);
          }}
          className="px-2 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded hover:from-blue-600 hover:to-blue-700 transition-all transform hover:scale-105 flex items-center gap-1 text-[10px] font-medium shadow-md"
          title="Ver fotos y documentos"
        >
          <Folder className="w-3 h-3" />
          Ver
        </button>
      ),
    },
  ];

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 py-8">
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
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Panel de Subastas</h1>
                <p className="text-gray-600">Gestión integral de subastas de maquinaria usada</p>
              </div>
              <Button 
                onClick={() => handleOpenModal()} 
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Nueva Subasta
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
          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{filteredAuctions.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ganadas</p>
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
                <p className="text-sm font-medium text-gray-600">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{totalPending}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inversión</p>
                <p className="text-2xl font-bold text-purple-600">
                  ${(totalInvestment / 1000).toFixed(0)}K
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-600" />
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
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                    />
                  </div>
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
                    className="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
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
          data={filteredAuctions}
          columns={columns}
          onRowClick={handleOpenModal}
          isLoading={isLoading}
        />
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
      </div>
    </div>
  );
};
