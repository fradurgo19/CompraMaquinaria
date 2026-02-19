# Backend API - Sistema de Maquinaria Usada

Backend Node.js + Express + PostgreSQL 17 para desarrollo local.

## 🚀 Inicio Rápido

### 1. Instalar dependencias

```bash
cd backend
npm install
```

### 2. Configurar variables de entorno

Copia `.env.example` a `.env` y configura tu contraseña de PostgreSQL:

```bash
cp .env.example .env
```

Edita `.env` y coloca tu contraseña de PostgreSQL en `DB_PASSWORD`.

### 3. Iniciar el servidor

```bash
npm run dev
```

El servidor estará disponible en **http://localhost:3000**

## 📡 Endpoints API

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Obtener usuario actual

### Subastas (Sebastian + Gerencia)
- `GET /api/auctions` - Listar subastas
- `GET /api/auctions/:id` - Obtener subasta
- `POST /api/auctions` - Crear subasta (Sebastian)
- `PUT /api/auctions/:id` - Actualizar subasta (Sebastian)
- `DELETE /api/auctions/:id` - Eliminar subasta (Sebastian)

### Compras (Eliana + Gerencia)
- `GET /api/purchases` - Listar compras
- `POST /api/purchases` - Crear compra (Eliana)

### Máquinas (Todos)
- `GET /api/machines` - Listar máquinas (según rol)
- `POST /api/machines` - Crear máquina

### Proveedores (Todos)
- `GET /api/suppliers` - Listar proveedores
- `POST /api/suppliers` - Crear proveedor

### Consolidado (Gerencia)
- `GET /api/management` - Obtener consolidado
- `PUT /api/management/:id` - Actualizar registro

### Health Check
- `GET /health` - Verificar estado del servidor

### Cron interno (Vercel)
- `GET /api/cron/equipments-maintenance` - Ejecuta mantenimiento/sincronización de equipos (requiere `Authorization: Bearer <CRON_SECRET>` en producción)

## 🔐 Autenticación

Todas las rutas (excepto `/health` y `/api/auth/login`) requieren autenticación JWT.

**Header requerido:**
```
Authorization: Bearer <token>
```

## 👥 Usuarios de Prueba

- sebastian@partequipos.com / sebastian123
- eliana@partequipos.com / eliana123
- gerencia@partequipos.com / gerencia123
- admin@partequipos.com / admin123

## 🗂️ Estructura

```
backend/
├── server.js              # Servidor principal
├── db/
│   └── connection.js      # Conexión a PostgreSQL
├── middleware/
│   └── auth.js           # Middleware de autenticación
├── routes/
│   ├── auth.js           # Rutas de autenticación
│   ├── auctions.js       # Rutas de subastas
│   ├── purchases.js      # Rutas de compras
│   ├── machines.js       # Rutas de máquinas
│   ├── suppliers.js      # Rutas de proveedores
│   └── management.js     # Rutas de consolidado
└── package.json
```

## 🔧 Desarrollo

El servidor usa `--watch` de Node.js para recargar automáticamente al hacer cambios.

```bash
npm run dev   # Desarrollo con auto-reload
npm start     # Producción
```

