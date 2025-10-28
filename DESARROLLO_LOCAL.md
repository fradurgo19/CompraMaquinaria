# 🚀 Guía de Desarrollo Local

Sistema completo con PostgreSQL 17 + Backend Node.js + Frontend React

## 📋 Arquitectura

```
┌─────────────────┐      ┌──────────────────┐      ┌───────────────────┐
│   Frontend      │─────→│   Backend API    │─────→│  PostgreSQL 17    │
│  React + Vite   │      │  Node + Express  │      │   (Base de Datos) │
│  localhost:5173 │      │  localhost:3000  │      │   localhost:5432  │
└─────────────────┘      └──────────────────┘      └───────────────────┘
```

---

## ✅ Paso 1: Verificar Requisitos

### Ya tienes instalado:
✅ PostgreSQL 17 (corriendo)  
✅ Base de datos `maquinaria_usada` (creada)  
✅ Node.js 18+ (instalado)  
✅ Dependencias frontend (instaladas)

---

## 🔧 Paso 2: Configurar Backend

### 2.1 Instalar dependencias del backend

```powershell
cd backend
npm install
```

### 2.2 Configurar variables de entorno

Crea el archivo `backend/.env` copiando desde `.env.example`:

```powershell
# Desde la raíz del proyecto
Copy-Item backend\.env.example backend\.env
```

Edita `backend/.env` y coloca tu contraseña de PostgreSQL:

```env
DB_PASSWORD=tu_password_postgresql_aqui
```

**Las demás configuraciones ya están correctas por defecto.**

---

## 🚀 Paso 3: Iniciar el Sistema

### Opción A: Scripts Automáticos (Recomendado)

Abre **DOS ventanas de PowerShell**:

#### Ventana 1 - Backend:
```powershell
.\start-backend.ps1
```

Deberías ver:
```
========================================
  Backend API estará disponible en:
  http://localhost:3000
========================================
```

#### Ventana 2 - Frontend:
```powershell
.\start-frontend.ps1
```

Deberías ver:
```
  ➜  Local:   http://localhost:5173/
```

### Opción B: Manual

#### Ventana 1 - Backend:
```powershell
cd backend
npm run dev
```

#### Ventana 2 - Frontend:
```powershell
npm run dev
```

---

## 🧪 Paso 4: Verificar que Todo Funciona

### 4.1 Verificar Backend

Abre en tu navegador: **http://localhost:3000/health**

Deberías ver:
```json
{
  "status": "OK",
  "database": "Connected",
  "timestamp": "..."
}
```

### 4.2 Verificar Frontend

Abre en tu navegador: **http://localhost:5173**

Deberías ver la página de **Login**.

### 4.3 Probar Login

Usa cualquier usuario de prueba:

**Email**: `sebastian@partequipos.com`  
**Contraseña**: `sebastian123`

Si el login funciona, ¡todo está correcto! ✅

---

## 📡 Endpoints API Disponibles

### Autenticación
```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "sebastian@partequipos.com",
  "password": "sebastian123"
}
```

Respuesta:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "sebastian@partequipos.com",
    "full_name": "Sebastián García",
    "role": "sebastian"
  }
}
```

### Obtener Subastas (como Sebastian)
```http
GET http://localhost:3000/api/auctions
Authorization: Bearer <tu-token>
```

---

## 🔐 Autenticación en Frontend

El frontend debe guardar el token y enviarlo en cada petición:

```typescript
// Ejemplo de login
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const { token, user } = await response.json();

// Guardar token
localStorage.setItem('token', token);

// Usar en siguientes peticiones
const auctions = await fetch('http://localhost:3000/api/auctions', {
  headers: { 
    'Authorization': `Bearer ${token}`
  }
});
```

---

## 🛑 Detener los Servidores

En cada ventana de PowerShell, presiona:

**Ctrl + C**

---

## 🔍 Troubleshooting

### Error: "Cannot connect to database"

**Solución:**
1. Verifica que PostgreSQL está corriendo:
   ```powershell
   Get-Service postgresql*
   ```

2. Si no está corriendo:
   ```powershell
   Start-Service postgresql-x64-17
   ```

3. Verifica tu contraseña en `backend/.env`

### Error: "Port 3000 already in use"

**Solución:**
```powershell
# Ver qué está usando el puerto
Get-NetTCPConnection -LocalPort 3000

# Detener procesos de Node
Get-Process node | Stop-Process -Force
```

### Error: "Port 5173 already in use"

**Solución:**
```powershell
Get-Process node | Stop-Process -Force
```

### Backend se conecta pero Frontend da error de CORS

**Solución:**
Verifica que en `backend/.env`:
```env
FRONTEND_URL=http://localhost:5173
```

---

## 📂 Estructura del Proyecto

```
project/
├── backend/                    # ← Backend Node.js
│   ├── server.js              # Servidor principal
│   ├── package.json           # Dependencias backend
│   ├── .env                   # Variables de entorno (crear)
│   ├── .env.example           # Ejemplo de .env
│   ├── db/
│   │   └── connection.js      # Conexión PostgreSQL
│   ├── middleware/
│   │   └── auth.js            # Autenticación JWT
│   └── routes/                # Rutas API
│       ├── auth.js
│       ├── auctions.js
│       ├── purchases.js
│       ├── machines.js
│       ├── suppliers.js
│       └── management.js
│
├── src/                       # ← Frontend React
│   ├── main.tsx
│   ├── App.tsx
│   ├── services/
│   ├── hooks/
│   └── ...
│
├── start-backend.ps1          # Script inicio backend
├── start-frontend.ps1         # Script inicio frontend
├── package.json               # Dependencias frontend
└── .env                       # Variables frontend (crear)
```

---

## 🎯 Siguiente Paso: Integración OneDrive

Una vez que todo funcione en local, configuraremos:

1. **OneDrive API** para subir/ver fotos de máquinas
2. **Actualizar Frontend** para usar el backend local
3. **Testing** completo del sistema

---

## 👥 Usuarios de Prueba

| Email | Contraseña | Rol | Permisos |
|-------|------------|-----|----------|
| sebastian@partequipos.com | sebastian123 | sebastian | Subastas |
| eliana@partequipos.com | eliana123 | eliana | Compras |
| gerencia@partequipos.com | gerencia123 | gerencia | Todo |
| admin@partequipos.com | admin123 | admin | Admin |

---

**¿Todo funcionando?** 🎉 ¡Perfecto! Ya tienes tu ambiente de desarrollo local completo.

**¿Hay errores?** Revisa la sección de Troubleshooting arriba.

