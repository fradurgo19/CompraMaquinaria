/**
 * Servicio de Notificaciones Internas
 * Genera alertas automáticas cuando ocurren eventos importantes
 */

import { pool } from '../db/connection.js';
import { sendToUser, broadcastToRoles } from './websocketServer.js';

/**
 * Crear notificación para uno o múltiples usuarios
 */
export async function createNotification({
  userId,          // Usuario específico (o null para usar roles)
  targetRoles = [], // Array de roles que recibirán la notificación
  moduleSource,
  moduleTarget,
  type = 'info',
  priority = 1,
  title,
  message,
  referenceId = null,
  metadata = null,
  actionType = null,
  actionUrl = null,
  expiresInDays = null,
  createdBy = null
}) {
  try {
    // Si se especificó userId, crear para ese usuario
    if (userId) {
      const expiresAt = expiresInDays 
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      await pool.query(
        `INSERT INTO notifications (
          user_id, module_source, module_target, type, priority,
          title, message, reference_id, metadata, action_type, action_url,
          expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          userId, moduleSource, moduleTarget, type, priority,
          title, message, referenceId, metadata, actionType, actionUrl,
          expiresAt
        ]
      );

      console.log(`✅ Notificación creada para usuario ${userId}: ${title}`);
      
      // 🔔 Enviar por WebSocket en tiempo real
      // Nota: En producción serverless (Vercel), el WebSocket no está disponible
      // Las notificaciones se obtendrán vía polling HTTP cada 30 segundos
      try {
        sendToUser(userId, {
          type: 'new_notification',
          notification: {
            moduleSource,
            moduleTarget,
            type,
            priority,
            title,
            message,
            referenceId,
            actionType,
            actionUrl
          }
        });
      } catch (wsError) {
        // Ignorar errores de WebSocket en producción serverless
        // Las notificaciones ya están guardadas en la BD y se obtendrán vía polling
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ WebSocket no disponible (normal en producción serverless):', wsError.message);
        }
      }
      
      return { success: true };
    }

    // Si se especificaron roles, crear para todos los usuarios con esos roles
    if (targetRoles.length > 0) {
      const usersResult = await pool.query(
        `SELECT id FROM users_profile WHERE role = ANY($1)`,
        [targetRoles]
      );

      const expiresAt = expiresInDays 
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const insertPromises = usersResult.rows.map(user =>
        pool.query(
          `INSERT INTO notifications (
            user_id, module_source, module_target, type, priority,
            title, message, reference_id, metadata, action_type, action_url,
            expires_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            user.id, moduleSource, moduleTarget, type, priority,
            title, message, referenceId, metadata, actionType, actionUrl,
            expiresAt
          ]
        )
      );

      await Promise.all(insertPromises);

      console.log(`✅ Notificación creada para ${usersResult.rows.length} usuarios (roles: ${targetRoles.join(', ')}): ${title}`);
      
      // 🔔 Enviar por WebSocket en tiempo real a todos los roles afectados
      // Nota: En producción serverless (Vercel), el WebSocket no está disponible
      // Las notificaciones se obtendrán vía polling HTTP cada 30 segundos
      try {
        broadcastToRoles(targetRoles, {
          type: 'new_notification',
          notification: {
            moduleSource,
            moduleTarget,
            type,
            priority,
            title,
            message,
            referenceId,
            actionType,
            actionUrl
          }
        });
      } catch (wsError) {
        // Ignorar errores de WebSocket en producción serverless
        // Las notificaciones ya están guardadas en la BD y se obtendrán vía polling
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ WebSocket no disponible (normal en producción serverless):', wsError.message);
        }
      }
      
      return { success: true, count: usersResult.rows.length };
    }

    console.log('⚠️ No se especificó userId ni targetRoles');
    return { success: false, error: 'No se especificó destinatario' };

  } catch (error) {
    console.error('❌ Error creando notificación:', error);
    return { success: false, error: error.message };
  }
}

/**
 * EJEMPLOS DE NOTIFICACIONES AUTOMÁTICAS
 * Estas funciones se pueden llamar desde otros módulos cuando ocurren eventos
 */

// Ejemplo 1: Subasta ganada sin registro de compra
export async function notifyAuctionWonNoPurchase(auctionId, mq, daysElapsed) {
  return await createNotification({
    targetRoles: ['eliana', 'gerencia', 'admin'],
    moduleSource: 'auctions',
    moduleTarget: 'purchases',
    type: 'urgent',
    priority: 4,
    title: '⚠️ Subasta ganada sin registro de compra',
    message: `La máquina ${mq} fue marcada como GANADA hace ${daysElapsed} días pero no tiene registro de compra.`,
    referenceId: auctionId,
    actionType: 'create_purchase',
    actionUrl: `/purchases`,
    expiresInDays: 30
  });
}

// Ejemplo 2: Máquina sin factura
export async function notifyMissingInvoice(purchaseId, mq, daysElapsed) {
  return await createNotification({
    targetRoles: ['eliana', 'gerencia', 'admin'],
    moduleSource: 'purchases',
    moduleTarget: 'purchases',
    type: 'warning',
    priority: 3,
    title: 'Factura pendiente',
    message: `La máquina ${mq} no tiene fecha de factura desde hace ${daysElapsed} días.`,
    referenceId: purchaseId,
    actionType: 'edit_record',
    actionUrl: `/purchases`,
    expiresInDays: 15
  });
}

// Ejemplo 3: Máquina nacionalizada lista para servicio
export async function notifyReadyForService(purchaseId, mq) {
  return await createNotification({
    targetRoles: ['servicio', 'gerencia', 'admin'],
    moduleSource: 'importations',
    moduleTarget: 'service',
    type: 'info',
    priority: 2,
    title: '📦 Máquina nacionalizada',
    message: `La máquina ${mq} ha sido nacionalizada y está lista para alistamiento.`,
    referenceId: purchaseId,
    actionType: 'view_record',
    actionUrl: `/service`,
    expiresInDays: 7
  });
}

// Ejemplo 4: Alistamiento completado
export async function notifyReadyForSale(equipmentId, mq, pvp) {
  return await createNotification({
    targetRoles: ['comerciales', 'jefe_comercial', 'gerencia', 'admin'],
    moduleSource: 'service',
    moduleTarget: 'equipments',
    type: 'success',
    priority: 2,
    title: '✅ Máquina lista para venta',
    message: `La máquina ${mq} ha completado alistamiento. PVP: $${pvp.toLocaleString('es-CO')}`,
    referenceId: equipmentId,
    actionType: 'view_record',
    actionUrl: `/equipments`,
    expiresInDays: 7
  });
}

/**
 * Limpiar notificaciones expiradas (llamar desde cron diario)
 */
export async function cleanExpiredNotifications() {
  try {
    const result = await pool.query(
      `DELETE FROM notifications
       WHERE expires_at IS NOT NULL AND expires_at < NOW()
       RETURNING *`
    );

    console.log(`🗑️ ${result.rows.length} notificaciones expiradas eliminadas`);
    return { success: true, deleted: result.rows.length };
  } catch (error) {
    console.error('❌ Error limpiando notificaciones:', error);
    return { success: false, error: error.message };
  }
}

