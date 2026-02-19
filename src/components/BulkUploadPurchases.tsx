/**
 * Componente para carga masiva de compras (solo administradores)
 */

import React, { useState, useRef, useId } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader, Download } from 'lucide-react';
import { Modal } from '../molecules/Modal';
import { Button } from '../atoms/Button';
import { showSuccess, showError, showWarning } from './Toast';
import * as XLSX from 'xlsx';
import { apiPost } from '../services/api';

interface BulkUploadPurchasesProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Lista de proveedores permitidos para carga masiva
const ALLOWED_SUPPLIERS = [
  'GREEN', 'GUIA', 'HCMJ', 'JEN', 'KANEHARU', 'KIXNET', 'NORI', 'ONAGA', 'SOGO',
  'THI', 'TOZAI', 'WAKITA', 'YUMAC', 'AOI', 'NDT',
  'EUROAUCTIONS / UK', 'EUROAUCTIONS / GER',
  'RITCHIE / USA / PE USA', 'RITCHIE / CAN / PE USA',
  'ROYAL - PROXY / USA / PE USA', 'ACME / USA / PE USA',
  'GDF', 'GOSHO', 'JTF', 'KATAGIRI', 'MONJI', 'REIBRIDGE',
  'IRON PLANET / USA / PE USA', 'SHOJI',
  'YIWU ELI TRADING COMPANY / CHINA', 'E&F / USA / PE USA', 'DIESEL'
];

// Lista de monedas permitidas para carga masiva
const ALLOWED_CURRENCIES = ['JPY', 'GBP', 'EUR', 'USD', 'CAD'];

interface ParsedRow {
  supplier_name?: string;
  brand?: string;
  model?: string;
  serial?: string;
  year?: number | string;
  hours?: number | string;
  machine_type?: string;
  condition?: string;
  spec?: string;
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
  [key: string]: unknown;
}

interface BulkUploadResponse {
  success: boolean;
  inserted: number;
  duplicates?: number;
  totalProcessed?: number;
  message?: string;
  errors?: string[];
}

interface ColumnMappingRule {
  field: string;
  includeAny: string[];
  excludeAny?: string[];
}

const CURRENCY_SYMBOLS_REGEX = /[¥$€£₹₽₩₪₫₨₦₧₭₮₯₰₱₲₳₴₵₶₷₸₺₻₼₾₿]/g;

const NUMERIC_FIELDS = new Set([
  'fob_expenses', 'disassembly_load_value',
  'usd_jpy_rate', 'trm', 'trm_rate', 'ocean_usd',
  'gastos_pto_cop', 'traslados_nacionales_cop', 'ppto_reparacion_cop',
  'pvp_est', 'year', 'hours'
]);

const COLUMN_MAPPING_RULES: ColumnMappingRule[] = [
  { field: 'mq', includeAny: ['mq'] },
  { field: 'shipment_type_v2', includeAny: ['shipment'], excludeAny: ['type'] },
  { field: 'supplier_name', includeAny: ['proveedor'] },
  { field: 'model', includeAny: ['modelo'] },
  { field: 'serial', includeAny: ['serial'] },
  { field: 'invoice_date', includeAny: ['fecha factura', 'invoice_date'] },
  { field: 'location', includeAny: ['ubicación', 'location'] },
  { field: 'port_of_embarkation', includeAny: ['puerto embarque', 'port'] },
  { field: 'currency_type', includeAny: ['moneda', 'currency', 'crcy'] },
  { field: 'incoterm', includeAny: ['incoterm'] },
  { field: 'exw_value_formatted', includeAny: ['valor + bp', 'exw'] },
  { field: 'fob_expenses', includeAny: ['gastos + lavado', 'fob_expenses'] },
  { field: 'disassembly_load_value', includeAny: ['desensamblaje', 'disassembly'] },
  { field: 'usd_jpy_rate', includeAny: ['contravalor', 'usd_jpy_rate'] },
  { field: 'trm', includeAny: ['trm'] },
  { field: 'payment_date', includeAny: ['fecha de pago', 'payment_date'] },
  { field: 'shipment_departure_date', includeAny: ['etd', 'departure'] },
  { field: 'shipment_arrival_date', includeAny: ['eta', 'arrival'] },
  { field: 'sales_reported', includeAny: ['reportado ventas', 'sales_reported'] },
  { field: 'commerce_reported', includeAny: ['reportado a comercio', 'commerce_reported'] },
  { field: 'luis_lemus_reported', includeAny: ['reporte luis', 'luis_lemus'] },
  { field: 'year', includeAny: ['año', 'year'] },
  { field: 'hours', includeAny: ['horas', 'hours'] },
  { field: 'spec', includeAny: ['spec'] },
  { field: 'brand', includeAny: ['marca', 'brand'] },
  { field: 'machine_type', includeAny: ['tipo maquina', 'machine_type'] },
  { field: 'tipo', includeAny: ['tipo'], excludeAny: ['maquina'] },
  { field: 'ocean_usd', includeAny: ['ocean'] },
  { field: 'gastos_pto_cop', includeAny: ['gastos pto'] },
  { field: 'traslados_nacionales_cop', includeAny: ['traslados nacionales', 'traslados', 'trasld'] },
  { field: 'ppto_reparacion_cop', includeAny: ['reparacion', 'mant_ejec'] },
  { field: 'pvp_est', includeAny: ['pvp est', 'pvp_est'] },
];

const mapColumnToDbField = (columnName: string): string | null => {
  const normalizedColumn = columnName.toLowerCase().trim();

  // Ignorar columna calculada automáticamente.
  if (normalizedColumn.includes('valor fob') && (normalizedColumn.includes('suma') || normalizedColumn.includes('total'))) {
    return null;
  }

  const matchedRule = COLUMN_MAPPING_RULES.find((rule) => {
    const hasIncludedToken = rule.includeAny.some((token) => normalizedColumn.includes(token));
    if (!hasIncludedToken) return false;
    const hasExcludedToken = rule.excludeAny?.some((token) => normalizedColumn.includes(token)) ?? false;
    return !hasExcludedToken;
  });

  return matchedRule?.field ?? normalizedColumn;
};

const normalizeSpecValue = (value: unknown): string | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const normalizedSpec = String(value).trim();
  return normalizedSpec || undefined;
};

const parseCsvLineToRow = (headers: string[], line: string): ParsedRow => {
  const values = line.split(',').map((rawValue) => rawValue.trim());
  const row: ParsedRow = {};

  headers.forEach((header, index) => {
    const value = values[index] ?? '';
    const dbField = mapColumnToDbField(header);
    if (!dbField) return;

    if (dbField === 'spec') {
      row[dbField] = normalizeSpecValue(value);
      return;
    }

    row[dbField] = value || undefined;
  });

  return row;
};

const normalizeExcelFieldValue = (dbField: string, value: unknown): unknown => {
  if (dbField === 'exw_value_formatted') {
    if (!value) return undefined;
    const normalizedValue = normalizeNumericValue(value);
    return normalizedValue?.toString();
  }

  if (dbField === 'spec') {
    return normalizeSpecValue(value);
  }

  if (NUMERIC_FIELDS.has(dbField)) {
    return normalizeNumericValue(value) ?? undefined;
  }

  return value || undefined;
};

const parseExcelDataRow = (row: Record<string, unknown>): ParsedRow => {
  const normalizedRow: ParsedRow = {};

  Object.keys(row).forEach((key) => {
    const dbField = mapColumnToDbField(key);
    if (!dbField) return;
    normalizedRow[dbField] = normalizeExcelFieldValue(dbField, row[key]);
  });

  return normalizedRow;
};

const buildErrorKeyItems = (messages: string[]) => {
  const occurrences = new Map<string, number>();
  return messages.slice(0, 10).map((message) => {
    const count = (occurrences.get(message) ?? 0) + 1;
    occurrences.set(message, count);
    return { message, key: `${message}-${count}` };
  });
};

const buildPreviewRowItems = (rows: ParsedRow[]) => {
  const occurrences = new Map<string, number>();
  return rows.slice(0, 10).map((row, order) => {
    const baseKey = [
      row.mq,
      row.serial,
      row.model,
      row.brand,
      row.supplier_name,
      row.invoice_number,
      row.purchase_order,
      row.tipo,
      row.purchase_type
    ]
      .filter((value) => value !== null && value !== undefined && value !== '')
      .join('|') || JSON.stringify(row);

    const count = (occurrences.get(baseKey) ?? 0) + 1;
    occurrences.set(baseKey, count);

    return {
      row,
      key: `${baseKey}-${count}`,
      order,
    };
  });
};

const addValidationError = (validationErrors: string[], rowIndex: number, message: string) => {
  validationErrors.push(`Fila ${rowIndex + 2}: ${message}`);
};

const validateRequiredFields = (row: ParsedRow, rowIndex: number, validationErrors: string[]) => {
  if (row.model || row.serial) return;
  addValidationError(validationErrors, rowIndex, 'Se requiere al menos modelo o serial');
};

const validateSupplier = (row: ParsedRow, rowIndex: number, validationErrors: string[]) => {
  if (!row.supplier_name) return;

  const supplierName = String(row.supplier_name).trim();
  const isAllowed = ALLOWED_SUPPLIERS.some((allowed) => allowed.toUpperCase() === supplierName.toUpperCase());
  if (isAllowed) return;

  addValidationError(
    validationErrors,
    rowIndex,
    `Proveedor inválido "${supplierName}". Debe estar en la lista de proveedores permitidos.`
  );
};

const normalizeAndValidateCurrency = (row: ParsedRow, rowIndex: number, validationErrors: string[]) => {
  if (!row.currency_type) return;

  const currencyTypeRaw = String(row.currency_type).trim().toUpperCase();
  const currencyTypeMap: Record<string, string> = {
    'EURO': 'EUR',
    'EUR': 'EUR',
    'USD': 'USD',
    'JPY': 'JPY',
    'GBP': 'GBP',
    'CAD': 'CAD',
    'YEN': 'JPY',
    'DOLAR': 'USD',
    'DOLLAR': 'USD',
    'POUND': 'GBP',
    'LIBRA': 'GBP',
    'CANADIAN DOLLAR': 'CAD',
    'DOLLAR CANADIENSE': 'CAD'
  };

  const currencyType = currencyTypeMap[currencyTypeRaw] || currencyTypeRaw;
  if (ALLOWED_CURRENCIES.includes(currencyType)) {
    row.currency_type = currencyType;
    return;
  }

  addValidationError(
    validationErrors,
    rowIndex,
    `Moneda inválida "${row.currency_type}". Debe ser una de: ${ALLOWED_CURRENCIES.join(', ')}`
  );
};

const normalizeAndValidatePurchaseType = (row: ParsedRow, rowIndex: number, validationErrors: string[]) => {
  const tipoValue = row.tipo || row.purchase_type || '';
  if (tipoValue) {
    const normalizedTipo = tipoValue.toString().toUpperCase().trim();
    if (normalizedTipo === 'COMPRA_DIRECTA' || normalizedTipo === 'COMPRA DIRECTA' || normalizedTipo === 'DIRECTA') {
      row.tipo = 'COMPRA_DIRECTA';
      return;
    }

    if (normalizedTipo === 'SUBASTA' || normalizedTipo === 'AUCTION') {
      row.tipo = 'SUBASTA';
      return;
    }

    addValidationError(
      validationErrors,
      rowIndex,
      `Tipo inválido "${tipoValue}". Debe ser "COMPRA_DIRECTA" o "SUBASTA"`
    );
    return;
  }

  addValidationError(
    validationErrors,
    rowIndex,
    'Se requiere la columna "tipo" con valor "COMPRA_DIRECTA" o "SUBASTA"'
  );
};

const normalizeAndValidateIncoterm = (row: ParsedRow, rowIndex: number, validationErrors: string[]) => {
  if (!row.incoterm) return;

  const normalizedIncoterm = row.incoterm.toString().toUpperCase().trim();
  if (['EXY', 'FOB', 'CIF'].includes(normalizedIncoterm)) {
    row.incoterm = normalizedIncoterm;
    return;
  }

  addValidationError(
    validationErrors,
    rowIndex,
    `INCOTERM inválido "${row.incoterm}". Debe ser "EXY", "FOB" o "CIF"`
  );
};

const validateAndNormalizeParsedRow = (row: ParsedRow, rowIndex: number, validationErrors: string[]) => {
  validateRequiredFields(row, rowIndex, validationErrors);
  validateSupplier(row, rowIndex, validationErrors);
  normalizeAndValidateCurrency(row, rowIndex, validationErrors);
  normalizeAndValidatePurchaseType(row, rowIndex, validationErrors);
  normalizeAndValidateIncoterm(row, rowIndex, validationErrors);
};

/**
 * Normaliza valores numéricos eliminando signos de moneda, comas, espacios y otros caracteres
 * Ejemplos: "¥8,169,400" -> 8169400, "$ 3,873.00" -> 3873.00, "¥384,500.00" -> 384500.00
 */
const normalizeNumericValue = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // Si ya es un número, retornarlo
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }
  
  // Convertir a string y limpiar
  let cleaned = String(value).trim();
  
  // Si está vacío después de trim, retornar null
  if (cleaned === '') {
    return null;
  }
  
  // Eliminar signos de moneda comunes: ¥, $, €, £, etc.
  cleaned = cleaned.replaceAll(CURRENCY_SYMBOLS_REGEX, '');
  
  // Eliminar comas (separadores de miles)
  cleaned = cleaned.replaceAll(',', '');
  
  // Eliminar espacios
  cleaned = cleaned.replaceAll(/\s/g, '');
  
  // Mantener solo números, punto decimal y signo negativo
  cleaned = cleaned.replaceAll(/[^\d.-]/g, '');
  
  // Convertir a número
  const num = Number.parseFloat(cleaned);
  
  return Number.isNaN(num) ? null : num;
};

export const BulkUploadPurchases: React.FC<BulkUploadPurchasesProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputId = useId();

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

        const headers = lines[0].split(',').map((header) => header.trim().toLowerCase());
        data = lines
          .slice(1)
          .map((line) => parseCsvLineToRow(headers, line))
          .filter((row) => Object.values(row).some((value) => value !== undefined && value !== ''));
      } else {
        // Procesar Excel (todos los formatos: .xlsx, .xls, .xlsm, .xlsb, .xltx, .xltm)
        const arrayBuffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { 
          type: 'array',
          cellDates: true,
          cellNF: false,
          cellText: false
        });
        
        // Buscar la hoja UNION_DOE_DOP o usar la primera hoja
        const sheetName = workbook.SheetNames.find(name => 
          name.toUpperCase().includes('UNION') || 
          name.toUpperCase().includes('DOE') || 
          name.toUpperCase().includes('DOP')
        ) || workbook.SheetNames[0];
        
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { raw: false });
        data = jsonData.map((row) => parseExcelDataRow(row));
      }

      // Normalizar y validar datos
      const validationErrors: string[] = [];
      data.forEach((row, index) => {
        validateAndNormalizeParsedRow(row, index, validationErrors);
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
    // Template completo con todas las columnas del Excel UNION_DOE_DOP
    // NOTA: Se excluyen columnas calculadas automáticamente:
    // - VALOR FOB (SUMA) / FOB Total: Se calcula automáticamente como exw_value + fob_expenses + disassembly_load_value
    // - FOB (USD): Se calcula automáticamente como exw_value + fob_additional + disassembly_load
    // - CIF (USD): Se calcula automáticamente como FOB + ocean (flete)
    // - CIF Local (COP): Se calcula automáticamente como CIF (USD) * TRM
    // - Cost. Arancel (COP): Se calcula automáticamente según reglas del sistema
    const templateData = [
      // Encabezados - Mapeo de columnas del Excel a campos de BD
      [
        'MQ', 'SHIPMENT', 'PROVEEDOR', 'MODELO', 'SERIAL', 'FECHA FACTURA', 
        'UBICACIÓN MAQUINA', 'PUERTO EMBARQUE', 'MONEDA', 'INCOTERM', 'VALOR + BP', 
        'GASTOS + LAVADO', 'DESENSAMBLAJE + CARGUE', 
        'CONTRAVALOR', 'TRM', 'FECHA DE PAGO', 'ETD', 'ETA', 
        'REPORTADO VENTAS', 'REPORTADO A COMERCIO', 'REPORTE LUIS LEMUS', 
        'AÑO', 'HORAS', 'SPEC', 'CRCY', 
        'OCEAN (USD)', 'Gastos Pto (COP)', 
        'TRASLADOS NACIONALES (COP)', 'PPTO DE REPARACION (COP)', 
        'PVP Est.', 'tipo', 'MARCA', 'TIPO MAQUINA'
      ],
      // Ejemplo de registro 1 - COMPRA_DIRECTA con FOB
      [
        'MQ-001', '1X40', 'TOZAI', 'ZX200', 'ZX200-12345', '2024-01-15',
        'KOBE', 'KOBE', 'USD', 'FOB', '50000', '2000', '1500',
        '1', '4000', '2024-01-20', '2024-02-01', '2024-03-15',
        'OK', 'OK', 'OK',
        2020, 5000, 'ESTANDAR', 'USD',
        '8000', '5000000', '2000000', '3000000',
        '350000000', 'COMPRA_DIRECTA', 'HITACHI', 'EXCAVADORA'
      ],
      // Ejemplo de registro 2 - SUBASTA con EXY
      [
        'MQ-002', 'RORO', 'ONAGA', 'ZX210', 'ZX210-67890', '2024-01-16',
        'TOKYO', 'YOKOHAMA', 'JPY', 'EXY', '60000', '2500', '1800',
        '1', '3800', '2024-01-25', '2024-02-05', '2024-03-20',
        'OK', 'PDTE', 'OK',
        2021, 3000, 'LONG ARM', 'JPY',
        '9000', '6000000', '2500000', '3500000',
        '400000000', 'SUBASTA', 'HITACHI', 'EXCAVADORA'
      ]
    ];

    // Crear workbook
    const wb = XLSX.utils.book_new();
    
    // Convertir datos a worksheet
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    
    // Ajustar ancho de columnas (34 columnas después de agregar INCOTERM)
    const colWidths = new Array(34).fill({ wch: 15 }); // Todas las columnas con ancho 15
    ws['!cols'] = colWidths;
    
    // Agregar worksheet al workbook
    XLSX.utils.book_append_sheet(wb, ws, 'UNION_DOE_DOP');
    
    // Generar archivo Excel
    XLSX.writeFile(wb, 'template_carga_masiva_compras_completo.xlsx');
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
      // Preparar registros: usar tipo del archivo (requerido)
      const recordsWithType = parsedData.map(row => ({
        ...row,
        purchase_type: row.tipo || row.purchase_type
      }));

      const response = await apiPost<BulkUploadResponse>(
        '/api/purchases/bulk-upload',
        {
          records: recordsWithType
        }
      );

      if (response.success) {
        const inserted = response.inserted ?? 0;
        const duplicates = response.duplicates ?? 0;
        const uploadErrors = response.errors ?? [];
        const totalProcessed = response.totalProcessed ?? recordsWithType.length;
        const hasWarnings = duplicates > 0 || uploadErrors.length > 0;

        const summaryMessage = `Procesados: ${totalProcessed}. Insertados: ${inserted}. Duplicados omitidos: ${duplicates}. Errores: ${uploadErrors.length}.`;

        if (hasWarnings) {
          showWarning(`⚠️ Carga completada con observaciones. ${summaryMessage}`);
        } else {
          showSuccess(`✅ Carga completada exitosamente. ${summaryMessage}`);
        }

        if (uploadErrors.length > 0) {
          console.warn('Errores en carga masiva de compras:', uploadErrors);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const errorItems = buildErrorKeyItems(errors);
  const previewRows = buildPreviewRowItems(parsedData);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Carga Masiva de Compras"
      size="xl"
    >
      <div className="space-y-6">
        {/* Botón descargar template */}
        <div>
          <Button
            onClick={handleDownloadTemplate}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Descargar Template Excel
          </Button>
          <p className="mt-2 text-xs text-gray-500">
            El template incluye ejemplos de COMPRA_DIRECTA y SUBASTA. La columna "tipo" es obligatoria para cada registro.
            <br />
            <strong>Nota:</strong> Las columnas VALOR FOB (SUMA), FOB (USD), CIF (USD), CIF Local (COP) y Cost. Arancel (COP) se calculan automáticamente y no deben incluirse en el archivo.
          </p>
        </div>

        {/* Selector de archivo */}
        <div>
          <label htmlFor={fileInputId} className="block text-sm font-medium text-gray-700 mb-2">
            Archivo (CSV o Excel)
          </label>
          <div className="flex items-center gap-4">
            <input
              id={fileInputId}
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
            Formatos soportados: CSV, Excel (.xlsx, .xls, .xlsm, .xlsb, .xltx, .xltm). Las columnas deben incluir al menos: modelo, serial, marca, proveedor, tipo (COMPRA_DIRECTA o SUBASTA).
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
              {errorItems.map((item) => (
                <li key={item.key}>• {item.message}</li>
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
                  {previewRows.map((item) => (
                    <tr key={item.key} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600">{item.order + 1}</td>
                      <td className="px-3 py-2">{item.row.brand || '-'}</td>
                      <td className="px-3 py-2">{item.row.model || '-'}</td>
                      <td className="px-3 py-2">{item.row.serial || '-'}</td>
                      <td className="px-3 py-2">{item.row.supplier_name || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          (item.row.tipo || item.row.purchase_type) === 'SUBASTA' 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {item.row.tipo || item.row.purchase_type || '-'}
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
