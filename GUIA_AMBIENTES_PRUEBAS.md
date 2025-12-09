# 🧪 Guía de Ambientes para Pruebas Funcionales - Flexi Maquinaria

## 📋 Situación Actual

- ✅ **Desarrollo Local**: Funcionando (localhost:5173 + localhost:3000)
- ❌ **Ambiente de Pruebas**: No configurado
- ❌ **Ambiente de Staging**: No configurado

---

## 🎯 **RECOMENDACIÓN: Ambiente de QA/Staging**

### ¿Por qué esta opción?

1. **Aislamiento completo** de desarrollo y producción
2. **Accesible para todo el equipo** (no requiere setup local)
3. **Similar a producción** (mismo stack, diferentes datos)
4. **Datos de prueba controlados** (no afecta datos reales)
5. **Costo bajo o gratuito** (planes free de Supabase, Vercel, Railway)

---

## 🏗️ Arquitectura Propuesta (IDEAL)

```
┌─────────────────────────────────────────────────────────┐
│              AMBIENTE DE QA/STAGING                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐      ┌──────────────┐      ┌─────────┐│
│  │   Frontend   │─────→│   Backend    │─────→│   DB    ││
│  │   (Vercel)   │      │  (Vercel     │      │(Supabase││
│  │              │      │  Serverless) │      │   QA)   ││
│  │ qa.vercel.app│      │  /api/*      │      │         ││
│  └──────────────┘      └──────────────┘      └─────────┘│
│                                                          │
│  ✅ Todo en Vercel (Frontend + Backend)                 │
│  ✅ Accesible desde cualquier lugar                      │
│  ✅ Datos de prueba aislados                             │
│  ✅ Mismo código que producción                          │
│  ✅ Serverless (escala automáticamente)                  │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Opción 1: QA/Staging Completo (RECOMENDADA)

### ⚠️ **Limitación de Vercel Free**

- **Límite**: 9 funciones serverless en plan gratuito
- **Tu backend**: 24+ rutas diferentes
- **Solución**: Usar **1 sola función Express** que maneja todas las rutas

### **Stack Tecnológico (Arquitectura Ideal)**

| Componente | Servicio | Plan | Costo |
|------------|----------|------|-------|
| **Base de Datos** | Supabase | Free/Pro | $0-25/mes |
| **Frontend** | Vercel | Free | $0 |
| **Backend** | Vercel Serverless (1 función) | Free | $0 |
| **Total** | | | **$0-25/mes** |

**Ventaja**: Todo en una sola plataforma (Vercel), más simple de gestionar.  
**Nota**: Usamos **1 sola función serverless** (Express wrapper) para todas las rutas, cumpliendo con el límite de 9 funciones del plan gratuito.

### **Ventajas**

✅ **Accesible 24/7** desde cualquier lugar  
✅ **URLs públicas** para pruebas remotas  
✅ **Datos aislados** (no afecta producción)  
✅ **Fácil reset** de datos de prueba  
✅ **Mismo stack** que producción  
✅ **CI/CD automático** (deploy en cada push)

### **Desventajas**

❌ Requiere configuración inicial (2-3 horas)  
❌ Necesita variables de entorno separadas

---

## 🔧 Opción 2: Desarrollo Compartido (Alternativa Rápida)

### **Configuración**

- **Servidor de desarrollo** accesible por VPN o túnel (ngrok)
- **Base de datos local** o Supabase compartido
- **URL temporal** para pruebas

### **Ventajas**

✅ **Setup rápido** (30 minutos)  
✅ **Costo cero**  
✅ **Ideal para pruebas puntuales**

### **Desventajas**

❌ **No siempre disponible** (depende del servidor local)  
❌ **Menos estable** que ambiente dedicado  
❌ **Requiere VPN/túnel** para acceso remoto

---

## 🐳 Opción 3: Docker Local (Para Equipo Técnico)

### **Configuración**

- **Docker Compose** con PostgreSQL + Backend + Frontend
- **Scripts de setup** automatizados
- **Datos de prueba** pre-cargados

### **Ventajas**

✅ **Consistente** entre desarrolladores  
✅ **Aislamiento** completo  
✅ **Fácil reset** de ambiente

### **Desventajas**

❌ **Requiere Docker** instalado  
❌ **Solo local** (no accesible remotamente)  
❌ **Setup inicial** más complejo

---

## 📝 Plan de Implementación - Opción 1 (Recomendada)

### **Paso 1: Crear Proyecto Supabase para QA** (15 min)

1. Ir a [supabase.com](https://supabase.com)
2. Crear nuevo proyecto: `fleximaquinaria-qa`
3. Aplicar migraciones desde `supabase/migrations/`
4. Crear usuarios de prueba:
   ```sql
   -- Usuarios de prueba para QA
   INSERT INTO users_profile (id, full_name, email, role)
   VALUES 
     ('qa-sebastian-id', 'Sebastián QA', 'sebastian-qa@partequipos.com', 'sebastian'),
     ('qa-eliana-id', 'Eliana QA', 'eliana-qa@partequipos.com', 'eliana'),
     ('qa-gerencia-id', 'Gerencia QA', 'gerencia-qa@partequipos.com', 'gerencia');
   ```

### **Paso 2: Configurar Backend como Serverless Function ÚNICA en Vercel** (20 min)

**⚠️ IMPORTANTE**: Vercel Free solo permite **9 funciones serverless**.  
**✅ SOLUCIÓN**: Usar Express como **1 sola función** que maneja todas las rutas.

**Implementación (Recomendada):**

1. Crear carpeta `api/` en la raíz del proyecto
2. Copiar `api/index.example.js` a `api/index.js` y ajustar si es necesario:
   ```bash
   cp api/index.example.js api/index.js
   ```
   
   O crear manualmente `api/index.js` (wrapper Express):
   ```javascript
   // api/index.js
   import express from 'express';
   import cors from 'cors';
   import dotenv from 'dotenv';
   import { pool } from '../backend/db/connection.js';
   
   // Importar todas las rutas
   import authRoutes from '../backend/routes/auth.js';
   import auctionsRoutes from '../backend/routes/auctions.js';
   import purchasesRoutes from '../backend/routes/purchases.js';
   // ... importar todas las demás rutas
   
   dotenv.config();
   
   const app = express();
   
   // Middleware
   app.use(cors({
     origin: process.env.FRONTEND_URL || '*',
     credentials: true
   }));
   app.use(express.json());
   
   // Health check
   app.get('/health', async (req, res) => {
     try {
       await pool.query('SELECT NOW()');
       res.json({ status: 'OK', database: 'Connected' });
     } catch (error) {
       res.status(500).json({ status: 'ERROR', database: 'Disconnected' });
     }
   });
   
   // Todas las rutas
   app.use('/api/auth', authRoutes);
   app.use('/api/auctions', auctionsRoutes);
   app.use('/api/purchases', purchasesRoutes);
   // ... agregar todas las demás rutas
   
   // Exportar como serverless function
   export default app;
   ```

3. Crear `vercel.json` en la raíz (copiar desde `vercel.json.example`):
   ```bash
   cp vercel.json.example vercel.json
   ```
   
   O crear manualmente `vercel.json`:
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "api/index.js",
         "use": "@vercel/node"
       },
       {
         "src": "package.json",
         "use": "@vercel/static-build",
         "config": {
           "distDir": "dist"
         }
       }
     ],
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "/api/index.js"
       },
       {
         "src": "/(.*)",
         "dest": "/$1"
       }
     ]
   }
   ```

**✅ Resultado**: Solo **1 función serverless** maneja todas las 24+ rutas del backend.

**Alternativa si prefieres separar el backend:**

Si prefieres mantener el backend separado (por ejemplo, para mejor escalabilidad), puedes usar:

- **Railway** (Free tier): Backend separado, sin límite de funciones
- **Render** (Free tier): Backend separado, similar a Railway
- **Fly.io** (Free tier): Backend separado, buena opción

Pero la **recomendación es usar Express wrapper en Vercel** porque:
- ✅ Todo en una plataforma
- ✅ Mismo dominio (sin CORS issues)
- ✅ Más simple de gestionar
- ✅ Gratis

### **Paso 3: Configurar Proyecto Completo en Vercel** (15 min)

1. Ir a [vercel.com](https://vercel.com)
2. Crear nuevo proyecto: `fleximaquinaria-qa`
3. Conectar repositorio GitHub
4. Configurar **Build Settings**:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Configurar variables de entorno:
   ```env
   # Frontend
   VITE_API_URL=https://fleximaquinaria-qa.vercel.app
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_anon_key_qa
   
   # Backend (Serverless Functions)
   DB_HOST=db.xxxxx.supabase.co
   DB_PORT=5432
   DB_NAME=postgres
   DB_USER=postgres
   DB_PASSWORD=tu_password_supabase_qa
   NODE_ENV=staging
   ```
6. Deploy automático

### **Paso 5: Crear Scripts de Datos de Prueba** (30 min)

Crear archivo `scripts/seed-qa-data.sql`:

```sql
-- Datos de prueba para QA
-- Subastas de prueba
INSERT INTO auctions (supplier_id, machine_id, auction_date, lot_number, max_price, purchase_price, status)
VALUES 
  ('supplier-1', 'machine-1', '2025-01-15', 'LOT-001', 50000, 48000, 'WON'),
  ('supplier-2', 'machine-2', '2025-01-20', 'LOT-002', 75000, NULL, 'PENDING');

-- Compras de prueba
INSERT INTO purchases (auction_id, machine_id, invoice_number, invoice_date, incoterm, exw_value)
VALUES 
  ('auction-1', 'machine-1', 'INV-001', '2025-01-16', 'EXW', 48000);

-- Máquinas de prueba
INSERT INTO machines (brand, model, serial, year, condition)
VALUES 
  ('Caterpillar', '320D', 'CAT320D001', 2018, 'USED'),
  ('Komatsu', 'PC200', 'KOM200001', 2019, 'USED');
```

### **Paso 4: Configurar Branch de QA** (10 min)

1. Crear branch `qa/staging` en GitHub
2. En Vercel, configurar:
   - **Production Branch**: `main`
   - **Preview Branches**: `qa/staging`, `develop`
3. Cada push a `qa/staging` → deploy automático a preview
4. Cada push a `main` → deploy a producción

---

## 🎯 Flujo de Trabajo Recomendado

```
┌─────────────────────────────────────────────────────────┐
│                    FLUJO DE PRUEBAS                     │
└─────────────────────────────────────────────────────────┘

1. DESARROLLO
   └─> Código en branch `develop`
       └─> Pruebas locales

2. QA/STAGING
   └─> Merge a branch `qa/staging`
       └─> Deploy automático
           └─> Pruebas funcionales en ambiente QA
               └─> URL: https://fleximaquinaria-qa.vercel.app

3. PRODUCCIÓN
   └─> Merge a branch `main`
       └─> Deploy a producción
           └─> URL: https://fleximaquinaria.vercel.app
```

---

## 📊 Comparación de Opciones

| Criterio | QA/Staging | Desarrollo Compartido | Docker Local |
|----------|------------|----------------------|--------------|
| **Costo** | $0-30/mes | $0 | $0 |
| **Setup** | 2-3 horas | 30 min | 1-2 horas |
| **Accesibilidad** | ✅ 24/7 remoto | ⚠️ Depende servidor | ❌ Solo local |
| **Estabilidad** | ✅ Alta | ⚠️ Media | ✅ Alta |
| **Aislamiento** | ✅ Completo | ⚠️ Parcial | ✅ Completo |
| **Escalabilidad** | ✅ Alta | ❌ Baja | ⚠️ Media |
| **Ideal para** | Equipo completo | Pruebas rápidas | Devs técnicos |

---

## ✅ Checklist de Implementación

### Para QA/Staging (Recomendado):

- [ ] Crear proyecto Supabase QA
- [ ] Aplicar migraciones a Supabase QA
- [ ] Crear usuarios de prueba en Supabase QA
- [ ] Crear `api/index.js` con Express wrapper (1 sola función)
- [ ] Crear `vercel.json` con configuración de rutas
- [ ] Configurar Vercel para frontend + backend QA
- [ ] Crear branch `qa/staging` en GitHub
- [ ] Configurar variables de entorno en Vercel (frontend + backend)
- [ ] Crear script de datos de prueba
- [ ] Cargar datos de prueba en Supabase QA
- [ ] Probar deploy automático
- [ ] Documentar URLs de QA para el equipo
- [ ] Configurar notificaciones de deploy

---

## 🔗 URLs de Ejemplo (Post-Implementación)

```
Frontend QA:  https://fleximaquinaria-qa.vercel.app
Backend API:  https://fleximaquinaria-qa.vercel.app/api/*
API Health:   https://fleximaquinaria-qa.vercel.app/api/health
Supabase QA:  https://xxxxx.supabase.co (Dashboard)
```

**Nota**: Frontend y Backend comparten el mismo dominio en Vercel.

---

## 💡 Recomendación Final

**Para Flexi Maquinaria, la mejor opción es:**

### ✅ **QA/Staging Completo** (Opción 1)

**Razones:**
1. **Equipo distribuido**: Permite pruebas remotas sin setup local
2. **Profesional**: Ambiente dedicado similar a producción
3. **Escalable**: Fácil agregar más ambientes (dev, staging, prod)
4. **Costo bajo**: Gratis o muy económico con planes free
5. **CI/CD**: Deploy automático facilita el flujo de trabajo

**Tiempo de implementación**: 2-3 horas  
**Costo mensual**: $0-25 USD (solo Supabase, Vercel es gratis)  
**Beneficio**: Ambiente profesional para pruebas funcionales, todo en Vercel

---

## 📞 Próximos Pasos

1. **Decidir opción** (recomendamos QA/Staging)
2. **Asignar responsable** de configuración
3. **Seguir plan de implementación** paso a paso
4. **Documentar URLs** y credenciales de QA
5. **Capacitar equipo** en uso del ambiente de QA

---

---

## 📝 Notas Importantes

### Sobre la Limitación de Vercel Free (9 funciones)

**Problema**: Tienes 24+ rutas en el backend, pero Vercel Free solo permite 9 funciones serverless.

**Solución Implementada**: 
- ✅ Usar **1 sola función Express** (`api/index.js`) que maneja todas las rutas
- ✅ Esto cuenta como **1 función** de las 9 disponibles
- ✅ Todas las rutas funcionan normalmente: `/api/auth/*`, `/api/auctions/*`, etc.

**Archivos de Ejemplo Creados**:
- `api/index.example.js` - Template completo del wrapper Express
- `vercel.json.example` - Configuración de Vercel

**Pasos Rápidos**:
1. Copiar `api/index.example.js` → `api/index.js`
2. Copiar `vercel.json.example` → `vercel.json`
3. Ajustar imports si es necesario
4. Deploy a Vercel

---

**¿Necesitas ayuda con la implementación?** Puedo ayudarte a configurar cualquiera de estas opciones paso a paso.

