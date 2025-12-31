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
```

### OneDrive (Opcional)
```env
ONEDRIVE_CLIENT_ID=tu_client_id
ONEDRIVE_CLIENT_SECRET=tu_client_secret
ONEDRIVE_TENANT_ID=tu_tenant_id
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

### OneDrive (Opcional)
```env
VITE_ONEDRIVE_CLIENT_ID=tu_client_id
VITE_ONEDRIVE_TENANT_ID=tu_tenant_id
VITE_ONEDRIVE_REDIRECT_URI=http://localhost:5173
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

