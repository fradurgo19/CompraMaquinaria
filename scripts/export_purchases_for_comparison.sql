-- Query para exportar compras y comparar con archivo de carga masiva
-- Usar esta query en Supabase SQL Editor para exportar a CSV/Excel

-- ============================================================================
-- PRIMERO: Verifica cuántos registros hay en total
-- ============================================================================
SELECT COUNT(*) as total_registros FROM purchases;

-- Si quieres ver cuántos se crearon recientemente:
-- SELECT COUNT(*) as registros_recientes 
-- FROM purchases 
-- WHERE created_at >= CURRENT_DATE - INTERVAL '2 days';

-- ============================================================================
-- QUERY PRINCIPAL: Exportar TODAS las compras
-- ============================================================================

-- Opción 1: Exportar TODAS las compras con campos clave para identificación
-- IMPORTANTE: El SQL Editor de Supabase muestra solo 100 filas por defecto
-- Para descargar TODOS los registros, usa el botón "Download CSV" que descarga TODOS los resultados
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
    created_at as fecha_creacion,
    updated_at as fecha_actualizacion
FROM purchases
ORDER BY created_at DESC
LIMIT 10000;  -- Límite alto para asegurar que descargue todos (ajusta si tienes más de 10,000 registros)

-- Opción 2: Exportar solo compras creadas HOY (últimas 24 horas)
-- Ajusta la fecha según cuando hiciste la carga masiva
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
    created_at as fecha_creacion,
    updated_at as fecha_actualizacion
FROM purchases
WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY created_at DESC;

-- Opción 3: Exportar compras creadas en un rango de fechas específico
-- Reemplaza las fechas con tu rango específico
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
    created_at as fecha_creacion,
    updated_at as fecha_actualizacion
FROM purchases
WHERE created_at >= '2026-01-XX'::timestamp  -- Reemplaza XX con tu fecha inicial
  AND created_at < '2026-01-XX'::timestamp   -- Reemplaza XX con tu fecha final
ORDER BY created_at DESC;

-- Opción 4: Exportar con campos adicionales útiles para cruzar datos
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
    exw_value_formatted as valor_bp,
    created_at as fecha_creacion,
    updated_at as fecha_actualizacion
FROM purchases
WHERE created_at >= CURRENT_DATE - INTERVAL '2 days'  -- Ajusta según necesites
ORDER BY created_at DESC
LIMIT 10000;  -- Asegura descargar todos los registros recientes

-- Opción 5: Si necesitas descargar MÁS de 10,000 registros, usa paginación
-- Ejecuta esta query múltiples veces cambiando OFFSET:
-- Primera ejecución (registros 1-10000):
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
    created_at as fecha_creacion,
    updated_at as fecha_actualizacion
FROM purchases
ORDER BY created_at DESC
LIMIT 10000 OFFSET 0;

-- Segunda ejecución (registros 10001-20000):
-- LIMIT 10000 OFFSET 10000;
-- Y así sucesivamente hasta descargar todos

-- ============================================================================
-- INSTRUCCIONES PARA DESCARGAR TODOS LOS REGISTROS (NO SOLO 100)
-- ============================================================================
-- 
-- IMPORTANTE: El SQL Editor de Supabase solo MUESTRA 100 filas en pantalla,
-- pero el botón "Download CSV" descarga TODOS los resultados de la query.
--
-- PASOS:
-- 1. Abre Supabase Dashboard -> SQL Editor
-- 2. Copia y pega una de las queries de arriba (preferiblemente Opción 1 o 4)
-- 3. Ajusta las fechas si usas Opción 3
-- 4. Ejecuta la query (RUN) - verás solo 100 filas en pantalla (ES NORMAL)
-- 5. IMPORTANTE: Haz click en el botón "Download CSV" (NO uses "Copy")
--    Este botón descarga TODOS los registros que devuelve la query
-- 6. Abre el CSV descargado en Excel - deberías ver todos los registros
-- 7. Cruza con tu archivo original usando combinación de:
--    - modelo + serial (más confiable)
--    - O modelo + marca + proveedor
--    - O mq (si tienes MQ en tu archivo)
--
-- SI EL BOTÓN "Download CSV" NO DESCARGA TODOS:
-- - Verifica que el LIMIT en la query sea suficientemente alto
-- - Usa la Opción 5 (query con paginación) para descargar por lotes
-- ============================================================================
