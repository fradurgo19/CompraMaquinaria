# Configuración de PostgreSQL 17 Local

Este documento describe cómo configurar y usar PostgreSQL 17 localmente para el sistema de gestión de compra de maquinaria usada.

## Requisitos Previos

- PostgreSQL 17 instalado en tu máquina local
- Node.js 18+ instalado
- Git

## 1. Crear la Base de Datos

Abre la terminal de PostgreSQL (psql) o pgAdmin y ejecuta:

```sql
-- Crear la base de datos
CREATE DATABASE maquinaria_usada;

-- Conectar a la base de datos
\c maquinaria_usada

-- Crear la extensión uuid-ossp para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear el schema auth (necesario para compatibilidad con Supabase)
CREATE SCHEMA IF NOT EXISTS auth;

-- Crear tabla de usuarios en auth
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

## 2. Ejecutar las Migraciones

Las migraciones se encuentran en `supabase/migrations/`. Para aplicarlas manualmente:

### Opción A: Usando psql

```bash
# Desde la raíz del proyecto
psql -U tu_usuario -d maquinaria_usada -f supabase/migrations/20251015221509_create_initial_schema.sql
psql -U tu_usuario -d maquinaria_usada -f supabase/migrations/20251015222311_seed_initial_data.sql
psql -U tu_usuario -d maquinaria_usada -f supabase/migrations/20251015230000_update_schema_complete.sql
```

### Opción B: Usando herramienta de migración

Si prefieres usar una herramienta de migración, puedes instalar `node-pg-migrate`:

```bash
npm install -g node-pg-migrate

# Ejecutar migraciones
node-pg-migrate up -m supabase/migrations --database-url-var DATABASE_URL
```

## 3. Crear Usuarios de Prueba

Para probar la aplicación, necesitas crear usuarios con diferentes roles:

```sql
-- Usuario: Sebastián (gestiona subastas)
INSERT INTO auth.users (id, email, encrypted_password)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'sebastian@partequipos.com',
  crypt('password123', gen_salt('bf'))
);

INSERT INTO users_profile (id, full_name, email, role)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Sebastián García',
  'sebastian@partequipos.com',
  'sebastian'
);

-- Usuario: Eliana (gestiona compras y pagos)
INSERT INTO auth.users (id, email, encrypted_password)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'eliana@partequipos.com',
  crypt('password123', gen_salt('bf'))
);

INSERT INTO users_profile (id, full_name, email, role)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Eliana Rodríguez',
  'eliana@partequipos.com',
  'eliana'
);

-- Usuario: Gerencia (ve todo)
INSERT INTO auth.users (id, email, encrypted_password)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'gerencia@partequipos.com',
  crypt('password123', gen_salt('bf'))
);

INSERT INTO users_profile (id, full_name, email, role)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'Director General',
  'gerencia@partequipos.com',
  'gerencia'
);

-- Usuario: Admin (gestiona todo el sistema)
INSERT INTO auth.users (id, email, encrypted_password)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  'admin@partequipos.com',
  crypt('password123', gen_salt('bf'))
);

INSERT INTO users_profile (id, full_name, email, role)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  'Administrador del Sistema',
  'admin@partequipos.com',
  'admin'
);
```

## 4. Configurar Variables de Entorno

Copia el archivo `.env.example` a `.env` y configura las variables:

```bash
cp .env.example .env
```

Edita `.env`:

```env
# Usar PostgreSQL local
VITE_USE_LOCAL_POSTGRES=true
VITE_DATABASE_URL=postgresql://tu_usuario:tu_password@localhost:5432/maquinaria_usada

# Comentar las variables de Supabase si usas PostgreSQL local
# VITE_SUPABASE_URL=
# VITE_SUPABASE_ANON_KEY=
```

## 5. Verificar la Configuración

Para verificar que todo está correctamente configurado:

```sql
-- Ver todas las tablas
\dt

-- Ver las políticas RLS
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
ORDER BY tablename;

-- Verificar función de obtener rol
SELECT get_user_role();

-- Ver los usuarios creados
SELECT id, full_name, email, role FROM users_profile;
```

## 6. Permisos y Roles

El sistema tiene 4 roles principales:

### Sebastián
- **Ve**: Subastas (solo las creadas por él), Máquinas vinculadas a sus subastas, Proveedores
- **Edita**: Subastas, Máquinas vinculadas, Proveedores

### Eliana
- **Ve**: Compras, Pagos, Costos (cost_items), Envíos (shipping), Máquinas vinculadas a compras, Proveedores
- **Edita**: Compras, Costos, Envíos, Proveedores

### Gerencia
- **Ve**: TODO (Subastas + Compras + Consolidado + Máquinas + Proveedores)
- **Edita**: Consolidado (management_table), puede revisar y aprobar

### Admin
- **Ve**: TODO
- **Edita**: TODO
- **Gestiona**: Usuarios, configuración del sistema

## 7. Estructura de Tablas

### Principales
1. **users_profile** - Perfiles de usuarios con roles
2. **suppliers** - Proveedores con información de contacto
3. **machines** - Máquinas (entidad central, se registra una sola vez)
4. **auctions** - Subastas (visible por Sebastián y Gerencia)
5. **purchases** - Compras (visible por Eliana y Gerencia)
6. **cost_items** - Costos adicionales (INLAND, GASTOS_PTO, FLETE, etc.)
7. **shipping** - Información de envío
8. **currency_rates** - Tasas de cambio
9. **management_table** - Consolidado de Gerencia ("AA2025" digital)

### Auxiliares
- **notifications** - Notificaciones del sistema

## 8. Vistas Útiles

El sistema incluye vistas para consultas comunes:

```sql
-- Ver subastas con información completa
SELECT * FROM v_auctions_complete;

-- Ver compras con información completa
SELECT * FROM v_purchases_complete;

-- Ver consolidado de gerencia
SELECT * FROM v_management_consolidado;
```

## 9. Triggers y Cálculos Automáticos

El sistema incluye varios triggers para automatizar cálculos:

- **FOB Value**: Se calcula automáticamente como `exw_value + fob_additional + disassembly_load`
- **Estimated Arrival**: Se calcula como `departure_date + 45 días`
- **Management Table**: Se actualiza automáticamente cuando se insertan/actualizan auctions, purchases o cost_items
- **updated_at**: Se actualiza automáticamente en todas las tablas

## 10. Backup y Restauración

### Crear backup

```bash
pg_dump -U tu_usuario -d maquinaria_usada -F c -b -v -f backup_$(date +%Y%m%d_%H%M%S).backup
```

### Restaurar backup

```bash
pg_restore -U tu_usuario -d maquinaria_usada -v backup_YYYYMMDD_HHMMSS.backup
```

## 11. Troubleshooting

### Error: "relation does not exist"
- Asegúrate de haber ejecutado todas las migraciones en orden
- Verifica que estás conectado a la base de datos correcta: `SELECT current_database();`

### Error: "permission denied for table"
- Verifica las políticas RLS: `SELECT * FROM pg_policies;`
- Asegúrate de que el usuario tiene un perfil en `users_profile`

### Error: "function get_user_role() does not exist"
- Ejecuta la migración completa `20251015230000_update_schema_complete.sql`

### Las políticas RLS no funcionan
- Verifica que RLS está habilitado: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`
- Asegúrate de que la función `auth.uid()` retorna el ID correcto del usuario autenticado

## 12. Conexión desde la Aplicación

La aplicación se conectará automáticamente usando la configuración en `.env`. Si estás usando Supabase, el cliente de Supabase manejará la autenticación y RLS automáticamente.

Si usas PostgreSQL local, necesitarás implementar autenticación JWT para que `auth.uid()` funcione correctamente con RLS.

## Recursos Adicionales

- [PostgreSQL 17 Documentation](https://www.postgresql.org/docs/17/)
- [Row Level Security (RLS)](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)
- [Supabase Documentation](https://supabase.com/docs)

