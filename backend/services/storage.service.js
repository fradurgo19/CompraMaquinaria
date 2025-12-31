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
      this.supabase = createClient(this.supabaseUrl, this.supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      console.log('✅ Storage Service: Usando Supabase Storage (Producción)');
    } else {
      this.supabase = null;
      console.log('✅ Storage Service: Usando almacenamiento local (Desarrollo)');
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

      // Subir el archivo
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .upload(filePath, fileBuffer, {
          contentType: this.getContentType(fileName),
          upsert: false
        });

      if (error) {
        throw new Error(`Error subiendo a Supabase Storage: ${error.message}`);
      }

      // Obtener URL pública
      const { data: urlData } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      return {
        url: urlData.publicUrl,
        path: filePath
      };
    } catch (error) {
      console.error('Error subiendo a Supabase Storage:', error);
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
    if (!this.supabase) return;

    try {
      // Verificar si el bucket existe
      const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();
      
      if (listError) {
        console.warn('⚠️ Error listando buckets:', listError.message);
        return;
      }

      const bucketExists = buckets.some(b => b.name === bucketName);

      if (!bucketExists) {
        // Crear bucket
        const { data, error } = await this.supabase.storage.createBucket(bucketName, {
          public: false, // Buckets privados por defecto
          fileSizeLimit: 52428800, // 50MB
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 
                            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
        });

        if (error) {
          console.warn(`⚠️ Error creando bucket ${bucketName}:`, error.message);
          // No lanzar error, el bucket podría ya existir o no tener permisos
        } else {
          console.log(`✅ Bucket ${bucketName} creado exitosamente`);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error verificando bucket ${bucketName}:`, error.message);
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

