# ⚡ Inicio Rápido - 5 Minutos

Guía ultra-rápida para tener el sistema funcionando en 5 minutos.

## 📋 Pre-requisitos

Asegúrate de tener instalado:
- ✅ Node.js 18+ ([Descargar](https://nodejs.org/))
- ✅ PostgreSQL 17 ([Descargar](https://www.postgresql.org/download/)) O cuenta en [Supabase](https://supabase.com)

---

## 🚀 Opción A: Con PostgreSQL Local (5 minutos)

### 1. Clonar e instalar
```powershell
git clone <repo-url>
cd project
npm install
```

### 2. Crear base de datos
```powershell
# Abrir psql
psql -U postgres

# Crear DB y salir
CREATE DATABASE maquinaria_usada;
\q
```

### 3. Aplicar migraciones
```powershell
.\scripts\apply-migrations.ps1
```
Ingresa tu contraseña de PostgreSQL cuando te lo pida.

### 4. Configurar .env
Crea archivo `.env`:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

### 5. Iniciar
```powershell
npm run dev
```

Abre http://localhost:5173/

### 6. Login
**Usuario**: sebastian@partequipos.com  
**Contraseña**: sebastian123

---

## ☁️ Opción B: Con Supabase Cloud (5 minutos)

### 1. Clonar e instalar
```bash
git clone <repo-url>
cd project
npm install
```

### 2. Crear proyecto en Supabase
- Ve a [supabase.com](https://supabase.com)
- Crea nuevo proyecto
- Copia URL y ANON KEY

### 3. Aplicar migraciones
Ve a SQL Editor en Supabase y ejecuta en orden:
1. `scripts/setup-database.sql`
2. `supabase/migrations/20251015221509_create_initial_schema.sql`
3. `supabase/migrations/20251015222311_seed_initial_data.sql`
4. `supabase/migrations/20251015230000_update_schema_complete.sql`

### 4. Crear usuarios
En Authentication > Users, crea:
- sebastian@partequipos.com (password: sebastian123)
- eliana@partequipos.com (password: eliana123)
- gerencia@partequipos.com (password: gerencia123)
- admin@partequipos.com (password: admin123)

Luego en SQL Editor:
```sql
INSERT INTO users_profile (id, full_name, email, role)
VALUES 
  ('id-sebastian', 'Sebastián García', 'sebastian@partequipos.com', 'sebastian'),
  ('id-eliana', 'Eliana Rodríguez', 'eliana@partequipos.com', 'eliana'),
  ('id-gerencia', 'Director General', 'gerencia@partequipos.com', 'gerencia'),
  ('id-admin', 'Admin Sistema', 'admin@partequipos.com', 'admin');
```
(Reemplaza los IDs con los reales)

### 5. Configurar .env
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-real
```

### 6. Iniciar
```bash
npm run dev
```

Abre http://localhost:5173/

---

## ✅ Verificar que Funciona

1. ✅ Puedes ver la página de login
2. ✅ Puedes iniciar sesión con sebastian@partequipos.com
3. ✅ Ves el menú de navegación
4. ✅ Puedes navegar a "Subastas"
5. ✅ No hay errores en la consola (F12)

---

## 🎯 Primeros Pasos

### Como Sebastián (Subastas)
1. Ve a "Subastas"
2. Clic en "Nueva Subasta"
3. Completa el formulario
4. Guarda

### Como Eliana (Compras)
1. Login con eliana@partequipos.com / eliana123
2. Ve a "Compras"
3. Clic en "Nueva Compra"
4. Completa el formulario
5. Agrega costos
6. Guarda

### Como Gerencia (Consolidado)
1. Login con gerencia@partequipos.com / gerencia123
2. Ve a "Consolidado"
3. Ve todas las máquinas
4. Edita proyecciones
5. Exporta a Excel

---

## 🆘 Problemas Comunes

### "Cannot connect to database"
```powershell
# Verifica que PostgreSQL está corriendo
Get-Service postgresql*
# Si no, inicialo:
Start-Service postgresql-x64-17
```

### "psql: command not found"
Agrega PostgreSQL al PATH:
- `C:\Program Files\PostgreSQL\17\bin`
- Reinicia PowerShell

### "Invalid API key"
- Verifica que copiaste la ANON key (no service_role)
- Verifica que no hay espacios extra en .env
- Reinicia el servidor (Ctrl+C y npm run dev)

### "No tienes permisos"
```sql
-- Verifica que el usuario tiene perfil
SELECT * FROM users_profile WHERE email = 'tu-email@example.com';

-- Si no existe, créalo:
INSERT INTO users_profile (id, full_name, email, role)
VALUES ('id-del-usuario', 'Nombre', 'email@example.com', 'rol');
```

---

## 📚 Más Información

- **Documentación Completa**: [README.md](./README.md)
- **Guía de Instalación**: [INSTALACION.md](./INSTALACION.md)
- **Configuración PostgreSQL**: [postgres-setup.md](./postgres-setup.md)

---

## 🎉 ¡Listo!

Si llegaste hasta aquí sin errores, **¡felicitaciones!** 🎊

El sistema está funcionando y listo para usar.

---

**Tiempo estimado**: 5 minutos  
**Dificultad**: ⭐⭐☆☆☆ (Fácil)  
**Próximo paso**: Explorar el sistema con diferentes roles

