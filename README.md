# Sistema de Gestión de Compra de Maquinaria Usada

Sistema integral para la gestión de compras de maquinaria usada, desarrollado con React + TypeScript y PostgreSQL 17.

## 📋 Descripción

Este sistema permite gestionar de manera eficiente todo el proceso de compra de maquinaria usada, desde la participación en subastas hasta el seguimiento de envíos y consolidación de datos para gerencia.

### Características Principales

- ✅ **Gestión de Subastas** (Sebastián)
- ✅ **Gestión de Compras y Pagos** (Eliana)
- ✅ **Consolidado de Gerencia** (Gerencia)
- ✅ **Control de Acceso Basado en Roles**
- ✅ **Seguimiento de Envíos**
- ✅ **Gestión de Costos**
- ✅ **Tasas de Cambio**
- ✅ **Reportes y Exportación**

## 🏗️ Arquitectura del Sistema

### Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite
- **Estilos**: TailwindCSS
- **Base de Datos**: PostgreSQL 17 (local) o Supabase (cloud)
- **Autenticación**: Supabase Auth / JWT
- **Deployment**: Vercel (automático en push)

### Estructura de Roles

#### 👨‍💼 Sebastián
- Ve y gestiona **subastas** (solo las creadas por él)
- Ve máquinas vinculadas a sus subastas
- Gestiona fotos en Google Drive
- Puede crear y editar proveedores

#### 👩‍💼 Eliana
- Ve y gestiona **compras**
- Gestiona **pagos** y **costos**
- Gestiona **envíos** (shipping)
- Ve máquinas vinculadas a compras
- Puede crear y editar proveedores

#### 🏢 Gerencia
- Ve **TODO**: Subastas + Compras + Consolidado
- Edita el **Consolidado** (management_table)
- Revisa y aprueba operaciones
- Acceso completo de solo lectura en subastas y compras

#### 🔧 Admin
- Acceso completo al sistema
- Gestión de usuarios
- Configuración global
- Puede editar todo

## 📊 Estructura de la Base de Datos

### Tablas Principales

1. **users_profile** - Perfiles de usuarios con roles
2. **suppliers** - Proveedores (nombre, contacto, teléfono, notas)
3. **machines** - Máquinas (entidad central, una sola vez)
4. **auctions** - Subastas (fecha, lote, precios, estado, fotos)
5. **purchases** - Compras (factura, incoterm, valores, pagos)
6. **cost_items** - Costos adicionales (INLAND, GASTOS_PTO, FLETE, etc.)
7. **shipping** - Envíos (salida, llegada estimada/real, tracking)
8. **currency_rates** - Tasas de cambio (USD/JPY, USD/COP, etc.)
9. **management_table** - Consolidado de gerencia ("AA2025" digital)

### Vistas

- `v_auctions_complete` - Subastas con información relacionada
- `v_purchases_complete` - Compras con información relacionada
- `v_management_consolidado` - Vista completa del consolidado

## 🚀 Instalación

### Opción 1: Con PostgreSQL 17 Local

#### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd project
```

#### 2. Instalar dependencias

```bash
npm install
```

#### 3. Crear la base de datos

```bash
# Abrir psql y crear la base de datos
psql -U postgres

CREATE DATABASE maquinaria_usada;
\q
```

#### 4. Aplicar migraciones (Windows PowerShell)

```powershell
.\scripts\apply-migrations.ps1
```

O manualmente:

```bash
psql -U postgres -d maquinaria_usada -f scripts/setup-database.sql
psql -U postgres -d maquinaria_usada -f supabase/migrations/20251015221509_create_initial_schema.sql
psql -U postgres -d maquinaria_usada -f supabase/migrations/20251015222311_seed_initial_data.sql
psql -U postgres -d maquinaria_usada -f supabase/migrations/20251015230000_update_schema_complete.sql
```

#### 5. Configurar variables de entorno

Crear archivo `.env` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

#### 6. Iniciar el servidor de desarrollo

```bash
npm run dev
```

### Opción 2: Con Supabase Cloud

#### 1-2. Igual que opción 1

#### 3. Crear proyecto en Supabase

- Ve a [https://supabase.com](https://supabase.com)
- Crea un nuevo proyecto
- Guarda la URL y la ANON KEY

#### 4. Aplicar migraciones en Supabase

Ve al SQL Editor en Supabase y ejecuta los archivos en orden:

1. `supabase/migrations/20251015221509_create_initial_schema.sql`
2. `supabase/migrations/20251015222311_seed_initial_data.sql`
3. `supabase/migrations/20251015230000_update_schema_complete.sql`

#### 5. Crear usuarios en Supabase Auth

Ve a Authentication > Users y crea usuarios con los emails:
- sebastian@partequipos.com
- eliana@partequipos.com
- gerencia@partequipos.com
- admin@partequipos.com

Luego ejecuta en SQL Editor:

```sql
INSERT INTO users_profile (id, full_name, email, role)
VALUES 
  ('id-de-sebastian', 'Sebastián García', 'sebastian@partequipos.com', 'sebastian'),
  ('id-de-eliana', 'Eliana Rodríguez', 'eliana@partequipos.com', 'eliana'),
  ('id-de-gerencia', 'Director General', 'gerencia@partequipos.com', 'gerencia'),
  ('id-de-admin', 'Administrador', 'admin@partequipos.com', 'admin');
```

#### 6. Configurar `.env` y ejecutar

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

```bash
npm run dev
```

## 📖 Uso del Sistema

### Usuarios de Prueba

Después de la instalación, puedes iniciar sesión con:

- **Sebastián**: sebastian@partequipos.com / sebastian123
- **Eliana**: eliana@partequipos.com / eliana123
- **Gerencia**: gerencia@partequipos.com / gerencia123
- **Admin**: admin@partequipos.com / admin123

### Flujo de Trabajo

#### 1. Sebastián - Gestión de Subastas

1. Crear una nueva subasta
2. Asociar a una máquina (crear nueva o seleccionar existente)
3. Definir proveedor, lote, precio máximo
4. Subir fotos a Google Drive y guardar folder ID
5. Marcar como GANADA o PERDIDA

#### 2. Eliana - Gestión de Compras

1. Crear una compra (puede estar asociada a una subasta ganada)
2. Ingresar datos de factura, incoterm (EXW/FOB)
3. Definir valores: EXW, adicionales FOB, desmontaje
4. Agregar costos adicionales (INLAND, FLETE, etc.)
5. Crear registro de envío con fechas
6. Actualizar estado de pago

#### 3. Gerencia - Consolidado

1. Ver todas las máquinas en el consolidado
2. Revisar costos calculados automáticamente
3. Marcar estado de venta (OK, X, BLANCO)
4. Agregar proyecciones y PVP estimado
5. Exportar a Excel para análisis

## 🔧 Desarrollo

### Estructura del Proyecto

```
project/
├── src/
│   ├── atoms/          # Componentes básicos (Button, Input, etc.)
│   ├── molecules/      # Componentes compuestos (Card, Modal, etc.)
│   ├── organisms/      # Componentes complejos (Forms, Tables, etc.)
│   ├── pages/          # Páginas de la aplicación
│   ├── context/        # Contextos de React (Auth, etc.)
│   ├── hooks/          # Hooks personalizados
│   ├── services/       # Servicios de API y lógica de negocio
│   └── types/          # Tipos de TypeScript
├── supabase/
│   └── migrations/     # Migraciones de base de datos
├── scripts/            # Scripts auxiliares
└── public/             # Archivos estáticos
```

### Comandos Disponibles

```bash
# Desarrollo
npm run dev

# Build para producción
npm run build

# Preview del build
npm run preview

# Linting
npm run lint
```

### Agregar Nuevas Características

1. Definir tipos en `src/types/database.ts`
2. Crear servicio en `src/services/`
3. Crear hook personalizado en `src/hooks/`
4. Crear componentes necesarios
5. Agregar migración si es necesario

## 🔐 Seguridad

### Row Level Security (RLS)

Todas las tablas tienen políticas RLS que garantizan:

- Sebastián solo ve sus propias subastas
- Eliana solo ve las compras
- Gerencia ve todo pero con permisos limitados de edición
- Admin tiene acceso completo

### Funciones de Verificación

```typescript
import { 
  canViewAuctions, 
  canViewPurchases, 
  canViewManagementTable 
} from '@/services/database.service';

// En componentes
const userCanView = await canViewAuctions();
```

## 📈 Cálculos Automáticos

El sistema incluye triggers que calculan automáticamente:

1. **FOB Value**: `exw_value + fob_additional + disassembly_load`
2. **Estimated Arrival**: `departure_date + 45 días`
3. **Management Table**: Se actualiza al modificar auctions, purchases o cost_items

## 📤 Exportación de Datos

```typescript
import { exportConsolidado } from '@/services/management.service';
import { exportToCSV } from '@/services/database.service';

// Exportar consolidado
const { data } = await exportConsolidado();
if (data) {
  exportToCSV(data, 'consolidado_gerencia');
}
```

## 🌐 Deployment

El proyecto está configurado para deployment automático en Vercel:

1. Conecta el repositorio a Vercel
2. Configura las variables de entorno
3. Cada push a `main` despliega automáticamente

### Variables de Entorno en Vercel

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
CRON_SECRET=token_largo_y_seguro
```

### Cron de mantenimiento de equipos (Vercel)

- `path`: `/api/cron/equipments-maintenance`
- `schedule`: `*/2 * * * *` (cada 2 minutos)
- Seguridad: enviar `Authorization: Bearer <CRON_SECRET>`

## 🐛 Troubleshooting

### Error: "No tienes permisos..."

Verifica que el usuario tiene un perfil en `users_profile` con el rol correcto.

### Error: "relation does not exist"

Asegúrate de haber ejecutado todas las migraciones en orden.

### La autenticación no funciona

Verifica que:
1. Las variables de entorno están correctamente configuradas
2. El usuario existe en `auth.users`
3. El usuario tiene un perfil en `users_profile`

## 📝 Documentación Adicional

- [Configuración de PostgreSQL 17](./postgres-setup.md)
- [Guía de Migraciones](./supabase/migrations/)
- [Estructura de la Base de Datos](./postgres-setup.md#estructura-de-tablas)

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add: AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y confidencial de Partequipos S.A.S.

## 👥 Contacto

Desarrollado para Partequipos S.A.S.

---

**Nota**: Este sistema está diseñado específicamente para las necesidades de gestión de compra de maquinaria usada de Partequipos S.A.S. y puede requerir customización para otros usos.

