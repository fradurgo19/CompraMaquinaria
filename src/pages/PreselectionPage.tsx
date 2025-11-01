/**
 * Página de Preselección - Módulo previo a Subastas
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Download, Calendar, TrendingUp, ChevronDown, ChevronRight, CheckCircle, XCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../atoms/Button';
import { Card } from '../molecules/Card';
import { Modal } from '../molecules/Modal';
import { Select } from '../atoms/Select';
import { PreselectionWithRelations, PreselectionDecision } from '../types/database';
import { PreselectionForm } from '../organisms/PreselectionForm';
import { usePreselections } from '../hooks/usePreselections';
import { showSuccess, showError } from '../components/Toast';

export const PreselectionPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPreselection, setSelectedPreselection] = useState<PreselectionWithRelations | null>(null);
  const [decisionFilter, setDecisionFilter] = useState<PreselectionDecision | ''>('');
  const [dateFilter, setDateFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const { preselections, isLoading, refetch, updateDecision } = usePreselections();

  const filteredPreselections = preselections
    .filter((presel) => {
      if (decisionFilter && presel.decision !== decisionFilter) return false;
      
      if (dateFilter) {
        const preselDateOnly = (presel.auction_date || '').split('T')[0];
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
      const dateA = new Date(a.auction_date).getTime();
      const dateB = new Date(b.auction_date).getTime();
      return dateB - dateA;
    });

  // Agrupar por fecha
  const groupedPreselections = useMemo(() => {
    const groups = new Map<string, PreselectionWithRelations[]>();
    
    filteredPreselections.forEach((presel) => {
      const dateKey = (presel.auction_date || '').split('T')[0];
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(presel);
    });
    
    return Array.from(groups.entries())
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(([date, presels]) => ({
        date,
        preselections: presels.sort((a, b) => (a.lot_number || '').localeCompare(b.lot_number || '')),
        totalPreselections: presels.length,
        pendingCount: presels.filter(p => p.decision === 'PENDIENTE').length,
        approvedCount: presels.filter(p => p.decision === 'SI').length,
        rejectedCount: presels.filter(p => p.decision === 'NO').length,
      }));
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

  const handleDecision = async (preselId: string, decision: 'SI' | 'NO') => {
    try {
      const response = await updateDecision(preselId, decision);
      showSuccess(response.message || `Preselección ${decision === 'SI' ? 'aprobada' : 'rechazada'} exitosamente`);
      refetch();
    } catch (error: any) {
      showError(error.message || 'Error al procesar decisión');
    }
  };

  // Funciones de estilo
  const getMarcaStyle = (marca: string | null) => {
    if (!marca) return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gray-100 text-gray-400 border border-gray-200';
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md';
  };

  const getModeloStyle = (modelo: string) => {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md';
  };

  const getSerialStyle = (serial: string) => {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-slate-600 to-gray-700 text-white shadow-md font-mono';
  };

  const getProveedorStyle = (proveedor: string) => {
    return 'px-2 py-1 rounded-lg font-semibold text-sm bg-gradient-to-r from-lime-500 to-green-500 text-white shadow-md';
  };

  const getDecisionStyle = (decision: string) => {
    if (decision === 'SI') {
      return 'px-3 py-1.5 rounded-lg font-semibold text-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md';
    } else if (decision === 'NO') {
      return 'px-3 py-1.5 rounded-lg font-semibold text-sm bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md';
    }
    return 'px-3 py-1.5 rounded-lg font-semibold text-sm bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-md';
  };

  // Estadísticas
  const totalPending = filteredPreselections.filter(p => p.decision === 'PENDIENTE').length;
  const totalApproved = filteredPreselections.filter(p => p.decision === 'SI').length;
  const totalRejected = filteredPreselections.filter(p => p.decision === 'NO').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Panel de Preselección</h1>
                <p className="text-gray-600">Evaluación y selección de equipos para subastas</p>
              </div>
              <Button 
                onClick={() => setIsModalOpen(true)} 
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Nueva Preselección
              </Button>
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
          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{filteredPreselections.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{totalPending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Aprobadas</p>
                <p className="text-2xl font-bold text-green-600">{totalApproved}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rechazadas</p>
                <p className="text-2xl font-bold text-red-600">{totalRejected}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
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
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por modelo, serial, lote o proveedor..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
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
                    className="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
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
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between">
                  <p className="text-sm text-indigo-800 font-medium">
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
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline"
                  >
                    Limpiar filtros
                  </button>
                </div>
              )}
            </div>

            {/* Tabla Agrupada */}
            <div className="bg-white rounded-xl shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                {isLoading ? (
                  <div className="p-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
                    <p className="text-gray-600 mt-4">Cargando preselecciones...</p>
                  </div>
                ) : groupedPreselections.length === 0 ? (
                  <div className="p-12 text-center">
                    <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-lg">No hay preselecciones para mostrar</p>
                  </div>
                ) : (
                  <table className="min-w-full">
                    <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase w-12"></th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Proveedor</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Lote</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Marca</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Modelo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Serial</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Año</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Horas</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">Precio Sug.</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase">URL</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase">Decisión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedPreselections.map((group, groupIndex) => {
                        const isExpanded = expandedDates.has(group.date);
                        const [year, month, day] = group.date.split('-').map(Number);
                        const date = new Date(year, month - 1, day);
                        
                        return (
                          <React.Fragment key={group.date}>
                            {/* Fila de Grupo */}
                            <motion.tr
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: groupIndex * 0.05 }}
                              className="bg-gradient-to-r from-indigo-50 to-purple-50 border-y-2 border-indigo-200 hover:from-indigo-100 hover:to-purple-100 transition-colors cursor-pointer"
                              onClick={() => toggleDateExpansion(group.date)}
                            >
                              <td colSpan={11} className="px-4 py-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <button className="focus:outline-none">
                                      {isExpanded ? (
                                        <ChevronDown className="w-6 h-6 text-indigo-600" />
                                      ) : (
                                        <ChevronRight className="w-6 h-6 text-indigo-600" />
                                      )}
                                    </button>
                                    <Calendar className="w-5 h-5 text-indigo-600" />
                                    <div>
                                      <p className="text-lg font-bold text-indigo-900">
                                        {date.toLocaleDateString('es-CO', { 
                                          weekday: 'long',
                                          day: 'numeric', 
                                          month: 'long', 
                                          year: 'numeric' 
                                        })}
                                      </p>
                                      <p className="text-sm text-indigo-600">
                                        {group.totalPreselections} preselección{group.totalPreselections !== 1 ? 'es' : ''}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-4">
                                    <div className="text-center px-4 py-2 bg-yellow-100 rounded-lg">
                                      <p className="text-2xl font-bold text-yellow-700">{group.pendingCount}</p>
                                      <p className="text-xs text-yellow-600 font-medium">Pendientes</p>
                                    </div>
                                    <div className="text-center px-4 py-2 bg-green-100 rounded-lg">
                                      <p className="text-2xl font-bold text-green-700">{group.approvedCount}</p>
                                      <p className="text-xs text-green-600 font-medium">Aprobadas</p>
                                    </div>
                                    <div className="text-center px-4 py-2 bg-red-100 rounded-lg">
                                      <p className="text-2xl font-bold text-red-700">{group.rejectedCount}</p>
                                      <p className="text-xs text-red-600 font-medium">Rechazadas</p>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </motion.tr>

                            {/* Filas de Detalle */}
                            {isExpanded && group.preselections.map((presel, idx) => (
                              <motion.tr
                                key={presel.id}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                className="hover:bg-indigo-50 transition-colors border-b border-gray-200 cursor-pointer"
                                onClick={() => {
                                  setSelectedPreselection(presel);
                                  setIsModalOpen(true);
                                }}
                              >
                                <td className="px-4 py-3"></td>
                                <td className="px-4 py-3 text-sm">
                                  <span className={getProveedorStyle(presel.supplier_name)}>
                                    {presel.supplier_name}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm font-mono font-semibold">{presel.lot_number}</td>
                                <td className="px-4 py-3 text-sm">
                                  {presel.brand ? (
                                    <span className={getMarcaStyle(presel.brand)}>{presel.brand}</span>
                                  ) : <span className="text-gray-400">-</span>}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <span className={getModeloStyle(presel.model)}>{presel.model}</span>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <span className={getSerialStyle(presel.serial)}>{presel.serial}</span>
                                </td>
                                <td className="px-4 py-3 text-sm">{presel.year || '-'}</td>
                                <td className="px-4 py-3 text-sm">
                                  {presel.hours ? presel.hours.toLocaleString('es-CO') : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm font-semibold text-green-600">
                                  {presel.suggested_price ? `$${presel.suggested_price.toLocaleString('es-CO')}` : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {presel.auction_url ? (
                                    <a
                                      href={presel.auction_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 underline text-xs"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      Ver
                                    </a>
                                  ) : <span className="text-gray-400">-</span>}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex gap-2 justify-center items-center">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (presel.decision === 'NO') {
                                          if (window.confirm('¿Cambiar a SI y crear subasta?')) {
                                            handleDecision(presel.id, 'SI');
                                          }
                                        } else if (presel.decision === 'PENDIENTE') {
                                          if (window.confirm('¿Aprobar y pasar a SUBASTA?')) {
                                            handleDecision(presel.id, 'SI');
                                          }
                                        }
                                        // Si ya está en SI, no hacer nada (botón muestra estado)
                                      }}
                                      disabled={presel.decision === 'SI'}
                                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 text-xs font-semibold shadow-md ${
                                        presel.decision === 'SI' 
                                          ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white ring-2 ring-green-400 cursor-default' 
                                          : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 cursor-pointer'
                                      }`}
                                      title={presel.decision === 'SI' ? 'Aprobada ✓' : 'Aprobar y crear subasta'}
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                      SI {presel.decision === 'SI' && '✓'}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (presel.decision === 'SI') {
                                          if (window.confirm('⚠️ ¿Revertir a NO? Esto ELIMINARÁ la subasta creada.')) {
                                            handleDecision(presel.id, 'NO');
                                          }
                                        } else if (presel.decision === 'PENDIENTE') {
                                          if (window.confirm('¿Rechazar preselección?')) {
                                            handleDecision(presel.id, 'NO');
                                          }
                                        }
                                        // Si ya está en NO, no hacer nada (botón muestra estado)
                                      }}
                                      disabled={presel.decision === 'NO'}
                                      className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 text-xs font-semibold shadow-md ${
                                        presel.decision === 'NO' 
                                          ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white ring-2 ring-red-400 cursor-default' 
                                          : 'bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600 cursor-pointer'
                                      }`}
                                      title={presel.decision === 'NO' ? 'Rechazada ✓' : 'Rechazar preselección'}
                                    >
                                      <XCircle className="w-4 h-4" />
                                      NO {presel.decision === 'NO' && '✓'}
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
      </div>
    </div>
  );
};

