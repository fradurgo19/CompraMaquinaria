# 📚 Índice de Documentación

Guía completa de toda la documentación disponible del Sistema de Gestión de Compra de Maquinaria Usada.

---

## 🚀 Para Empezar

### ⚡ [INICIO_RAPIDO.md](./INICIO_RAPIDO.md)
**Tiempo de lectura**: 5 minutos  
**Para quién**: Desarrolladores que quieren instalar rápidamente

**Contenido**:
- Instalación en 5 minutos
- Opción PostgreSQL local
- Opción Supabase cloud
- Verificación de instalación
- Solución rápida de problemas

**Empieza aquí si**: Quieres tener el sistema funcionando lo más rápido posible.

---

## 📖 Documentación Principal

### 📘 [README.md](./README.md)
**Tiempo de lectura**: 15 minutos  
**Para quién**: Todos (desarrolladores, gerentes, usuarios)

**Contenido**:
- Descripción del sistema
- Características principales
- Arquitectura y tecnologías
- Estructura de roles y permisos
- Estructura de base de datos
- Comandos de desarrollo
- Seguridad y RLS
- Cálculos automáticos
- Deployment

**Empieza aquí si**: Necesitas entender qué es el sistema y cómo funciona.

---

## 🔧 Instalación y Configuración

### 📗 [INSTALACION.md](./INSTALACION.md)
**Tiempo de lectura**: 20 minutos  
**Para quién**: Desarrolladores, Administradores de sistemas

**Contenido**:
- Requisitos previos detallados
- Instalación paso a paso (PostgreSQL local)
- Instalación paso a paso (Supabase cloud)
- Verificación de instalación
- Configuración de variables de entorno
- Troubleshooting detallado
- Próximos pasos

**Empieza aquí si**: Es tu primera vez instalando el sistema y quieres una guía detallada.

### 📙 [postgres-setup.md](./postgres-setup.md)
**Tiempo de lectura**: 25 minutos  
**Para quién**: DBAs, Administradores, Desarrolladores avanzados

**Contenido**:
- Configuración de PostgreSQL 17
- Creación de base de datos
- Ejecución de migraciones
- Creación de usuarios de prueba
- Estructura de tablas detallada
- Vistas útiles
- Triggers y cálculos automáticos
- Backup y restauración
- Troubleshooting de base de datos

**Empieza aquí si**: Necesitas información técnica profunda sobre la base de datos.

---

## 📊 Información del Proyecto

### 📕 [RESUMEN_EJECUTIVO.md](./RESUMEN_EJECUTIVO.md)
**Tiempo de lectura**: 10 minutos  
**Para quién**: Gerentes, Stakeholders, Tomadores de decisión

**Contenido**:
- Estado del proyecto
- Entregables completos
- Funcionalidades clave por rol
- Métricas del proyecto
- Cumplimiento de requerimientos (100%)
- ROI estimado
- Roadmap futuro
- Conclusiones

**Empieza aquí si**: Necesitas una vista ejecutiva del proyecto sin detalles técnicos.

### 📒 [IMPLEMENTACION_COMPLETADA.md](./IMPLEMENTACION_COMPLETADA.md)
**Tiempo de lectura**: 12 minutos  
**Para quién**: Desarrolladores, Project Managers

**Contenido**:
- Lista detallada de lo implementado
- Tablas, vistas, triggers
- Servicios y hooks del frontend
- Scripts y automatización
- Documentación creada
- Estadísticas de código
- Características principales
- Próximas mejoras sugeridas
- Testing recomendado

**Empieza aquí si**: Quieres saber exactamente qué se implementó y qué falta.

---

## 🗂️ Archivos Técnicos

### SQL y Migraciones

#### 1. `scripts/setup-database.sql`
- Configuración inicial de PostgreSQL
- Creación de schemas (auth, public)
- Extensiones necesarias
- Función auth.uid()
- Usuarios de prueba

#### 2. `supabase/migrations/20251015221509_create_initial_schema.sql`
- Tablas básicas
- Políticas RLS iniciales
- Índices básicos
- Triggers de updated_at

#### 3. `supabase/migrations/20251015222311_seed_initial_data.sql`
- Proveedores de ejemplo
- Datos semilla

#### 4. `supabase/migrations/20251015230000_update_schema_complete.sql`
- Schema completo actualizado
- Todos los campos nuevos
- Políticas RLS completas
- Triggers de cálculo automático
- Vistas completas
- Función update_management_table()

### Scripts de PowerShell

#### `scripts/apply-migrations.ps1`
- Aplicación automática de migraciones
- Validación de conexión
- Mensajes de progreso
- Manejo de errores

### Configuración

#### `database.config.example.js`
- Ejemplo de configuración
- Opciones de PostgreSQL local
- Opciones de Supabase
- Variables de entorno necesarias

---

## 💻 Código Frontend

### Servicios (src/services/)

#### `database.service.ts` (400+ líneas)
**Funciones principales**:
- `getCurrentUserProfile()` - Obtener perfil del usuario
- `getCurrentUserRole()` - Obtener rol del usuario
- `hasRole()` - Verificar roles
- `canViewAuctions()` - Permisos de subastas
- `canViewPurchases()` - Permisos de compras
- `canViewManagementTable()` - Permisos de consolidado
- `handleDatabaseError()` - Manejo de errores
- `formatCurrency()` - Formateo de monedas
- `exportToCSV()` - Exportación de datos

#### `shipping.service.ts` (200+ líneas)
**Funciones principales**:
- `getShippings()` - Obtener todos los envíos
- `createShipping()` - Crear envío
- `updateShipping()` - Actualizar envío
- `getShipmentsInTransit()` - Envíos en tránsito
- `getDelayedShipments()` - Envíos atrasados
- `markShipmentArrived()` - Marcar como llegado

#### `costItems.service.ts` (250+ líneas)
**Funciones principales**:
- `getCostItemsByPurchaseId()` - Costos de una compra
- `createCostItem()` - Crear costo
- `getTotalCostsByType()` - Total por tipo
- `getCostsSummary()` - Resumen de costos
- `createMultipleCostItems()` - Crear múltiples

#### `currencyRates.service.ts` (300+ líneas)
**Funciones principales**:
- `getCurrencyRates()` - Obtener todas las tasas
- `getLatestRate()` - Tasa más reciente
- `getRateByDate()` - Tasa por fecha
- `getRateHistory()` - Histórico de tasas
- `convertAmount()` - Convertir entre monedas
- `getAverageRate()` - Promedio de período

#### `management.service.ts` (350+ líneas)
**Funciones principales**:
- `getManagementRecords()` - Todos los registros
- `getManagementConsolidado()` - Consolidado completo
- `updateManagementRecord()` - Actualizar registro
- `getConsolidadoTotals()` - Totales del consolidado
- `exportConsolidado()` - Exportar a Excel
- `getConsolidadoStats()` - Estadísticas

### Hooks (src/hooks/)

#### `useShipping.ts`
- `useShipping()` - Gestión de envíos
- `useShippingByPurchase()` - Envío de una compra
- `useShipmentsInTransit()` - Envíos en tránsito
- `useDelayedShipments()` - Envíos atrasados

#### `useCostItems.ts`
- `useCostItems()` - Gestión de costos
- `useCostsSummary()` - Resumen de costos
- `useTotalCostsByType()` - Totales por tipo

#### `useCurrencyRates.ts`
- `useCurrencyRates()` - Gestión de tasas
- `useLatestRate()` - Tasa más reciente
- `useRateByDate()` - Tasa por fecha
- `useRateHistory()` - Histórico
- `useCurrencyConverter()` - Conversor

#### `useManagement.ts`
- `useManagementRecords()` - Registros del consolidado
- `useManagementConsolidado()` - Consolidado completo
- `useManagementTotals()` - Totales
- `useManagementStats()` - Estadísticas
- `useExportConsolidado()` - Exportación

### Tipos (src/types/)

#### `database.ts` (500+ líneas)
**Definiciones**:
- Enums: UserRole, AuctionStatus, PurchaseType, etc.
- Interfaces: todas las tablas
- Tipos con relaciones
- Vistas
- Tipos de formularios
- Tipos de filtros
- Tipos de respuesta

---

## 🎓 Guías por Rol de Usuario

### Para Sebastián (Subastas)

**Documentos relevantes**:
1. [INICIO_RAPIDO.md](./INICIO_RAPIDO.md) - Sección "Como Sebastián"
2. [README.md](./README.md) - Sección "Para Sebastián"
3. Manual de usuario (a crear)

**Puede hacer**:
- ✅ Crear y editar subastas
- ✅ Asociar máquinas
- ✅ Gestionar fotos en Drive
- ✅ Marcar estado de subastas

**No puede hacer**:
- ❌ Ver subastas de otros
- ❌ Ver compras
- ❌ Ver consolidado

### Para Eliana (Compras)

**Documentos relevantes**:
1. [INICIO_RAPIDO.md](./INICIO_RAPIDO.md) - Sección "Como Eliana"
2. [README.md](./README.md) - Sección "Para Eliana"
3. Manual de usuario (a crear)

**Puede hacer**:
- ✅ Crear y editar compras
- ✅ Gestionar costos
- ✅ Gestionar envíos
- ✅ Actualizar pagos

**No puede hacer**:
- ❌ Ver subastas
- ❌ Editar consolidado

### Para Gerencia (Consolidado)

**Documentos relevantes**:
1. [INICIO_RAPIDO.md](./INICIO_RAPIDO.md) - Sección "Como Gerencia"
2. [README.md](./README.md) - Sección "Para Gerencia"
3. [RESUMEN_EJECUTIVO.md](./RESUMEN_EJECUTIVO.md)
4. Manual de usuario (a crear)

**Puede hacer**:
- ✅ Ver todo (subastas + compras)
- ✅ Editar consolidado
- ✅ Agregar proyecciones
- ✅ Exportar reportes

**No puede hacer**:
- ❌ Editar subastas
- ❌ Editar compras (solo lectura)

### Para Admin (Sistema)

**Documentos relevantes**:
1. [INSTALACION.md](./INSTALACION.md)
2. [postgres-setup.md](./postgres-setup.md)
3. Todos los documentos técnicos

**Puede hacer**:
- ✅ Todo lo anterior
- ✅ Gestionar usuarios
- ✅ Eliminar registros
- ✅ Configuración del sistema

---

## 📝 Checklist de Documentación

### Para Instalación
- [x] Guía rápida (5 min)
- [x] Guía detallada
- [x] Configuración PostgreSQL
- [x] Troubleshooting
- [ ] Video tutorial

### Para Usuarios
- [x] Descripción del sistema
- [x] Funcionalidades por rol
- [ ] Manual de usuario Sebastián
- [ ] Manual de usuario Eliana
- [ ] Manual de usuario Gerencia
- [ ] Video tutoriales por rol

### Para Desarrolladores
- [x] README técnico
- [x] Estructura del proyecto
- [x] Servicios y hooks
- [x] Base de datos detallada
- [x] Migraciones
- [ ] Contributing guidelines
- [ ] Code style guide

### Para Gerencia
- [x] Resumen ejecutivo
- [x] ROI estimado
- [x] Roadmap futuro
- [ ] Presentación ejecutiva
- [ ] Plan de capacitación

---

## 🔍 Búsqueda Rápida

### "¿Cómo instalo el sistema?"
→ [INICIO_RAPIDO.md](./INICIO_RAPIDO.md) o [INSTALACION.md](./INSTALACION.md)

### "¿Qué puede hacer cada rol?"
→ [README.md](./README.md) - Sección "Estructura de Roles"

### "¿Cómo funciona la base de datos?"
→ [postgres-setup.md](./postgres-setup.md)

### "¿Qué se implementó?"
→ [IMPLEMENTACION_COMPLETADA.md](./IMPLEMENTACION_COMPLETADA.md)

### "¿Cuál es el ROI?"
→ [RESUMEN_EJECUTIVO.md](./RESUMEN_EJECUTIVO.md) - Sección "ROI Estimado"

### "Tengo un error..."
→ [INSTALACION.md](./INSTALACION.md) - Sección "Troubleshooting"
→ [postgres-setup.md](./postgres-setup.md) - Sección "Troubleshooting"

### "¿Cómo desarrollo una nueva feature?"
→ [README.md](./README.md) - Sección "Desarrollo"

### "¿Dónde están las migraciones?"
→ `supabase/migrations/`

### "¿Dónde están los servicios?"
→ `src/services/`

### "¿Dónde están los hooks?"
→ `src/hooks/`

---

## 📞 Soporte

Si no encuentras lo que buscas:

1. Revisa este índice de nuevo
2. Usa la búsqueda rápida arriba
3. Revisa el README principal
4. Consulta el troubleshooting
5. Revisa los logs de error

---

## 📈 Estado de Documentación

| Tipo | Completado | Pendiente |
|------|------------|-----------|
| **Instalación** | 100% | Video tutorial |
| **Técnica** | 100% | Code style guide |
| **Usuario Final** | 70% | Manuales por rol, Videos |
| **Gerencia** | 90% | Presentación ejecutiva |
| **Total** | **90%** | **10%** |

---

**Última actualización**: 15 de Octubre, 2025  
**Versión de documentación**: 1.0  
**Estado**: ✅ Completa y actualizada

