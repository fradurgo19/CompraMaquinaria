-- ============================================================================
-- ⚠️ IMPORTANTE: LÍMITE DE 100 REGISTROS EN SUPABASE SQL EDITOR
-- ============================================================================
-- 
-- El botón "Download CSV" en Supabase SQL Editor SOLO descarga 100 registros.
-- Si tienes más de 100 registros (como 366), NO descargarás todos.
--
-- SOLUCIÓN RECOMENDADA: Usar el endpoint del backend
-- GET http://localhost:3001/api/purchases/export
-- (Ver instrucciones abajo)
--
-- ============================================================================
-- OPCIÓN 1: USAR ENDPOINT DEL BACKEND (SIN LÍMITES) ⭐ RECOMENDADO
-- ============================================================================
-- 
-- 1. Inicia el backend: cd backend && npm start
-- 2. Abre tu navegador en: http://localhost:3001/api/purchases/export
--    (debes estar autenticado)
-- 3. O usa curl:
--    curl -H "Authorization: Bearer TU_TOKEN" http://localhost:3001/api/purchases/export -o compras.csv
--
-- ============================================================================
-- OPCIÓN 2: USAR QUERY CON PAGINACIÓN (si prefieres Supabase)
-- ============================================================================
-- 
-- Descarga en múltiples archivos y combínalos en Excel:
-- 
-- Archivo 1 (registros 1-100):
-- SELECT ... LIMIT 100 OFFSET 0;
--
-- Archivo 2 (registros 101-200):
-- SELECT ... LIMIT 100 OFFSET 100;
--
-- Archivo 3 (registros 201-300):
-- SELECT ... LIMIT 100 OFFSET 200;
--
-- Y así sucesivamente...
--
-- ============================================================================

-- Query para descargar TODAS las compras
SELECT 
    id,
    mq,
    supplier_name as proveedor,
    model as modelo,
    serial as serial,
    brand as marca,
    invoice_date as fecha_factura,
    invoice_number as numero_factura,
    purchase_order as orden_compra,
    purchase_type as tipo_compra,
    incoterm,
    currency_type as moneda,
    location as ubicacion,
    port_of_embarkation as puerto_embarque,
    shipment_type_v2 as metodo_embarque,
    created_at as fecha_creacion,
    updated_at as fecha_actualizacion
FROM purchases
ORDER BY created_at DESC;

-- ============================================================================
-- NOTA IMPORTANTE SOBRE EL LÍMITE DE 100 FILAS VISIBLES:
-- ============================================================================
-- 
-- El SQL Editor de Supabase SOLO MUESTRA 100 filas en pantalla.
-- PERO el botón "Download CSV" descarga TODOS los resultados de la query.
-- 
-- Si no ves todos los registros en la pantalla, es normal.
-- El CSV descargado sí contendrá todos los registros.
--
-- Si tienes dudas, primero ejecuta:
-- SELECT COUNT(*) FROM purchases;
-- Y verifica que el CSV descargado tenga esa misma cantidad de filas.
--
-- ============================================================================
