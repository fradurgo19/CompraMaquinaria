# 📁 Configuración de OneDrive para el Sistema

Este documento explica cómo configurar la integración con OneDrive para gestionar fotos y documentos de máquinas.

## 🎯 Objetivo

Cada máquina tendrá una carpeta en OneDrive con el formato:
```
OneDrive/MaquinariaUsada/
  ├── Modelo - Serial/
  │   ├── Fotos/
  │   └── Documentos/
```

## 🔧 Configuración en Azure (Microsoft 365)

### Paso 1: Registrar Aplicación en Azure AD

1. **Ir a Azure Portal**:
   - https://portal.azure.com
   - Iniciar sesión con tu cuenta de **Partequipos S.A.S**

2. **Ir a Azure Active Directory**:
   - Menú lateral → "Azure Active Directory"
   - Seleccionar "App registrations" (Registros de aplicaciones)

3. **Crear Nueva Aplicación**:
   - Clic en "+ New registration"
   - **Name**: `Sistema Maquinaria - OneDrive Integration`
   - **Supported account types**: `Accounts in this organizational directory only (Partequipos only - Single tenant)`
   - **Redirect URI**: 
     - Type: `Single-page application (SPA)`
     - URL: `http://localhost:5173` (desarrollo)
     - Agregar también: `https://tu-dominio-vercel.app` (producción)
   - Clic en "Register"

### Paso 2: Configurar Permisos

1. En la app creada, ir a **API permissions**:
   - Clic en "+ Add a permission"
   - Seleccionar "Microsoft Graph"
   - Seleccionar "Delegated permissions"
   - Buscar y agregar:
     - ✅ `Files.ReadWrite` - Leer y escribir archivos del usuario
     - ✅ `Files.ReadWrite.All` - Leer y escribir todos los archivos
     - ✅ `User.Read` - Leer perfil del usuario
   - Clic en "Add permissions"

2. **Grant admin consent**:
   - Clic en "Grant admin consent for Partequipos"
   - Confirmar

### Paso 3: Obtener Credenciales

1. **Application (client) ID**:
   - En la página "Overview" de tu app
   - Copiar el "Application (client) ID"
   - Ejemplo: `12345678-1234-1234-1234-123456789abc`

2. **Directory (tenant) ID**:
   - También en "Overview"
   - Copiar el "Directory (tenant) ID"
   - Ejemplo: `87654321-4321-4321-4321-cba987654321`

3. **Client Secret** (opcional, para backend):
   - Ir a "Certificates & secrets"
   - Clic en "+ New client secret"
   - Description: `Backend API Secret`
   - Expires: `24 months`
   - Clic en "Add"
   - **IMPORTANTE**: Copiar el VALUE inmediatamente (no se mostrará de nuevo)

### Paso 4: Configurar en el Proyecto

Editar `backend/.env`:

```env
# OneDrive / Microsoft Graph
ONEDRIVE_CLIENT_ID=tu-client-id-aqui
ONEDRIVE_CLIENT_SECRET=tu-client-secret-aqui
ONEDRIVE_TENANT_ID=tu-tenant-id-aqui
ONEDRIVE_REDIRECT_URI=http://localhost:5173

# Producción
# ONEDRIVE_REDIRECT_URI=https://tu-dominio-vercel.app
```

Editar `.env.local` (frontend):

```env
VITE_ONEDRIVE_CLIENT_ID=tu-client-id-aqui
VITE_ONEDRIVE_TENANT_ID=tu-tenant-id-aqui
VITE_ONEDRIVE_REDIRECT_URI=http://localhost:5173
```

---

## 🔐 Flujo de Autenticación

### Para Desarrollo Local

El sistema usa **OAuth 2.0 con PKCE** (Proof Key for Code Exchange):

1. **Usuario hace clic** en "Conectar OneDrive"
2. **Se abre ventana** de login de Microsoft
3. **Usuario autoriza** el acceso
4. **Se obtiene token** de acceso
5. **Token se guarda** en localStorage (válido 1 hora)
6. **Refresh automático** cuando expira

### Configuración del Frontend

El componente `OneDriveAuth` maneja la autenticación automáticamente.

---

## 📂 Estructura de Carpetas

### Carpeta Raíz

```
OneDrive/
└── MaquinariaUsada/           ← Carpeta base (se crea automáticamente)
    ├── KOMATSU PC200-8 - ABC123/
    │   ├── Fotos/
    │   │   ├── foto1.jpg
    │   │   ├── foto2.jpg
    │   │   └── foto3.jpg
    │   └── Documentos/
    │       ├── Reporte_Tecnico.pdf
    │       └── Certificado.pdf
    ├── CAT 320D - XYZ789/
    │   ├── Fotos/
    │   └── Documentos/
    └── ...
```

### Reglas de Nomenclatura

- **Formato de carpeta**: `{MODELO} - {SERIAL}`
  - Ejemplo: `KOMATSU PC200-8 - ABC123`
  - Ejemplo: `CAT 320D - XYZ789`

- **Subcarpetas fijas**:
  - `Fotos/` - Imágenes de la máquina
  - `Documentos/` - Reportes técnicos, certificados, etc.

---

## 🚀 Uso en la Aplicación

### Para Sebastián (Subastas)

1. **Crear Subasta**:
   - Al crear una subasta, automáticamente se crea la carpeta en OneDrive
   - Formato: `{modelo} - {serial}`

2. **Subir Fotos**:
   - Ir a "Subastas"
   - Clic en una subasta
   - Clic en "Gestionar Archivos"
   - Arrastrar fotos o seleccionar archivos
   - Las fotos se suben a `OneDrive/MaquinariaUsada/{modelo-serial}/Fotos/`

3. **Subir Documentos**:
   - Mismo proceso, pero seleccionar pestaña "Documentos"
   - Los archivos se suben a `OneDrive/MaquinariaUsada/{modelo-serial}/Documentos/`

4. **Ver Archivos**:
   - Clic en "Ver en OneDrive" abre la carpeta directamente en OneDrive
   - También se pueden ver en la app web

### Para Gerencia

- Acceso de solo lectura a todas las carpetas
- Puede ver fotos y documentos
- Puede descargar archivos

---

## 📊 Permisos por Rol

| Rol | Ver Carpetas | Subir Archivos | Eliminar Archivos | Ver en OneDrive |
|-----|--------------|----------------|-------------------|-----------------|
| Sebastián | Solo sus máquinas | ✅ | ✅ | ✅ |
| Eliana | Solo compras | ❌ | ❌ | ✅ |
| Gerencia | Todas | ❌ | ❌ | ✅ |
| Admin | Todas | ✅ | ✅ | ✅ |

---

## 🔍 Búsqueda de Carpetas

Desde la aplicación se puede:
- Buscar carpetas por modelo
- Buscar carpetas por serial
- Filtrar por fecha de creación
- Ver todos los archivos de una máquina

---

## ⚠️ Notas Importantes

### Límites de OneDrive

- **Tamaño máximo de archivo**: 250 GB (con carga por bloques)
- **Tamaño en la app**: 50 MB por archivo
- **Total de almacenamiento**: Según plan de Microsoft 365
- **Tipos de archivo permitidos**: Todos (fotos, PDFs, Word, Excel, etc.)

### Seguridad

- ✅ Tokens encriptados
- ✅ HTTPS obligatorio en producción
- ✅ Permisos a nivel de organización (Partequipos)
- ✅ No se comparten archivos públicamente

### Sincronización

- Los archivos se sincronizan en tiempo real con OneDrive
- Accesibles desde cualquier dispositivo
- Compatible con OneDrive desktop app

---

## 🐛 Troubleshooting

### "No se puede conectar a OneDrive"

1. Verificar que las credenciales en `.env` son correctas
2. Verificar que los permisos fueron aprobados por el admin
3. Verificar conexión a internet

### "Token expirado"

- El token se renueva automáticamente
- Si persiste, hacer clic en "Reconectar OneDrive"

### "No se puede subir archivo"

1. Verificar tamaño del archivo (< 50 MB)
2. Verificar conexión a internet
3. Verificar permisos del usuario

---

## 📞 Contacto

Para problemas de configuración de Azure AD, contactar al administrador de TI de Partequipos S.A.S.

---

**Estado**: Configuración pendiente
**Próximos pasos**: Configurar app en Azure AD y actualizar variables de entorno

