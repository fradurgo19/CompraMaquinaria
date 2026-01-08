/**
 * Script para exportar todas las compras desde el navegador
 * 
 * INSTRUCCIONES:
 * 1. Abre la aplicación en tu navegador (debes estar autenticado)
 * 2. Abre la consola del navegador (F12 -> Console)
 * 3. Copia y pega este script completo
 * 4. El archivo CSV se descargará automáticamente
 */

// Obtener token del localStorage
const token = localStorage.getItem('token') || localStorage.getItem('authToken');

if (!token) {
  console.error('❌ No se encontró token de autenticación. Debes estar autenticado.');
  alert('❌ Debes estar autenticado para exportar las compras');
} else {
  console.log('📥 Exportando todas las compras...');
  
  // Llamar al endpoint de exportación
  fetch('/api/purchases/export', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.blob();
  })
  .then(blob => {
    // Crear URL temporal para descarga
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Nombre del archivo con timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    a.download = `compras_export_${timestamp}.csv`;
    
    // Descargar
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Limpiar URL temporal
    URL.revokeObjectURL(url);
    
    console.log('✅ Exportación completada! El archivo se descargó automáticamente.');
    alert('✅ Exportación completada! Revisa tus descargas.');
  })
  .catch(error => {
    console.error('❌ Error al exportar:', error);
    alert(`❌ Error al exportar: ${error.message}`);
  });
}
