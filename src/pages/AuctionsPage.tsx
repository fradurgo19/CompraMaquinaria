/**
 * Página de Subastas - Diseño Premium Empresarial
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Folder, Search, Download, Calendar, TrendingUp, Eye, DollarSign, Package, ChevronDown, ChevronRight, Mail, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../atoms/Button';
import { Card } from '../molecules/Card';
import { Modal } from '../molecules/Modal';
import { Select } from '../atoms/Select';
import { AuctionWithRelations, AuctionStatus } from '../types/database';
import { AuctionForm } from '../organisms/AuctionForm';
import { useAuctions } from '../hooks/useAuctions';
import { FileManager } from '../components/FileManager';
import { showSuccess } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { ChangeHistory } from '../components/ChangeHistory';

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
  
  // Refs para scroll sincronizado
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const { auctions, isLoading, refetch } = useAuctions();
  const { user } = useAuth();

  const filteredAuctions = auctions
    .filter((auction) => {
    if (statusFilter && auction.status !== statusFilter) return false;
      
      // Comparar solo la parte de fecha (YYYY-MM-DD)
      if (dateFilter) {
        const rawDate = auction.auction_date || auction.date || '';
        const auctionDateOnly = rawDate.split('T')[0];
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
      // Ordenar por fecha: más recientes/cercanas primero
      const dateA = new Date(a.auction_date || a.date).getTime();
      const dateB = new Date(b.auction_date || b.date).getTime();
      
      // Orden descendente (más recientes primero)
      return dateB - dateA;
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

  // Agrupar subastas por fecha
  const groupedAuctions = useMemo(() => {
    const groups = new Map<string, AuctionWithRelations[]>();
    
    filteredAuctions.forEach((auction) => {
      const dateKey = (auction.auction_date || auction.date || '').split('T')[0]; // YYYY-MM-DD
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(auction);
    });
    
    // Convertir a array y ordenar por fecha (más reciente primero)
    return Array.from(groups.entries())
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(([date, auctions]) => ({
        date,
        auctions: auctions.sort((a, b) => {
          const lotA = a.lot_number || a.lot || '';
          const lotB = b.lot_number || b.lot || '';
          return lotA.localeCompare(lotB);
        }),
        totalAuctions: auctions.length,
        wonCount: auctions.filter(a => a.status === 'GANADA').length,
        lostCount: auctions.filter(a => a.status === 'PERDIDA').length,
        pendingCount: auctions.filter(a => a.status === 'PENDIENTE').length,
      }));
  }, [filteredAuctions]);

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

  // Manejar filtro de fecha: expandir solo ese grupo cuando se selecciona
  useEffect(() => {
    if (dateFilter) {
      setExpandedDates(new Set([dateFilter]));
    } else {
      // Si se limpia el filtro, contraer todos
      setExpandedDates(new Set());
    }
  }, [dateFilter]);

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
    if (!modelo) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-brand-red to-primary-600 text-white shadow-md';
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
      return 'bg-green-50 hover:bg-green-100';
    } else if (upperStatus === 'PERDIDA') {
      return 'bg-red-50 hover:bg-red-100';
    }
    // PENDIENTE
    return 'bg-yellow-50 hover:bg-yellow-100';
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
      const response = await fetch('http://localhost:3000/api/notifications/auctions/send-reminder', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(`✅ Recordatorio enviado: ${data.data.auctionCount} subasta(s) para ${data.data.auctionDate}`);
      } else {
        alert(data.message || 'No hay subastas programadas para dentro de 2 días');
      }
    } catch (error) {
      console.error('Error al enviar recordatorio:', error);
      alert('Error al enviar recordatorio. Revise la consola.');
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 py-8">
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
                      // Contraer todos los grupos al limpiar
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
                className="overflow-x-auto bg-gradient-to-r from-red-100 to-gray-100 rounded-lg shadow-inner"
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
                  <table className="min-w-full">
                    <thead className="bg-gradient-to-r from-brand-red to-primary-600 text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase w-12"></th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Proveedor</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Lote</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Marca</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Modelo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Serial</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Año</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Horas</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Max</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Comprado</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Estado</th>
                        <th className="px-2 py-3 text-left text-xs font-semibold uppercase" style={{ maxWidth: '80px' }}>Tipo Máq</th>
                        <th className="px-2 py-3 text-left text-xs font-semibold uppercase" style={{ maxWidth: '50px' }}>L.H</th>
                        <th className="px-2 py-3 text-left text-xs font-semibold uppercase" style={{ maxWidth: '60px' }}>Brazo</th>
                        <th className="px-2 py-3 text-left text-xs font-semibold uppercase" style={{ maxWidth: '50px' }}>Zap</th>
                        <th className="px-2 py-3 text-left text-xs font-semibold uppercase" style={{ maxWidth: '50px' }}>Cap</th>
                        <th className="px-2 py-3 text-left text-xs font-semibold uppercase" style={{ maxWidth: '50px' }}>Bld</th>
                        <th className="px-2 py-3 text-left text-xs font-semibold uppercase" style={{ maxWidth: '50px' }}>G.M</th>
                        <th className="px-2 py-3 text-left text-xs font-semibold uppercase" style={{ maxWidth: '50px' }}>G.H</th>
                        <th className="px-2 py-3 text-left text-xs font-semibold uppercase" style={{ maxWidth: '70px' }}>Motor</th>
                        <th className="px-2 py-3 text-left text-xs font-semibold uppercase" style={{ maxWidth: '70px' }}>Cabina</th>
                        <th className="sticky right-[110px] bg-brand-red z-10 px-4 py-3 text-left text-xs font-semibold uppercase shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]" style={{ minWidth: '110px', width: '110px' }}>Archivos</th>
                        <th className="sticky right-0 bg-brand-red z-10 px-4 py-3 text-left text-xs font-semibold uppercase shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]" style={{ minWidth: '150px', width: '150px' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedAuctions.map((group, groupIndex) => {
                        const isExpanded = expandedDates.has(group.date);
                        // Parsear fecha en zona horaria local (evitar problema de UTC)
                        const [year, month, day] = group.date.split('-').map(Number);
                        const date = new Date(year, month - 1, day);
                        
                        return (
                          <React.Fragment key={group.date}>
                            {/* Fila de Grupo */}
                            <motion.tr
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: groupIndex * 0.05 }}
                              className="bg-gradient-to-r from-red-50 to-gray-50 border-y-2 border-red-200 hover:from-red-100 hover:to-gray-100 transition-colors cursor-pointer"
                              onClick={() => toggleDateExpansion(group.date)}
                            >
                              <td colSpan={22} className="px-4 py-4">
                                <div className="flex items-center gap-4 flex-wrap">
                                  {/* Botón expandir + Fecha */}
                                  <div className="flex items-center gap-3">
                                    <button className="focus:outline-none">
                                      {isExpanded ? (
                                        <ChevronDown className="w-6 h-6 text-brand-red" />
                                      ) : (
                                        <ChevronRight className="w-6 h-6 text-brand-red" />
                                      )}
                                    </button>
                                    <Calendar className="w-5 h-5 text-brand-red" />
                                    <div>
                                      <p className="text-lg font-bold text-brand-red">
                                        {date.toLocaleDateString('es-CO', { 
                                          weekday: 'long',
                                          day: 'numeric', 
                                          month: 'long', 
                                          year: 'numeric' 
                                        })}
                                      </p>
                                      <p className="text-sm text-brand-gray">
                                        {group.totalAuctions} {group.totalAuctions === 1 ? 'subasta' : 'subastas'}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* Separador vertical */}
                                  <div className="h-12 w-px bg-gray-300"></div>
                                  
                                  {/* Mini KPIs - Al lado de la fecha */}
                                  <div className="flex gap-2">
                                    <div className="text-center px-2 py-1 bg-green-100 rounded-lg shadow-sm min-w-[70px]">
                                      <p className="text-lg font-bold text-green-700">{group.wonCount}</p>
                                      <p className="text-xs text-green-600 font-medium">Ganadas</p>
                                    </div>
                                    <div className="text-center px-2 py-1 bg-red-100 rounded-lg shadow-sm min-w-[70px]">
                                      <p className="text-lg font-bold text-red-700">{group.lostCount}</p>
                                      <p className="text-xs text-red-600 font-medium">Perdidas</p>
                                    </div>
                                    <div className="text-center px-2 py-1 bg-yellow-100 rounded-lg shadow-sm min-w-[80px]">
                                      <p className="text-lg font-bold text-yellow-700">{group.pendingCount}</p>
                                      <p className="text-xs text-yellow-600 font-medium">Pendientes</p>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              
                              {/* Columnas sticky vacías para mantener alineación */}
                              <td className="sticky right-[110px] bg-gradient-to-r from-red-50 to-gray-50 border-y-2 border-red-200 z-10" style={{ minWidth: '110px', width: '110px' }}></td>
                              <td className="sticky right-0 bg-gradient-to-r from-red-50 to-gray-50 border-y-2 border-red-200 z-10" style={{ minWidth: '150px', width: '150px' }}></td>
                            </motion.tr>

                            {/* Filas de Detalle */}
                            {isExpanded && group.auctions.map((auction, auctionIndex) => (
                              <motion.tr
                                key={auction.id}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: auctionIndex * 0.03 }}
                                className={`group transition-colors border-b border-gray-200 cursor-pointer ${getRowBackgroundByStatus(auction.status)}`}
                                onClick={() => handleOpenModal(auction)}
                              >
                                <td className="px-4 py-3"></td>
                                {/* Proveedor - Primera columna */}
                                <td className="px-4 py-3 text-sm">
                                  {auction.supplier?.name ? (
                                    <span className={getProveedorStyle(auction.supplier.name)}>
                                      {auction.supplier.name}
                                    </span>
                                  ) : <span className="text-gray-400">-</span>}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <span className={getTipoCompraStyle(auction.purchase_type)}>
                                    {auction.purchase_type === 'COMPRA_DIRECTA' ? 'COMPRA DIRECTA' : auction.purchase_type}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm font-mono font-semibold">{auction.lot_number || auction.lot}</td>
                                <td className="px-4 py-3 text-sm">
                                  {auction.machine?.brand ? (
                                    <span className={getMarcaStyle(auction.machine.brand)}>{auction.machine.brand}</span>
                                  ) : <span className="text-gray-400">-</span>}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {auction.machine?.model ? (
                                    <span className={getMaquinaStyle(auction.machine.model)}>{auction.machine.model}</span>
                                  ) : <span className="text-gray-400">-</span>}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {auction.machine?.serial ? (
                                    <span className={getSerialStyle(auction.machine.serial)}>{auction.machine.serial}</span>
                                  ) : <span className="text-gray-400 font-mono">-</span>}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {auction.machine?.year ? (
                                    <span className={getYearStyle(auction.machine.year)}>{auction.machine.year}</span>
                                  ) : <span className="text-gray-400">-</span>}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {auction.machine?.hours ? (
                                    <span className={getHoursStyle(auction.machine.hours)}>
                                      {auction.machine.hours.toLocaleString('es-CO')}
                                    </span>
                                  ) : <span className="text-gray-400">-</span>}
                                </td>
                                
                                {/* Precio Max, Comprado, Estado */}
                                <td className="px-4 py-3 text-sm font-semibold">
                                  ${(auction.max_price || auction.price_max || 0).toLocaleString('es-CO')}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {(auction.purchased_price || auction.price_bought) ? (
                                    <span className={getCompradoStyle(auction.purchased_price || auction.price_bought)}>
                                      ${(auction.purchased_price || auction.price_bought || 0).toLocaleString('es-CO')}
                                    </span>
                                  ) : <span className="text-gray-400">-</span>}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <span className={getEstadoStyle(auction.status)}>
                                    {auction.status}
                                  </span>
                                </td>
                                
                                {/* Especificaciones Técnicas - Compactas */}
                                <td className="px-2 py-3 text-xs text-gray-700 truncate" style={{ maxWidth: '80px' }} title={auction.machine?.machine_type || '-'}>{auction.machine?.machine_type || '-'}</td>
                                <td className="px-2 py-3 text-xs text-center" style={{ maxWidth: '50px' }}>
                                  {auction.machine?.wet_line ? (
                                    <span className={`px-1 py-0.5 rounded font-semibold text-xs ${
                                      auction.machine.wet_line === 'SI' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                      {auction.machine.wet_line}
                                    </span>
                                  ) : <span className="text-gray-400">-</span>}
                                </td>
                                <td className="px-2 py-3 text-xs text-gray-700 text-center" style={{ maxWidth: '60px' }}>{auction.machine?.arm_type || '-'}</td>
                                <td className="px-2 py-3 text-xs text-gray-700 text-center" style={{ maxWidth: '50px' }}>{auction.machine?.track_width || '-'}</td>
                                <td className="px-2 py-3 text-xs text-gray-700 text-center" style={{ maxWidth: '50px' }}>{auction.machine?.bucket_capacity || '-'}</td>
                                <td className="px-2 py-3 text-xs text-center" style={{ maxWidth: '50px' }}>
                                  {auction.machine?.blade ? (
                                    <span className={`px-1 py-0.5 rounded font-semibold text-xs ${
                                      auction.machine.blade === 'SI' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                      {auction.machine.blade}
                                    </span>
                                  ) : <span className="text-gray-400">-</span>}
                                </td>
                                <td className="px-2 py-3 text-xs text-gray-700 text-center" style={{ maxWidth: '50px' }}>{auction.machine?.warranty_months || '-'}</td>
                                <td className="px-2 py-3 text-xs text-gray-700 text-center" style={{ maxWidth: '50px' }}>{auction.machine?.warranty_hours || '-'}</td>
                                <td className="px-2 py-3 text-xs text-gray-700 truncate text-center" style={{ maxWidth: '70px' }} title={auction.machine?.engine_brand || '-'}>{auction.machine?.engine_brand || '-'}</td>
                                <td className="px-2 py-3 text-xs text-gray-700 truncate text-center" style={{ maxWidth: '70px' }} title={auction.machine?.cabin_type || '-'}>{auction.machine?.cabin_type || '-'}</td>
                                <td className={`sticky right-[110px] z-10 px-4 py-3 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)] transition-colors ${
                                  auction.status.toUpperCase() === 'GANADA' ? 'bg-green-50 group-hover:bg-green-100' :
                                  auction.status.toUpperCase() === 'PERDIDA' ? 'bg-red-50 group-hover:bg-red-100' :
                                  'bg-yellow-50 group-hover:bg-yellow-100'
                                }`} style={{ minWidth: '110px', width: '110px' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenFiles(auction);
                                    }}
                                    className="px-2 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded hover:from-blue-600 hover:to-blue-700 transition-all transform hover:scale-105 flex items-center gap-1 text-[10px] font-medium shadow-md"
                                  >
                                    <Folder className="w-3 h-3" />
                                    Archivos
                                  </button>
                                </td>
                                <td className={`sticky right-0 z-10 px-2 py-3 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)] transition-colors ${
                                  auction.status.toUpperCase() === 'GANADA' ? 'bg-green-50 group-hover:bg-green-100' :
                                  auction.status.toUpperCase() === 'PERDIDA' ? 'bg-red-50 group-hover:bg-red-100' :
                                  'bg-yellow-50 group-hover:bg-yellow-100'
                                }`} style={{ minWidth: '150px', width: '150px' }}>
                                  <div className="flex items-center gap-1 justify-center">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleViewDetail(auction);
                                      }}
                                      className="px-2 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105 flex items-center gap-1 text-[10px] font-medium shadow-md"
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
                                      className="px-2 py-1 bg-white border-2 border-orange-500 text-orange-600 rounded hover:bg-orange-50 transition-all flex items-center gap-1 text-[10px] font-medium shadow-sm"
                                      title="Ver historial"
                                    >
                                      <Clock className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                              </motion.tr>
                            ))}
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
          title="Detalle Completo de la Subasta"
          size="xl"
        >
          {selectedAuction && (
            <div className="space-y-6">
              {/* Sección: Estado y Tipo */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200">
                <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Información General
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Estado</p>
                    <span className={getEstadoStyle(selectedAuction.status)}>
                      {selectedAuction.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Tipo de Compra</p>
                    <span className={getTipoCompraStyle(selectedAuction.purchase_type)}>
                      {selectedAuction.purchase_type === 'COMPRA_DIRECTA' ? 'COMPRA DIRECTA' : selectedAuction.purchase_type}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Fecha de Subasta</p>
                    <p className="text-gray-900 font-semibold">
                      {new Date(selectedAuction.auction_date || selectedAuction.date).toLocaleDateString('es-CO', { 
                        day: '2-digit', 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Número de Lote</p>
                    <p className="text-gray-900 font-mono font-semibold">{selectedAuction.lot_number || selectedAuction.lot}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Proveedor</p>
                    {selectedAuction.supplier?.name ? (
                      <span className={getProveedorStyle(selectedAuction.supplier.name)}>
                        {selectedAuction.supplier.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Sección: Información de la Máquina */}
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
                <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Información de la Máquina
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Marca</p>
                    {selectedAuction.machine?.brand ? (
                      <span className={getMarcaStyle(selectedAuction.machine.brand)}>
                        {selectedAuction.machine.brand}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Modelo</p>
                    {selectedAuction.machine?.model ? (
                      <span className={getMaquinaStyle(selectedAuction.machine.model)}>
                        {selectedAuction.machine.model}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Serial</p>
                    {selectedAuction.machine?.serial ? (
                      <span className={getSerialStyle(selectedAuction.machine.serial)}>
                        {selectedAuction.machine.serial}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Año</p>
                    {selectedAuction.machine?.year ? (
                      <span className={getYearStyle(selectedAuction.machine.year)}>
                        {selectedAuction.machine.year}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Horas de Operación</p>
                    {selectedAuction.machine?.hours ? (
                      <span className={getHoursStyle(selectedAuction.machine.hours)}>
                        {selectedAuction.machine.hours.toLocaleString('es-CO')} hrs
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>

                  {/* Especificaciones Técnicas */}
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Tipo Máq</p>
                    {selectedAuction.machine?.machine_type ? (
                      <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-800 text-xs font-medium">
                        {selectedAuction.machine.machine_type}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">L.H</p>
                    {selectedAuction.machine?.wet_line ? (
                      <span className="px-2 py-1 rounded-lg bg-cyan-100 text-cyan-800 text-xs font-medium">
                        {selectedAuction.machine.wet_line}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Brazo</p>
                    {selectedAuction.machine?.arm_type ? (
                      <span className="px-2 py-1 rounded-lg bg-purple-100 text-purple-800 text-xs font-medium">
                        {selectedAuction.machine.arm_type}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Zap</p>
                    {selectedAuction.machine?.track_width ? (
                      <span className="px-2 py-1 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-medium">
                        {selectedAuction.machine.track_width}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Cap</p>
                    {selectedAuction.machine?.bucket_capacity ? (
                      <span className="px-2 py-1 rounded-lg bg-green-100 text-green-800 text-xs font-medium">
                        {selectedAuction.machine.bucket_capacity}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Bld</p>
                    {selectedAuction.machine?.blade ? (
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        selectedAuction.machine.blade === 'SI'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedAuction.machine.blade}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">G.M</p>
                    {selectedAuction.machine?.warranty_months ? (
                      <span className="px-2 py-1 rounded-lg bg-orange-100 text-orange-800 text-xs font-medium">
                        {selectedAuction.machine.warranty_months}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">G.H</p>
                    {selectedAuction.machine?.warranty_hours ? (
                      <span className="px-2 py-1 rounded-lg bg-yellow-100 text-yellow-800 text-xs font-medium">
                        {selectedAuction.machine.warranty_hours}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Motor</p>
                    {selectedAuction.machine?.engine_brand ? (
                      <span className="px-2 py-1 rounded-lg bg-red-100 text-red-800 text-xs font-medium">
                        {selectedAuction.machine.engine_brand}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Cabina</p>
                    {selectedAuction.machine?.cabin_type ? (
                      <span className="px-2 py-1 rounded-lg bg-pink-100 text-pink-800 text-xs font-medium">
                        {selectedAuction.machine.cabin_type}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Sección: Información Financiera */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                <h3 className="text-lg font-bold text-green-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Información Financiera
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Precio Máximo</p>
                    <p className="text-2xl font-bold text-blue-600">
                      ${(selectedAuction.max_price || selectedAuction.price_max || 0).toLocaleString('es-CO')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Precio de Compra</p>
                    {(selectedAuction.purchased_price || selectedAuction.price_bought) ? (
                      <p className="text-2xl font-bold text-green-600">
                        ${(selectedAuction.purchased_price || selectedAuction.price_bought || 0).toLocaleString('es-CO')}
                      </p>
                    ) : (
                      <span className="text-gray-400">No comprado</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Sección: Comentarios */}
              {selectedAuction.comments && (
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Comentarios</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedAuction.comments}</p>
                </div>
              )}

              {/* Botones de Acción */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenFiles(selectedAuction);
                  }}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all flex items-center justify-center gap-2 font-semibold shadow-lg"
                >
                  <Folder className="w-5 h-5" />
                  Ver Archivos
                </button>
                <button
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenModal(selectedAuction);
                  }}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all flex items-center justify-center gap-2 font-semibold shadow-lg"
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
      </div>
    </div>
  );
};
