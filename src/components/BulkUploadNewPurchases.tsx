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

/** Tipo reutilizable para campos opcionales (SonarQube: evita repetir union types). */
type OptionalString = string | null;
/** Número o string numérico en Excel (SonarQube: type alias). */
type OptionalNumStr = number | string | null;

/** Especificaciones técnicas extraídas del texto SPEC del Excel */
interface ParsedSpecs {
  cabin_type: OptionalString;
  wet_line: OptionalString;
  dozer_blade: OptionalString;
  track_type: OptionalString;
  track_width: OptionalString;
  arm_type: OptionalString;
}

interface ParsedRow {
  year?: OptionalNumStr;
  machine_type?: OptionalString;
  brand?: OptionalString;
  supplier_name?: OptionalString;
  purchase_order?: OptionalString;
  type?: OptionalString;
  model?: OptionalString;
  spec?: OptionalString;
  cabin_type?: OptionalString;
  wet_line?: OptionalString;
  dozer_blade?: OptionalString;
  track_type?: OptionalString;
  track_width?: OptionalString;
  arm_type?: OptionalString;
  incoterm?: OptionalString;
  machine_location?: OptionalString;
  port_of_loading?: OptionalString;
  currency?: OptionalString;
  value?: OptionalNumStr;
  shipping_costs?: OptionalNumStr;
  finance_costs?: OptionalNumStr;
  valor_total?: OptionalNumStr;
  invoice_number?: OptionalString;
  invoice_date?: OptionalString;
  due_date?: OptionalString;
  serial?: OptionalString;
  condition?: OptionalString;
  pvp_est?: OptionalNumStr;
  purchase_year?: OptionalNumStr;
  [key: string]: unknown;
}

const normalizeNumeric = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  const s = String(value).trim().replaceAll(/[¥$€£,\s]/g, '').replaceAll(/[^\d.-]/g, '');
  if (!s) return null;
  const n = Number.parseFloat(s);
  return Number.isNaN(n) ? null : n;
};

const DATE_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DATE_DMY_REGEX = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/;
const parseDate = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    const d = new Date((value - 25569) * 86400 * 1000);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (DATE_ISO_REGEX.test(s)) return s;
  const m = DATE_DMY_REGEX.exec(s);
  if (m) {
    const [, day, month, year] = m;
    const y = year.length === 2 ? `20${year}` : year;
    return `${y}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
};

/** Convierte texto SI/SÍ/NO del SPEC a valor permitido (SonarQube: evita ternario anidado). */
function yesNoFromSpecValue(val: string): OptionalString {
  const u = val.trim().toUpperCase();
  if (u === 'SI' || u === 'SÍ') return 'SI';
  if (u === 'NO') return 'NO';
  return null;
}

/** Asigna cabin_type desde match del SPEC. */
function assignCabinType(s: string, result: ParsedSpecs): void {
  const cabRegex = /\bCabina\s*:\s*([^,]+)/i;
  const m = cabRegex.exec(s);
  if (!m) return;
  const v = m[1].trim().toUpperCase();
  if (v === 'CANOPY') result.cabin_type = 'CANOPY';
  else if (/CAB\s*CERRADA|CERRADA/i.test(v)) result.cabin_type = v;
  else if (v === 'N/A') result.cabin_type = 'N/A';
  else result.cabin_type = m[1].trim();
}

/** Asigna track_type desde texto SPEC. */
function assignTrackType(s: string, result: ParsedSpecs): void {
  if (/\bSTEEL\s*TRACK\b/i.test(s)) result.track_type = 'STEEL TRACK';
  else if (/\bRUBBER\s*TRACK\b/i.test(s)) result.track_type = 'RUBBER TRACK';
  else {
    const trackRegex = /\bTipo\s*de\s*Zapata\s*:\s*([^,]+)/i;
    const m = trackRegex.exec(s);
    if (m) result.track_type = m[1].trim();
  }
}

/** Asigna arm_type desde match del SPEC. */
function assignArmType(s: string, result: ParsedSpecs): void {
  const armRegex = /\bBrazo\s*:\s*([^,]+)/i;
  const armAlt = /\bBrazo\s+([^,]+)/i;
  const m = armRegex.exec(s) ?? armAlt.exec(s);
  if (!m) return;
  const v = m[1].trim().toUpperCase();
  if (v === 'ESTANDAR' || v === 'ESTÁNDAR') result.arm_type = 'ESTANDAR';
  else if (v === 'LONG ARM' || v === 'LONGARM') result.arm_type = 'LONG ARM';
  else if (v === 'N/A') result.arm_type = 'N/A';
  else result.arm_type = m[1].trim();
}

/**
 * Parsea el texto SPEC del Excel y extrae cabin_type, wet_line, dozer_blade, track_type, track_width, arm_type.
 */
function parseSpecString(spec: string | null | undefined): ParsedSpecs {
  const result: ParsedSpecs = {
    cabin_type: null,
    wet_line: null,
    dozer_blade: null,
    track_type: null,
    track_width: null,
    arm_type: null,
  };
  if (!spec || typeof spec !== 'string') return result;
  const s = spec.trim();
  if (!s) return result;

  assignCabinType(s, result);

  const wetRegex = /\bLínea\s*Húmeda\s*:\s*(\w+)/i;
  const wetAlt = /\bLinea\s*Humeda\s*:\s*(\w+)/i;
  const wetMatch = wetRegex.exec(s) ?? wetAlt.exec(s);
  if (wetMatch) result.wet_line = yesNoFromSpecValue(wetMatch[1]);

  const dozerRegex = /\bHoja\s*Topadora\s*:\s*(\w+)/i;
  const dozerMatch = dozerRegex.exec(s);
  if (dozerMatch) result.dozer_blade = yesNoFromSpecValue(dozerMatch[1]);

  assignTrackType(s, result);

  const widthRegex = /\bAncho\s*(\d+\s*mm?|\d+)\b/i;
  const widthAlt = /\b(\d+)\s*mm\b/i;
  const widthMatch = widthRegex.exec(s) ?? widthAlt.exec(s);
  if (widthMatch) result.track_width = widthMatch[1].trim().replaceAll(/\s+/g, '');

  assignArmType(s, result);

  return result;
}

const TEMPLATE_HEADERS = [
  'AÑO',
  'AÑO COMPRA',
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
  'SERIE',
  'CONDICIÓN',
  'PVP',
];

const HEADER_TO_FIELD: Record<string, string> = {
  'año': 'year',
  'año compra': 'purchase_year',
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
  'serie': 'serial',
  'condición': 'condition',
  'pvp': 'pvp_est',
  'pvp est': 'pvp_est',
};

function mapHeaderToField(key: string): string | null {
  const k = key.toLowerCase().trim();
  if (HEADER_TO_FIELD[k]) return HEADER_TO_FIELD[k];
  if (k.startsWith('spec')) return 'spec';
  return null;
}

/** Asigna raw a normalizedRow según el campo (reduce complejidad en normalizeRowFromSheetRow). */
function applyRawToField(field: string, raw: unknown, normalizedRow: ParsedRow): void {
  if (field === 'year') {
    normalizedRow.year = normalizeNumeric(raw) ?? undefined;
  } else if (field === 'pvp_est') {
    normalizedRow.pvp_est = normalizeNumeric(raw) ?? undefined;
  } else if (field === 'purchase_year') {
    normalizedRow.purchase_year = normalizeNumeric(raw) ?? undefined;
  } else if (['value', 'shipping_costs', 'finance_costs', 'valor_total'].includes(field)) {
    normalizedRow[field] = normalizeNumeric(raw);
  } else if (['invoice_date', 'due_date'].includes(field)) {
    normalizedRow[field] = parseDate(raw) ?? undefined;
  } else {
    const str = (raw === null || raw === undefined) ? '' : String(raw).trim();
    normalizedRow[field] = str.length > 0 ? str : undefined;
  }
}

/** True si el valor está presente y es string no vacío (SonarQube: condición positiva). */
function isFilledString(val: unknown): boolean {
  return typeof val === 'string' && val.trim().length > 0;
}

/** Añade error de validación si faltan PROVEEDOR o MODELO (evita negated condition en caller). */
function collectRequiredFieldError(row: ParsedRow, rowNum: number, validationErrors: string[]): void {
  if (row.supplier_name && row.model) return;
  validationErrors.push(`Fila ${rowNum}: Se requieren PROVEEDOR y MODELO.`);
}

/** Devuelve el serial de la fila o PDTE-{rowNum} si viene vacío. */
function resolveSerial(serial: unknown, rowNum: number): string {
  if (isFilledString(serial)) return String(serial);
  return `PDTE-${rowNum}`;
}

/** Aplica defaults de tipo y moneda a la fila normalizada. */
function applyTypeAndCurrencyDefaults(normalizedRow: ParsedRow): void {
  if (normalizedRow.type) {
    const t = String(normalizedRow.type).toUpperCase().trim();
    if (t === 'COMPRA DIRECTA' || t === 'COMPRA_DIRECTA') normalizedRow.type = 'COMPRA DIRECTA';
    else if (t === 'SUBASTA') normalizedRow.type = 'SUBASTA';
  } else {
    normalizedRow.type = 'COMPRA DIRECTA';
  }
  normalizedRow.currency = normalizedRow.currency ?? 'USD';
}

/** Normaliza una fila del Excel a ParsedRow y acumula error de validación si faltan PROVEEDOR/MODELO. */
function normalizeRowFromSheetRow(
  row: Record<string, unknown>,
  rowNum: number,
  validationErrors: string[]
): ParsedRow {
  const normalizedRow: ParsedRow = {};
  for (const key of Object.keys(row)) {
    const field = mapHeaderToField(key) ?? key.toLowerCase().trim().replaceAll(/\s+/g, '_');
    if (field) {
      applyRawToField(field, row[key], normalizedRow);
    }
  }

  if (normalizedRow.spec) {
    Object.assign(normalizedRow, parseSpecString(normalizedRow.spec));
  }

  collectRequiredFieldError(normalizedRow, rowNum, validationErrors);
  normalizedRow.serial = resolveSerial(normalizedRow.serial, rowNum);

  const condUpper = (normalizedRow.condition && String(normalizedRow.condition).toUpperCase().trim()) ?? '';
  normalizedRow.condition = condUpper === 'USADO' ? 'USADO' : 'NUEVO';
  applyTypeAndCurrencyDefaults(normalizedRow);

  return normalizedRow;
}

/** Construye el payload para POST bulk-upload (reduce complejidad en handleUpload). */
function buildBulkPayload(parsedData: ParsedRow[]): Record<string, unknown>[] {
  return parsedData.map((row) => ({
    year: (row.year === null || row.year === undefined) ? null : Number(row.year),
    purchase_year: (row.purchase_year === null || row.purchase_year === undefined) ? null : Number(row.purchase_year),
    machine_type: row.machine_type ? String(row.machine_type).trim().toUpperCase() : null,
    brand: row.brand ?? null,
    supplier_name: row.supplier_name ?? null,
    purchase_order: row.purchase_order ?? null,
    type: row.type ?? 'COMPRA DIRECTA',
    model: row.model ?? null,
    spec: row.spec ?? null,
    description: row.spec ?? null,
    cabin_type: row.cabin_type ?? null,
    wet_line: row.wet_line ?? null,
    dozer_blade: row.dozer_blade ?? null,
    track_type: row.track_type ?? null,
    track_width: row.track_width ?? null,
    arm_type: row.arm_type ?? 'ESTANDAR',
    incoterm: row.incoterm ?? null,
    machine_location: row.machine_location ?? null,
    port_of_loading: row.port_of_loading ?? row.machine_location ?? null,
    currency: (row.currency ?? 'USD').toUpperCase(),
    value: normalizeNumeric(row.value),
    shipping_costs: normalizeNumeric(row.shipping_costs),
    finance_costs: normalizeNumeric(row.finance_costs),
    invoice_number: row.invoice_number ?? null,
    invoice_date: row.invoice_date ?? null,
    due_date: row.due_date ?? null,
    serial: row.serial ?? null,
    condition: (row.condition ?? 'NUEVO').toUpperCase() === 'USADO' ? 'USADO' : 'NUEVO',
    pvp_est: normalizeNumeric(row.pvp_est) ?? null,
  }));
}

/** Mensaje cuando la subida está bloqueada (Sin datos vs. Errores de validación). */
function getUploadBlockedMessage(parsedDataLength: number): string {
  return parsedDataLength > 0 ? 'Corrija los errores antes de subir.' : 'No hay datos para subir.';
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
        'ZX200-12345',
        'NUEVO',
        350000000,
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
      const jsonData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });

      const data: ParsedRow[] = [];
      const validationErrors: string[] = [];

      for (let idx = 0; idx < jsonData.length; idx++) {
        const row = jsonData[idx];
        const rowNum = idx + 2;
        const normalizedRow = normalizeRowFromSheetRow(row, rowNum, validationErrors);
        data.push(normalizedRow);
      }

      const hasValidationErrors = validationErrors.length > 0;
      if (hasValidationErrors) {
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
    const canUpload = parsedData.length > 0 && errors.length === 0;
    if (canUpload) {
      setIsUploading(true);
      try {
        const payload = buildBulkPayload(parsedData);
        const res = await apiPost<{ success: boolean; inserted: number; errors?: string[] }>(
          '/api/new-purchases/bulk-upload',
          { records: payload }
        );

        const uploadOk = res.success;
        if (uploadOk) {
          showSuccess(`${res.inserted} registro(s) insertado(s) correctamente.`);
          const hasPartialErrors = (res.errors?.length ?? 0) > 0;
          if (hasPartialErrors) {
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
    } else {
      showError(getUploadBlockedMessage(parsedData.length));
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
            Plantilla en formato Excel (.xlsx) con las columnas: AÑO, AÑO COMPRA, TIPO MÁQUINA, MARCA, PROVEEDOR, OC, TIPO (COMPRA DIRECTA), MODELO, SPEC, INCOTERM, UBICACIÓN Y PUERTO, MONEDA, VALOR, FLETES, FINANCE, VALOR TOTAL, FACTURA, F. FACTURA, VENCIMIENTO, SERIE, CONDICIÓN (por defecto NUEVO), PVP.
          </p>
        </div>

        <div>
          <label htmlFor="bulk-new-purchases-file" className="block text-sm font-medium text-gray-700 mb-2">
            Archivo Excel
          </label>
          <div className="flex items-center gap-4">
            <input
              id="bulk-new-purchases-file"
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
                <li key={`bulk-err-${i}-${e.substring(0, 30)}`}>• {e}</li>
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
                    <tr key={`bulk-preview-${i}-${row.serial ?? ''}-${row.model ?? ''}`} className="hover:bg-gray-50">
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
