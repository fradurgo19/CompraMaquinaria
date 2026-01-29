/**
 * Servicio de Notificaciones Internas
 * Genera alertas automáticas cuando ocurren eventos importantes
 */

import { pool } from '../db/connection.js';
import { sendToUser, broadcastToRoles } from './websocketServer.js';

/**
 * Obtener UUID de usuario por email (users_profile o auth.users)
 */
export async function getUserIdByEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  try {
    const result = await pool.query(
      `SELECT up.id FROM users_profile up
       LEFT JOIN auth.users au ON up.id = au.id
       WHERE LOWER(TRIM(COALESCE(up.email, au.email))) = $1
       LIMIT 1`,
      [normalized]
    );
    return result.rows.length > 0 ? result.rows[0].id : null;
  } catch (err) {
    try {
      const fallback = await pool.query(
        `SELECT id FROM users_profile WHERE LOWER(TRIM(email)) = $1 LIMIT 1`,
        [normalized]
      );
      return fallback.rows.length > 0 ? fallback.rows[0].id : null;
    } catch (e) {
      console.warn('getUserIdByEmail:', e.message);
      return null;
    }
  }
}

/**
 * Crear notificación para uno o múltiples usuarios
 */
export async function createNotification({
  userId,          // Usuario específico (o null para usar roles o targetUsers)
  targetRoles = [], // Array de roles que recibirán la notificación
  targetUsers = [], // Array de UUIDs de usuarios específicos
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
    const expiresAt = expiresInDays 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    let allUserIds = new Set(); // Usar Set para evitar duplicados

    // Si se especificó userId único, agregarlo
    if (userId) {
      allUserIds.add(userId);
    }

    // Si se especificaron usuarios específicos (targetUsers), agregarlos
    if (targetUsers && targetUsers.length > 0) {
      targetUsers.forEach(userId => {
        if (userId) allUserIds.add(userId);
      });
    }

    // Si se especificaron roles, obtener todos los usuarios con esos roles
    if (targetRoles.length > 0) {
      const usersResult = await pool.query(
        `SELECT id FROM users_profile WHERE role = ANY($1)`,
        [targetRoles]
      );
      
      usersResult.rows.forEach(user => {
        allUserIds.add(user.id);
      });
    }

    // Si no hay destinatarios, retornar error
    if (allUserIds.size === 0) {
      console.log('⚠️ No se especificó userId, targetUsers ni targetRoles');
      return { success: false, error: 'No se especificó destinatario' };
    }

    // Crear notificaciones para todos los usuarios únicos
    const userIdsArray = Array.from(allUserIds);
    const insertPromises = userIdsArray.map(userId =>
      pool.query(
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
      )
    );

    await Promise.all(insertPromises);

    const rolesStr = targetRoles.length > 0 ? ` (roles: ${targetRoles.join(', ')})` : '';
    const usersStr = targetUsers && targetUsers.length > 0 ? ` (usuarios: ${targetUsers.length})` : '';
    console.log(`✅ Notificación creada para ${userIdsArray.length} usuario(s)${rolesStr}${usersStr}: ${title}`);
    
    // 🔔 Enviar por WebSocket en tiempo real
    // Nota: En producción serverless (Vercel), el WebSocket no está disponible
    // Las notificaciones se obtendrán vía polling HTTP cada 30 segundos
    try {
      // Enviar a usuarios específicos
      userIdsArray.forEach(userId => {
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
          // Ignorar errores individuales
        }
      });

      // También hacer broadcast a roles si existen
      if (targetRoles.length > 0) {
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
      }
    } catch (wsError) {
      // Ignorar errores de WebSocket en producción serverless
      // Las notificaciones ya están guardadas en la BD y se obtendrán vía polling
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ WebSocket no disponible (normal en producción serverless):', wsError.message);
      }
    }
    
    return { success: true, count: userIdsArray.length };

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

