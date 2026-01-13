# Análisis Profundo: Problema con Campos Inline Editables

## Campos Problemáticos
1. **FOB ORIGEN** - Se cierra automáticamente
2. **OCEAN (USD)** - Se cierra automáticamente  
3. **GASTO PTO (COP)** - Se cierra automáticamente
4. **PPTO DE REPARACION (COP)** - Se cierra automáticamente

## Campo Funcional (Referencia)
- **TRASLADOS NACIONALES (COP)** - Funciona correctamente

## Diferencias Estructurales Encontradas

### 1. FOB ORIGEN (línea 2601)
```tsx
<div className="flex flex-col items-end gap-1">  // ⚠️ gap-1 (diferente)
  {canEditManagementFields() ? (  // ⚠️ Condicional
    <InlineCell>
      <InlineFieldEditor ... />
    </InlineCell>
  ) : (
    <span>...</span>
  )}
</div>
```
**Diferencias:**
- `gap-1` en lugar de `gap-2`
- Tiene condicional `canEditManagementFields()`
- TD tiene clases condicionales más complejas

### 2. OCEAN (USD) (línea 2644)
```tsx
<td className="relative ...">  // ⚠️ className="relative"
  <div className="flex flex-col items-end gap-2">
    <InlineCell>
      <InlineFieldEditor ... />
    </InlineCell>
  </div>
</td>
```
**Diferencias:**
- TD tiene `className="relative"` - podría causar problemas de z-index
- `gap-2` (igual a TRASLADOS)
- NO tiene condicional

### 3. GASTO PTO (COP) (línea 2841)
```tsx
<div className="flex flex-col items-end gap-2">
  <InlineCell>
    <InlineFieldEditor ... />
  </InlineCell>
</div>
```
**Estructura IDÉNTICA a TRASLADOS NACIONALES** - pero no funciona

### 4. PPTO DE REPARACION (COP) (línea 2946)
```tsx
<div className="flex flex-col items-end gap-2">
  <div className="flex items-center justify-end gap-2">  // ⚠️ Wrapper adicional
    <InlineCell>
      <InlineFieldEditor ... />
    </InlineCell>
  </div>
</div>
```
**Diferencias:**
- Tiene un wrapper `<div>` adicional que envuelve el InlineCell
- Esto podría estar interfiriendo con los eventos de click/focus

### 5. TRASLADOS NACIONALES (COP) - FUNCIONA (línea 2877)
```tsx
<div className="flex flex-col items-end gap-2">
  <InlineCell>
    <InlineFieldEditor ... />
  </InlineCell>
</div>
```
**Estructura simple y limpia - esta es la referencia**

## Hipótesis del Problema

1. **FOB ORIGEN**: El `gap-1` y el condicional podrían estar causando re-renders que cierran el editor
2. **OCEAN (USD)**: El `className="relative"` en el TD podría estar interfiriendo con el z-index del editor
3. **GASTO PTO**: Estructura idéntica a TRASLADOS pero no funciona - podría ser un problema de orden en el DOM o eventos que se propagan
4. **PPTO DE REPARACION**: El wrapper div adicional podría estar capturando eventos antes de que lleguen al InlineFieldEditor

## Solución Propuesta

1. Estandarizar todos los campos a la estructura de TRASLADOS NACIONALES
2. Remover `className="relative"` del TD de OCEAN
3. Remover el wrapper div adicional de PPTO DE REPARACION
4. Cambiar `gap-1` a `gap-2` en FOB ORIGEN
5. Verificar si el condicional `canEditManagementFields()` está causando re-renders
