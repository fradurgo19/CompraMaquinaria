/**
 * Servicio de Almacenamiento
 * Maneja almacenamiento local (desarrollo) y Supabase Storage (producción)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

class StorageService {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production' || process.env.SUPABASE_STORAGE_ENABLED === 'true';
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (this.isProduction && this.supabaseUrl && this.supabaseServiceKey) {
      // IMPORTANTE: Usar SERVICE_ROLE_KEY - este cliente bypassa RLS automáticamente
      // No usar headers adicionales, el cliente de Supabase maneja esto internamente
      this.supabase = createClient(this.supabaseUrl, this.supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      });
      console.log('✅ Storage Service: Usando Supabase Storage (Producción)');
      console.log('   - URL:', this.supabaseUrl);
      console.log('   - SERVICE_ROLE_KEY configurado:', this.supabaseServiceKey ? 'Sí (longitud: ' + this.supabaseServiceKey.length + ')' : 'No');
    } else {
      this.supabase = null;
      console.log('✅ Storage Service: Usando almacenamiento local (Desarrollo)');
      if (!this.supabaseUrl) {
        console.warn('⚠️ SUPABASE_URL no configurado');
      }
      if (!this.supabaseServiceKey) {
        console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY no configurado');
      }
    }
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
      // Asegurar que el bucket existe
      await this.ensureBucketExists(bucketName);

      // Construir la ruta del archivo
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      console.log(`📤 Intentando subir archivo a Supabase Storage: bucket=${bucketName}, path=${filePath}`);

      // Subir el archivo
      // IMPORTANTE: Con SERVICE_ROLE_KEY, el cliente debería bypassar RLS automáticamente
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .upload(filePath, fileBuffer, {
          contentType: this.getContentType(fileName),
          upsert: false,
          // No pasar ningún parámetro de autenticación adicional, el SERVICE_ROLE_KEY ya está en el cliente
        });

      if (error) {
        console.error(`❌ Error de Supabase Storage:`, error);
        console.error(`   - Código: ${error.statusCode || 'N/A'}`);
        console.error(`   - Mensaje: ${error.message}`);
        console.error(`   - Error object:`, JSON.stringify(error, null, 2));
        
        // Si es un error 403, proporcionar más información
        if (error.statusCode === 403 || error.message?.includes('403') || error.message?.includes('Forbidden')) {
          throw new Error(`Error de permisos (403) en Supabase Storage: ${error.message}. Verifica que el bucket '${bucketName}' exista y que el SERVICE_ROLE_KEY tenga permisos correctos.`);
        }
        
        throw new Error(`Error subiendo a Supabase Storage: ${error.message} (Status: ${error.statusCode || 'N/A'})`);
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
   * Subir a almacenamiento local
   */
  async uploadToLocal(fileBuffer, fileName, bucketName, folder) {
    try {
      // Crear directorio si no existe
      const baseDir = path.join(process.cwd(), 'storage', bucketName);
      const uploadDir = folder ? path.join(baseDir, folder) : baseDir;
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Guardar archivo
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, fileBuffer);

      // Construir ruta relativa (sin el bucket, solo la ruta dentro del bucket)
      const relativePath = folder ? `${folder}/${fileName}` : fileName;
      
      // Construir URL pública
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
      const url = `${backendUrl}/${bucketName}/${relativePath}`;

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
      const fullPath = path.join(process.cwd(), 'storage', bucketName, filePath);
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
      
      // Verificar si el bucket existe
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
        return;
      }

      const bucketExists = buckets && buckets.some(b => b.name === bucketName);

      if (!bucketExists) {
        console.log(`📦 Bucket '${bucketName}' no existe. Intentando crear...`);
        
        // Crear bucket
        // IMPORTANTE: Cuando se crea un bucket con SERVICE_ROLE_KEY, las políticas RLS no deberían aplicar
        // Pero el bucket puede tener políticas que bloqueen operaciones posteriores
        const { data, error } = await this.supabase.storage.createBucket(bucketName, {
          public: false, // Buckets privados por defecto (se accede con URLs firmadas)
          fileSizeLimit: 52428800, // 50MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 
                            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
        });

        if (error) {
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
        } else {
          console.log(`✅ Bucket ${bucketName} creado exitosamente`);
        }
      } else {
        console.log(`✅ Bucket ${bucketName} existe`);
      }
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
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
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
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
      return `${backendUrl}/${bucketName}/${filePath}`;
    }
  }
}

// Singleton instance
export const storageService = new StorageService();
export default storageService;

