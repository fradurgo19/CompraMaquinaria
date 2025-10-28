/**
 * Servicio de OneDrive para el Frontend
 * Maneja autenticación y operaciones con Microsoft Graph API
 */

import { apiPost, apiGet } from './api';

// Configuración de OneDrive (Microsoft Graph)
// TODO: Configurar en .env.local con credenciales de Azure AD
const ONEDRIVE_CLIENT_ID = import.meta.env.VITE_ONEDRIVE_CLIENT_ID || 'TU_CLIENT_ID_AQUI';
const ONEDRIVE_TENANT_ID = import.meta.env.VITE_ONEDRIVE_TENANT_ID || 'TU_TENANT_ID_AQUI';
const ONEDRIVE_REDIRECT_URI = import.meta.env.VITE_ONEDRIVE_REDIRECT_URI || window.location.origin;

const ONEDRIVE_SCOPES = [
  'Files.ReadWrite',
  'Files.ReadWrite.All',
  'User.Read'
].join(' ');

class OneDriveService {
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  /**
   * Iniciar autenticación con OneDrive
   */
  async authenticate(): Promise<void> {
    // Construir URL de autorización
    const authUrl = `https://login.microsoftonline.com/${ONEDRIVE_TENANT_ID}/oauth2/v2.0/authorize?` +
      `client_id=${ONEDRIVE_CLIENT_ID}&` +
      `response_type=token&` +
      `redirect_uri=${encodeURIComponent(ONEDRIVE_REDIRECT_URI)}&` +
      `scope=${encodeURIComponent(ONEDRIVE_SCOPES)}&` +
      `response_mode=fragment`;

    // Abrir ventana de autenticación
    const width = 500;
    const height = 600;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;

    const authWindow = window.open(
      authUrl,
      'OneDrive Authentication',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Esperar a que se complete la autenticación
    return new Promise((resolve, reject) => {
      const checkAuth = setInterval(() => {
        try {
          if (authWindow?.closed) {
            clearInterval(checkAuth);
            
            const token = localStorage.getItem('onedrive_token');
            const expiry = localStorage.getItem('onedrive_token_expiry');
            
            if (token && expiry) {
              this.accessToken = token;
              this.tokenExpiry = parseInt(expiry);
              resolve();
            } else {
              reject(new Error('Autenticación cancelada'));
            }
          }

          // Intentar leer el hash de la URL de la ventana
          if (authWindow?.location?.hash) {
            const params = new URLSearchParams(authWindow.location.hash.substring(1));
            const accessToken = params.get('access_token');
            const expiresIn = params.get('expires_in');

            if (accessToken) {
              this.accessToken = accessToken;
              this.tokenExpiry = Date.now() + (parseInt(expiresIn || '3600') * 1000);
              
              // Guardar en localStorage
              localStorage.setItem('onedrive_token', accessToken);
              localStorage.setItem('onedrive_token_expiry', this.tokenExpiry.toString());
              
              authWindow.close();
              clearInterval(checkAuth);
              resolve();
            }
          }
        } catch (e) {
          // Ignorar errores de CORS al leer la ventana
        }
      }, 100);

      // Timeout después de 5 minutos
      setTimeout(() => {
        clearInterval(checkAuth);
        authWindow?.close();
        reject(new Error('Tiempo de autenticación agotado'));
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Verificar si está autenticado
   */
  isAuthenticated(): boolean {
    const token = localStorage.getItem('onedrive_token');
    const expiry = localStorage.getItem('onedrive_token_expiry');
    
    if (!token || !expiry) return false;
    
    const expiryTime = parseInt(expiry);
    if (Date.now() >= expiryTime) {
      this.logout();
      return false;
    }
    
    this.accessToken = token;
    this.tokenExpiry = expiryTime;
    return true;
  }

  /**
   * Cerrar sesión de OneDrive
   */
  logout(): void {
    this.accessToken = null;
    this.tokenExpiry = null;
    localStorage.removeItem('onedrive_token');
    localStorage.removeItem('onedrive_token_expiry');
  }

  /**
   * Obtener token de acceso
   */
  getAccessToken(): string | null {
    if (!this.isAuthenticated()) return null;
    return this.accessToken;
  }

  /**
   * Crear carpeta para una máquina
   */
  async createMachineFolder(model: string, serial: string): Promise<any> {
    const token = this.getAccessToken();
    if (!token) throw new Error('No autenticado en OneDrive');

    const response = await apiPost('/api/onedrive/create-folder', {
      model,
      serial,
      accessToken: token
    });

    return response;
  }

  /**
   * Subir archivo
   */
  async uploadFile(
    model: string,
    serial: string,
    file: File,
    subfolder: 'Fotos' | 'Documentos'
  ): Promise<any> {
    const token = this.getAccessToken();
    if (!token) throw new Error('No autenticado en OneDrive');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', model);
    formData.append('serial', serial);
    formData.append('subfolder', subfolder);
    formData.append('accessToken', token);

    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/onedrive/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Error al subir archivo');
    }

    return response.json();
  }

  /**
   * Listar archivos de una máquina
   */
  async listFiles(
    model: string,
    serial: string,
    subfolder?: 'Fotos' | 'Documentos'
  ): Promise<any[]> {
    const token = this.getAccessToken();
    if (!token) throw new Error('No autenticado en OneDrive');

    const url = `/api/onedrive/files/${encodeURIComponent(model)}/${encodeURIComponent(serial)}${
      subfolder ? `?subfolder=${subfolder}` : ''
    }&accessToken=${token}`;

    const response = await apiGet<any>(url);
    return response.files || [];
  }

  /**
   * Eliminar archivo
   */
  async deleteFile(fileId: string): Promise<boolean> {
    const token = this.getAccessToken();
    if (!token) throw new Error('No autenticado en OneDrive');

    const response = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/onedrive/file/${fileId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ accessToken: token })
      }
    );

    const result = await response.json();
    return result.success || false;
  }

  /**
   * Obtener información de carpeta
   */
  async getFolderInfo(model: string, serial: string): Promise<any> {
    const token = this.getAccessToken();
    if (!token) throw new Error('No autenticado en OneDrive');

    const url = `/api/onedrive/folder/${encodeURIComponent(model)}/${encodeURIComponent(serial)}?accessToken=${token}`;
    
    const response = await apiGet<any>(url);
    return response;
  }
}

export default new OneDriveService();


