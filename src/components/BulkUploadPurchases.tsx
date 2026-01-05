/**
 * Componente para carga masiva de compras (solo administradores)
 */

import React, { useState, useRef } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader, Download } from 'lucide-react';
import { Modal } from '../molecules/Modal';
import { Button } from '../atoms/Button';
import { Select } from '../atoms/Select';
import { showSuccess, showError } from './Toast';
import * as XLSX from 'xlsx';
import { apiPost } from '../services/api';

interface BulkUploadPurchasesProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedRow {
  supplier_name?: string;
  brand?: string;
  model?: string;
  serial?: string;
  year?: number | string;
  hours?: number | string;
  machine_type?: string;
  condition?: string;
  invoice_date?: string;
  invoice_number?: string;
  purchase_order?: string;
  incoterm?: string;
  currency_type?: string;
  exw_value_formatted?: string;
  fob_value?: number | string;
  trm?: number | string;
  supplier_id?: string;
  tipo?: string;
  purchase_type?: string;
  [key: string]: any;
}

export const BulkUploadPurchases: React.FC<BulkUploadPurchasesProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [purchaseType, setPurchaseType] = useState<'COMPRA_DIRECTA' | 'SUBASTA'>('COMPRA_DIRECTA');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validar tipo de archivo - Aceptar todos los formatos Excel
    const validExtensions = ['.csv', '.xlsx', '.xls', '.xlsm', '.xlsb', '.xltx', '.xltm'];
    const fileExtension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      showError('Formato de archivo no válido. Use CSV o Excel (.xlsx, .xls, .xlsm, .xlsb, .xltx, .xltm)');
      return;
    }

    setFile(selectedFile);
    setErrors([]);
    setIsProcessing(true);

    try {
      let data: ParsedRow[] = [];

      if (fileExtension === '.csv') {
        // Procesar CSV
        const text = await selectedFile.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          throw new Error('El archivo CSV debe tener al menos una fila de encabezados y una fila de datos');
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        data = lines.slice(1).map((line, index) => {
          const values = line.split(',').map(v => v.trim());
          const row: ParsedRow = {};
          headers.forEach((header, i) => {
            const value = values[i] || '';
            row[header] = value || undefined;
          });
          return row;
        }).filter(row => Object.values(row).some(v => v !== undefined && v !== ''));
      } else {
        // Procesar Excel (todos los formatos: .xlsx, .xls, .xlsm, .xlsb, .xltx, .xltm)
        const arrayBuffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { 
          type: 'array',
          cellDates: true,
          cellNF: false,
          cellText: false
        });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
        
        data = jsonData.map((row: any) => {
          const normalizedRow: ParsedRow = {};
          Object.keys(row).forEach(key => {
            const normalizedKey = key.toLowerCase().trim();
            normalizedRow[normalizedKey] = row[key] || undefined;
          });
          return normalizedRow;
        });
      }

      // Normalizar y validar datos
      const validationErrors: string[] = [];
      data.forEach((row, index) => {
        if (!row.model && !row.serial) {
          validationErrors.push(`Fila ${index + 2}: Se requiere al menos modelo o serial`);
        }
        
        // Normalizar campo tipo/purchase_type
        const tipoValue = row.tipo || row.purchase_type || '';
        if (tipoValue) {
          const normalizedTipo = tipoValue.toString().toUpperCase().trim();
          if (normalizedTipo === 'COMPRA_DIRECTA' || normalizedTipo === 'COMPRA DIRECTA' || normalizedTipo === 'DIRECTA') {
            row.tipo = 'COMPRA_DIRECTA';
          } else if (normalizedTipo === 'SUBASTA' || normalizedTipo === 'AUCTION') {
            row.tipo = 'SUBASTA';
          } else if (normalizedTipo !== 'COMPRA_DIRECTA' && normalizedTipo !== 'SUBASTA') {
            validationErrors.push(`Fila ${index + 2}: Tipo inválido "${tipoValue}". Debe ser "COMPRA_DIRECTA" o "SUBASTA"`);
          }
        }
      });

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        setParsedData([]);
      } else {
        setParsedData(data);
        showSuccess(`Archivo procesado: ${data.length} registros encontrados`);
      }
    } catch (error) {
      console.error('Error procesando archivo:', error);
      showError(error instanceof Error ? error.message : 'Error al procesar el archivo');
      setParsedData([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      ['supplier_name', 'brand', 'model', 'serial', 'year', 'hours', 'machine_type', 'condition', 'invoice_date', 'invoice_number', 'purchase_order', 'incoterm', 'currency_type', 'exw_value_formatted', 'trm', 'tipo'],
      ['TOZAI', 'HITACHI', 'ZX200', 'ZX200-12345', '2020', '5000', 'EXCAVADORA', 'USADO', '2024-01-15', 'INV-001', 'PO-001', 'FOB', 'USD', '50000', '0', 'COMPRA_DIRECTA'],
      ['KANEHARU', 'KOMATSU', 'PC200', 'PC200-67890', '2019', '4500', 'EXCAVADORA', 'USADO', '2024-02-10', 'INV-002', 'PO-002', 'EXY', 'JPY', '3000000', '0', 'SUBASTA']
    ];

    const csvContent = templateData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'template_carga_masiva_compras.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpload = async () => {
    if (parsedData.length === 0) {
      showError('No hay datos para subir');
      return;
    }

    if (errors.length > 0) {
      showError('Corrija los errores antes de subir');
      return;
    }

    setIsUploading(true);

    try {
      // Preparar registros: usar tipo del archivo si existe, sino usar el selector global
      const recordsWithType = parsedData.map(row => ({
        ...row,
        purchase_type: row.tipo || row.purchase_type || purchaseType
      }));

      const response = await apiPost<{ success: boolean; inserted: number; errors?: string[] }>(
        '/api/purchases/bulk-upload',
        {
          purchase_type: purchaseType, // Tipo por defecto si no viene en el archivo
          records: recordsWithType
        }
      );

      if (response.success) {
        showSuccess(`✅ ${response.inserted} registro(s) insertado(s) exitosamente`);
        if (response.errors && response.errors.length > 0) {
          console.warn('Algunos registros tuvieron errores:', response.errors);
        }
        handleClose();
        onSuccess();
      } else {
        showError('Error al subir los registros');
      }
    } catch (error) {
      console.error('Error subiendo registros:', error);
      showError(error instanceof Error ? error.message : 'Error al subir los registros');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    setErrors([]);
    setPurchaseType('COMPRA_DIRECTA');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Carga Masiva de Compras"
      size="xl"
    >
      <div className="space-y-6">
        {/* Selector de tipo (solo si no viene en el archivo) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Compra (por defecto)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Si el archivo incluye una columna "tipo" o "purchase_type", se usará ese valor. Este selector solo se aplica a registros sin tipo definido.
          </p>
          <Select
            value={purchaseType}
            onChange={(e) => setPurchaseType(e.target.value as 'COMPRA_DIRECTA' | 'SUBASTA')}
            options={[
              { value: 'COMPRA_DIRECTA', label: 'Compra Directa' },
              { value: 'SUBASTA', label: 'Subasta' }
            ]}
          />
        </div>

        {/* Botón descargar template */}
        <div>
          <Button
            onClick={handleDownloadTemplate}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Descargar Template CSV
          </Button>
        </div>

        {/* Selector de archivo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Archivo (CSV o Excel)
          </label>
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.xlsm,.xlsb,.xltx,.xltm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12,application/vnd.ms-excel.sheet.binary.macroEnabled.12"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="secondary"
              disabled={isProcessing}
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {file ? 'Cambiar archivo' : 'Seleccionar archivo'}
            </Button>
            {file && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileText className="w-4 h-4" />
                <span>{file.name}</span>
                <span className="text-gray-400">({(file.size / 1024).toFixed(2)} KB)</span>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Formatos soportados: CSV, Excel (.xlsx, .xls, .xlsm, .xlsb, .xltx, .xltm). Las columnas deben incluir al menos: modelo, serial, marca, proveedor. Opcional: columna "tipo" con valores "COMPRA_DIRECTA" o "SUBASTA".
          </p>
        </div>

        {/* Procesando */}
        {isProcessing && (
          <div className="flex items-center gap-2 text-blue-600">
            <Loader className="w-4 h-4 animate-spin" />
            <span>Procesando archivo...</span>
          </div>
        )}

        {/* Errores */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
              <AlertCircle className="w-5 h-5" />
              Errores de validación ({errors.length})
            </div>
            <ul className="text-sm text-red-700 space-y-1 max-h-40 overflow-y-auto">
              {errors.slice(0, 10).map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
              {errors.length > 10 && (
                <li className="text-red-600 italic">... y {errors.length - 10} error(es) más</li>
              )}
            </ul>
          </div>
        )}

        {/* Preview de datos */}
        {parsedData.length > 0 && errors.length === 0 && (
          <div className="border border-gray-200 rounded-lg">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Preview: {parsedData.length} registro(s) listo(s) para subir
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Marca</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Modelo</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Serial</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Proveedor</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {parsedData.slice(0, 10).map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600">{index + 1}</td>
                      <td className="px-3 py-2">{row.brand || '-'}</td>
                      <td className="px-3 py-2">{row.model || '-'}</td>
                      <td className="px-3 py-2">{row.serial || '-'}</td>
                      <td className="px-3 py-2">{row.supplier_name || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          (row.tipo || row.purchase_type) === 'SUBASTA' 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {row.tipo || row.purchase_type || purchaseType}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedData.length > 10 && (
                <div className="px-4 py-2 text-xs text-gray-500 text-center bg-gray-50">
                  ... y {parsedData.length - 10} registro(s) más
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isUploading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            disabled={parsedData.length === 0 || errors.length > 0 || isUploading}
            className="flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Subir {parsedData.length > 0 ? `${parsedData.length} registro(s)` : ''}
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
