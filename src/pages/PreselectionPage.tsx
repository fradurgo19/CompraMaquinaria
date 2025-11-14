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
import { PreselectionForm, AUCTION_SUPPLIERS } from '../organisms/PreselectionForm';
import { usePreselections } from '../hooks/usePreselections';
import { showSuccess, showError } from '../components/Toast';
import { InlineFieldEditor } from '../components/InlineFieldEditor';
const CABIN_OPTIONS = [
  { value: 'CABINA CERRADA/AC', label: 'Cabina cerrada / AC' },
  { value: 'CABINA CERRADA', label: 'Cabina cerrada' },
  { value: 'CABINA CERRADA / AIRE ACONDICIONADO', label: 'Cabina cerrada / Aire' },
  { value: 'CANOPY', label: 'Canopy' },
];

const toNumberOrNull = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(numeric) ? null : numeric;
};

export const PreselectionPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPreselection, setSelectedPreselection] = useState<PreselectionWithRelations | null>(null);
  const [decisionFilter, setDecisionFilter] = useState<PreselectionDecision | ''>('');
  const [dateFilter, setDateFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const { preselections, isLoading, refetch, updateDecision, updatePreselectionFields } = usePreselections();
  const supplierOptions = AUCTION_SUPPLIERS.map((supplier) => ({
    value: supplier,
    label: supplier,
  }));

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

  const handleInlineUpdate = async (preselId: string, field: string, value: string | number | null) => {
    try {
      await updatePreselectionFields(preselId, { [field]: value } as any);
      showSuccess('Dato actualizado');
    } catch (error: any) {
      showError(error.message || 'No se pudo actualizar el dato');
      throw error;
    }
  };

  const handleToggleSpec = async (preselId: string, field: 'spec_pip' | 'spec_blade', currentValue: boolean | null | undefined) => {
    await handleInlineUpdate(preselId, field, !currentValue);
  };

  const getDecisionTone = (decision: string) => {
    switch (decision) {
      case 'SI':
        return { label: 'Aprobada', classes: 'bg-emerald-100 text-emerald-700 border border-emerald-200' };
      case 'NO':
        return { label: 'Rechazada', classes: 'bg-rose-100 text-rose-700 border border-rose-200' };
      default:
        return { label: 'Pendiente', classes: 'bg-amber-100 text-amber-700 border border-amber-200' };
    }
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

  const formatDateTime = (value?: string | null, timeZone?: string) => {
    if (!value) return '-';
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '-';
      return new Intl.DateTimeFormat('es-CO', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone,
      }).format(date);
    } catch {
      return '-';
    }
  };

  const buildSpecBadges = (presel: PreselectionWithRelations) => {
    const badges: string[] = [];
    if (presel.shoe_width_mm) {
      badges.push(`${presel.shoe_width_mm.toLocaleString('es-CO')} mm`);
    }
    if (presel.spec_pip) badges.push('PIP');
    if (presel.spec_blade) badges.push('Blade');
    if (presel.spec_cabin) badges.push(`Cabina: ${presel.spec_cabin}`);
    return badges;
  };

  const formatHours = (value?: number | null) => {
    if (!value && value !== 0) return '-';
    return `${value.toLocaleString('es-CO')} hrs`;
  };

  const formatModelTitle = (presel: PreselectionWithRelations) => {
    if (presel.auction_name) return presel.auction_name;
    if (presel.lot_number) return `Lote ${presel.lot_number}`;
    return `${presel.brand || ''} ${presel.model}`.trim() || 'Sin nombre';
  };

  const InlineTile: React.FC<{
    label: string;
    children: React.ReactNode;
  }> = ({ label, children }) => (
    <div className="p-3 border rounded-lg bg-white shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{label}</p>
      {children}
    </div>
  );

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
                className="flex items-center gap-2 bg-gray-900 text-white hover:bg-gray-800 shadow-lg"
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
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
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
                  const [year, month, day] = group.date.split('-').map(Number);
                  const date = new Date(year, month - 1, day);
                  const summaryPresel = group.preselections[0];
                  const summaryLocalTime = summaryPresel ? formatDateTime(summaryPresel.auction_date) : '-';
                  const summaryColTime = summaryPresel
                    ? formatDateTime(summaryPresel.auction_date, 'America/Bogota')
                    : '-';

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
                              <p className="text-lg font-semibold text-gray-900">
                                {date.toLocaleDateString('es-CO', {
                                  weekday: 'long',
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                })}
                              </p>
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
                          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mt-2" onClick={(e) => e.stopPropagation()}>
                            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-3">
                              <InlineTile label="Proveedor">
                                <InlineFieldEditor
                                  value={summaryPresel.supplier_name}
                                  type="select"
                                  placeholder="Seleccionar proveedor"
                                  options={supplierOptions}
                                  onSave={(val) => handleInlineUpdate(summaryPresel.id, 'supplier_name', val)}
                                />
                              </InlineTile>
                              <InlineTile label="Tipo de subasta">
                                <InlineFieldEditor
                                  value={summaryPresel.auction_type}
                                  type="select"
                                  placeholder="Seleccionar tipo"
                                  options={[
                                    { value: 'LIVE', label: 'Live' },
                                    { value: 'ONLINE', label: 'Online' },
                                    { value: 'CERRADA', label: 'Cerrada' },
                                  ]}
                                  onSave={(val) => handleInlineUpdate(summaryPresel.id, 'auction_type', val)}
                                />
                              </InlineTile>
                              <InlineTile label="Fecha y hora local">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <p className="text-[10px] uppercase text-gray-400 font-semibold mb-1">Fecha</p>
                                    <InlineFieldEditor
                                      value={summaryPresel.auction_date ? new Date(summaryPresel.auction_date).toISOString().split('T')[0] : ''}
                                      type="date"
                                      placeholder="Fecha"
                                      onSave={async (val) => {
                                        const dateValue = typeof val === 'string' && val
                                          ? new Date(`${val}T00:00:00`).toISOString()
                                          : null;
                                        await handleInlineUpdate(summaryPresel.id, 'auction_date', dateValue);
                                      }}
                                      displayFormatter={() =>
                                        summaryPresel.auction_date
                                          ? new Date(summaryPresel.auction_date).toLocaleDateString('es-CO')
                                          : 'Sin fecha'
                                      }
                                    />
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase text-gray-400 font-semibold mb-1">Hora</p>
                                    <InlineFieldEditor
                                      value={summaryPresel.local_time || ''}
                                      type="time"
                                      placeholder="Hora local"
                                      className="w-full min-h-[44px]"
                                      onSave={(val) => handleInlineUpdate(summaryPresel.id, 'local_time', val)}
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <p className="text-[10px] uppercase text-gray-400 font-semibold mb-1">Ciudad</p>
                                    <InlineFieldEditor
                                      value={summaryPresel.auction_city || ''}
                                      type="text"
                                      placeholder="Ciudad"
                                      className="w-full min-h-[44px]"
                                      onSave={(val) => handleInlineUpdate(summaryPresel.id, 'auction_city', val)}
                                    />
                                  </div>
                                </div>
                                <p className="text-[11px] text-gray-500 mt-2">
                                  Hora Colombia: {formatDateTime(summaryPresel.auction_date, 'America/Bogota')}
                                </p>
                              </InlineTile>
                              <InlineTile label="URL">
                                <InlineFieldEditor
                                  value={summaryPresel.auction_url}
                                  placeholder="Enlace"
                                  onSave={(val) => handleInlineUpdate(summaryPresel.id, 'auction_url', val)}
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
                              </InlineTile>
                              <InlineTile label="Moneda">
                                <InlineFieldEditor
                                  value={summaryPresel.currency}
                                  type="select"
                                  placeholder="Moneda"
                                  options={[
                                    { value: 'USD', label: 'USD' },
                                    { value: 'COP', label: 'COP' },
                                    { value: 'EUR', label: 'EUR' },
                                    { value: 'JPY', label: 'JPY' },
                                  ]}
                                  onSave={(val) => handleInlineUpdate(summaryPresel.id, 'currency', val)}
                                />
                              </InlineTile>
                              <InlineTile label="Ubicación">
                                <InlineFieldEditor
                                  value={summaryPresel.location}
                                  type="select"
                                  placeholder="Ubicación"
                                  options={[
                                    { value: 'EEUU', label: 'Estados Unidos' },
                                    { value: 'JAPON', label: 'Japón' },
                                    { value: 'COLOMBIA', label: 'Colombia' },
                                    { value: 'OTRO', label: 'Otro' },
                                  ]}
                                  onSave={(val) => handleInlineUpdate(summaryPresel.id, 'location', val)}
                                />
                              </InlineTile>
                            </div>
                          </div>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-100 divide-y">
                          {group.preselections.map((presel, idx) => {
                            const specBadges = buildSpecBadges(presel);
                            const tone = getDecisionTone(presel.decision);

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
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Marca</p>
                                    <InlineFieldEditor
                                      value={presel.brand}
                                      placeholder="Marca"
                                      onSave={(val) => handleInlineUpdate(presel.id, 'brand', val)}
                                    />
                                  </div>
                                  <div>
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Lote</p>
                                    <InlineFieldEditor
                                      value={presel.lot_number}
                                      placeholder="Lote"
                                      onSave={(val) => handleInlineUpdate(presel.id, 'lot_number', val)}
                                    />
                                  </div>
                                  <div>
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Modelo</p>
                                    <InlineFieldEditor
                                      value={presel.model}
                                      placeholder="Modelo"
                                      onSave={(val) => handleInlineUpdate(presel.id, 'model', val)}
                                    />
                                  </div>
                                  <div>
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Serie</p>
                                    <InlineFieldEditor
                                      value={presel.serial}
                                      placeholder="Serie"
                                      className="font-mono"
                                      onSave={(val) => handleInlineUpdate(presel.id, 'serial', val)}
                                    />
                                  </div>
                                  <div>
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Año</p>
                                    <InlineFieldEditor
                                      value={presel.year}
                                      type="number"
                                      placeholder="Año"
                                      onSave={(val) => handleInlineUpdate(presel.id, 'year', val)}
                                    />
                                  </div>
                                  <div>
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Horas</p>
                                    <InlineFieldEditor
                                      value={presel.hours}
                                      type="number"
                                      placeholder="Horas"
                                      displayFormatter={(val) => formatHours(toNumberOrNull(val))}
                                      onSave={(val) => handleInlineUpdate(presel.id, 'hours', val)}
                                    />
                                  </div>
                                  <div>
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Precio sugerido</p>
                                    <InlineFieldEditor
                                      value={presel.suggested_price}
                                      type="number"
                                      placeholder="Valor sugerido"
                                      displayFormatter={(val) => formatCurrency(toNumberOrNull(val), presel.currency)}
                                      onSave={(val) => handleInlineUpdate(presel.id, 'suggested_price', val)}
                                    />
                                  </div>
                                  <div>
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Precio compra</p>
                                    <InlineFieldEditor
                                      value={presel.final_price}
                                      type="number"
                                      placeholder="Precio compra"
                                      displayFormatter={(val) =>
                                        toNumberOrNull(val) !== null
                                          ? formatCurrency(toNumberOrNull(val), presel.currency)
                                          : 'Sin definir'
                                      }
                                      onSave={(val) => handleInlineUpdate(presel.id, 'final_price', val)}
                                    />
                                  </div>
                                  <div className="lg:col-span-2 space-y-2">
                                    <p className="text-[11px] uppercase text-gray-400 font-semibold">Especificaciones</p>
                                    <InlineFieldEditor
                                      value={presel.shoe_width_mm}
                                      type="number"
                                      placeholder="Ancho zapatas (mm)"
                                      displayFormatter={(val) => {
                                        const numeric = toNumberOrNull(val);
                                        return numeric !== null ? `${numeric.toLocaleString('es-CO')} mm` : 'Definir ancho';
                                      }}
                                      onSave={(val) => handleInlineUpdate(presel.id, 'shoe_width_mm', val)}
                                    />
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleSpec(presel.id, 'spec_pip', presel.spec_pip)}
                                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                          presel.spec_pip ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'border-gray-200 text-gray-500'
                                        }`}
                                      >
                                        PIP
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleSpec(presel.id, 'spec_blade', presel.spec_blade)}
                                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                          presel.spec_blade ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'border-gray-200 text-gray-500'
                                        }`}
                                      >
                                        Blade
                                      </button>
                                      <InlineFieldEditor
                                        value={presel.spec_cabin || ''}
                                        type="select"
                                        placeholder="Tipo cabina"
                                        options={CABIN_OPTIONS}
                                        onSave={(val) => handleInlineUpdate(presel.id, 'spec_cabin', val)}
                                      />
                                    </div>
                                  </div>
                                  <div className="lg:col-span-2 flex items-center justify-end">
                                    {presel.decision === 'SI' ? (
                                      <div className="flex items-center justify-end gap-2">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-semibold">
                                          ✓
                                        </span>
                                        <span className="text-xs font-semibold text-emerald-700">Aprobada</span>
                                      </div>
                                    ) : (
                                      <div className="flex justify-end gap-2">
                                        <button
                                          onClick={() => handleDecision(presel.id, 'SI')}
                                          className="px-3 py-1.5 rounded-lg border border-emerald-500 text-emerald-600 text-xs font-semibold hover:bg-emerald-50"
                                        >
                                          Aprobar
                                        </button>
                                        <button
                                          onClick={() => handleDecision(presel.id, 'NO')}
                                          className="px-3 py-1.5 rounded-lg border border-rose-500 text-rose-600 text-xs font-semibold hover:bg-rose-50"
                                        >
                                          Rechazar
                                        </button>
                                      </div>
                                    )}
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
      </div>
    </div>
  );
};

