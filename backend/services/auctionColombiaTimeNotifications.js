/**
 * Servicio de Notificaciones de Subastas basado en Hora de Colombia
 * Envía recordatorios automáticos:
 * - 1 día antes (24 horas antes de la hora de Colombia)
 * - 3 horas antes de la hora de Colombia
 */

import { pool } from '../db/connection.js';
import { sendAuctionUpcomingEmail } from './email.service.js';
import cron from 'node-cron';

const COLOMBIA_TIMEZONE = 'America/Bogota';

/**
 * Obtiene las subastas que necesitan notificación
 * @param {string} notificationType - '1_DAY_BEFORE' o '3_HOURS_BEFORE'
 */
export const getAuctionsNeedingNotification = async (notificationType) => {
  try {
    const now = new Date();
    const nowColombia = new Date(now.toLocaleString('en-US', { timeZone: COLOMBIA_TIMEZONE }));
    
    let targetTime;
    if (notificationType === '1_DAY_BEFORE') {
      // 24 horas antes
      targetTime = new Date(nowColombia);
      targetTime.setHours(targetTime.getHours() + 24);
    } else if (notificationType === '3_HOURS_BEFORE') {
      // 3 horas antes
      targetTime = new Date(nowColombia);
      targetTime.setHours(targetTime.getHours() + 3);
    } else {
      throw new Error('Tipo de notificación inválido');
    }

    // Rango de tiempo: ±30 minutos para permitir ejecución del cron
    const timeWindowStart = new Date(targetTime);
    timeWindowStart.setMinutes(timeWindowStart.getMinutes() - 30);
    
    const timeWindowEnd = new Date(targetTime);
    timeWindowEnd.setMinutes(timeWindowEnd.getMinutes() + 30);

    console.log(`🔍 Buscando subastas para notificación ${notificationType}:`);
    console.log(`   Ventana: ${timeWindowStart.toISOString()} - ${timeWindowEnd.toISOString()}`);

    const result = await pool.query(`
      SELECT 
        a.id as auction_id,
        a.date::date as auction_date,
        a.lot as lot_number,
        a.price_max as max_price,
        a.status,
        a.comments,
        m.brand,
        m.model,
        m.serial,
        m.year,
        m.hours,
        p.colombia_time,
        p.local_time,
        p.auction_city,
        COALESCE(p.supplier_name, a.supplier_id::text) as supplier_name
      FROM auctions a
      LEFT JOIN machines m ON a.machine_id = m.id
      LEFT JOIN preselections p ON p.auction_id = a.id
      WHERE a.status = 'PENDIENTE'
        AND p.colombia_time IS NOT NULL
        AND p.colombia_time >= $1::timestamptz
        AND p.colombia_time <= $2::timestamptz
        AND NOT EXISTS (
          SELECT 1 FROM auction_notification_sent ans
          WHERE ans.auction_id = a.id
            AND ans.notification_type = $3
        )
      ORDER BY p.colombia_time ASC
    `, [timeWindowStart.toISOString(), timeWindowEnd.toISOString(), notificationType]);

    console.log(`📊 Encontradas ${result.rows.length} subasta(s) que necesitan notificación ${notificationType}`);

    return result.rows;
  } catch (error) {
    console.error(`❌ Error al obtener subastas para notificación ${notificationType}:`, error);
    throw error;
  }
};

/**
 * Envía notificaciones para un tipo específico
 */
export const sendNotificationsForType = async (notificationType) => {
  try {
    const auctions = await getAuctionsNeedingNotification(notificationType);
    
    if (auctions.length === 0) {
      console.log(`ℹ️ No hay subastas que necesiten notificación ${notificationType}`);
      return { success: true, sent: 0 };
    }

    let sentCount = 0;
    let errorCount = 0;

    for (const auction of auctions) {
      try {
        const emailResult = await sendAuctionUpcomingEmail({
          auction_id: auction.auction_id,
          lot_number: auction.lot_number,
          machine_model: auction.model,
          machine_serial: auction.serial,
          machine_year: auction.year,
          machine_hours: auction.hours,
          max_price: auction.max_price,
          supplier_name: auction.supplier_name,
          colombia_time: auction.colombia_time,
          local_time: auction.local_time,
          auction_city: auction.auction_city,
          comments: auction.comments
        }, notificationType);

        if (emailResult.success) {
          // Registrar que se envió la notificación
          await pool.query(`
            INSERT INTO auction_notification_sent (auction_id, notification_type, email_message_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (auction_id, notification_type) DO UPDATE
            SET sent_at = NOW(), email_message_id = EXCLUDED.email_message_id
          `, [auction.auction_id, notificationType, emailResult.messageId]);

          sentCount++;
          console.log(`✅ Notificación ${notificationType} enviada para subasta ${auction.lot_number}`);
        } else {
          errorCount++;
          console.error(`❌ Error enviando notificación ${notificationType} para subasta ${auction.lot_number}:`, emailResult.error);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error procesando subasta ${auction.lot_number}:`, error);
      }
    }

    return {
      success: true,
      sent: sentCount,
      errors: errorCount,
      total: auctions.length
    };
  } catch (error) {
    console.error(`❌ Error en sendNotificationsForType (${notificationType}):`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Procesa todas las notificaciones pendientes
 */
export const processAllNotifications = async () => {
  console.log('⏰ Procesando notificaciones de subastas basadas en hora de Colombia...');
  
  const results = {
    oneDayBefore: { success: false, sent: 0, errors: 0 },
    threeHoursBefore: { success: false, sent: 0, errors: 0 }
  };

  try {
    // Notificación 1 día antes
    const oneDayResult = await sendNotificationsForType('1_DAY_BEFORE');
    results.oneDayBefore = oneDayResult;

    // Notificación 3 horas antes
    const threeHoursResult = await sendNotificationsForType('3_HOURS_BEFORE');
    results.threeHoursBefore = threeHoursResult;

    console.log('✅ Procesamiento de notificaciones completado:', results);
    return results;
  } catch (error) {
    console.error('❌ Error procesando notificaciones:', error);
    return results;
  }
};

/**
 * Inicia el cron job para verificar notificaciones
 * Se ejecuta cada 15 minutos para asegurar que se envíen en el momento correcto
 */
export const startColombiaTimeNotificationCron = () => {
  // Ejecutar cada 15 minutos
  cron.schedule('*/15 * * * *', async () => {
    console.log('⏰ [CRON] Verificando notificaciones de subastas (hora Colombia)...');
    await processAllNotifications();
  }, {
    timezone: COLOMBIA_TIMEZONE
  });

  // También ejecutar al iniciar el servidor (después de 1 minuto)
  setTimeout(() => {
    console.log('🚀 Ejecutando verificación inicial de notificaciones de subastas...');
    processAllNotifications();
  }, 60000); // 1 minuto después de iniciar

  console.log('✅ Cron job de notificaciones de subastas (hora Colombia) iniciado (cada 15 minutos)');
};

/**
 * Función manual para probar el envío de notificaciones
 */
export const sendNotificationsNow = async () => {
  try {
    console.log('🔄 Ejecutando notificaciones manuales...');
    const results = await processAllNotifications();
    return results;
  } catch (error) {
    console.error('❌ Error al enviar notificaciones manuales:', error);
    return { success: false, error: error.message };
  }
};

