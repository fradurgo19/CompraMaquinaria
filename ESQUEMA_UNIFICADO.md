# 🎯 Esquema Unificado: Purchases y New_Purchases

## 📋 Resumen

Esta migración elimina la necesidad de **espejos duplicados** entre `purchases` y `new_purchases`, permitiendo que `equipments` y `service_records` referencien directamente ambas tablas.

## ✅ Ventajas del Esquema Unificado

### 1. **Sin Duplicación de Datos**
- ❌ **Antes**: Datos duplicados en `purchases` (espejo)
- ✅ **Ahora**: Datos en un solo lugar (`new_purchases`)

### 2. **Sincronización Automática con Triggers**
- Los triggers de Supabase sincronizan automáticamente
- No requiere código manual en el backend
- Más confiable y mantenible

### 3. **Vista Unificada para Consultas**
- `v_unified_purchases` combina ambas tablas
- Consultas simplificadas en todos los módulos
- Un solo punto de acceso a los datos

### 4. **Mejor para Producción en Supabase**
- Aprovecha triggers nativos de PostgreSQL
- Mejor rendimiento (sin sincronización manual)
- Escalable y mantenible

## 🔧 Cambios Implementados

### 1. **Modificaciones en Tablas**

#### `equipments`
- `purchase_id` ahora es **nullable**
- Ya tenía `new_purchase_id` (agregado anteriormente)
- Constraint: al menos uno debe existir

#### `service_records`
- `purchase_id` ahora es **nullable**
- Agregado `new_purchase_id`
- Constraint: al menos uno debe existir

### 2. **Vista Unificada**

```sql
SELECT * FROM v_unified_purchases;
```

Combina `purchases` y `new_purchases` en una sola vista con todos los campos necesarios.

### 3. **Triggers Automáticos**

#### `sync_new_purchase_to_equipment()`
- Se ejecuta cuando se crea/actualiza un `new_purchase`
- Crea/actualiza automáticamente el registro en `equipments`

#### `sync_new_purchase_to_service()`
- Se ejecuta cuando se crea/actualiza un `new_purchase`
- Crea/actualiza automáticamente el registro en `service_records`

## 📝 Cómo Usar

### En el Backend

**Antes (con espejos):**
```javascript
// Crear espejo manualmente
await createPurchaseMirror(newPurchase);
```

**Ahora (automático):**
```javascript
// Solo crear new_purchase, los triggers hacen el resto
await pool.query('INSERT INTO new_purchases ...');
// ✅ equipment y service_record se crean automáticamente
```

### En las Consultas

**Usar la vista unificada:**
```sql
SELECT * FROM v_unified_purchases 
WHERE mq = 'MQ-12345';
```

**O consultar directamente:**
```sql
-- Equipments puede venir de purchase o new_purchase
SELECT * FROM equipments e
LEFT JOIN purchases p ON e.purchase_id = p.id
LEFT JOIN new_purchases np ON e.new_purchase_id = np.id;
```

## 🚀 Migración

### 1. Aplicar la Migración

```bash
# En desarrollo local
psql -U postgres -d maquinaria_usada -f supabase/migrations/20251128_unified_purchases_schema.sql

# En Supabase (se aplicará automáticamente al hacer push)
```

### 2. Actualizar Backend

- Remover función `createPurchaseMirror()` (ya no necesaria)
- Los triggers hacen la sincronización automáticamente
- Actualizar consultas para usar la vista unificada (opcional)

### 3. Verificar

```sql
-- Verificar que los triggers funcionan
INSERT INTO new_purchases (mq, supplier_name, model, serial, ...) VALUES (...);
-- Debe crear automáticamente en equipments y service_records

-- Verificar la vista
SELECT * FROM v_unified_purchases LIMIT 10;
```

## ⚠️ Notas Importantes

1. **Datos Existentes**: Los registros existentes con espejos seguirán funcionando
2. **Compatibilidad**: Los módulos existentes seguirán funcionando sin cambios
3. **Rendimiento**: Los triggers son muy eficientes en PostgreSQL/Supabase
4. **Rollback**: Si necesitas revertir, puedes deshabilitar los triggers

## 🔄 Próximos Pasos

1. ✅ Aplicar migración
2. ✅ Actualizar backend para remover `createPurchaseMirror()`
3. ✅ Probar creación de `new_purchases` y verificar sincronización automática
4. ✅ Actualizar consultas para usar vista unificada (opcional, mejora rendimiento)

## 📊 Comparación

| Aspecto | Espejos | Esquema Unificado |
|---------|---------|-------------------|
| Duplicación | ❌ Sí | ✅ No |
| Sincronización | Manual (código) | Automática (triggers) |
| Mantenibilidad | Media | Alta |
| Rendimiento | Medio | Alto |
| Escalabilidad | Limitada | Excelente |
| Compatible Supabase | ✅ | ✅✅ |

