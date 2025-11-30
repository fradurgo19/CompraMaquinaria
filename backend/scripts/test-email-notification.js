/**
 * Script de prueba para verificar el funcionamiento de las notificaciones por correo
 * 
 * Uso:
 *   node backend/scripts/test-email-notification.js
 * 
 * O con un tipo específico:
 *   node backend/scripts/test-email-notification.js 1_DAY_BEFORE
 *   node backend/scripts/test-email-notification.js 3_HOURS_BEFORE
 */

import { sendAuctionUpcomingEmail, testEmailConnection } from '../services/email.service.js';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Datos de ejemplo para la prueba
const testAuctionData = {
  auction_id: '00000000-0000-0000-0000-000000000000',
  lot_number: 'LOTE-001',
  machine_model: 'ZX200LC-5B',
  machine_serial: 'ABC123456',
  machine_year: 2020,
  machine_hours: 2500,
  max_price: 45000,
  supplier_name: 'Hitachi Construction Machinery',
  colombia_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Mañana
  local_time: '18:52',
  auction_city: 'Tokio, Japón (GMT+9)',
  comments: 'Esta es una prueba del sistema de notificaciones por correo electrónico.'
};

// Obtener el tipo de notificación desde los argumentos de línea de comandos
const notificationType = process.argv[2] || '1_DAY_BEFORE';

async function testEmailNotification() {
  console.log('🧪 Iniciando prueba de notificación por correo...\n');
  
  // 1. Verificar conexión del servicio de correo
  console.log('1️⃣ Verificando conexión del servicio de correo...');
  const connectionOk = await testEmailConnection();
  
  if (!connectionOk) {
    console.error('❌ Error: No se pudo conectar al servicio de correo.');
    console.error('   Verifica las credenciales en las variables de entorno:');
    console.error('   - EMAIL_USER');
    console.error('   - EMAIL_PASS');
    process.exit(1);
  }
  
  console.log('✅ Conexión al servicio de correo verificada correctamente\n');
  
  // 2. Mostrar datos de prueba
  console.log('2️⃣ Datos de prueba:');
  console.log('   Tipo de notificación:', notificationType);
  console.log('   Lote:', testAuctionData.lot_number);
  console.log('   Modelo:', testAuctionData.machine_model);
  console.log('   Serial:', testAuctionData.machine_serial);
  console.log('   Hora Colombia:', new Date(testAuctionData.colombia_time).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'long',
    timeStyle: 'short'
  }));
  console.log('   Destinatario:', process.env.EMAIL_TO || 'analista.mantenimiento@partequipos.com');
  console.log('');
  
  // 3. Enviar correo de prueba
  console.log('3️⃣ Enviando correo de prueba...');
  try {
    const result = await sendAuctionUpcomingEmail(testAuctionData, notificationType);
    
    if (result.success) {
      console.log('✅ Correo enviado exitosamente!');
      console.log('   Message ID:', result.messageId);
      console.log('');
      console.log('📧 Revisa tu bandeja de entrada (y spam) en:');
      console.log('   ' + (process.env.EMAIL_TO || 'analista.mantenimiento@partequipos.com'));
      console.log('');
      console.log('💡 El correo debería verse con:');
      console.log('   - Encabezado con colores según el tipo de notificación');
      console.log('   - Hora de Colombia destacada');
      console.log('   - Tablas con información de la subasta y máquina');
      console.log('   - Acciones recomendadas');
    } else {
      console.error('❌ Error al enviar correo:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error inesperado:', error);
    process.exit(1);
  }
  
  console.log('\n✨ Prueba completada exitosamente!');
}

// Ejecutar la prueba
testEmailNotification().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});

