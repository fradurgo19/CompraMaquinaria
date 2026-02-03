# Verificación de Variables de Entorno

## ✅ Estado Actual

- ✅ `backend/.env` - **EXISTE**
- ✅ `.env.local` - **EXISTE**
- ✅ `backend/.env.example` - **CREADO** (plantilla)
- ✅ `.env.example` - **CREADO** (plantilla)

## 📋 Variables Requeridas - Backend (`backend/.env`)

### Base de Datos (Desarrollo Local)
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=maquinaria_usada
DB_USER=postgres
DB_PASSWORD=tu_password_postgresql_aqui
```

### Base de Datos (Producción - Supabase)
```env
# Usar uno de estos:
DATABASE_URL=postgresql://postgres.xxx:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres
# O
SUPABASE_DB_URL=postgresql://postgres.xxx:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres
```

### Autenticación
```env
JWT_SECRET=tu_jwt_secret_muy_seguro_aqui
```

### Supabase (Producción)
```env
SUPABASE_URL=https://hoqigshqvbnlicuvirpo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (service_role key)
SUPABASE_STORAGE_ENABLED=false  # true en producción
```

### Frontend/Backend URLs
```env
FRONTEND_URL=http://localhost:5173
VITE_FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000
```

### Email (Opcional)
```env
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_app_password_aqui
EMAIL_TO=correo_por_defecto@partequipos.com  # Correo por defecto para notificaciones generales
EMAIL_AUCTION_ALERTS=sdonado@partequiposusa.com  # Correo para alertas de subasta (mañana y 3 horas)
```

### Entorno
```env
NODE_ENV=development
PORT=3000
```

## 📋 Variables Requeridas - Frontend (`.env.local`)

### API Backend
```env
VITE_API_URL=http://localhost:3000
```

### Supabase
```env
VITE_SUPABASE_URL=https://hoqigshqvbnlicuvirpo.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (anon key)
```

### Frontend URL
```env
VITE_FRONTEND_URL=http://localhost:5173
```

## 🔍 Verificación Manual

Para verificar que tus archivos `.env` tienen todas las variables:

### Backend
1. Abre `backend/.env`
2. Verifica que tenga al menos:
   - `DB_PASSWORD` (para desarrollo local)
   - `JWT_SECRET`
   - `FRONTEND_URL`

### Frontend
1. Abre `.env.local`
2. Verifica que tenga al menos:
   - `VITE_API_URL`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## ⚠️ Importante

- Los archivos `.env` y `.env.local` están en `.gitignore` (no se suben a Git)
- Los archivos `.env.example` son plantillas y SÍ se suben a Git
- En producción (Vercel), las variables se configuran en el Dashboard de Vercel

## 🚀 Configuración en Vercel

Para configurar variables de entorno en Vercel:

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Agrega las siguientes variables:

### Variables de Email (si no están configuradas):
- `EMAIL_USER`: Tu correo Gmail (ej: `fradurgo19@gmail.com`)
- `EMAIL_PASS`: Tu App Password de Gmail
- `EMAIL_AUCTION_ALERTS`: `sdonado@partequiposusa.com` (para alertas de subasta)

### Nota sobre EMAIL_AUCTION_ALERTS:
- Esta variable es específica para las notificaciones de alerta de subasta (mañana y 3 horas)
- Si no está configurada, usará `sdonado@partequiposusa.com` por defecto
- Las notificaciones de "Subasta ganada" están actualmente pausadas

### Después de agregar las variables:
- Haz clic en **Save**
- Vercel puede requerir un nuevo deployment para que las variables surtan efecto
- Si es necesario, ve a **Deployments** y haz un nuevo deployment manual
