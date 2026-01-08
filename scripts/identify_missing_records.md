# Guía para Identificar Registros Faltantes en Carga Masiva

## Problema
Se cargaron 366 registros de 368 del archivo. Necesitas identificar cuáles 2 registros no se subieron.

## Solución Paso a Paso

### Paso 1: Exportar Datos (Opciones)

#### **Opción A: Usar Endpoint del Backend (RECOMENDADO - Sin límite de registros)**

1. **Inicia el backend si no está corriendo:**
   ```powershell
   cd backend
   npm start
   ```

2. **Abre tu navegador o usa curl/Postman:**
   - En el navegador (debes estar autenticado):
     ```
     http://localhost:3001/api/purchases/export
     ```
   - Con curl (reemplaza `TU_TOKEN` con tu token de autenticación):
     ```bash
     curl -H "Authorization: Bearer TU_TOKEN" http://localhost:3001/api/purchases/export -o compras_subidas.csv
     ```
   - O simplemente abre el navegador en tu app, ve a la página de compras, abre la consola del navegador (F12) y ejecuta:
     ```javascript
     fetch('/api/purchases/export', {
       headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
     }).then(r => r.blob()).then(blob => {
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url;
       a.download = 'compras_subidas.csv';
       a.click();
     });
     ```

3. **El archivo se descargará automáticamente con TODOS los registros (sin límite de 100)**

#### **Opción B: Usar Supabase SQL Editor con Paginación**

**⚠️ NOTA:** El botón "Download CSV" en Supabase limita a 100 registros. Usa paginación si tienes más de 100:

1. **Ejecuta esta query en lotes (primero 100):**

```sql
SELECT 
    mq,
    supplier_name as proveedor,
    model as modelo,
    serial as serial,
    brand as marca,
    invoice_date as fecha_factura,
    invoice_number as numero_factura,
    purchase_order as orden_compra,
    purchase_type as tipo_compra,
    created_at as fecha_creacion
FROM purchases
ORDER BY created_at DESC
LIMIT 100 OFFSET 0;
```

2. **Descarga CSV, luego ejecuta con OFFSET 100, luego 200, etc.**

3. **Combina los CSV descargados en Excel**

#### **Opción C: Verificar desde la aplicación**

Si tienes acceso a la aplicación en producción:
1. Ve a `/purchases` 
2. Verifica cuántos registros hay en total
3. Usa el endpoint de exportación desde la consola del navegador (ver Opción A)

### Paso 2: Preparar tu Archivo Original

1. Abre tu archivo Excel original con los 368 registros
2. Asegúrate de tener columnas: `MODELO`, `SERIAL`, `MARCA`, `PROVEEDOR`, `MQ` (si aplica)
3. Guarda como CSV: `archivo_original.csv`

### Paso 3: Comparar en Excel

#### Opción A: Usar VLOOKUP (Recomendado)

1. En tu archivo Excel original, crea una columna nueva "¿Subido?"
2. En la celda de la nueva columna (por ejemplo, columna AA), usa esta fórmula:

```excel
=IF(ISERROR(VLOOKUP(B2&C2, Sheet2!B:B&Sheet2!C:C, 1, FALSE)), "NO", "SÍ")
```

O mejor, usando una combinación de MODELO y SERIAL:

```excel
=IF(ISERROR(VLOOKUP(B2&C2, Sheet2!$B$2:$C$400, 1, FALSE)), "NO SUBIDO", "SÍ")
```

Donde:
- `B2` = MODELO en tu archivo original
- `C2` = SERIAL en tu archivo original
- `Sheet2` = Hoja donde importaste los datos de Supabase
- `Sheet2!$B$2:$C$400` = Rango donde están MODELO y SERIAL de Supabase

#### Opción B: Usar COUNTIFS (Más Simple)

1. Crea una columna "¿Subido?" en tu archivo original
2. Usa esta fórmula:

```excel
=IF(COUNTIFS(Sheet2!$B:$B, B2, Sheet2!$C:$C, C2) > 0, "SÍ", "NO")
```

Donde:
- `B2` = MODELO
- `C2` = SERIAL
- `Sheet2!$B:$B` = Columna MODELO en datos de Supabase
- `Sheet2!$C:$C` = Columna SERIAL en datos de Supabase

3. Arrastra la fórmula hacia abajo para todas las filas
4. Filtra por "NO" para ver los registros faltantes

#### Opción C: Usar Power Query (Más Avanzado)

1. Excel → Datos → Obtener datos → Desde archivo → Desde CSV
2. Importa ambos archivos como tablas
3. Datos → Combinar consultas → Combinar
4. Selecciona las columnas de coincidencia (MODELO + SERIAL)
5. Selecciona "Solo filas de la primera tabla" para ver qué falta

### Paso 4: Identificar los 2 Registros Faltantes

1. Filtra tu archivo original por "¿Subido?" = "NO"
2. Verás los 2 registros que no se subieron
3. Anota los valores de MODELO, SERIAL, MARCA, PROVEEDOR para identificarlos

### Paso 5: Verificar Por Qué No Se Subieron

Puedes revisar los logs del backend o verificar:
- Si tienen MODELO o SERIAL (al menos uno es requerido)
- Si el PROVEEDOR está en la lista permitida
- Si la MONEDA es válida
- Si hay algún error de validación específico

## Query Alternativa: Ver Registros Creados por Usuario Específico

Si sabes qué usuario hizo la carga, puedes filtrar por ese usuario:

```sql
SELECT 
    p.mq,
    p.supplier_name as proveedor,
    p.model as modelo,
    p.serial as serial,
    p.brand as marca,
    p.invoice_date as fecha_factura,
    p.created_at as fecha_creacion,
    u.email as creado_por
FROM purchases p
LEFT JOIN auth.users u ON p.created_by = u.id
WHERE p.created_at >= CURRENT_DATE - INTERVAL '2 days'
ORDER BY p.created_at DESC;
```

## Consejo Adicional

Si en tu archivo original tienes un número de fila o ID único, agrégalo también a la comparación para mayor precisión.
