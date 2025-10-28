/**
 * Servicio de integración con OneDrive
 * Gestiona carpetas y archivos de máquinas en OneDrive
 */

import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

class OneDriveService {
  constructor() {
    this.accessToken = null;
    this.baseFolder = 'MaquinariaUsada'; // Carpeta raíz en OneDrive
  }

  /**
   * Inicializar cliente de Graph API con token de acceso
   */
  getClient(accessToken) {
    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      }
    });
  }

  /**
   * Crear carpeta raíz si no existe
   */
  async ensureBaseFolderExists(accessToken) {
    const client = this.getClient(accessToken);
    
    try {
      // Intentar obtener la carpeta
      await client.api(`/me/drive/root:/${this.baseFolder}`).get();
      console.log('✓ Carpeta base existe:', this.baseFolder);
    } catch (error) {
      if (error.statusCode === 404) {
        // Crear carpeta base
        const folder = {
          name: this.baseFolder,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename'
        };
        
        await client.api('/me/drive/root/children').post(folder);
        console.log('✓ Carpeta base creada:', this.baseFolder);
      } else {
        throw error;
      }
    }
  }

  /**
   * Crear carpeta para una máquina específica
   * Formato: "Modelo - Serial"
   */
  async createMachineFolder(accessToken, model, serial) {
    const client = this.getClient(accessToken);
    await this.ensureBaseFolderExists(accessToken);

    const folderName = `${model} - ${serial}`;
    const folderPath = `/${this.baseFolder}/${folderName}`;

    try {
      // Verificar si ya existe
      const existing = await client.api(`/me/drive/root:${folderPath}`).get();
      console.log('✓ Carpeta ya existe:', folderName);
      return existing;
    } catch (error) {
      if (error.statusCode === 404) {
        // Crear carpeta
        const folder = {
          name: folderName,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename'
        };

        const newFolder = await client.api(`/me/drive/root:/${this.baseFolder}:/children`).post(folder);
        console.log('✓ Carpeta creada:', folderName);

        // Crear subcarpetas: Fotos y Documentos
        await this.createSubfolders(accessToken, newFolder.id);
        
        return newFolder;
      }
      throw error;
    }
  }

  /**
   * Crear subcarpetas: Fotos y Documentos
   */
  async createSubfolders(accessToken, parentFolderId) {
    const client = this.getClient(accessToken);
    
    const subfolders = ['Fotos', 'Documentos'];
    
    for (const subfolder of subfolders) {
      const folder = {
        name: subfolder,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'skip'
      };
      
      await client.api(`/me/drive/items/${parentFolderId}/children`).post(folder);
    }
    
    console.log('✓ Subcarpetas creadas: Fotos, Documentos');
  }

  /**
   * Subir archivo a OneDrive
   */
  async uploadFile(accessToken, folderPath, fileName, fileBuffer, mimeType) {
    const client = this.getClient(accessToken);
    
    try {
      const uploadPath = `/me/drive/root:${folderPath}/${fileName}:/content`;
      
      const file = await client
        .api(uploadPath)
        .header('Content-Type', mimeType)
        .put(fileBuffer);
      
      console.log('✓ Archivo subido:', fileName);
      return file;
    } catch (error) {
      console.error('Error subiendo archivo:', error);
      throw error;
    }
  }

  /**
   * Listar archivos de una carpeta
   */
  async listFiles(accessToken, folderPath) {
    const client = this.getClient(accessToken);
    
    try {
      const result = await client
        .api(`/me/drive/root:${folderPath}:/children`)
        .select('id,name,size,createdDateTime,webUrl,file,folder,@microsoft.graph.downloadUrl')
        .get();
      
      return result.value || [];
    } catch (error) {
      console.error('Error listando archivos:', error);
      return [];
    }
  }

  /**
   * Obtener carpeta de una máquina
   */
  async getMachineFolder(accessToken, model, serial) {
    const client = this.getClient(accessToken);
    const folderName = `${model} - ${serial}`;
    const folderPath = `/${this.baseFolder}/${folderName}`;

    try {
      const folder = await client.api(`/me/drive/root:${folderPath}`).get();
      return folder;
    } catch (error) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Eliminar archivo
   */
  async deleteFile(accessToken, fileId) {
    const client = this.getClient(accessToken);
    
    try {
      await client.api(`/me/drive/items/${fileId}`).delete();
      console.log('✓ Archivo eliminado:', fileId);
      return true;
    } catch (error) {
      console.error('Error eliminando archivo:', error);
      return false;
    }
  }

  /**
   * Buscar carpetas de máquinas
   */
  async searchMachineFolders(accessToken, searchTerm) {
    const client = this.getClient(accessToken);
    
    try {
      const result = await client
        .api(`/me/drive/root:/${this.baseFolder}:/children`)
        .select('id,name,webUrl,createdDateTime,folder')
        .filter(`folder ne null and contains(name, '${searchTerm}')`)
        .get();
      
      return result.value || [];
    } catch (error) {
      console.error('Error buscando carpetas:', error);
      return [];
    }
  }

  /**
   * Obtener URL para compartir un archivo
   */
  async getShareLink(accessToken, fileId) {
    const client = this.getClient(accessToken);
    
    try {
      const permission = await client
        .api(`/me/drive/items/${fileId}/createLink`)
        .post({
          type: 'view',
          scope: 'organization'
        });
      
      return permission.link.webUrl;
    } catch (error) {
      console.error('Error creando link:', error);
      return null;
    }
  }
}

export default new OneDriveService();

