/**
 * Página de Importación de Históricos de Precios
 * Solo accesible para Administradores
 */

import React, { useState } from 'react';
import { Upload, Database, TrendingUp, DollarSign, AlertCircle, CheckCircle2, FileSpreadsheet, Download } from 'lucide-react';
import { Card } from '../molecules/Card';
import { Button } from '../atoms/Button';
import { apiGet, apiDelete, apiUpload, API_URL } from '../services/api';
import { showSuccess, showError } from '../components/Toast';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

interface ImportStats {
  total_records?: number;
  unique_models?: number;
  oldest_year?: number;
  newest_year?: number;
  avg_price?: number;
  avg_pvp?: number;
  avg_rptos?: number;
}

export const ImportPricesPage = () => {
  const [auctionFile, setAuctionFile] = useState<File | null>(null);
  const [pvpFile, setPvpFile] = useState<File | null>(null);
  const [isUploadingAuction, setIsUploadingAuction] = useState(false);
  const [isUploadingPvp, setIsUploadingPvp] = useState(false);
  const [auctionStats, setAuctionStats] = useState<ImportStats | null>(null);
  const [pvpStats, setPvpStats] = useState<ImportStats | null>(null);

  const handleAuctionFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAuctionFile(file);
  };

  const handlePvpFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPvpFile(file);
  };

  const handleUploadAuction = async () => {
    if (!auctionFile) {
      showError('Por favor selecciona un archivo');
      return;
    }

    setIsUploadingAuction(true);
    try {
      const formData = new FormData();
      formData.append('file', auctionFile);

      const result = await apiUpload<{ imported: number; total: number; errors?: string[] }>(
        '/api/price-history/import-auction',
        formData
      );

      showSuccess(`✅ Importados ${result.imported} de ${result.total} registros`);
      if (result.errors?.length) {
        console.warn('Errores en importación:', result.errors);
      }
      setAuctionFile(null);
      fetchAuctionStats();
    } catch (error: unknown) {
      console.error('Error subiendo archivo:', error);
      showError(getErrorMessage(error));
    } finally {
      setIsUploadingAuction(false);
    }
  };

  const handleUploadPvp = async () => {
    if (!pvpFile) {
      showError('Por favor selecciona un archivo');
      return;
    }

    setIsUploadingPvp(true);
    try {
      const formData = new FormData();
      formData.append('file', pvpFile);

      const result = await apiUpload<{ imported: number; total: number; errors?: string[] }>(
        '/api/price-history/import-pvp',
        formData
      );

      showSuccess(`✅ Importados ${result.imported} de ${result.total} registros`);
      if (result.errors?.length) {
        console.warn('Errores en importación:', result.errors);
      }
      setPvpFile(null);
      fetchPvpStats();
    } catch (error: unknown) {
      console.error('Error subiendo archivo:', error);
      showError(getErrorMessage(error));
    } finally {
      setIsUploadingPvp(false);
    }
  };

  const fetchAuctionStats = async () => {
    try {
      const stats = await apiGet<ImportStats>('/api/price-history/auction-stats');
      setAuctionStats(stats);
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
    }
  };

  const fetchPvpStats = async () => {
    try {
      const stats = await apiGet<ImportStats>('/api/price-history/pvp-stats');
      setPvpStats(stats);
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
    }
  };

  React.useEffect(() => {
    fetchAuctionStats();
    fetchPvpStats();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-8 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-white/20 rounded-xl">
            <Database className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">Importar Históricos de Precios</h1>
            <p className="text-indigo-100">
              Sube archivos Excel con datos históricos para alimentar las sugerencias inteligentes
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECCIÓN 1: SUBASTAS */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Histórico de Subastas</h2>
                <p className="text-sm text-gray-600">Precios de subastas ganadas</p>
              </div>
            </div>

            {/* Estadísticas Actuales */}
            {auctionStats?.total_records && Number.parseInt(auctionStats.total_records.toString(), 10) > 0 ? (
              <div className="bg-blue-50 p-4 rounded-lg mb-6 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Registros totales:</span>
                  <span className="font-bold text-blue-700">{auctionStats.total_records}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Modelos únicos:</span>
                  <span className="font-bold text-blue-700">{auctionStats.unique_models}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Rango de años:</span>
                  <span className="font-bold text-blue-700">
                    {auctionStats.oldest_year || 'N/A'} - {auctionStats.newest_year || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Precio promedio:</span>
                  <span className="font-bold text-blue-700">
                    ${auctionStats.avg_price ? Math.round(Number.parseFloat(auctionStats.avg_price.toString())).toLocaleString() : '0'}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    if (confirm('¿Seguro que quieres eliminar todos los registros históricos de subastas? Esto permitirá reimportar con los datos corregidos.')) {
                      try {
                        await apiDelete('/api/price-history/auction');
                        showSuccess('Histórico eliminado');
                        fetchAuctionStats();
                      } catch (error: unknown) {
                        console.error('Error eliminando:', error);
                        showError(getErrorMessage(error));
                      }
                    }
                  }}
                  className="w-full mt-2 px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                >
                  🗑️ Limpiar histórico
                </button>
              </div>
            ) : (
              <div className="bg-yellow-50 p-4 rounded-lg mb-6 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="text-sm text-yellow-700">No hay datos históricos aún</span>
              </div>
            )}

            {/* Descargar Template */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg mb-6 border-2 border-blue-200">
              <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Template con Formato Correcto
              </h3>
              <p className="text-xs text-gray-600 mb-3">
                Descarga este archivo Excel con la estructura exacta y ejemplos. Solo completa con tus datos.
              </p>
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`${API_URL}/api/price-history/template-auction`, {
                      headers: {
                        'Authorization': `Bearer ${token}`
                      }
                    });
                    if (!response.ok) throw new Error('Error al descargar template');
                    const blob = await response.blob();
                    const url = globalThis.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'Template_Subastas.xlsx';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    globalThis.URL.revokeObjectURL(url);
                  } catch (error: unknown) {
                    console.error('Error descargando template:', error);
                    showError(getErrorMessage(error));
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Descargar Template de Subastas
              </button>
              <div className="mt-3 text-xs text-gray-500 space-y-1">
                <p>✅ Columnas: MODELO, SERIE, AÑO, HORAS, PRECIO, FECHA, PROVEEDOR, LOT, MONEDA, ESTADO</p>
                <p>✅ Incluye 3 registros de ejemplo</p>
                <p>✅ Instrucciones detalladas en hoja 2</p>
              </div>
            </div>
            
            {/* Formato Esperado */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Formato del Excel
              </h3>
              <div className="text-xs text-gray-600 space-y-1">
                <p>Columnas esperadas (en cualquier orden):</p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li><strong>MODELO</strong> (requerido)</li>
                  <li>SERIE, AÑO, HORAS</li>
                  <li>PRECIO (precio pagado)</li>
                  <li>FECHA (opcional, formato: 26/02/2024)</li>
                  <li>PROVEEDOR, LOT (opcionales)</li>
                  <li><strong>MONEDA</strong> (opcional: JPY, USD, EUR)</li>
                  <li><strong>ESTADO</strong> (opcional: GANADA o PERDIDA; solo GANADA se usa en sugerencia)</li>
                </ul>
                <p className="text-gray-500 mt-2 italic">Nota: MARCA se detecta automáticamente del modelo</p>
              </div>
            </div>

            {/* Upload */}
            <div className="space-y-4">
              <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleAuctionFileChange}
                  className="hidden"
                  id="auction-file"
                />
                <label htmlFor="auction-file" className="cursor-pointer">
                  <Upload className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  {auctionFile ? (
                    <div>
                      <p className="text-sm font-medium text-gray-700">{auctionFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {(auctionFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Haz clic o arrastra el archivo Excel
                      </p>
                      <p className="text-xs text-gray-500">Formatos: .xlsx, .xls, .csv</p>
                    </div>
                  )}
                </label>
              </div>

              <Button
                onClick={handleUploadAuction}
                disabled={!auctionFile || isUploadingAuction}
                className="w-full"
              >
                {isUploadingAuction ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Importar Histórico de Subastas
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* SECCIÓN 2: PVP Y REPUESTOS */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Histórico de PVP y Repuestos</h2>
                <p className="text-sm text-gray-600">Datos de consolidado previos</p>
              </div>
            </div>

            {/* Estadísticas Actuales */}
            {pvpStats?.total_records && Number.parseInt(pvpStats.total_records.toString(), 10) > 0 ? (
              <div className="bg-green-50 p-4 rounded-lg mb-6 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Registros totales:</span>
                  <span className="font-bold text-green-700">{pvpStats.total_records}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Modelos únicos:</span>
                  <span className="font-bold text-green-700">{pvpStats.unique_models}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Rango de años:</span>
                  <span className="font-bold text-green-700">
                    {pvpStats.oldest_year} - {pvpStats.newest_year}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">PVP promedio:</span>
                  <span className="font-bold text-green-700">
                    ${Math.round(Number.parseFloat(pvpStats.avg_pvp?.toString() ?? '0')).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Repuestos promedio:</span>
                  <span className="font-bold text-green-700">
                    ${Math.round(Number.parseFloat(pvpStats.avg_rptos?.toString() ?? '0')).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 p-4 rounded-lg mb-6 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="text-sm text-yellow-700">No hay datos históricos aún</span>
              </div>
            )}

            {/* Descargar Template */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg mb-6 border-2 border-green-200">
              <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Template con Formato Correcto
              </h3>
              <p className="text-xs text-gray-600 mb-3">
                Descarga este archivo Excel con las 15 columnas exactas y ejemplos. Solo completa con tus datos.
              </p>
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`${API_URL}/api/price-history/template-pvp`, {
                      headers: {
                        'Authorization': `Bearer ${token}`
                      }
                    });
                    if (!response.ok) throw new Error('Error al descargar template');
                    const blob = await response.blob();
                    const url = globalThis.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'Template_PVP_Repuestos.xlsx';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    globalThis.URL.revokeObjectURL(url);
                  } catch (error: unknown) {
                    console.error('Error descargando template:', error);
                    showError(getErrorMessage(error));
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Descargar Template de PVP
              </button>
              <div className="mt-3 text-xs text-gray-500 space-y-1">
                <p>✅ 16 Columnas completas según tu BD</p>
                <p>✅ Incluye 3 registros de ejemplo</p>
                <p>✅ Instrucciones detalladas en hoja 2</p>
              </div>
            </div>
            
            {/* Formato Esperado */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Formato del Excel
              </h3>
              <div className="text-xs text-gray-600 space-y-1">
                <p>Columnas esperadas (respete el nombre exacto):</p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li><strong>MODELO</strong> (requerido)</li>
                  <li>PROVEE, SERIE, AÑO, HOUR</li>
                  <li>PRECIO, INLAND, CIF /USD, CIF</li>
                  <li>GASTOS PTO, FLETE, TRASLD</li>
                  <li><strong>RPTOS</strong>, proyectado, <strong>PVP EST</strong></li>
                  <li><strong>FECHA</strong> (año de compra: 2023, 2024)</li>
                </ul>
              </div>
            </div>

            {/* Upload */}
            <div className="space-y-4">
              <div className="border-2 border-dashed border-green-300 rounded-lg p-6 text-center hover:border-green-500 transition-colors cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handlePvpFileChange}
                  className="hidden"
                  id="pvp-file"
                />
                <label htmlFor="pvp-file" className="cursor-pointer">
                  <Upload className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  {pvpFile ? (
                    <div>
                      <p className="text-sm font-medium text-gray-700">{pvpFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {(pvpFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Haz clic o arrastra el archivo Excel
                      </p>
                      <p className="text-xs text-gray-500">Formatos: .xlsx, .xls, .csv</p>
                    </div>
                  )}
                </label>
              </div>

              <Button
                onClick={handleUploadPvp}
                disabled={!pvpFile || isUploadingPvp}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isUploadingPvp ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Importar Histórico de PVP
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Información Adicional */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            Información Importante
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Los datos se acumulan</p>
                <p className="text-gray-600">Puedes importar múltiples archivos, los registros se suman</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Sugerencias inteligentes</p>
                <p className="text-gray-600">Se combinan con datos actuales de la app para mayor precisión</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Algoritmo adaptativo</p>
                <p className="text-gray-600">Pondera por relevancia, antigüedad y similitud del modelo</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Actualización continua</p>
                <p className="text-gray-600">Cada nueva subasta/PVP mejora las futuras sugerencias</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

