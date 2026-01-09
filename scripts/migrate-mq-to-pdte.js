/**
 * Script para migrar MQ de formato MQ-* a PDTE-{número}
 * 
 * Uso:
 * 1. Obtén tu token de autenticación desde el navegador (localStorage.getItem('token'))
 * 2. Ejecuta: node scripts/migrate-mq-to-pdte.js YOUR_TOKEN
 */

const API_URL = process.env.API_URL || 'https://compra-maquinaria.vercel.app';

async function migrateMQ() {
  const token = process.argv[2];
  
  if (!token) {
    console.error('❌ Error: Debes proporcionar el token de autenticación');
    console.log('\nUso: node scripts/migrate-mq-to-pdte.js YOUR_TOKEN');
    console.log('\nPara obtener tu token:');
    console.log('1. Abre la aplicación en el navegador');
    console.log('2. Abre la consola (F12)');
    console.log('3. Ejecuta: localStorage.getItem("token")');
    console.log('4. Copia el token y úsalo como argumento\n');
    process.exit(1);
  }

  try {
    console.log('🔄 Iniciando migración de MQ a PDTE...\n');
    
    const response = await fetch(`${API_URL}/api/purchases/migrate-mq-to-pdte`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Error desconocido');
    }

    console.log('✅ Migración completada exitosamente!');
    console.log(`📊 Total migrado: ${data.migrated?.length || 0} registros\n`);
    
    if (data.migrated && data.migrated.length > 0) {
      console.log('Primeros registros migrados:');
      data.migrated.slice(0, 10).forEach((migration, index) => {
        console.log(`  ${index + 1}. ${migration.old_mq} → ${migration.new_mq}`);
      });
      if (data.migrated.length > 10) {
        console.log(`  ... y ${data.migrated.length - 10} más`);
      }
    } else {
      console.log('ℹ️ No se encontraron registros con formato MQ-* para migrar');
    }

  } catch (error) {
    console.error('❌ Error durante la migración:', error.message);
    if (error.message.includes('401') || error.message.includes('No autorizado')) {
      console.log('\n💡 Sugerencia: Verifica que tu token sea válido y que tengas rol "eliana"');
    } else if (error.message.includes('403') || error.message.includes('Prohibido')) {
      console.log('\n💡 Sugerencia: Tu usuario debe tener rol "eliana" para ejecutar esta migración');
    }
    process.exit(1);
  }
}

migrateMQ();
