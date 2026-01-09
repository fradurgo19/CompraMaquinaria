# Guía de Migración de MQ a PDTE

## Opción 1: Desde la Consola del Navegador (Recomendado)

### Pasos:

1. **Abre la aplicación en el navegador** e inicia sesión con un usuario que tenga rol `eliana`

2. **Abre la consola del navegador**:
   - Presiona `F12` o `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Ve a la pestaña "Console"

3. **Ejecuta este código en la consola**:

```javascript
// Obtener el token de autenticación
const token = localStorage.getItem('token');
const API_URL = 'https://compra-maquinaria.vercel.app' || 'http://localhost:3000';

// Ejecutar la migración
fetch(`${API_URL}/api/purchases/migrate-mq-to-pdte`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
})
.then(response => response.json())
.then(data => {
  console.log('✅ Migración completada:', data);
  console.log(`📊 Total migrado: ${data.migrated?.length || 0} registros`);
  if (data.migrated && data.migrated.length > 0) {
    console.table(data.migrated.slice(0, 10)); // Mostrar primeros 10
  }
})
.catch(error => {
  console.error('❌ Error en la migración:', error);
});
```

4. **Revisa el resultado** en la consola. Deberías ver:
   - Un mensaje de éxito
   - El número de registros migrados
   - Una tabla con los primeros registros migrados

---

## Opción 2: Usando PowerShell (Windows)

### Pasos:

1. **Obtén tu token de autenticación**:
   - Abre la aplicación en el navegador
   - Abre la consola (F12)
   - Ejecuta: `localStorage.getItem('token')`
   - Copia el token que aparece

2. **Abre PowerShell** y ejecuta:

```powershell
# Reemplaza YOUR_TOKEN con el token que copiaste
$token = "YOUR_TOKEN"
$apiUrl = "https://compra-maquinaria.vercel.app/api/purchases/migrate-mq-to-pdte"

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
}

$response = Invoke-RestMethod -Uri $apiUrl -Method POST -Headers $headers

Write-Host "✅ Migración completada: $($response.message)"
Write-Host "📊 Total migrado: $($response.migrated.Count) registros"
```

---

## Opción 3: Usando curl (Linux/Mac/Windows con Git Bash)

### Pasos:

1. **Obtén tu token de autenticación** (igual que en Opción 2)

2. **Ejecuta en la terminal**:

```bash
# Reemplaza YOUR_TOKEN con el token que copiaste
TOKEN="YOUR_TOKEN"
API_URL="https://compra-maquinaria.vercel.app/api/purchases/migrate-mq-to-pdte"

curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

---

## Verificación Post-Migración

Después de ejecutar la migración, verifica que funcionó:

1. **En la aplicación**, ve a la página de Importaciones (`/importations`)
2. **Verifica** que los MQ ahora tienen formato `PDTE-XXXX` en lugar de `MQ-XXXXXX`
3. **Revisa los logs del backend** (si tienes acceso) para confirmar el mensaje de éxito

---

## Notas Importantes

- ⚠️ **La migración es irreversible** - Una vez ejecutada, los MQ antiguos se convertirán a formato PDTE
- ✅ **La migración es segura** - Solo afecta registros con formato `MQ-*`, no toca otros registros
- 🔒 **Requiere permisos de Eliana** - Solo usuarios con rol `eliana` pueden ejecutar la migración
- 📝 **Los números son secuenciales** - Se asignan en orden de creación (PDTE-0001, PDTE-0002, etc.)

---

## Solución de Problemas

### Error 401 (No autorizado)
- Verifica que estés logueado con un usuario con rol `eliana`
- Verifica que el token no haya expirado (cierra sesión y vuelve a iniciar)

### Error 403 (Prohibido)
- Asegúrate de que tu usuario tenga el rol `eliana`
- Contacta al administrador si necesitas permisos

### No se migran registros
- Verifica que existan registros con formato `MQ-*` en la base de datos
- Revisa los logs del backend para más detalles
