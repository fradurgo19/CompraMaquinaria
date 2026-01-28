/**
 * Carga masiva de Compras Nuevas (new-purchases).
 * Template Excel con columnas solicitadas; subida en lotes para 800+ registros.
 */

import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader, Download } from 'lucide-react';
import { Modal } from '../molecules/Modal';
import { Button } from '../atoms/Button';
import { showSuccess, showError } from './Toast';
import * as XLSX from 'xlsx';
import { apiPost } from '../services/api';

interface BulkUploadNewPurchasesProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedRow {
  year?: number | string | null;
  machine_type?: string | null;
  brand?: string | null;
  supplier_name?: string | null;
  purchase_order?: string | null;
  type?: string | null;
  model?: string | null;
  spec?: string | null;
  incoterm?: string | null;
  machine_location?: string | null;
  port_of_loading?: string | null;
  currency?: string | null;
  value?: number | string | null;
  shipping_costs?: number | string | null;
  finance_costs?: number | string | null;
  valor_total?: number | string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  serial?: string | null;
  condition?: string | null;
  [key: string]: unknown;
}

const normalizeNumeric = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;
  let s = String(value).trim().replace(/[¥$€£,\s]/g, '').replace(/[^\d.-]/g, '');
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

const parseDate = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    // Excel serial date
    const d = new Date((value - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const [, day, month, year] = m;
    const y = year.length === 2 ? `20${year}` : year;
    return `${y}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
};

const TEMPLATE_HEADERS = [
  'AÑO',
  'TIPO MÁQUINA',
  'MARCA',
  'PROVEEDOR',
  'OC',
  'TIPO (COMPRA DIRECTA)',
  'MODELO',
  'SPEC (Cabina, Línea Húmeda, Hoja Topadora, Tipo de Zapata, STEEL TRACK, Ancho Zapata Y Brazo)',
  'INCOTERM',
  'UBICACIÓN Y PUERTO',
  'MONEDA',
  'VALOR',
  'FLETES',
  'FINANCE',
  'VALOR TOTAL',
  'FACTURA',
  'F. FACTURA',
  'VENCIMIENTO',
  'SERIE Y CONDICIÓN',
];

const HEADER_TO_FIELD: Record<string, string> = {
  'año': 'year',
  'tipo máquina': 'machine_type',
  'marca': 'brand',
  'proveedor': 'supplier_name',
  'oc': 'purchase_order',
  'tipo (compra directa)': 'type',
  'modelo': 'model',
  'incoterm': 'incoterm',
  'ubicación y puerto': 'machine_location',
  'moneda': 'currency',
  'valor': 'value',
  'fletes': 'shipping_costs',
  'finance': 'finance_costs',
  'valor total': 'valor_total',
  'factura': 'invoice_number',
  'f. factura': 'invoice_date',
  'vencimiento': 'due_date',
  'serie y condición': 'serial_condition',
};

function mapHeaderToField(key: string): string | null {
  const k = key.toLowerCase().trim();
  if (HEADER_TO_FIELD[k]) return HEADER_TO_FIELD[k];
  if (k.startsWith('spec')) return 'spec';
  return null;
}

export const BulkUploadNewPurchases: React.FC<BulkUploadNewPurchasesProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const templateData = [
      TEMPLATE_HEADERS,
      [
        2024,
        'EXCAVADORA',
        'HITACHI',
        'HITACHI',
        'PTQ001-24',
        'COMPRA DIRECTA',
        'ZX200',
        'Cabina: CANOPY, Línea Húmeda: SI, Hoja Topadora: NO, STEEL TRACK, Ancho 500mm, Brazo ESTANDAR',
        'EXW',
        'KOBE',
        'USD',
        50000,
        2000,
        500,
        52500,
        'INV-001',
        '2024-01-15',
        '2024-04-15',
        'ZX200-12345 NUEVO',
      ],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    ws['!cols'] = TEMPLATE_HEADERS.map((_, i) => ({ wch: i === 7 ? 50 : 18 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Compras Nuevas');
    XLSX.writeFile(wb, 'template_compras_nuevas.xlsx');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const ext = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));
    if (!['.xlsx', '.xls', '.xlsm'].includes(ext)) {
      showError('Use un archivo Excel (.xlsx, .xls o .xlsm). No CSV.');
      return;
    }

    setFile(selectedFile);
    setErrors([]);
    setIsProcessing(true);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true, raw: false });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false }) as Record<string, unknown>[];

      const data: ParsedRow[] = [];
      const validationErrors: string[] = [];

      for (let idx = 0; idx < jsonData.length; idx++) {
        const row = jsonData[idx];
        const rowNum = idx + 2;
        const normalizedRow: ParsedRow = {};

        for (const key of Object.keys(row)) {
          const field = mapHeaderToField(key) || key.toLowerCase().trim().replace(/\s+/g, '_');
          if (!field) continue;

          const raw = row[key];
          if (field === 'serial_condition') {
            const s = raw ? String(raw).trim() : '';
            if (s) {
              const upper = s.toUpperCase();
              if (upper.endsWith(' NUEVO') || upper === 'NUEVO') {
                normalizedRow.condition = 'NUEVO';
                normalizedRow.serial = s.replace(/\s*nuevo\s*$/i, '').trim() || null;
              } else if (upper.endsWith(' USADO') || upper === 'USADO') {
                normalizedRow.condition = 'USADO';
                normalizedRow.serial = s.replace(/\s*usado\s*$/i, '').trim() || null;
              } else {
                normalizedRow.serial = s;
                normalizedRow.condition = 'NUEVO';
              }
            }
            continue;
          }

          if (field === 'year') {
            const n = normalizeNumeric(raw);
            normalizedRow.year = n !== null ? n : undefined;
          } else if (['value', 'shipping_costs', 'finance_costs', 'valor_total'].includes(field)) {
            const n = normalizeNumeric(raw);
            (normalizedRow as Record<string, unknown>)[field] = n;
          } else if (['invoice_date', 'due_date'].includes(field)) {
            (normalizedRow as Record<string, unknown>)[field] = parseDate(raw) || undefined;
          } else {
            (normalizedRow as Record<string, unknown>)[field] = raw != null && String(raw).trim() !== '' ? String(raw).trim() : undefined;
          }
        }

        if (!normalizedRow.supplier_name || !normalizedRow.model) {
          validationErrors.push(`Fila ${rowNum}: Se requieren PROVEEDOR y MODELO.`);
        }
        if (!normalizedRow.serial) {
          normalizedRow.serial = `PDTE-${rowNum}`;
        }
        if (!normalizedRow.condition) {
          normalizedRow.condition = 'NUEVO';
        }
        if (!normalizedRow.type) {
          normalizedRow.type = 'COMPRA DIRECTA';
        }
        if (normalizedRow.type) {
          const t = String(normalizedRow.type).toUpperCase().trim();
          if (t === 'COMPRA DIRECTA' || t === 'COMPRA_DIRECTA') normalizedRow.type = 'COMPRA DIRECTA';
          else if (t === 'SUBASTA') normalizedRow.type = 'SUBASTA';
        }
        if (!normalizedRow.currency) {
          normalizedRow.currency = 'USD';
        }

        data.push(normalizedRow);
      }

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        setParsedData([]);
      } else {
        setParsedData(data);
        showSuccess(`Archivo procesado: ${data.length} registros.`);
      }
    } catch (err) {
      console.error(err);
      showError(err instanceof Error ? err.message : 'Error al procesar el archivo.');
      setParsedData([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpload = async () => {
    if (parsedData.length === 0) {
      showError('No hay datos para subir.');
      return;
    }
    if (errors.length > 0) {
      showError('Corrija los errores antes de subir.');
      return;
    }

    setIsUploading(true);
    try {
      const payload = parsedData.map((row) => ({
        year: row.year != null ? Number(row.year) : null,
        machine_type: row.machine_type || null,
        brand: row.brand || null,
        supplier_name: row.supplier_name || null,
        purchase_order: row.purchase_order || null,
        type: row.type || 'COMPRA DIRECTA',
        model: row.model || null,
        spec: row.spec || null,
        description: row.spec || null,
        incoterm: row.incoterm || null,
        machine_location: row.machine_location || null,
        port_of_loading: row.port_of_loading || row.machine_location || null,
        currency: (row.currency || 'USD').toUpperCase(),
        value: normalizeNumeric(row.value),
        shipping_costs: normalizeNumeric(row.shipping_costs),
        finance_costs: normalizeNumeric(row.finance_costs),
        invoice_number: row.invoice_number || null,
        invoice_date: row.invoice_date || null,
        due_date: row.due_date || null,
        serial: row.serial || null,
        condition: (row.condition || 'NUEVO').toUpperCase() === 'USADO' ? 'USADO' : 'NUEVO',
      }));

      const res = await apiPost<{ success: boolean; inserted: number; errors?: string[] }>(
        '/api/new-purchases/bulk-upload',
        { records: payload }
      );

      if (res.success) {
        showSuccess(`${res.inserted} registro(s) insertado(s) correctamente.`);
        if (res.errors?.length) {
          console.warn('Errores parciales:', res.errors);
        }
        handleClose();
        onSuccess();
      } else {
        showError('Error al subir los registros.');
      }
    } catch (err) {
      console.error(err);
      showError(err instanceof Error ? err.message : 'Error al subir.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    setErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Carga masiva - Compras Nuevas" size="xl">
      <div className="space-y-6">
        <div>
          <Button variant="secondary" onClick={handleDownloadTemplate} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Descargar plantilla Excel
          </Button>
          <p className="mt-2 text-xs text-gray-500">
            Plantilla en formato Excel (.xlsx) con las columnas: AÑO, TIPO MÁQUINA, MARCA, PROVEEDOR, OC, TIPO (COMPRA DIRECTA), MODELO, SPEC, INCOTERM, UBICACIÓN Y PUERTO, MONEDA, VALOR, FLETES, FINANCE, VALOR TOTAL, FACTURA, F. FACTURA, VENCIMIENTO, SERIE Y CONDICIÓN.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Archivo Excel</label>
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="secondary"
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {file ? 'Cambiar archivo' : 'Seleccionar archivo'}
            </Button>
            {file && (
              <span className="text-sm text-gray-600 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Solo Excel (.xlsx, .xls, .xlsm). Soporta más de 800 registros; la subida se hace por lotes.
          </p>
        </div>

        {isProcessing && (
          <div className="flex items-center gap-2 text-blue-600">
            <Loader className="w-4 h-4 animate-spin" />
            Procesando archivo...
          </div>
        )}

        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
              <AlertCircle className="w-5 h-5" />
              Errores de validación ({errors.length})
            </div>
            <ul className="text-sm text-red-700 space-y-1 max-h-40 overflow-y-auto">
              {errors.slice(0, 15).map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
              {errors.length > 15 && <li>... y {errors.length - 15} más</li>}
            </ul>
          </div>
        )}

        {parsedData.length > 0 && errors.length === 0 && (
          <div className="border border-gray-200 rounded-lg">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">
                {parsedData.length} registro(s) listos para subir
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Marca</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Modelo</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Proveedor</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Serial</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {parsedData.slice(0, 10).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600">{i + 1}</td>
                      <td className="px-3 py-2">{row.brand || '-'}</td>
                      <td className="px-3 py-2">{row.model || '-'}</td>
                      <td className="px-3 py-2">{row.supplier_name || '-'}</td>
                      <td className="px-3 py-2">{row.serial || '-'}</td>
                      <td className="px-3 py-2">{row.type || '-'}</td>
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

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={handleClose} disabled={isUploading}>
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
