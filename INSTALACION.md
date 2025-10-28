# Guía de Instalación Detallada

Esta guía te llevará paso a paso por la instalación del Sistema de Gestión de Compra de Maquinaria Usada.

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

### Requerido

- ✅ **Node.js 18 o superior** ([Descargar](https://nodejs.org/))
- ✅ **Git** ([Descargar](https://git-scm.com/))

### Opciones de Base de Datos (elegir una)

**Opción A: PostgreSQL 17 Local**
- ✅ **PostgreSQL 17** ([Descargar](https://www.postgresql.org/download/windows/))
- ✅ **pgAdmin** (incluido con PostgreSQL) para gestión visual

**Opción B: Supabase Cloud**
- ✅ Cuenta en [Supabase](https://supabase.com) (gratis)

## 🚀 Instalación Paso a Paso

### Paso 1: Clonar el Repositorio

```bash
# Abrir PowerShell o CMD en la ubicación deseada
cd C:\Users\TuUsuario\Documentos

# Clonar el repositorio
git clone <url-del-repositorio>
cd project
```

### Paso 2: Instalar Dependencias de Node

```bash
npm install
```

Esto instalará todas las dependencias necesarias definidas en `package.json`.

---

## 🐘 Opción A: Instalación con PostgreSQL 17 Local

### Paso 3A: Instalar PostgreSQL 17

1. Descarga PostgreSQL 17 desde https://www.postgresql.org/download/windows/
2. Ejecuta el instalador
3. Durante la instalación:
   - Selecciona todos los componentes (PostgreSQL Server, pgAdmin, Command Line Tools)
   - Establece una contraseña para el usuario `postgres` (¡guárdala!)
   - Puerto: 5432 (por defecto)
   - Locale: Spanish, Colombia (o el que prefieras)

### Paso 4A: Verificar Instalación de PostgreSQL

```powershell
# Abrir PowerShell y ejecutar
psql --version

# Debería mostrar algo como: psql (PostgreSQL) 17.x
```

Si no funciona, agrega PostgreSQL al PATH:
- Ruta típica: `C:\Program Files\PostgreSQL\17\bin`

### Paso 5A: Crear Base de Datos

```powershell
# Conectar a PostgreSQL (pedirá la contraseña)
psql -U postgres

# Dentro de psql, ejecutar:
CREATE DATABASE maquinaria_usada;

# Listar bases de datos para verificar
\l

# Salir
\q
```

### Paso 6A: Aplicar Migraciones Automáticamente

```powershell
# Desde la raíz del proyecto, ejecutar el script
.\scripts\apply-migrations.ps1
```

El script te pedirá:
- Usuario de PostgreSQL (por defecto: postgres)
- Contraseña de PostgreSQL
- Nombre de la base de datos (por defecto: maquinaria_usada)

El script aplicará:
1. Configuración inicial (schemas, extensiones, función auth.uid())
2. Schema inicial (tablas básicas)
3. Datos semilla (proveedores de ejemplo)
4. Schema completo (todas las tablas, políticas RLS, triggers)

### Paso 7A: Verificar que Todo Esté Correcto

```powershell
# Conectar a la base de datos
psql -U postgres -d maquinaria_usada

# Ver todas las tablas
\dt

# Debería mostrar:
# users_profile, suppliers, machines, auctions, purchases, 
# cost_items, shipping, currency_rates, management_table, notifications

# Ver usuarios de prueba
SELECT full_name, email, role FROM users_profile;

# Salir
\q
```

### Paso 8A: Configurar Variables de Entorno

Si usas Supabase Auth (recomendado):

Crear archivo `.env` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

Si usas PostgreSQL sin Supabase Auth (avanzado):

```env
VITE_DATABASE_URL=postgresql://postgres:tu_password@localhost:5432/maquinaria_usada
VITE_USE_LOCAL_POSTGRES=true
```

---

## ☁️ Opción B: Instalación con Supabase Cloud

### Paso 3B: Crear Proyecto en Supabase

1. Ve a https://supabase.com
2. Inicia sesión o crea una cuenta
3. Haz clic en "New Project"
4. Configura:
   - **Name**: Maquinaria Usada
   - **Database Password**: (genera una segura y guárdala)
   - **Region**: South America (o el más cercano)
   - **Pricing Plan**: Free

### Paso 4B: Obtener Credenciales

1. Una vez creado el proyecto, ve a **Settings** > **API**
2. Copia:
   - **Project URL** (algo como: https://abc123.supabase.co)
   - **anon public key** (una clave larga)

### Paso 5B: Aplicar Migraciones

1. Ve a **SQL Editor** en el panel de Supabase
2. Crea una nueva query
3. Copia y pega el contenido de cada archivo en orden:

#### Migración 1: Setup Inicial

```sql
-- Copiar y pegar contenido de scripts/setup-database.sql
-- Ejecutar
```

#### Migración 2: Schema Inicial

```sql
-- Copiar y pegar contenido de supabase/migrations/20251015221509_create_initial_schema.sql
-- Ejecutar
```

#### Migración 3: Datos Semilla

```sql
-- Copiar y pegar contenido de supabase/migrations/20251015222311_seed_initial_data.sql
-- Ejecutar
```

#### Migración 4: Schema Completo

```sql
-- Copiar y pegar contenido de supabase/migrations/20251015230000_update_schema_complete.sql
-- Ejecutar
```

### Paso 6B: Crear Usuarios de Prueba

1. Ve a **Authentication** > **Users** en Supabase
2. Haz clic en "Add user" > "Create new user"
3. Crea 4 usuarios:

   - Email: sebastian@partequipos.com, Password: sebastian123
   - Email: eliana@partequipos.com, Password: eliana123
   - Email: gerencia@partequipos.com, Password: gerencia123
   - Email: admin@partequipos.com, Password: admin123

4. Copia el **ID** de cada usuario creado

5. Ve a **SQL Editor** y ejecuta:

```sql
INSERT INTO users_profile (id, full_name, email, role)
VALUES 
  ('id-de-sebastian-aqui', 'Sebastián García', 'sebastian@partequipos.com', 'sebastian'),
  ('id-de-eliana-aqui', 'Eliana Rodríguez', 'eliana@partequipos.com', 'eliana'),
  ('id-de-gerencia-aqui', 'Director General', 'gerencia@partequipos.com', 'gerencia'),
  ('id-de-admin-aqui', 'Administrador del Sistema', 'admin@partequipos.com', 'admin');
```

Reemplaza los IDs con los IDs reales de los usuarios.

### Paso 7B: Configurar Variables de Entorno

Crear archivo `.env` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

Reemplaza con tus credenciales reales.

---

## 🎯 Pasos Finales (Ambas Opciones)

### Paso 8: Verificar Configuración

```bash
# Ver contenido de .env
cat .env   # Linux/Mac
type .env  # Windows
```

Debe mostrar las variables correctamente configuradas.

### Paso 9: Iniciar el Servidor de Desarrollo

```bash
npm run dev
```

Deberías ver algo como:

```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Paso 10: Abrir en el Navegador

1. Abre tu navegador
2. Ve a http://localhost:5173/
3. Deberías ver la página de login

### Paso 11: Iniciar Sesión

Prueba con alguno de los usuarios de prueba:

- **Usuario**: sebastian@partequipos.com
- **Contraseña**: sebastian123

O cualquiera de los otros usuarios creados.

---

## ✅ Verificación de Instalación Exitosa

Si todo funciona correctamente:

✅ El servidor de desarrollo está corriendo en http://localhost:5173/
✅ Puedes ver la página de login
✅ Puedes iniciar sesión con usuarios de prueba
✅ No hay errores en la consola del navegador (F12)
✅ Puedes navegar por las diferentes secciones según tu rol

---

## 🔧 Solución de Problemas Comunes

### Problema: "Cannot find module 'xxx'"

**Solución:**
```bash
# Eliminar node_modules y reinstalar
rm -rf node_modules
npm install
```

### Problema: "psql: command not found" (Windows)

**Solución:**
1. Agregar PostgreSQL al PATH de Windows
2. Buscar "Variables de entorno" en Windows
3. Editar "Path" en Variables del sistema
4. Agregar: `C:\Program Files\PostgreSQL\17\bin`
5. Reiniciar PowerShell

### Problema: "relation does not exist"

**Solución:**
```bash
# Verificar que todas las migraciones se aplicaron
psql -U postgres -d maquinaria_usada

# Ver tablas
\dt

# Si faltan tablas, volver a aplicar migraciones
.\scripts\apply-migrations.ps1
```

### Problema: "Invalid API key" con Supabase

**Solución:**
1. Verifica que copiaste la clave correcta (anon public, NO service_role)
2. Verifica que no haya espacios extras en el archivo .env
3. Reinicia el servidor de desarrollo (Ctrl+C y npm run dev)

### Problema: No puedo iniciar sesión

**Solución:**
```sql
-- Verificar que el usuario existe en auth.users
SELECT * FROM auth.users WHERE email = 'sebastian@partequipos.com';

-- Verificar que tiene perfil
SELECT * FROM users_profile WHERE email = 'sebastian@partequipos.com';

-- Si falta el perfil, crearlo
INSERT INTO users_profile (id, full_name, email, role)
VALUES ('id-del-usuario', 'Nombre', 'email@ejemplo.com', 'sebastian');
```

---

## 📚 Próximos Pasos

Una vez instalado correctamente:

1. Lee el [README.md](./README.md) para entender el sistema
2. Revisa [postgres-setup.md](./postgres-setup.md) para configuración avanzada
3. Explora las diferentes secciones del sistema con cada rol
4. Prueba crear subastas, compras, y ver el consolidado

---

## 🆘 Soporte

Si sigues teniendo problemas:

1. Verifica que seguiste todos los pasos en orden
2. Revisa los logs de error en la consola
3. Verifica los logs de PostgreSQL
4. Consulta la documentación de Supabase si usas cloud

---

¡Listo! Tu sistema debería estar funcionando correctamente. 🎉

