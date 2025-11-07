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
  return template.replace(/{(\w+)}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : match;
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
  const { rule_code, trigger_event, trigger_condition } = rule;

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
        WHERE n.reference_id = a.id
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
      moduleSource: rule.module_source,
      moduleTarget: rule.module_target,
      type: rule.notification_type,
      priority: rule.notification_priority,
      title: replacePlaceholders(rule.notification_title_template, data),
      message: replacePlaceholders(rule.notification_message_template, data),
      referenceId: auction.id,
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
        WHERE n.reference_id = p.id
          AND n.type = '${rule.notification_type}'
          AND n.created_at > NOW() - INTERVAL '1 day'
      )
  `);

  let notificationsCreated = 0;

  for (const purchase of result.rows) {
    const data = {
      mq: purchase.mq,
      model: purchase.model || 'N/A',
      serial: purchase.serial || 'N/A',
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
      referenceId: purchase.id,
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
        WHERE n.reference_id = p.id
          AND n.type = '${rule.notification_type}'
          AND n.title LIKE '%nacionalizada%'
          AND n.created_at > NOW() - INTERVAL '1 day'
      )
    LIMIT 10
  `);

  let notificationsCreated = 0;

  for (const purchase of result.rows) {
    const data = {
      mq: purchase.mq,
      model: purchase.model || 'N/A',
      serial: purchase.serial || 'N/A'
    };

    await createNotification({
      targetRoles: rule.target_roles,
      moduleSource: rule.module_source,
      moduleTarget: rule.module_target,
      type: rule.notification_type,
      priority: rule.notification_priority,
      title: replacePlaceholders(rule.notification_title_template, data),
      message: replacePlaceholders(rule.notification_message_template, data),
      referenceId: purchase.id,
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
        WHERE n.reference_id = s.id
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
      referenceId: service.id,
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
        WHERE n.reference_id = p.id
          AND n.type = '${rule.notification_type}'
          AND n.title LIKE '%sin movimiento%'
          AND n.created_at > NOW() - INTERVAL '1 day'
      )
    LIMIT 10
  `);

  let notificationsCreated = 0;

  for (const purchase of result.rows) {
    const data = {
      mq: purchase.mq,
      model: purchase.model || 'N/A',
      serial: purchase.serial || 'N/A',
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
      referenceId: purchase.id,
      actionType: rule.action_type,
      actionUrl: rule.action_url_template,
      expiresInDays: rule.expires_in_days
    });

    notificationsCreated++;
  }

  return { notificationsCreated };
}

/**
 * Disparador manual para evento específico
 * Se llama desde endpoints cuando ocurre un evento
 */
export async function triggerNotificationForEvent(eventType, eventData) {
  try {
    // Buscar reglas activas para este evento
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

      const result = await createNotification({
        userId: eventData.userId || null,
        targetRoles: rule.target_roles,
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
    cron.schedule('0 * * * *', async () => {
      console.log('⏰ [CRON] Iniciando verificación de reglas de notificación...');
      await checkAndExecuteRules();
    });

    // También ejecutar al iniciar el servidor
    setTimeout(() => {
      console.log('🚀 Ejecutando verificación inicial de notificaciones...');
      checkAndExecuteRules();
    }, 5000); // 5 segundos después de iniciar

    console.log('✅ Cron de notificaciones iniciado (cada hora)');
  });
}

