/**
 * Cliente API para el backend
 * En producción usa VITE_API_URL (configurado en Vercel)
 * En desarrollo local usa http://localhost:3000
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Helper para hacer peticiones autenticadas
 */
export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem('token');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    console.warn('⚠️ No se encontró token en localStorage para la petición:', endpoint);
  }

  try {
    // Crear AbortController para timeout si no se proporciona uno
    let controller: AbortController | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    
    if (!options.signal && typeof AbortController !== 'undefined') {
      controller = new AbortController();
      timeoutId = setTimeout(() => controller!.abort(), 120000); // 120 segundos timeout
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      signal: options.signal || controller?.signal,
    });

    if (timeoutId) clearTimeout(timeoutId);

    return response;
  } catch (error: any) {
    // Manejar errores de red o timeout
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error('La petición tardó demasiado. Por favor, intenta de nuevo.');
    }
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      throw new Error('Error de conexión. Verifica tu conexión a internet.');
    }
    throw error;
  }
}

/**
 * GET request
 */
export async function apiGet<T>(endpoint: string): Promise<T> {
  const response = await apiRequest(endpoint);
  
  if (!response.ok) {
    let errorMessage = 'Error en la petición';
    try {
      const error = await response.json();
      errorMessage = error.error || error.details || error.message || errorMessage;
    } catch {
      // Si no se puede parsear el JSON, usar el status text
      errorMessage = response.statusText || `Error ${response.status}`;
    }
    
    // Manejar errores específicos
    // Solo redirigir a login si es 401 (no autenticado), no 403 (no autorizado)
    // El 403 significa que el usuario está autenticado pero no tiene permisos para esa acción específica
    if (response.status === 401) {
      localStorage.removeItem('token');
      // Usar window.location solo si no estamos ya en la página de login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
    }
    
    // Para 403, solo lanzar error sin redirigir (el usuario está autenticado, solo falta permiso)
    if (response.status === 403) {
      throw new Error(errorMessage || 'No tienes permisos para realizar esta acción.');
    }
    
    throw new Error(errorMessage);
  }
  
  return response.json();
}

/**
 * POST request
 */
export async function apiPost<T>(
  endpoint: string,
  data: any
): Promise<T> {
  const response = await apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    let errorMessage = 'Error en la petición';
    try {
      const error = await response.json();
      errorMessage = error.error || error.details || error.message || errorMessage;
    } catch {
      errorMessage = response.statusText || `Error ${response.status}`;
    }
    
    // Solo redirigir a login si es 401 (no autenticado), no 403 (no autorizado)
    if (response.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
    }
    
    // Para 403, solo lanzar error sin redirigir
    if (response.status === 403) {
      throw new Error(errorMessage || 'No tienes permisos para realizar esta acción.');
    }
    
    throw new Error(errorMessage);
  }
  
  return response.json();
}

/**
 * PUT request
 */
export async function apiPut<T>(
  endpoint: string,
  data: any
): Promise<T> {
  const response = await apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    let errorMessage = 'Error en la petición';
    try {
      const error = await response.json();
      errorMessage = error.error || error.details || error.message || errorMessage;
    } catch {
      errorMessage = response.statusText || `Error ${response.status}`;
    }
    
    // Solo redirigir a login si es 401 (no autenticado)
    if (response.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
    }
    
    // Para 403, solo lanzar error sin redirigir
    if (response.status === 403) {
      throw new Error(errorMessage || 'No tienes permisos para realizar esta acción.');
    }
    
    throw new Error(errorMessage);
  }
  
  return response.json();
}

/**
 * PATCH request
 */
export async function apiPatch<T>(
  endpoint: string,
  data: any
): Promise<T> {
  const response = await apiRequest(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    let errorMessage = 'Error en la petición';
    try {
      const error = await response.json();
      errorMessage = error.error || error.details || error.message || errorMessage;
    } catch {
      errorMessage = response.statusText || `Error ${response.status}`;
    }
    
    // Solo redirigir a login si es 401 (no autenticado)
    if (response.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
    }
    
    // Para 403, solo lanzar error sin redirigir
    if (response.status === 403) {
      throw new Error(errorMessage || 'No tienes permisos para realizar esta acción.');
    }
    
    throw new Error(errorMessage);
  }
  
  return response.json();
}

/**
 * DELETE request
 */
export async function apiDelete(endpoint: string): Promise<void> {
  const response = await apiRequest(endpoint, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    let errorMessage = 'Error en la petición';
    try {
      const error = await response.json();
      errorMessage = error.error || error.details || error.message || errorMessage;
    } catch {
      errorMessage = response.statusText || `Error ${response.status}`;
    }
    
    // Solo redirigir a login si es 401 (no autenticado)
    if (response.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
    }
    
    // Para 403, solo lanzar error sin redirigir
    if (response.status === 403) {
      throw new Error(errorMessage || 'No tienes permisos para realizar esta acción.');
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Upload file (FormData)
 */
export async function apiUpload<T>(endpoint: string, formData: FormData): Promise<T> {
  const token = localStorage.getItem('token');
  
  const headers: HeadersInit = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    // Crear AbortController para timeout
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 120000) : null; // 120 segundos

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers, // NO incluir Content-Type - el navegador lo pone automáticamente para FormData
      body: formData,
      signal: controller?.signal,
    });

    if (timeoutId) clearTimeout(timeoutId);
    
    if (!response.ok) {
      let errorMessage = 'Error al subir archivo';
      try {
        const error = await response.json();
        errorMessage = error.error || error.details || error.message || errorMessage;
        
        // Mensaje específico para timeout
        if (response.status === 504 || errorMessage.includes('timeout') || errorMessage.includes('Gateway')) {
          errorMessage = 'El archivo es muy grande o el servidor tardó demasiado. Intenta con un archivo más pequeño o divide el archivo en partes.';
        }
        
        // Mensaje específico para MaxClients
        if (errorMessage.includes('MaxClients') || errorMessage.includes('max clients')) {
          errorMessage = 'El servidor está ocupado. Por favor, espera unos momentos e intenta de nuevo con un archivo más pequeño.';
        }
      } catch {
        // Si no se puede parsear el JSON, usar el status text
        if (response.status === 504) {
          errorMessage = 'El servidor tardó demasiado en responder. Intenta con un archivo más pequeño.';
        } else {
          errorMessage = response.statusText || `Error ${response.status}`;
        }
      }
      
      throw new Error(errorMessage);
    }
    
    return response.json();
  } catch (error: any) {
    // Manejar errores de red o timeout
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error('La subida del archivo tardó demasiado. Por favor, intenta con un archivo más pequeño.');
    }
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      throw new Error('Error de conexión. Verifica tu conexión a internet.');
    }
    throw error;
  }
}

export { API_URL };

