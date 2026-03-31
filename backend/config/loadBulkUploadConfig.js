/**
 * Carga configuración única de carga masiva (shared/bulkUploadConfig.json).
 * Desplegar la carpeta `shared` junto al backend para que exista el archivo.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(__dirname, '../../shared/bulkUploadConfig.json');

const raw = JSON.parse(readFileSync(jsonPath, 'utf8'));

if (!Array.isArray(raw.allowedSuppliers) || !Array.isArray(raw.recognizedModels)) {
  throw new Error(
    'bulkUploadConfig.json inválido: se requieren las propiedades allowedSuppliers y recognizedModels (arrays de strings).'
  );
}

/** @type {readonly string[]} */
export const BULK_UPLOAD_ALLOWED_SUPPLIERS = raw.allowedSuppliers;

// recognizedModels: referencia única en JSON para documentación / validación futura en API; no se usa en selects del frontend.
