/**
 * Servicio de Almacenamiento
 * Maneja almacenamiento local (desarrollo) y Supabase Storage (producción)
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

class StorageService {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production' || process.env.SUPABASE_STORAGE_ENABLED === 'true';
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const shouldUseSupabase = this.isProduction && this.supabaseUrl && this.supabaseServiceKey;
    if (shouldUseSupabase) {
      this.initializeSupabaseClient();
      return;
    }

    this.supabase = null;
    console.log('✅ Storage Service: Usando almacenamiento local (Desarrollo)');
    if (!this.supabaseUrl) {
      console.warn('⚠️ SUPABASE_URL no configurado');
    }
    if (!this.supabaseServiceKey) {
      console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY no configurado');
    }
  }

  initializeSupabaseClient() {
    this.validateServiceRoleKey();
    this.validateServiceRoleKeyIsNotAnon();

    // Crear cliente con SERVICE_ROLE_KEY que bypassa RLS
    // IMPORTANTE: El segundo parámetro debe ser el SERVICE_ROLE_KEY (no el anon key)
    // El cliente detecta automáticamente que es SERVICE_ROLE_KEY por el formato del JWT y bypassa RLS
    this.supabase = createClient(
      this.supabaseUrl,
      this.supabaseServiceKey, // SERVICE_ROLE_KEY - esto hace que bypass RLS automáticamente
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    );

    console.log('✅ Storage Service: Usando Supabase Storage (Producción)');
    console.log('   - URL:', this.supabaseUrl);
    console.log('   - SERVICE_ROLE_KEY configurado:', this.getServiceRoleKeyStatus());
  }

  validateServiceRoleKey() {
    // IMPORTANTE: Usar SERVICE_ROLE_KEY - este cliente bypassa RLS automáticamente
    // Verificar que la clave tenga el formato correcto (debe empezar con 'eyJ' si es JWT)
    if (!this.supabaseServiceKey?.startsWith('eyJ')) {
      console.error('❌ ERROR CRÍTICO: SUPABASE_SERVICE_ROLE_KEY no tiene formato válido (debe ser un JWT que empiece con "eyJ")');
      console.error('   Valor actual empieza con:', this.supabaseServiceKey?.substring(0, 10));
      console.error('   ⚠️ Esto causará errores 403 al intentar subir archivos a Supabase Storage');
      console.error('   💡 Solución: Verifica que la variable de entorno SUPABASE_SERVICE_ROLE_KEY en Vercel esté configurada con el valor correcto');
      console.error('   💡 Puedes encontrar el SERVICE_ROLE_KEY en: Supabase Dashboard > Settings > API > service_role key');
    }
  }

  validateServiceRoleKeyIsNotAnon() {
    // Verificar que no sea el anon key por error
    if (this.supabaseServiceKey === process.env.VITE_SUPABASE_ANON_KEY || this.supabaseServiceKey === process.env.SUPABASE_ANON_KEY) {
      console.error('❌ ERROR CRÍTICO: SUPABASE_SERVICE_ROLE_KEY parece ser igual a SUPABASE_ANON_KEY');
      console.error('   ⚠️ El SERVICE_ROLE_KEY debe ser diferente del ANON_KEY');
      console.error('   ⚠️ Esto causará errores 403 al intentar subir archivos');
      console.error('   💡 Solución: Verifica que estés usando el SERVICE_ROLE_KEY, no el ANON_KEY');
    }
  }

  getServiceRoleKeyStatus() {
    if (!this.supabaseServiceKey) return 'No';
    const keyFormat = this.supabaseServiceKey.startsWith('eyJ') ? 'JWT válido' : '⚠️ FORMATO INVÁLIDO';
    return `Sí (longitud: ${this.supabaseServiceKey.length}, formato: ${keyFormat})`;
  }

  /**
   * Subir archivo a storage
   * @param {Buffer} fileBuffer - Buffer del archivo
   * @param {string} fileName - Nombre del archivo
   * @param {string} bucketName - Nombre del bucket
   * @param {string} folder - Carpeta dentro del bucket (opcional)
   * @returns {Promise<{url: string, path: string}>}
   */
  async uploadFile(fileBuffer, fileName, bucketName, folder = null) {
    if (this.isProduction && this.supabase) {
      return this.uploadToSupabase(fileBuffer, fileName, bucketName, folder);
    } else {
      return this.uploadToLocal(fileBuffer, fileName, bucketName, folder);
    }
  }

  /**
   * Subir a Supabase Storage
   */
  async uploadToSupabase(fileBuffer, fileName, bucketName, folder) {
    try {
      // Verificar que el bucket existe antes de intentar subir
      const bucketExists = await this.verifyBucketExists(bucketName);
      if (!bucketExists) {
        // Intentar crear el bucket si no existe
        await this.ensureBucketExists(bucketName);
        
        // Verificar nuevamente después de intentar crear
        const stillMissing = !(await this.verifyBucketExists(bucketName));
        if (stillMissing) {
          throw new Error(`El bucket '${bucketName}' no existe en Supabase Storage y no se pudo crear. Por favor, crea el bucket manualmente desde el Dashboard de Supabase (Storage > Create bucket) o verifica que el SERVICE_ROLE_KEY tenga permisos de administrador.`);
        }
      }

      // Construir la ruta del archivo
      const safeFileName = this.ensurePathSegment(fileName, 'fileName');
      const safeFolder = folder ? this.ensureRelativePath(folder, 'folder') : '';
      const filePath = safeFolder ? `${safeFolder}/${safeFileName}` : safeFileName;

      console.log(`📤 Intentando subir archivo a Supabase Storage: bucket=${bucketName}, path=${filePath}, size=${fileBuffer.length} bytes`);

      // Subir el archivo
      // IMPORTANTE: Con SERVICE_ROLE_KEY, el cliente debería bypassar RLS automáticamente
      // Sin embargo, si el bucket es público, debemos asegurarnos de que no haya problemas con RLS
      console.log(`🔑 Usando SERVICE_ROLE_KEY para subir archivo (bypassa RLS)`);
      
      const { error } = await this.supabase.storage
        .from(bucketName)
        .upload(filePath, fileBuffer, {
          contentType: this.getContentType(fileName),
          upsert: false,
          // No especificar cacheControl u otras opciones que puedan interferir
        });

      if (error) {
        console.error(`❌ Error de Supabase Storage al subir:`, error);
        console.error(`   - Código: ${error.statusCode || error.code || 'N/A'}`);
        console.error(`   - Mensaje: ${error.message}`);
        console.error(`   - Error object:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        
        // Si es un error 403 o "Bucket not found", proporcionar más información
        if (error.statusCode === 403 || error.code === '403' || error.message?.includes('403') || error.message?.includes('Forbidden')) {
          throw new Error(`Error de permisos (403) en Supabase Storage: ${error.message}. El bucket '${bucketName}' podría no existir o el SERVICE_ROLE_KEY no tiene permisos. Verifica: 1) Que el bucket exista en Supabase Dashboard, 2) Que SUPABASE_SERVICE_ROLE_KEY esté configurado correctamente en Vercel.`);
        }
        
        // Si es "Bucket not found" o similar
        if (error.message?.includes('Bucket not found') || error.message?.includes('does not exist') || error.code === '404' || error.statusCode === 404) {
          throw new Error(`El bucket '${bucketName}' no existe en Supabase Storage. Por favor, créalo manualmente desde el Dashboard de Supabase (Storage > Create bucket).`);
        }
        
        throw new Error(`Error subiendo a Supabase Storage: ${error.message} (Código: ${error.statusCode || error.code || 'N/A'})`);
      }

      console.log(`✅ Archivo subido exitosamente a Supabase Storage: ${filePath}`);

      // Obtener URL pública
      const { data: urlData } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      return {
        url: urlData.publicUrl,
        path: filePath
      };
    } catch (error) {
      console.error('❌ Error completo subiendo a Supabase Storage:', error);
      console.error('   Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Verificar si el bucket existe (método auxiliar)
   */
  async verifyBucketExists(bucketName) {
    if (!this.supabase) return false;
    
    try {
      const { data: buckets, error } = await this.supabase.storage.listBuckets();
      if (error) {
        console.warn(`⚠️ Error verificando existencia del bucket:`, error.message);
        return false;
      }
      return buckets && buckets.some(b => b.name === bucketName);
    } catch (error) {
      console.warn(`⚠️ Error verificando bucket:`, error.message);
      return false;
    }
  }

  async listBucketsSafe() {
    const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();

    if (listError) {
      console.error(`❌ Error listando buckets:`, listError);
      console.error(`   - Código: ${listError.statusCode || 'N/A'}`);
      console.error(`   - Mensaje: ${listError.message}`);

      // Si es un error de permisos, lanzar error más descriptivo
      if (listError.statusCode === 403 || listError.message?.includes('403') || listError.message?.includes('Forbidden')) {
        throw new Error(`Error de permisos (403) al listar buckets. Verifica que el SERVICE_ROLE_KEY tenga permisos correctos en Supabase.`);
      }

      console.warn('⚠️ Continuando a pesar del error listando buckets (el bucket podría existir)');
      return null;
    }

    return buckets;
  }

  async createBucketIfMissing(bucketName) {
    console.log(`📦 Bucket '${bucketName}' no existe. Intentando crear...`);
    console.log(`⚠️ NOTA: El bucket debería existir ya que el usuario confirmó que existe en Supabase Dashboard. Esto podría indicar un problema de permisos.`);

    // Intentar crear bucket (pero probablemente ya existe)
    // IMPORTANTE: Cuando se crea un bucket con SERVICE_ROLE_KEY, las políticas RLS no deberían aplicar
    // Pero si el bucket ya existe como público, no necesitamos recrearlo
    const { error } = await this.supabase.storage.createBucket(bucketName, {
      public: true, // Bucket público (el usuario confirmó que es público)
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf',
                        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    });

    if (!error) {
      console.log(`✅ Bucket ${bucketName} creado exitosamente`);
      return;
    }

    console.error(`❌ Error creando bucket ${bucketName}:`, error);
    console.error(`   - Código: ${error.statusCode || 'N/A'}`);
    console.error(`   - Mensaje: ${error.message}`);

    // Si el error es que el bucket ya existe, está bien (puede ser una condición de carrera)
    if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
      console.log(`ℹ️ El bucket ${bucketName} ya existe (condición de carrera)`);
      return;
    }

    // Si es un error 403, proporcionar información más detallada
    if (error.statusCode === 403 || error.message?.includes('403') || error.message?.includes('Forbidden')) {
      throw new Error(`Error de permisos (403) al crear bucket '${bucketName}'. Verifica que el SERVICE_ROLE_KEY tenga permisos de administrador en Supabase Storage.`);
    }

    // Para otros errores, solo advertir pero continuar (el bucket podría existir)
    console.warn(`⚠️ No se pudo crear el bucket ${bucketName}, pero continuando (podría existir):`, error.message);
  }

  /**
   * Obtener URL base del backend (HTTPS en producción)
   */
  getBackendBaseUrl() {
    return process.env.BACKEND_URL
      || process.env.FRONTEND_URL
      || (process.env.NODE_ENV === 'production' ? 'https://api.partequipos.com' : 'http://localhost:3000');
  }

  /**
   * Generar nombre único de archivo preservando extensión
   */
  generateUniqueFileName(originalName) {
    const fileExtension = path.extname(originalName);
    return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${fileExtension}`;
  }

  normalizePathSeparators(value) {
    return value.split('\\').join('/');
  }

  ensureDirectoryExists(dirPath) {
    if (fs.existsSync(dirPath)) return;
    try {
      fs.mkdirSync(dirPath, { recursive: true });
    } catch (error) {
      throw new Error(`No se pudo crear el directorio: ${dirPath}`, { cause: error });
    }
  }

  hasPathTraversal(value) {
    const normalized = this.normalizePathSeparators(value);
    return normalized.split('/').includes('..');
  }

  ensurePathSegment(value, label) {
    if (!value) {
      throw new Error(`${label} inválido`);
    }
    if (value.includes('/') || value.includes('\\') || this.hasPathTraversal(value)) {
      throw new Error(`Ruta inválida en ${label}`);
    }
    return value;
  }

  ensureRelativePath(value, label) {
    if (!value) return '';
    const normalized = this.normalizePathSeparators(value);
    if (normalized.startsWith('/') || this.hasPathTraversal(normalized)) {
      throw new Error(`Ruta inválida en ${label}`);
    }
    return normalized;
  }

  /**
   * Subir a almacenamiento local
   */
  async uploadToLocal(fileBuffer, fileName, bucketName, folder) {
    try {
      const safeBucket = this.ensurePathSegment(bucketName, 'bucketName');
      const safeFileName = this.ensurePathSegment(fileName, 'fileName');
      const safeFolder = folder ? this.ensureRelativePath(folder, 'folder') : '';

      // Crear directorio si no existe
      const baseDir = path.join(process.cwd(), 'storage', safeBucket);
      const uploadDir = safeFolder ? path.join(baseDir, safeFolder) : baseDir;
      
      this.ensureDirectoryExists(uploadDir);

      // Guardar archivo
      const filePath = path.join(uploadDir, safeFileName);
      const resolvedPath = path.resolve(filePath);
      const baseDirResolved = path.resolve(baseDir);
      if (!resolvedPath.startsWith(`${baseDirResolved}${path.sep}`)) {
        throw new Error('Ruta inválida para escritura');
      }
      fs.writeFileSync(resolvedPath, fileBuffer);

      // Construir ruta relativa (sin el bucket, solo la ruta dentro del bucket)
      const relativePath = safeFolder ? `${safeFolder}/${safeFileName}` : safeFileName;
      
      // Construir URL pública (HTTPS en producción, HTTP solo en desarrollo local)
      const backendUrl = this.getBackendBaseUrl();
      const url = `${backendUrl}/${safeBucket}/${relativePath}`;

      return {
        url,
        path: relativePath
      };
    } catch (error) {
      console.error('Error subiendo a almacenamiento local:', error);
      throw error;
    }
  }

  /**
   * Eliminar archivo de storage
   */
  async deleteFile(bucketName, filePath) {
    if (this.isProduction && this.supabase) {
      const { error } = await this.supabase.storage
        .from(bucketName)
        .remove([filePath]);
      
      if (error) {
        throw new Error(`Error eliminando de Supabase Storage: ${error.message}`);
      }
    } else {
      const safeBucket = this.ensurePathSegment(bucketName, 'bucketName');
      const safeFilePath = this.ensureRelativePath(filePath, 'filePath');
      const fullPath = path.join(process.cwd(), 'storage', safeBucket, safeFilePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
  }

  /**
   * Asegurar que el bucket existe en Supabase
   */
  async ensureBucketExists(bucketName) {
    if (!this.supabase) {
      console.warn('⚠️ Cliente de Supabase no inicializado para verificar bucket');
      return;
    }

    try {
      console.log(`🔍 Verificando existencia del bucket: ${bucketName}`);
      
      const buckets = await this.listBucketsSafe();
      if (!buckets) return;

      const bucketExists = buckets.some((b) => b.name === bucketName);
      if (bucketExists) {
        console.log(`✅ Bucket ${bucketName} existe`);
        return;
      }

      await this.createBucketIfMissing(bucketName);
    } catch (error) {
      console.error(`❌ Error crítico verificando bucket ${bucketName}:`, error);
      // Si es un error de permisos, relanzar para que se maneje arriba
      if (error.message?.includes('403') || error.message?.includes('Forbidden') || error.message?.includes('permisos')) {
        throw error;
      }
      // Para otros errores, solo advertir
      console.warn(`⚠️ Continuando a pesar del error verificando bucket (podría existir):`, error.message);
    }
  }

  /**
   * Obtener tipo de contenido basado en extensión
   */
  getContentType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Obtener URL pública de un archivo
   */
  getPublicUrl(bucketName, filePath) {
    if (this.isProduction && this.supabase) {
      const { data } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);
      return data.publicUrl;
    } else {
      const backendUrl = this.getBackendBaseUrl();
      return `${backendUrl}/${bucketName}/${filePath}`;
    }
  }

  /**
   * Obtener URL firmada (signed URL) de un archivo
   * Útil para buckets privados
   * @param {string} bucketName - Nombre del bucket
   * @param {string} filePath - Ruta del archivo
   * @param {number} expiresIn - Segundos hasta que expire (default: 1 hora)
   * @returns {Promise<string>} URL firmada
   */
  async getSignedUrl(bucketName, filePath, expiresIn = 3600) {
    if (this.isProduction && this.supabase) {
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, expiresIn);
      
      if (error) {
        throw new Error(`Error creando URL firmada: ${error.message}`);
      }
      
      return data.signedUrl;
    } else {
      const backendUrl = this.getBackendBaseUrl();
      return `${backendUrl}/${bucketName}/${filePath}`;
    }
  }
}

// Singleton instance
export const storageService = new StorageService();
export default storageService;

