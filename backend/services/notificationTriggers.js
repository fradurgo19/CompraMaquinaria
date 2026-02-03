/**
 * Servicio de Triggers Automáticos para Notificaciones
 * Ejecuta reglas parametrizadas y genera alertas
 */

import { pool } from '../db/connection.js';
import { createNotification } from './notificationService.js';

/**
 * Reemplazar placeholders en templates
 */
function replacePlaceholders(template, data) {
  return template.replaceAll(/{(\w+)}/g, (match, key) => {
    return data[key] === undefined ? match : data[key];
  });
}

/**
 * Verificar y ejecutar reglas activas
 * Esta función se llama desde un cron job
 */
export async function checkAndExecuteRules() {
  try {
    console.log('🔍 Verificando reglas de notificación...');

    // Obtener reglas activas
    const rulesResult = await pool.query(
      `SELECT * FROM notification_rules WHERE is_active = true ORDER BY notification_priority DESC`
    );

    const rules = rulesResult.rows;
    console.log(`📋 ${rules.length} reglas activas encontradas`);
    
    // Log detallado de reglas activas para diagnóstico
    if (rules.length > 0) {
      console.log('📝 Reglas activas:', rules.map(r => `${r.rule_code} (trigger: ${r.trigger_event})`).join(', '));
    } else {
      console.warn('⚠️ No se encontraron reglas activas. Verifique el Panel de Reglas de Notificación.');
    }

    let totalNotificationsCreated = 0;

    // Ejecutar cada regla
    for (const rule of rules) {
      try {
        const result = await executeRule(rule);
        if (result.notificationsCreated > 0) {
          totalNotificationsCreated += result.notificationsCreated;
          console.log(`  ✅ ${rule.rule_code}: ${result.notificationsCreated} notificación(es) creada(s)`);
        }
      } catch (ruleError) {
        console.error(`  ❌ Error ejecutando regla ${rule.rule_code}:`, ruleError.message);
      }
    }

    console.log(`✅ Verificación completa. Total: ${totalNotificationsCreated} notificación(es) generada(s)`);
    return { success: true, totalNotificationsCreated };

  } catch (error) {
    console.error('❌ Error verificando reglas:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Ejecutar una regla específica
 */
async function executeRule(rule) {
  const { rule_code } = rule;

  switch (rule_code) {
    case 'auction_won_no_purchase':
      return await checkAuctionWonNoPurchase(rule);
    
    case 'purchase_missing_invoice':
      return await checkPurchaseMissingInvoice(rule);
    
    case 'nationalized_ready_service':
      return await checkNationalizedReadyForService(rule);
    
    case 'staging_completed':
      return await checkStagingCompleted(rule);
    
    case 'logistics_no_movement':
      return await checkLogisticsNoMovement(rule);
    
    case 'PRESEL_PENDING':
    case 'presel_pending':
    case 'preselection_pending':
      return await checkPreselectionPending(rule);
    
    case 'AUCTION_PENDING':
    case 'auction_pending':
    case 'auctions_pending':
      return await checkAuctionsPending(rule);
    
    case 'IMPORT_NO_DEPARTURE':
    case 'import_no_departure':
      return await checkImportNoDeparture(rule);
    
    case 'IMPORT_NO_ARRIVAL':
    case 'import_no_arrival':
      return await checkImportNoArrival(rule);
    
    case 'IMPORT_NO_PORT':
    case 'import_no_port':
      return await checkImportNoPort(rule);
    
    case 'IMPORT_NO_NATIONALIZATION':
    case 'import_no_nationalization':
      return await checkImportNoNationalization(rule);
    
    case 'AUCTION_WON_NOTIFICATION':
    case 'auction_won_notification':
      return await checkAuctionWonNotification(rule);
    
    case 'AUCTION_WON_NOTIFICATION1':
    case 'auction_won_notification1':
      return await checkAuctionWonNotification(rule); // Usa la misma función, solo cambia el destino
    
    case 'INVOICE_DATE_ADDED':
    case 'invoice_date_added':
      return await checkInvoiceDateAdded(rule);
    
    case 'AUCTION_CREATED':
    case 'auction_created':
      // Este evento se maneja directamente en triggerNotificationForEvent
      // No necesita una función específica, solo crear la notificación
      return { notificationsCreated: 0 };
    
    default:
      console.log(`  ⚠️ Regla no implementada: ${rule_code}`);
      return { notificationsCreated: 0 };
  }
}

/**
 * REGLA 1: Subastas ganadas sin registro de compra
 */
async function checkAuctionWonNoPurchase(rule) {
  const daysRequired = rule.trigger_condition?.days_without_purchase || 1;

  const result = await pool.query(`
    SELECT 
      a.id,
      a.machine_id,
      COALESCE(p.mq, 'MQ-' || SUBSTRING(SPLIT_PART(a.id::text, '-', 1), 1, 6)) as mq,
      m.model,
      m.serial,
      a.created_at,
      a.updated_at,
      EXTRACT(DAY FROM (NOW() - a.updated_at)) as days_elapsed
    FROM auctions a
    LEFT JOIN machines m ON a.machine_id = m.id
    LEFT JOIN purchases p ON a.id = p.auction_id
    WHERE a.status = 'GANADA'
      AND p.id IS NULL
      AND a.updated_at < NOW() - INTERVAL '${daysRequired} days'
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.reference_id = a.id::text
          AND n.type = '${rule.notification_type}'
          AND n.created_at > NOW() - INTERVAL '1 day'
      )
  `);

  let notificationsCreated = 0;

  for (const auction of result.rows) {
    const data = {
      mq: auction.mq,
      model: auction.model || 'N/A',
      serial: auction.serial || 'N/A',
      days: Math.floor(auction.days_elapsed)
    };

    await createNotification({
      targetRoles: rule.target_roles,
      targetUsers: rule.target_users || [],
      moduleSource: rule.module_source,
      moduleTarget: rule.module_target,
      type: rule.notification_type,
      priority: rule.notification_priority,
      title: replacePlaceholders(rule.notification_title_template, data),
      message: replacePlaceholders(rule.notification_message_template, data),
      referenceId: auction.id.toString(),
      actionType: rule.action_type,
      actionUrl: rule.action_url_template,
      expiresInDays: rule.expires_in_days
    });

    notificationsCreated++;
  }

  return { notificationsCreated };
}

/**
 * REGLA 2: Compras sin fecha de factura
 */
async function checkPurchaseMissingInvoice(rule) {
  const daysRequired = rule.trigger_condition?.days_without_invoice || 3;

  const result = await pool.query(`
    SELECT 
      p.id,
      COALESCE(p.mq, 'MQ-' || SUBSTRING(SPLIT_PART(p.id::text, '-', 1), 1, 6)) as mq,
      m.model,
      m.serial,
      p.created_at,
      EXTRACT(DAY FROM (NOW() - p.created_at)) as days_elapsed
    FROM purchases p
    LEFT JOIN machines m ON p.machine_id = m.id
    WHERE p.invoice_date IS NULL
      AND p.created_at < NOW() - INTERVAL '${daysRequired} days'
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.reference_id = p.id::text
          AND n.type = '${rule.notification_type}'
          AND n.created_at > NOW() - INTERVAL '1 day'
      )
  `);

  let notificationsCreated = 0;

  for (const purchase of result.rows) {
    // Para alertas de compras, usar serial en lugar de mq
    const data = {
      mq: purchase.serial || purchase.mq || 'N/A', // Reemplazar mq con serial para compras
      serial: purchase.serial || 'N/A',
      model: purchase.model || 'N/A',
      days: Math.floor(purchase.days_elapsed)
    };

    await createNotification({
      targetRoles: rule.target_roles,
      moduleSource: rule.module_source,
      moduleTarget: rule.module_target,
      type: rule.notification_type,
      priority: rule.notification_priority,
      title: replacePlaceholders(rule.notification_title_template, data),
      message: replacePlaceholders(rule.notification_message_template, data),
      referenceId: purchase.id.toString(),
      actionType: rule.action_type,
      actionUrl: rule.action_url_template,
      expiresInDays: rule.expires_in_days
    });

    notificationsCreated++;
  }

  return { notificationsCreated };
}

/**
 * REGLA 3: Máquinas nacionalizadas listas para servicio
 */
async function checkNationalizedReadyForService(rule) {
  const result = await pool.query(`
    SELECT 
      p.id,
      p.machine_id,
      COALESCE(p.mq, 'MQ-' || SUBSTRING(SPLIT_PART(p.id::text, '-', 1), 1, 6)) as mq,
      m.model,
      m.serial,
      p.nationalization_date
    FROM purchases p
    LEFT JOIN machines m ON p.machine_id = m.id
    WHERE p.nationalization_date IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM service_records sr WHERE sr.purchase_id = p.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.reference_id = p.id::text
          AND n.type = '${rule.notification_type}'
          AND n.title LIKE '%nacionalizada%'
          AND n.created_at > NOW() - INTERVAL '1 day'
      )
    LIMIT 10
  `);

  let notificationsCreated = 0;

  for (const purchase of result.rows) {
    // Para alertas de compras, usar serial en lugar de mq
    const data = {
      mq: purchase.serial || purchase.mq || 'N/A', // Reemplazar mq con serial para compras
      serial: purchase.serial || 'N/A',
      model: purchase.model || 'N/A'
    };

    await createNotification({
      targetRoles: rule.target_roles,
      moduleSource: rule.module_source,
      moduleTarget: rule.module_target,
      type: rule.notification_type,
      priority: rule.notification_priority,
      title: replacePlaceholders(rule.notification_title_template, data),
      message: replacePlaceholders(rule.notification_message_template, data),
      referenceId: purchase.id.toString(),
      actionType: rule.action_type,
      actionUrl: rule.action_url_template,
      expiresInDays: rule.expires_in_days
    });

    notificationsCreated++;
  }

  return { notificationsCreated };
}

/**
 * REGLA 4: Alistamiento completado
 */
async function checkStagingCompleted(rule) {
  const result = await pool.query(`
    SELECT 
      s.id,
      s.purchase_id,
      p.mq,
      s.model,
      s.serial,
      p.pvp_est,
      s.end_staging
    FROM service_records s
    LEFT JOIN purchases p ON s.purchase_id = p.id
    WHERE s.end_staging IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM equipments e WHERE e.purchase_id = s.purchase_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.reference_id = s.id::text
          AND n.type = '${rule.notification_type}'
          AND n.created_at > NOW() - INTERVAL '1 day'
      )
    LIMIT 10
  `);

  let notificationsCreated = 0;

  for (const service of result.rows) {
    const data = {
      mq: service.mq || 'N/A',
      model: service.model || 'N/A',
      serial: service.serial || 'N/A',
      pvp_est: service.pvp_est ? service.pvp_est.toLocaleString('es-CO') : '0'
    };

    await createNotification({
      targetRoles: rule.target_roles,
      moduleSource: rule.module_source,
      moduleTarget: rule.module_target,
      type: rule.notification_type,
      priority: rule.notification_priority,
      title: replacePlaceholders(rule.notification_title_template, data),
      message: replacePlaceholders(rule.notification_message_template, data),
      referenceId: service.id.toString(),
      actionType: rule.action_type,
      actionUrl: rule.action_url_template,
      expiresInDays: rule.expires_in_days
    });

    notificationsCreated++;
  }

  return { notificationsCreated };
}

/**
 * REGLA 5: Máquinas sin movimiento logístico
 */
async function checkLogisticsNoMovement(rule) {
  const daysRequired = rule.trigger_condition?.days_without_movement || 2;

  const result = await pool.query(`
    SELECT 
      p.id,
      COALESCE(p.mq, 'MQ-' || SUBSTRING(SPLIT_PART(p.id::text, '-', 1), 1, 6)) as mq,
      m.model,
      m.serial,
      p.nationalization_date,
      EXTRACT(DAY FROM (NOW() - p.nationalization_date)) as days_elapsed
    FROM purchases p
    LEFT JOIN machines m ON p.machine_id = m.id
    WHERE p.nationalization_date IS NOT NULL
      AND (p.current_movement IS NULL OR p.current_movement = '')
      AND p.nationalization_date < NOW() - INTERVAL '${daysRequired} days'
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.reference_id = p.id::text
          AND n.type = '${rule.notification_type}'
          AND n.title LIKE '%sin movimiento%'
          AND n.created_at > NOW() - INTERVAL '1 day'
      )
    LIMIT 10
  `);

  let notificationsCreated = 0;

  for (const purchase of result.rows) {
    // Para alertas de compras, usar serial en lugar de mq
    const data = {
      mq: purchase.serial || purchase.mq || 'N/A', // Reemplazar mq con serial para compras
      serial: purchase.serial || 'N/A',
      model: purchase.model || 'N/A',
      days: Math.floor(purchase.days_elapsed)
    };

    await createNotification({
      targetRoles: rule.target_roles,
      moduleSource: rule.module_source,
      moduleTarget: rule.module_target,
      type: rule.notification_type,
      priority: rule.notification_priority,
      title: replacePlaceholders(rule.notification_title_template, data),
      message: replacePlaceholders(rule.notification_message_template, data),
      referenceId: purchase.id.toString(),
      actionType: rule.action_type,
      actionUrl: rule.action_url_template,
      expiresInDays: rule.expires_in_days
    });

    notificationsCreated++;
  }

  return { notificationsCreated };
}

/**
 * REGLA 6: Preselecciones pendientes
 */
async function checkPreselectionPending(rule) {
  const result = await pool.query(`
    SELECT 
      id,
      model,
      serial,
      lot_number,
      supplier_name,
      auction_date,
      decision,
      created_at
    FROM preselections
    WHERE decision = 'PENDIENTE'
  `);

  let notificationsCreated = 0;

  // Si hay registros pendientes, verificar si ya existe notificación activa
  if (result.rows.length > 0) {
    // Verificar si ya existe una notificación activa
    const existingNotif = await pool.query(`
      SELECT id FROM notifications
      WHERE module_source = 'preselection'
        AND reference_id = 'preselection-pending'
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `);

    // Solo crear si no existe una notificación activa
    if (existingNotif.rows.length === 0) {
      const data = {
        count: result.rows.length,
        plural: result.rows.length > 1 ? 'es' : ''
      };

      // Crear una notificación para todos los pendientes
      await createNotification({
        targetRoles: rule.target_roles,
        moduleSource: rule.module_source,
        moduleTarget: rule.module_target,
        type: rule.notification_type,
        priority: rule.notification_priority,
        title: replacePlaceholders(rule.notification_title_template, data),
        message: replacePlaceholders(rule.notification_message_template, data),
        referenceId: 'preselection-pending',
        actionType: rule.action_type,
        actionUrl: rule.action_url_template,
        expiresInDays: rule.expires_in_days
      });

      notificationsCreated = 1;
    }
  }

  return { notificationsCreated };
}

/**
 * Retirar notificaciones cuando se responde una preselección
 */
export async function clearPreselectionNotifications() {
  try {
    // Eliminar notificaciones de preselección pendiente
    const result = await pool.query(`
      DELETE FROM notifications
      WHERE module_source = 'preselection'
        AND reference_id = 'preselection-pending'
    `);

    console.log(`🧹 ${result.rowCount} notificación(es) de preselección eliminada(s)`);
    return { success: true, deleted: result.rowCount };
  } catch (error) {
    console.error('❌ Error eliminando notificaciones de preselección:', error);
    return { success: false, error: error.message };
  }
}

/**
 * REGLA 7: Subastas pendientes
 */
async function checkAuctionsPending(rule) {
  const result = await pool.query(`
    SELECT 
      id,
      lot,
      machine_id,
      status,
      date as auction_date,
      created_at
    FROM auctions
    WHERE status = 'PENDIENTE'
  `);

  let notificationsCreated = 0;

  console.log(`  🔍 Subastas pendientes encontradas: ${result.rows.length}`);

  // Si hay registros pendientes, verificar si ya existe notificación activa
  if (result.rows.length > 0) {
    // Verificar si ya existe una notificación activa
    const existingNotif = await pool.query(`
      SELECT id FROM notifications
      WHERE module_source = 'auctions'
        AND reference_id = 'auctions-pending'
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `);

    console.log(`  🔍 Notificaciones existentes para auctions-pending: ${existingNotif.rows.length}`);

    // Solo crear si no existe una notificación activa
    if (existingNotif.rows.length === 0) {
      const data = {
        count: result.rows.length,
        plural: result.rows.length > 1 ? 's' : ''
      };

      console.log(`  ✅ Creando notificación para ${result.rows.length} subasta(s) pendiente(s)`);

      // Crear una notificación para todas las pendientes
      await createNotification({
        targetRoles: rule.target_roles,
        moduleSource: rule.module_source,
        moduleTarget: rule.module_target,
        type: rule.notification_type,
        priority: rule.notification_priority,
        title: replacePlaceholders(rule.notification_title_template, data),
        message: replacePlaceholders(rule.notification_message_template, data),
        referenceId: 'auctions-pending',
        actionType: rule.action_type,
        actionUrl: rule.action_url_template,
        expiresInDays: rule.expires_in_days
      });

      notificationsCreated = 1;
    } else {
      console.log(`  ⏭️ Notificación ya existe para auctions-pending, omitiendo creación`);
    }
  } else {
    console.log(`  ℹ️ No hay subastas pendientes`);
  }

  return { notificationsCreated };
}

/**
 * Retirar notificaciones cuando se responde una subasta
 */
export async function clearAuctionsNotifications() {
  try {
    // Eliminar notificaciones de subastas pendientes
    const result = await pool.query(`
      DELETE FROM notifications
      WHERE module_source = 'auctions'
        AND reference_id = 'auctions-pending'
    `);

    console.log(`🧹 ${result.rowCount} notificación(es) de subastas eliminada(s)`);
    return { success: true, deleted: result.rowCount };
  } catch (error) {
    console.error('❌ Error eliminando notificaciones de subastas:', error);
    return { success: false, error: error.message };
  }
}

/**
 * REGLA 8: Importaciones sin fecha de embarque salida
 */
async function checkImportNoDeparture(rule) {
  const result = await pool.query(`
    SELECT 
      p.id,
      p.mq,
      m.model,
      m.serial
    FROM purchases p
    LEFT JOIN machines m ON p.machine_id = m.id
    WHERE p.shipment_departure_date IS NULL
      AND p.condition = 'USADO'
  `);

  let notificationsCreated = 0;

  for (const purchase of result.rows) {
    // Verificar si ya existe notificación activa para este registro
    const existingNotif = await pool.query(`
      SELECT id FROM notifications
      WHERE module_source = 'importations'
        AND reference_id = $1::text
        AND message LIKE '%Embarque Salida%'
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `, [purchase.id]);

    // Solo crear si no existe una notificación activa
    if (existingNotif.rows.length === 0) {
      // Para alertas de compras, usar serial en lugar de mq
      const data = {
        mq: purchase.serial || purchase.mq || 'Sin Serial', // Reemplazar mq con serial para compras
        serial: purchase.serial || 'N/A',
        model: purchase.model || 'N/A'
      };

      await createNotification({
        targetRoles: rule.target_roles,
        moduleSource: rule.module_source,
        moduleTarget: rule.module_target,
        type: rule.notification_type,
        priority: rule.notification_priority,
        title: replacePlaceholders(rule.notification_title_template, data),
        message: replacePlaceholders(rule.notification_message_template, data),
        referenceId: purchase.id.toString(),
        actionType: rule.action_type,
        actionUrl: rule.action_url_template,
        expiresInDays: rule.expires_in_days
      });

      notificationsCreated++;
    }
  }

  return { notificationsCreated };
}

/**
 * REGLA 9: Importaciones sin fecha de embarque llegada
 */
async function checkImportNoArrival(rule) {
  const result = await pool.query(`
    SELECT 
      p.id,
      p.mq,
      m.model,
      m.serial
    FROM purchases p
    LEFT JOIN machines m ON p.machine_id = m.id
    WHERE p.shipment_arrival_date IS NULL
      AND p.condition = 'USADO'
      AND p.shipment_departure_date IS NOT NULL
  `);

  let notificationsCreated = 0;

  for (const purchase of result.rows) {
    const existingNotif = await pool.query(`
      SELECT id FROM notifications
      WHERE module_source = 'importations'
        AND reference_id = $1::text
        AND message LIKE '%Embarque Llegada%'
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `, [purchase.id]);

    if (existingNotif.rows.length === 0) {
      // Para alertas de compras, usar serial en lugar de mq
      const data = {
        mq: purchase.serial || purchase.mq || 'Sin Serial', // Reemplazar mq con serial para compras
        serial: purchase.serial || 'N/A',
        model: purchase.model || 'N/A'
      };

      await createNotification({
        targetRoles: rule.target_roles,
        moduleSource: rule.module_source,
        moduleTarget: rule.module_target,
        type: rule.notification_type,
        priority: rule.notification_priority,
        title: replacePlaceholders(rule.notification_title_template, data),
        message: replacePlaceholders(rule.notification_message_template, data),
        referenceId: purchase.id.toString(),
        actionType: rule.action_type,
        actionUrl: rule.action_url_template,
        expiresInDays: rule.expires_in_days
      });

      notificationsCreated++;
    }
  }

  return { notificationsCreated };
}

/**
 * REGLA 10: Importaciones sin puerto
 */
async function checkImportNoPort(rule) {
  const result = await pool.query(`
    SELECT 
      p.id,
      p.mq,
      m.model,
      m.serial
    FROM purchases p
    LEFT JOIN machines m ON p.machine_id = m.id
    WHERE (p.port_of_destination IS NULL OR p.port_of_destination = '')
      AND p.condition = 'USADO'
  `);

  let notificationsCreated = 0;

  for (const purchase of result.rows) {
    const existingNotif = await pool.query(`
      SELECT id FROM notifications
      WHERE module_source = 'importations'
        AND reference_id = $1::text
        AND message LIKE '%Puerto%'
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `, [purchase.id]);

    if (existingNotif.rows.length === 0) {
      // Para alertas de compras, usar serial en lugar de mq
      const data = {
        mq: purchase.serial || purchase.mq || 'Sin Serial', // Reemplazar mq con serial para compras
        serial: purchase.serial || 'N/A',
        model: purchase.model || 'N/A'
      };

      await createNotification({
        targetRoles: rule.target_roles,
        moduleSource: rule.module_source,
        moduleTarget: rule.module_target,
        type: rule.notification_type,
        priority: rule.notification_priority,
        title: replacePlaceholders(rule.notification_title_template, data),
        message: replacePlaceholders(rule.notification_message_template, data),
        referenceId: purchase.id.toString(),
        actionType: rule.action_type,
        actionUrl: rule.action_url_template,
        expiresInDays: rule.expires_in_days
      });

      notificationsCreated++;
    }
  }

  return { notificationsCreated };
}

/**
 * REGLA 11: Importaciones sin nacionalización
 */
async function checkImportNoNationalization(rule) {
  const result = await pool.query(`
    SELECT 
      p.id,
      p.mq,
      m.model,
      m.serial
    FROM purchases p
    LEFT JOIN machines m ON p.machine_id = m.id
    WHERE p.nationalization_date IS NULL
      AND p.condition = 'USADO'
      AND p.shipment_arrival_date IS NOT NULL
  `);

  let notificationsCreated = 0;

  for (const purchase of result.rows) {
    const existingNotif = await pool.query(`
      SELECT id FROM notifications
      WHERE module_source = 'importations'
        AND reference_id = $1::text
        AND message LIKE '%Nacionalización%'
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `, [purchase.id]);

    if (existingNotif.rows.length === 0) {
      // Para alertas de compras, usar serial en lugar de mq
      const data = {
        mq: purchase.serial || purchase.mq || 'Sin Serial', // Reemplazar mq con serial para compras
        serial: purchase.serial || 'N/A',
        model: purchase.model || 'N/A'
      };

      await createNotification({
        targetRoles: rule.target_roles,
        moduleSource: rule.module_source,
        moduleTarget: rule.module_target,
        type: rule.notification_type,
        priority: rule.notification_priority,
        title: replacePlaceholders(rule.notification_title_template, data),
        message: replacePlaceholders(rule.notification_message_template, data),
        referenceId: purchase.id.toString(),
        actionType: rule.action_type,
        actionUrl: rule.action_url_template,
        expiresInDays: rule.expires_in_days
      });

      notificationsCreated++;
    }
  }

  return { notificationsCreated };
}

/**
 * REGLA 12: Subasta ganada (notificación informativa)
 */
async function checkAuctionWonNotification(rule) {
  // Esta regla se dispara por evento, no por verificación periódica
  // Solo devolver 0 porque el trigger real está en auctions.js
  return { notificationsCreated: 0 };
}

/**
 * REGLA 13: Fecha de factura agregada en Compras
 */
async function checkInvoiceDateAdded(rule) {
  const result = await pool.query(`
    SELECT 
      p.id,
      p.mq,
      p.invoice_date,
      m.model,
      m.serial
    FROM purchases p
    LEFT JOIN machines m ON p.machine_id = m.id
    WHERE p.invoice_date IS NOT NULL
      AND p.condition = 'USADO'
      AND p.created_at > NOW() - INTERVAL '7 days'
  `);

  let notificationsCreated = 0;

  for (const purchase of result.rows) {
    // Verificar si ya existe notificación activa para este registro
    const existingNotif = await pool.query(`
      SELECT id FROM notifications
      WHERE module_source = 'purchases'
        AND reference_id = $1::text
        AND message LIKE '%fecha de factura%'
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `, [purchase.id]);

    // Solo crear si no existe una notificación activa
    if (existingNotif.rows.length === 0) {
      // Para alertas de compras, usar serial en lugar de mq
      const data = {
        mq: purchase.serial || purchase.mq || 'Sin Serial', // Reemplazar mq con serial para compras
        serial: purchase.serial || 'N/A',
        model: purchase.model || 'N/A',
        invoice_date: purchase.invoice_date || ''
      };

      await createNotification({
        targetRoles: rule.target_roles,
        moduleSource: rule.module_source,
        moduleTarget: rule.module_target,
        type: rule.notification_type,
        priority: rule.notification_priority,
        title: replacePlaceholders(rule.notification_title_template, data),
        message: replacePlaceholders(rule.notification_message_template, data),
        referenceId: purchase.id.toString(),
        actionType: rule.action_type,
        actionUrl: rule.action_url_template,
        expiresInDays: rule.expires_in_days
      });

      notificationsCreated++;
    }
  }

  return { notificationsCreated };
}

/**
 * Limpiar notificaciones de importaciones cuando se completen los campos
 */
export async function clearImportNotifications(purchaseId, field) {
  try {
    let condition = '';
    switch(field) {
      case 'shipment_departure_date':
        condition = "message LIKE '%Embarque Salida%'";
        break;
      case 'shipment_arrival_date':
        condition = "message LIKE '%Embarque Llegada%'";
        break;
      case 'port_of_destination':
        condition = "message LIKE '%Puerto%'";
        break;
      case 'nationalization_date':
        condition = "message LIKE '%Nacionalización%'";
        break;
    }

    if (condition) {
      const result = await pool.query(`
        DELETE FROM notifications
        WHERE module_source = 'importations'
          AND reference_id = $1::text
          AND ${condition}
      `, [purchaseId]);

      console.log(`🧹 ${result.rowCount} notificación(es) de ${field} eliminada(s)`);
      return { success: true, deleted: result.rowCount };
    }
  } catch (error) {
    console.error('❌ Error eliminando notificaciones de importaciones:', error);
    return { success: false, error: error.message };
  }
}

/** Normaliza target_users desde la regla (formato pg array o string) */
function parseTargetUsersFromRule(rule) {
  const raw = rule.target_users;
  if (Array.isArray(raw)) {
    return raw.filter(Boolean).map((id) => (typeof id === 'string' ? id : String(id)));
  }
  if (raw && typeof raw === 'string') {
    const parsed = raw.replaceAll(/[{}]/g, '').split(',').map((s) => s.trim()).filter(Boolean);
    return parsed.length ? parsed : [];
  }
  return [];
}

/**
 * Disparador manual para evento específico
 * Se llama desde endpoints cuando ocurre un evento
 * Usa el mismo patrón que checkAuctionWonNoPurchase: target_roles y target_users de la regla
 */
export async function triggerNotificationForEvent(eventType, eventData) {
  try {
    const rulesResult = await pool.query(
      `SELECT * FROM notification_rules 
       WHERE is_active = true 
         AND trigger_event = $1
       ORDER BY notification_priority DESC`,
      [eventType]
    );

    if (rulesResult.rows.length === 0) {
      return { success: true, notificationsCreated: 0 };
    }

    let totalCreated = 0;

    for (const rule of rulesResult.rows) {
      const title = replacePlaceholders(rule.notification_title_template, eventData);
      const message = replacePlaceholders(rule.notification_message_template, eventData);
      const actionUrl = rule.action_url_template ? replacePlaceholders(rule.action_url_template, eventData) : null;

      // Mismo patrón que auction_won_no_purchase: target_roles y target_users de la regla
      const targetUsers = parseTargetUsersFromRule(rule);

      const result = await createNotification({
        userId: eventData.userId || null,
        targetRoles: rule.target_roles || [],
        targetUsers,
        moduleSource: rule.module_source,
        moduleTarget: rule.module_target,
        type: rule.notification_type,
        priority: rule.notification_priority,
        title,
        message,
        referenceId: eventData.recordId,
        metadata: eventData.metadata || null,
        actionType: rule.action_type,
        actionUrl,
        expiresInDays: rule.expires_in_days,
        createdBy: eventData.triggeredBy || null
      });

      if (result.success) {
        totalCreated += result.count || 1;
      }
    }

    console.log(`✅ Evento ${eventType}: ${totalCreated} notificación(es) creada(s)`);
    return { success: true, notificationsCreated: totalCreated };

  } catch (error) {
    console.error(`❌ Error disparando notificación para evento ${eventType}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Iniciar cron job para verificaciones periódicas
 */
export function startNotificationCron() {
  import('node-cron').then((cronModule) => {
    const cron = cronModule.default;

    // Ejecutar cada hora
    const cronJob = cron.schedule('0 * * * *', async () => {
      console.log('⏰ [CRON] Iniciando verificación de reglas de notificación...');
      try {
        const result = await checkAndExecuteRules();
        console.log(`⏰ [CRON] Verificación completada: ${result.totalNotificationsCreated || 0} notificación(es) creada(s)`);
      } catch (error) {
        console.error('⏰ [CRON] Error en verificación:', error);
      }
    }, {
      scheduled: true,
      timezone: 'America/Bogota'
    });

    // También ejecutar al iniciar el servidor
    setTimeout(() => {
      console.log('🚀 Ejecutando verificación inicial de notificaciones...');
      checkAndExecuteRules().then(result => {
        console.log(`🚀 Verificación inicial completada: ${result.totalNotificationsCreated || 0} notificación(es) creada(s)`);
      }).catch(error => {
        console.error('🚀 Error en verificación inicial:', error);
      });
    }, 5000); // 5 segundos después de iniciar

    console.log('✅ Cron de notificaciones iniciado (cada hora a las :00)');
    return cronJob;
  }).catch((error) => {
    console.error('❌ Error iniciando cron de notificaciones:', error);
    console.warn('⚠️ El cron job de notificaciones no está disponible. Las notificaciones solo se crearán cuando se ejecute checkAndExecuteRules() manualmente.');
  });
}

