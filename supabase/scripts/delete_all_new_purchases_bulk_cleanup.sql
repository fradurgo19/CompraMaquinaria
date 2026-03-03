-- =====================================================
-- Script: Eliminar SOLO registros del módulo Compras Nuevas (NewPurchasesPage)
-- Uso: Ejecutar en Supabase SQL Editor para vaciar Compras Nuevas y poder
--      volver a subir un archivo por carga masiva.
--
-- Alcance (no daña lógica ni otros módulos):
--   - Solo se eliminan filas de new_purchases (origen de NewPurchasesPage).
--   - Solo se eliminan equipments con new_purchase_id IS NOT NULL (vinculados
--     a Compras Nuevas). No se tocan equipments que solo tienen purchase_id
--     (módulo Compras / Equipos).
--   - service_records y change_logs asociados a new_purchases.
--
-- CASCADE automático: new_purchase_files (al borrar new_purchases),
-- equipment_reservations (al borrar equipments).
-- =====================================================

BEGIN;

-- 1. Solo equipments vinculados a Compras Nuevas (new_purchase_id IS NOT NULL).
--    Equipments con solo purchase_id (Compras/Equipos) no se tocan.
DELETE FROM equipments
WHERE new_purchase_id IS NOT NULL;

-- 2. Solo service_records vinculados a new_purchases
DELETE FROM service_records
WHERE new_purchase_id IS NOT NULL;

-- 3. Solo historial de cambios de la tabla new_purchases
DELETE FROM change_logs
WHERE table_name = 'new_purchases';

-- 4. Todos los registros de Compras Nuevas (NewPurchasesPage). CASCADE borra new_purchase_files
DELETE FROM new_purchases;

COMMIT;

-- Verificación opcional tras ejecutar: deben dar 0
-- SELECT (SELECT COUNT(*) FROM new_purchases) AS new_purchases_restantes,
--        (SELECT COUNT(*) FROM equipments WHERE new_purchase_id IS NOT NULL) AS equipments_con_new_purchase_restantes;
