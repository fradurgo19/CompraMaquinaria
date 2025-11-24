# Comandos para Ejecutar Migración de Purchase Files

## Opción 1: Usando variable de entorno para contraseña (Recomendado)

```powershell
# 1. Navegar al directorio del proyecto
cd "C:\Users\Frank Duran\OneDrive - Partequipos S.A.S\Escritorio\CompraMaquinariaUsada\project"

# 2. Establecer la contraseña de PostgreSQL (si no está en .env)
$env:PGPASSWORD = "tu_contraseña_postgres"

# 3. Ejecutar la migración
psql -h localhost -U postgres -d maquinaria_usada -f "supabase\migrations\20251122_create_purchase_files.sql"
```

## Opción 2: Usando psql interactivo

```powershell
# 1. Navegar al directorio del proyecto
cd "C:\Users\Frank Duran\OneDrive - Partequipos S.A.S\Escritorio\CompraMaquinariaUsada\project"

# 2. Conectarse a PostgreSQL
psql -h localhost -U postgres -d maquinaria_usada

# 3. Dentro de psql, ejecutar:
\i supabase/migrations/20251122_create_purchase_files.sql

# 4. Verificar que la tabla se creó correctamente:
\dt purchase_files

# 5. Ver la estructura de la tabla:
\d purchase_files

# 6. Salir de psql:
\q
```

## Opción 3: Ejecutar SQL directamente desde psql

```powershell
# 1. Navegar al directorio del proyecto
cd "C:\Users\Frank Duran\OneDrive - Partequipos S.A.S\Escritorio\CompraMaquinariaUsada\project"

# 2. Ejecutar con contraseña en línea de comandos (menos seguro)
psql -h localhost -U postgres -d maquinaria_usada -f "supabase\migrations\20251122_create_purchase_files.sql"
# Te pedirá la contraseña interactivamente
```

## Verificar que la migración se ejecutó correctamente

```powershell
# Conectarse a la base de datos
psql -h localhost -U postgres -d maquinaria_usada

# Verificar que la tabla existe
SELECT table_name FROM information_schema.tables WHERE table_name = 'purchase_files';

# Verificar la estructura
\d purchase_files

# Verificar las políticas RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'purchase_files';

# Salir
\q
```

## Notas importantes:

1. **Reemplaza `tu_contraseña_postgres`** con tu contraseña real de PostgreSQL
2. Si tienes la contraseña en un archivo `.env`, puedes usar:
   ```powershell
   $env:PGPASSWORD = (Get-Content .env | Select-String "DB_PASSWORD").ToString().Split("=")[1].Trim()
   ```
3. Asegúrate de que PostgreSQL esté corriendo antes de ejecutar los comandos
4. La migración creará:
   - Tabla `purchase_files`
   - Índices para optimización
   - Políticas RLS para seguridad
   - Trigger para `updated_at`
   - Comentarios en la tabla

