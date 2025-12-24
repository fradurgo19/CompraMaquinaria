/**
 * Servicio de sincronización bidireccional entre Preselección, Subasta y Compras
 * Cuando se actualiza un registro en cualquier módulo, se sincronizan los cambios
 * a los módulos relacionados
 */

import { pool } from '../db/connection.js';

/**
 * Sincronizar cambios de Preselección a Subasta
 * @param {string} preselectionId - ID de la preselección actualizada
 * @param {object} updates - Campos actualizados en la preselección
 */
export async function syncPreselectionToAuction(preselectionId, updates) {
  try {
    // Obtener la preselección con su auction_id
    const preselectionResult = await pool.query(
      'SELECT auction_id FROM preselections WHERE id = $1',
      [preselectionId]
    );

    if (preselectionResult.rows.length === 0 || !preselectionResult.rows[0].auction_id) {
      return; // No hay subasta relacionada
    }

    const { auction_id } = preselectionResult.rows[0];
    
    // Obtener machine_id de la auction relacionada
    const auctionResult = await pool.query(
      'SELECT machine_id FROM auctions WHERE id = $1',
      [auction_id]
    );
    
    if (auctionResult.rows.length === 0) {
      return; // La subasta no existe
    }
    
    const machine_id = auctionResult.rows[0].machine_id;

    // Campos que se sincronizan de preselection a auction
    const fieldsToSync = {
      // Campos de máquina (a través de machine_id)
      brand: 'brand',
      model: 'model',
      serial: 'serial',
      year: 'year',
      hours: 'hours',
      // Campos de especificaciones técnicas
      shoe_width_mm: 'shoe_width_mm',
      spec_pip: 'spec_pip',
      spec_blade: 'spec_blade',
      spec_pad: 'spec_pad',
      spec_cabin: 'spec_cabin',
      arm_type: 'arm_type',
      // Campos de subasta
      auction_date: 'date',
      lot_number: 'lot',
      suggested_price: 'price_max',
      supplier_name: 'supplier_id', // Necesita conversión
      comments: 'comments',
      auction_type: 'auction_type',
      location: 'location'
    };

    const machineUpdates = {};
    const auctionUpdates = {};

    // Separar campos de máquina vs campos de subasta
    for (const [key, value] of Object.entries(updates)) {
      const targetField = fieldsToSync[key];
      if (!targetField) continue;

      // Campos de máquina
      if (['brand', 'model', 'serial', 'year', 'hours', 'shoe_width_mm', 'spec_pip', 'spec_blade', 'spec_cabin', 'arm_type', 'spec_pad'].includes(key)) {
        machineUpdates[targetField] = value;
      }
      // Campos de subasta
      else if (['auction_date', 'lot_number', 'suggested_price', 'comments', 'auction_type', 'location'].includes(key)) {
        if (key === 'auction_date') {
          auctionUpdates.date = value;
        } else if (key === 'lot_number') {
          auctionUpdates.lot = value;
        } else if (key === 'suggested_price') {
          auctionUpdates.price_max = value;
        } else {
          auctionUpdates[targetField] = value;
        }
      }
      // supplier_name necesita conversión a supplier_id
      else if (key === 'supplier_name' && value) {
        const supplierResult = await pool.query(
          'SELECT id FROM suppliers WHERE LOWER(name) = LOWER($1)',
          [value]
        );
        if (supplierResult.rows.length > 0) {
          auctionUpdates.supplier_id = supplierResult.rows[0].id;
        }
      }
    }

    // Actualizar máquina si hay cambios
    if (Object.keys(machineUpdates).length > 0 && machine_id) {
      const machineFieldsArr = Object.keys(machineUpdates);
      const machineValuesArr = Object.values(machineUpdates);
      const machineSetClause = machineFieldsArr.map((field, index) => 
        `${field} = $${index + 1}`
      ).join(', ');

      await pool.query(
        `UPDATE machines SET ${machineSetClause}, updated_at = NOW() 
         WHERE id = $${machineFieldsArr.length + 1}`,
        [...machineValuesArr, machine_id]
      );

      console.log(`✅ Máquina sincronizada desde Preselección (ID: ${machine_id})`);
    }

    // Actualizar subasta si hay cambios
    if (Object.keys(auctionUpdates).length > 0) {
      const auctionFieldsArr = Object.keys(auctionUpdates);
      const auctionValuesArr = Object.values(auctionUpdates);
      const auctionSetClause = auctionFieldsArr.map((field, index) => 
        `${field} = $${index + 1}`
      ).join(', ');

      await pool.query(
        `UPDATE auctions SET ${auctionSetClause}, updated_at = NOW() 
         WHERE id = $${auctionFieldsArr.length + 1}`,
        [...auctionValuesArr, auction_id]
      );

      console.log(`✅ Subasta sincronizada desde Preselección (ID: ${auction_id})`);

      // Si la subasta tiene purchases relacionados, sincronizar también (solo location, no máquina)
      const purchasesResult = await pool.query(
        'SELECT id FROM purchases WHERE auction_id = $1',
        [auction_id]
      );
      if (purchasesResult.rows.length > 0 && auctionUpdates.location !== undefined) {
        for (const purchase of purchasesResult.rows) {
          await pool.query(
            'UPDATE purchases SET location = $1, updated_at = NOW() WHERE id = $2',
            [auctionUpdates.location, purchase.id]
          );
        }
        console.log(`✅ Compras sincronizadas desde Preselección (location)`);
      }
    }
  } catch (error) {
    console.error('Error sincronizando Preselección → Subasta:', error);
    // No lanzar error para no interrumpir la actualización principal
  }
}

/**
 * Sincronizar cambios de Subasta a Preselección
 * @param {string} auctionId - ID de la subasta actualizada
 * @param {object} auctionUpdates - Campos actualizados en la subasta
 * @param {object} machineUpdates - Campos actualizados en la máquina
 */
export async function syncAuctionToPreselection(auctionId, auctionUpdates, machineUpdates) {
  try {
    // Obtener la preselección relacionada
    const preselectionResult = await pool.query(
      'SELECT id FROM preselections WHERE auction_id = $1',
      [auctionId]
    );

    if (preselectionResult.rows.length === 0) {
      return; // No hay preselección relacionada
    }

    const preselectionId = preselectionResult.rows[0].id;
    const preselectionUpdates = {};

    // Mapear campos de auction a preselection
    if (auctionUpdates.date !== undefined) {
      preselectionUpdates.auction_date = auctionUpdates.date;
    }
    if (auctionUpdates.lot !== undefined) {
      preselectionUpdates.lot_number = auctionUpdates.lot;
    }
    if (auctionUpdates.price_max !== undefined) {
      preselectionUpdates.suggested_price = auctionUpdates.price_max;
    }
    if (auctionUpdates.comments !== undefined) {
      preselectionUpdates.comments = auctionUpdates.comments;
    }
    if (auctionUpdates.auction_type !== undefined) {
      preselectionUpdates.auction_type = auctionUpdates.auction_type;
    }
    if (auctionUpdates.location !== undefined) {
      preselectionUpdates.location = auctionUpdates.location;
    }

    // Mapear campos de máquina a preselection
    if (machineUpdates) {
      if (machineUpdates.brand !== undefined) preselectionUpdates.brand = machineUpdates.brand;
      if (machineUpdates.model !== undefined) preselectionUpdates.model = machineUpdates.model;
      if (machineUpdates.serial !== undefined) preselectionUpdates.serial = machineUpdates.serial;
      if (machineUpdates.year !== undefined) preselectionUpdates.year = machineUpdates.year;
      if (machineUpdates.hours !== undefined) preselectionUpdates.hours = machineUpdates.hours;
      if (machineUpdates.shoe_width_mm !== undefined) preselectionUpdates.shoe_width_mm = machineUpdates.shoe_width_mm;
      if (machineUpdates.spec_pip !== undefined) preselectionUpdates.spec_pip = machineUpdates.spec_pip;
      if (machineUpdates.spec_blade !== undefined) preselectionUpdates.spec_blade = machineUpdates.spec_blade;
      if (machineUpdates.spec_pad !== undefined) preselectionUpdates.spec_pad = machineUpdates.spec_pad;
      if (machineUpdates.spec_cabin !== undefined) preselectionUpdates.spec_cabin = machineUpdates.spec_cabin;
      if (machineUpdates.arm_type !== undefined) preselectionUpdates.arm_type = machineUpdates.arm_type;
    }

    // Actualizar preselección si hay cambios
    if (Object.keys(preselectionUpdates).length > 0) {
      const fields = Object.keys(preselectionUpdates);
      const values = Object.values(preselectionUpdates);
      const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');

      await pool.query(
        `UPDATE preselections SET ${setClause}, updated_at = NOW() 
         WHERE id = $${fields.length + 1}`,
        [...values, preselectionId]
      );

      console.log(`✅ Preselección sincronizada desde Subasta (ID: ${preselectionId})`);
    }
  } catch (error) {
    console.error('Error sincronizando Subasta → Preselección:', error);
  }
}

/**
 * Sincronizar cambios de Subasta a Compras
 * @param {string} auctionId - ID de la subasta actualizada
 * @param {object} auctionUpdates - Campos actualizados en la subasta
 * @param {object} machineUpdates - Campos actualizados en la máquina
 */
export async function syncAuctionToPurchases(auctionId, auctionUpdates, machineUpdates) {
  try {
    // Obtener purchases relacionados
    const purchasesResult = await pool.query(
      'SELECT id, machine_id FROM purchases WHERE auction_id = $1',
      [auctionId]
    );

    if (purchasesResult.rows.length === 0) {
      return; // No hay compras relacionadas
    }

    // Actualizar cada purchase relacionado
    for (const purchase of purchasesResult.rows) {
      // Los cambios en machines ya se aplicaron arriba, aquí solo sincronizamos campos específicos de purchase
      if (auctionUpdates.location !== undefined) {
        await pool.query(
          'UPDATE purchases SET location = $1, updated_at = NOW() WHERE id = $2',
          [auctionUpdates.location, purchase.id]
        );
      }

      console.log(`✅ Compra sincronizada desde Subasta (ID: ${purchase.id})`);
    }
  } catch (error) {
    console.error('Error sincronizando Subasta → Compras:', error);
  }
}

/**
 * Sincronizar cambios de Compras a Subasta y Preselección
 * @param {string} purchaseId - ID de la compra actualizada
 * @param {object} updates - Campos actualizados en la compra
 */
export async function syncPurchaseToAuctionAndPreselection(purchaseId, updates) {
  try {
    // Obtener la compra con su auction_id y machine_id
    const purchaseResult = await pool.query(
      'SELECT auction_id, machine_id FROM purchases WHERE id = $1',
      [purchaseId]
    );

    if (purchaseResult.rows.length === 0 || !purchaseResult.rows[0].auction_id) {
      return; // No hay subasta relacionada
    }

    const { auction_id, machine_id } = purchaseResult.rows[0];

    // Campos que se sincronizan de purchase a auction
    const fieldsToSync = {
      location: 'location'
    };

    const auctionUpdates = {};

    // Mapear campos
    for (const [key, value] of Object.entries(updates)) {
      if (fieldsToSync[key]) {
        auctionUpdates[fieldsToSync[key]] = value;
      }
    }

    // Actualizar subasta si hay cambios
    if (Object.keys(auctionUpdates).length > 0) {
      const auctionFieldsArr = Object.keys(auctionUpdates);
      const auctionValuesArr = Object.values(auctionUpdates);
      const auctionSetClause = auctionFieldsArr.map((field, index) => 
        `${field} = $${index + 1}`
      ).join(', ');

      await pool.query(
        `UPDATE auctions SET ${auctionSetClause}, updated_at = NOW() 
         WHERE id = $${auctionFieldsArr.length + 1}`,
        [...auctionValuesArr, auction_id]
      );

      console.log(`✅ Subasta sincronizada desde Compra (ID: ${auction_id})`);

      // Sincronizar también a preselección (directamente, sin llamar a la función para evitar bucles)
      const preselectionResult = await pool.query(
        'SELECT id FROM preselections WHERE auction_id = $1',
        [auction_id]
      );
      if (preselectionResult.rows.length > 0 && Object.keys(auctionUpdates).length > 0) {
        const preselectionId = preselectionResult.rows[0].id;
        const preselectionUpdates = {};
        if (auctionUpdates.location !== undefined) preselectionUpdates.location = auctionUpdates.location;
        if (Object.keys(preselectionUpdates).length > 0) {
          const fields = Object.keys(preselectionUpdates);
          const values = Object.values(preselectionUpdates);
          const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
          await pool.query(
            `UPDATE preselections SET ${setClause}, updated_at = NOW() WHERE id = $${fields.length + 1}`,
            [...values, preselectionId]
          );
          console.log(`✅ Preselección sincronizada desde Compra (ID: ${preselectionId})`);
        }
      }
    }

    // Si hay cambios en campos de máquina, actualizar la máquina
    const machineFields = ['brand', 'model', 'serial', 'year', 'hours'];
    const machineUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (machineFields.includes(key)) {
        machineUpdates[key] = value;
      }
    }

    if (Object.keys(machineUpdates).length > 0 && machine_id) {
      const machineFieldsArr = Object.keys(machineUpdates);
      const machineValuesArr = Object.values(machineUpdates);
      const machineSetClause = machineFieldsArr.map((field, index) => 
        `${field} = $${index + 1}`
      ).join(', ');

      await pool.query(
        `UPDATE machines SET ${machineSetClause}, updated_at = NOW() 
         WHERE id = $${machineFieldsArr.length + 1}`,
        [...machineValuesArr, machine_id]
      );

      console.log(`✅ Máquina sincronizada desde Compra (ID: ${machine_id})`);

      // Sincronizar cambios de máquina a preselección (directamente, sin llamar a la función para evitar bucles)
      const preselectionResult2 = await pool.query(
        'SELECT id FROM preselections WHERE auction_id = $1',
        [auction_id]
      );
      if (preselectionResult2.rows.length > 0 && Object.keys(machineUpdates).length > 0) {
        const preselectionId2 = preselectionResult2.rows[0].id;
        const preselectionMachineUpdates = {};
        if (machineUpdates.brand !== undefined) preselectionMachineUpdates.brand = machineUpdates.brand;
        if (machineUpdates.model !== undefined) preselectionMachineUpdates.model = machineUpdates.model;
        if (machineUpdates.serial !== undefined) preselectionMachineUpdates.serial = machineUpdates.serial;
        if (machineUpdates.year !== undefined) preselectionMachineUpdates.year = machineUpdates.year;
        if (machineUpdates.hours !== undefined) preselectionMachineUpdates.hours = machineUpdates.hours;
        if (machineUpdates.shoe_width_mm !== undefined) preselectionMachineUpdates.shoe_width_mm = machineUpdates.shoe_width_mm;
        if (machineUpdates.spec_pip !== undefined) preselectionMachineUpdates.spec_pip = machineUpdates.spec_pip;
        if (machineUpdates.spec_blade !== undefined) preselectionMachineUpdates.spec_blade = machineUpdates.spec_blade;
        if (machineUpdates.spec_cabin !== undefined) preselectionMachineUpdates.spec_cabin = machineUpdates.spec_cabin;
        if (machineUpdates.arm_type !== undefined) preselectionMachineUpdates.arm_type = machineUpdates.arm_type;
        
        if (Object.keys(preselectionMachineUpdates).length > 0) {
          const fields = Object.keys(preselectionMachineUpdates);
          const values = Object.values(preselectionMachineUpdates);
          const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
          await pool.query(
            `UPDATE preselections SET ${setClause}, updated_at = NOW() WHERE id = $${fields.length + 1}`,
            [...values, preselectionId2]
          );
          console.log(`✅ Preselección sincronizada desde Compra (campos de máquina, ID: ${preselectionId2})`);
        }
      }
    }
  } catch (error) {
    console.error('Error sincronizando Compra → Subasta/Preselección:', error);
  }
}
