/**
 * Servicio de Sincronización Bidireccional
 * Sincroniza cambios desde purchases hacia new_purchases y equipments
 * cuando un purchase está relacionado con un new_purchase (por MQ)
 */

import { pool } from '../db/connection.js';

/**
 * Sincroniza cambios desde purchases hacia new_purchases y equipments
 * SOLO cuando el purchase está relacionado con un new_purchase por MQ
 * @param {string} purchaseId - ID del purchase que se actualizó
 * @param {Object} updates - Objeto con los campos actualizados
 * @param {Object} fieldMapping - Mapeo de campos de purchases a new_purchases
 */
export async function syncPurchaseToNewPurchaseAndEquipment(purchaseId, updates, fieldMapping = {}) {
  try {
    // Obtener el purchase con su MQ
    const purchaseResult = await pool.query(
      'SELECT id, mq, condition FROM purchases WHERE id = $1',
      [purchaseId]
    );

    if (purchaseResult.rows.length === 0) {
      // No es un purchase, puede ser un new_purchase directamente - no sincronizar
      return;
    }

    const purchase = purchaseResult.rows[0];
    
    // Si no tiene MQ, no hay nada que sincronizar (no está relacionado con new_purchases)
    if (!purchase.mq) {
      return;
    }

    // ✅ Buscar TODOS los new_purchases con el mismo MQ (MQ puede repetirse)
    const newPurchaseResult = await pool.query(
      'SELECT id FROM new_purchases WHERE mq = $1',
      [purchase.mq]
    );

    if (newPurchaseResult.rows.length === 0) {
      // No hay new_purchase relacionado, solo sincronizar a equipments
      await syncToEquipments(purchaseId, updates, fieldMapping);
      return;
    }

    // ✅ Obtener TODOS los IDs de new_purchases con el mismo MQ
    const newPurchaseIds = newPurchaseResult.rows.map(row => row.id);

    // Mapeo por defecto de campos comunes
    const defaultFieldMapping = {
      // Campos de logística
      // ✅ current_movement NO se sincroniza a new_purchases (machine_location es solo para ubicación de importaciones)
      current_movement: null, // NO sincronizar - machine_location es solo para ubicación
      current_movement_date: null, // new_purchases no tiene este campo
      current_movement_plate: null, // new_purchases no tiene este campo
      driver_name: null, // new_purchases no tiene este campo
      
      // Campos de importaciones
      shipment_departure_date: 'shipment_departure_date',
      shipment_arrival_date: 'shipment_arrival_date',
      port_of_destination: 'port_of_loading',
      nationalization_date: 'nationalization_date', // ✅ Sincronizar a new_purchases
      
      // Campos de pagos
      payment_date: 'payment_date',
      trm_rate: null, // new_purchases no tiene este campo
      usd_jpy_rate: null, // new_purchases no tiene este campo
      observaciones_pagos: null, // new_purchases no tiene este campo
      
      // Campos de servicio
      start_staging: null, // Se maneja en service_records
      end_staging: null, // Se maneja en service_records
      staging_type: null, // Se maneja en service_records
      
      // Campos generales
      mc: 'mc',
      supplier_name: 'supplier_name',
      model: 'model',
      serial: 'serial',
      brand: 'brand',
      machine_type: 'machine_type',
      condition: 'condition',
      invoice_date: 'invoice_date',
      invoice_number: 'invoice_number',
      purchase_order: 'purchase_order',
      ...fieldMapping
    };

    // Construir actualizaciones para new_purchases
    const newPurchaseUpdates = {};
    for (const [purchaseField, newPurchaseField] of Object.entries(defaultFieldMapping)) {
      if (updates[purchaseField] !== undefined && newPurchaseField !== null) {
        newPurchaseUpdates[newPurchaseField] = updates[purchaseField];
      }
    }

    // ✅ Actualizar TODOS los new_purchases con el mismo MQ si hay campos para actualizar
    if (Object.keys(newPurchaseUpdates).length > 0) {
      const updateFields = Object.keys(newPurchaseUpdates);
      const updateValues = Object.values(newPurchaseUpdates);
      const setClause = updateFields.map((field, index) => `${field} = $${index + 1}`).join(', ');
      
      // Actualizar TODOS los registros con el mismo MQ
      await pool.query(
        `UPDATE new_purchases 
         SET ${setClause}, updated_at = NOW() 
         WHERE mq = $${updateFields.length + 1}`,
        [...updateValues, purchase.mq]
      );
      
      console.log(`✅ Sincronizado desde purchase (${purchaseId}) a ${newPurchaseIds.length} new_purchase(s) por MQ: ${purchase.mq}`);
      console.log(`   IDs actualizados: ${newPurchaseIds.join(', ')}`);
      console.log(`   Campos actualizados: ${updateFields.join(', ')}`);
    }

    // ✅ Sincronizar también a equipments (para todos los new_purchases con el mismo MQ)
    for (const newPurchaseId of newPurchaseIds) {
      await syncToEquipments(purchaseId, updates, fieldMapping, newPurchaseId);
      await syncToServiceRecords(purchaseId, updates, fieldMapping, newPurchaseId);
    }
    
  } catch (error) {
    console.error('❌ Error en sincronización bidireccional:', error);
    // No lanzar error para no interrumpir el flujo principal
  }
}

/**
 * Sincroniza cambios a equipments
 * @param {string} purchaseId - ID del purchase
 * @param {Object} updates - Campos actualizados
 * @param {Object} fieldMapping - Mapeo de campos
 * @param {string} newPurchaseId - ID del new_purchase (opcional)
 */
async function syncToEquipments(purchaseId, updates, fieldMapping = {}, newPurchaseId = null) {
  try {
    // Mapeo de campos de purchases a equipments
    const equipmentFieldMapping = {
      current_movement: 'current_movement',
      current_movement_date: 'current_movement_date',
      current_movement_plate: 'current_movement_plate',
      driver_name: 'driver_name',
      shipment_departure_date: 'shipment_departure_date',
      shipment_arrival_date: 'shipment_arrival_date',
      port_of_destination: 'port_of_destination',
      nationalization_date: 'nationalization_date',
      mc: 'mc',
      supplier_name: 'supplier_name',
      model: 'model',
      serial: 'serial',
      condition: 'condition',
      machine_type: 'machine_type',
      ...fieldMapping
    };

    // Construir actualizaciones para equipments
    const equipmentUpdates = {};
    for (const [purchaseField, equipmentField] of Object.entries(equipmentFieldMapping)) {
      if (updates[purchaseField] !== undefined && equipmentField !== null) {
        equipmentUpdates[equipmentField] = updates[purchaseField];
      }
    }

    if (Object.keys(equipmentUpdates).length === 0) {
      return;
    }

    const updateFields = Object.keys(equipmentUpdates);
    const updateValues = Object.values(equipmentUpdates);
    const setClause = updateFields.map((field, index) => `${field} = $${index + 1}`).join(', ');

    // ✅ ACTUALIZAR equipment por purchase_id O new_purchase_id (evitar duplicados)
    // Priorizar equipment que tenga AMBOS IDs si existe, sino el que tenga purchase_id, sino el que tenga new_purchase_id
    if (newPurchaseId) {
      // Primero intentar actualizar el que tenga ambos IDs (el correcto)
      const updateBoth = await pool.query(
        `UPDATE equipments 
         SET ${setClause}, updated_at = NOW() 
         WHERE purchase_id = $${updateFields.length + 1} AND new_purchase_id = $${updateFields.length + 2}
         RETURNING id`,
        [...updateValues, purchaseId, newPurchaseId]
      );
      
      if (updateBoth.rows.length > 0) {
        console.log(`✅ Sincronizado a equipment con ambos IDs (purchase_id: ${purchaseId}, new_purchase_id: ${newPurchaseId})`);
      } else {
        // Si no tiene ambos, actualizar el que tenga purchase_id
        const updateByPurchase = await pool.query(
          `UPDATE equipments 
           SET ${setClause}, updated_at = NOW() 
           WHERE purchase_id = $${updateFields.length + 1}
           RETURNING id`,
          [...updateValues, purchaseId]
        );
        
        if (updateByPurchase.rows.length > 0) {
          console.log(`✅ Sincronizado a equipment por purchase_id (${purchaseId})`);
        } else {
          // Si no tiene purchase_id, actualizar el que tenga new_purchase_id
          await pool.query(
            `UPDATE equipments 
             SET ${setClause}, updated_at = NOW() 
             WHERE new_purchase_id = $${updateFields.length + 1}`,
            [...updateValues, newPurchaseId]
          );
          console.log(`✅ Sincronizado a equipment por new_purchase_id (${newPurchaseId})`);
        }
      }
    } else {
      // Solo actualizar por purchase_id
      await pool.query(
        `UPDATE equipments 
         SET ${setClause}, updated_at = NOW() 
         WHERE purchase_id = $${updateFields.length + 1}`,
        [...updateValues, purchaseId]
      );
      console.log(`✅ Sincronizado a equipment por purchase_id (${purchaseId})`);
    }
    
    console.log(`   Campos actualizados: ${updateFields.join(', ')}`);
  } catch (error) {
    console.error('❌ Error sincronizando a equipments:', error);
    // No lanzar error para no interrumpir el flujo principal
  }
}

/**
 * Sincroniza cambios desde service_records hacia new_purchases y equipments
 * @param {string} serviceRecordId - ID del service_record
 * @param {Object} updates - Campos actualizados (start_staging, end_staging, staging_type)
 */
export async function syncServiceToNewPurchaseAndEquipment(serviceRecordId, updates) {
  try {
    // Obtener el service_record
    const serviceResult = await pool.query(
      'SELECT purchase_id, new_purchase_id FROM service_records WHERE id = $1',
      [serviceRecordId]
    );

    if (serviceResult.rows.length === 0) {
      return;
    }

    const serviceRecord = serviceResult.rows[0];
    const { start_staging, end_staging, staging_type } = updates;

    // Si tiene purchase_id, buscar new_purchase por MQ
    if (serviceRecord.purchase_id) {
      const purchaseResult = await pool.query(
        'SELECT mq FROM purchases WHERE id = $1',
        [serviceRecord.purchase_id]
      );

      if (purchaseResult.rows.length > 0 && purchaseResult.rows[0].mq) {
        const mq = purchaseResult.rows[0].mq;
        const newPurchaseResult = await pool.query(
          'SELECT id FROM new_purchases WHERE mq = $1',
          [mq]
        );

        if (newPurchaseResult.rows.length > 0) {
          // Actualizar equipment por new_purchase_id
          await pool.query(
            `UPDATE equipments 
             SET start_staging = $1, end_staging = $2, staging_type = $3, updated_at = NOW() 
             WHERE new_purchase_id = $4`,
            [start_staging || null, end_staging || null, staging_type || null, newPurchaseResult.rows[0].id]
          );
          console.log(`✅ Sincronizado servicio a equipment por new_purchase_id (MQ: ${mq})`);
        } else {
          // Actualizar equipment por purchase_id
          await pool.query(
            `UPDATE equipments 
             SET start_staging = $1, end_staging = $2, staging_type = $3, updated_at = NOW() 
             WHERE purchase_id = $4`,
            [start_staging || null, end_staging || null, staging_type || null, serviceRecord.purchase_id]
          );
        }
      }
    } else if (serviceRecord.new_purchase_id) {
      // Actualizar equipment directamente por new_purchase_id
      await pool.query(
        `UPDATE equipments 
         SET start_staging = $1, end_staging = $2, staging_type = $3, updated_at = NOW() 
         WHERE new_purchase_id = $4`,
        [start_staging || null, end_staging || null, staging_type || null, serviceRecord.new_purchase_id]
      );
      console.log(`✅ Sincronizado servicio a equipment por new_purchase_id (${serviceRecord.new_purchase_id})`);
    }
  } catch (error) {
    console.error('❌ Error sincronizando servicio:', error);
  }
}

/**
 * Sincroniza cambios a service_records
 * @param {string} purchaseId - ID del purchase
 * @param {Object} updates - Campos actualizados
 * @param {Object} fieldMapping - Mapeo de campos
 * @param {string} newPurchaseId - ID del new_purchase (opcional)
 */
async function syncToServiceRecords(purchaseId, updates, fieldMapping = {}, newPurchaseId = null) {
  try {
    // Mapeo de campos de purchases a service_records
    const serviceFieldMapping = {
      shipment_departure_date: 'shipment_departure_date',
      shipment_arrival_date: 'shipment_arrival_date',
      port_of_destination: 'port_of_destination',
      nationalization_date: 'nationalization_date',
      mc: 'mc',
      supplier_name: 'supplier_name',
      model: 'model',
      serial: 'serial',
      condition: 'condition',
      machine_type: 'machine_type',
      ...fieldMapping
    };

    // Construir actualizaciones para service_records
    const serviceUpdates = {};
    for (const [purchaseField, serviceField] of Object.entries(serviceFieldMapping)) {
      if (updates[purchaseField] !== undefined && serviceField !== null) {
        serviceUpdates[serviceField] = updates[purchaseField];
      }
    }

    if (Object.keys(serviceUpdates).length === 0) {
      return;
    }

    const updateFields = Object.keys(serviceUpdates);
    const updateValues = Object.values(serviceUpdates);
    const setClause = updateFields.map((field, index) => `${field} = $${index + 1}`).join(', ');

    // ✅ ACTUALIZAR service_record por purchase_id O new_purchase_id
    if (newPurchaseId) {
      // Primero intentar actualizar el que tenga purchase_id
      const updateByPurchase = await pool.query(
        `UPDATE service_records 
         SET ${setClause}, updated_at = NOW() 
         WHERE purchase_id = $${updateFields.length + 1}
         RETURNING id`,
        [...updateValues, purchaseId]
      );
      
      if (updateByPurchase.rows.length > 0) {
        console.log(`✅ Sincronizado a service_record por purchase_id (${purchaseId})`);
      } else {
        // Si no tiene purchase_id, actualizar el que tenga new_purchase_id
        await pool.query(
          `UPDATE service_records 
           SET ${setClause}, updated_at = NOW() 
           WHERE new_purchase_id = $${updateFields.length + 1}`,
          [...updateValues, newPurchaseId]
        );
        console.log(`✅ Sincronizado a service_record por new_purchase_id (${newPurchaseId})`);
      }
    } else {
      // Solo actualizar por purchase_id
      await pool.query(
        `UPDATE service_records 
         SET ${setClause}, updated_at = NOW() 
         WHERE purchase_id = $${updateFields.length + 1}`,
        [...updateValues, purchaseId]
      );
      console.log(`✅ Sincronizado a service_record por purchase_id (${purchaseId})`);
    }
  } catch (error) {
    console.error('⚠️ Error sincronizando a service_records (no crítico):', error);
    // No lanzar error para no interrumpir el flujo principal
  }
}

