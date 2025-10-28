# Sistema de Gestión de Maquinaria Usada

Sistema completo para gestionar el proceso de compra de maquinaria usada, desde subastas hasta la gestión consolidada.

## Características Principales

### Módulo de Subastas (Sebastián)
- Registro y seguimiento de subastas
- Gestión de lotes y máquinas
- Control de precios máximos y precios de compra
- Estados: WON, LOST, PENDING
- Vinculación con proveedores

### Módulo de Compras (Eliana)
- Registro detallado de compras
- Gestión de valores FOB, EXW, CIF
- Control de costos adicionales (flete, inland, repuestos, etc.)
- Seguimiento de pagos y fechas
- Cálculo automático de llegada estimada (+45 días desde salida)

### Módulo de Gestión (Gerencia)
- Vista consolidada de todas las operaciones
- Totales de FOB, CIF y costos
- Valores proyectados y PVP estimado
- Vista detallada por máquina con tabs
- Estados de venta: AVAILABLE, RESERVED, SOLD

## Tecnologías Utilizadas

- **Frontend**: React 18 + TypeScript + Vite
- **Estilos**: TailwindCSS
- **Routing**: React Router v6
- **Base de Datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth
- **Iconos**: Lucide React
- **Arquitectura**: Atomic Design

## Estructura del Proyecto

```
src/
├── atoms/          # Componentes básicos (Button, Input, Select, etc.)
├── molecules/      # Componentes compuestos (Card, Modal, FilterBar, etc.)
├── organisms/      # Componentes complejos (DataTable, Navigation, Forms)
├── templates/      # Layouts de página
├── pages/          # Páginas completas (Login, Auctions, Purchases, Management)
├── hooks/          # Custom hooks para data fetching
├── services/       # Integración con Supabase
├── types/          # Definiciones TypeScript
└── context/        # Context API para estado global (Auth)
```

## Configuración Inicial

### 1. Variables de Entorno

El archivo `.env` ya está configurado con las credenciales de Supabase.

### 2. Crear Usuarios

Los usuarios deben crearse manualmente en Supabase:

1. Ir a Authentication > Users en el dashboard de Supabase
2. Crear usuarios con email y contraseña
3. Después del primer login, crear el perfil de usuario:

```sql
-- Crear perfil para Sebastián (subastas)
INSERT INTO users_profile (id, full_name, role)
VALUES ('USER_ID_FROM_AUTH', 'Sebastián García', 'sebastian');

-- Crear perfil para Eliana (compras)
INSERT INTO users_profile (id, full_name, role)
VALUES ('USER_ID_FROM_AUTH', 'Eliana Rodríguez', 'eliana');

-- Crear perfil para Gerencia
INSERT INTO users_profile (id, full_name, role)
VALUES ('USER_ID_FROM_AUTH', 'Director General', 'gerencia');
```

### 3. Instalar Dependencias

```bash
npm install
```

### 4. Ejecutar en Desarrollo

```bash
npm run dev
```

## Roles y Permisos

### Sebastián (sebastian)
- Acceso al módulo de Subastas
- Puede crear, editar y ver subastas
- Puede crear nuevas máquinas o vincular existentes
- Marca estado de subastas (WON/LOST/PENDING)

### Eliana (eliana)
- Acceso al módulo de Compras
- Puede registrar compras vinculadas a máquinas
- Gestiona costos adicionales
- Control de estados de pago
- Seguimiento de envíos

### Gerencia (gerencia)
- Acceso al módulo de Consolidado
- Vista completa de todas las operaciones
- Puede editar valores proyectados y PVP
- Agregar comentarios finales
- Exportación de reportes (futuro)

## Flujo de Trabajo

1. **Sebastián** registra una subasta con los datos de la máquina
2. Si la subasta es ganada (status=WON), la máquina queda disponible para compra
3. **Eliana** crea un registro de compra vinculado a esa máquina
4. Eliana completa los valores FOB, costos adicionales y datos de envío
5. El sistema calcula automáticamente totales y fecha estimada de llegada
6. **Gerencia** visualiza todo el consolidado con totales
7. Gerencia puede ver detalles completos y agregar proyecciones

## Base de Datos

### Tablas Principales

- `users_profile`: Perfiles de usuarios con roles
- `suppliers`: Proveedores de maquinaria
- `machines`: Catálogo de máquinas (modelo, serial, año, horas)
- `auctions`: Registros de subastas
- `purchases`: Registros de compras
- `additional_costs`: Costos adicionales por compra
- `management_table`: Vista consolidada para gerencia
- `notifications`: Sistema de notificaciones (futuro)

### Seguridad

- Row Level Security (RLS) habilitado en todas las tablas
- Políticas de acceso basadas en autenticación
- Usuarios solo pueden acceder a datos autorizados

## Características Técnicas

### Atomic Design
El proyecto sigue la metodología Atomic Design:
- **Atoms**: Componentes UI básicos reutilizables
- **Molecules**: Combinaciones simples de átomos
- **Organisms**: Componentes complejos con lógica
- **Pages**: Páginas completas que usan todos los componentes

### Type Safety
- TypeScript estricto en todo el proyecto
- Interfaces definidas para todas las entidades
- Type checking en build time

### Responsive Design
- Diseño adaptable a móviles, tablets y desktop
- Grid system con Tailwind CSS
- Breakpoints: sm, md, lg, xl

### Performance
- Code splitting automático con Vite
- Lazy loading de rutas
- Optimización de re-renders con React

## Scripts Disponibles

```bash
npm run dev        # Desarrollo
npm run build      # Build para producción
npm run preview    # Preview del build
npm run typecheck  # Verificar tipos TypeScript
npm run lint       # Linting con ESLint
```

## Próximas Funcionalidades

- [ ] Sistema de notificaciones en tiempo real
- [ ] Integración con Google Drive para fotos
- [ ] Exportación de reportes en PDF
- [ ] Dashboard con gráficos y métricas
- [ ] Búsqueda avanzada y filtros
- [ ] Historial de cambios por registro
- [ ] API REST para integraciones externas

## Soporte

Para dudas o problemas, contactar al equipo de desarrollo.
