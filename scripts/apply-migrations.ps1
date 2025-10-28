# ========================================
# Script PowerShell para aplicar migraciones
# Sistema de Gestión de Compra de Maquinaria Usada
# ========================================

param(
    [string]$DbUser = "postgres",
    [string]$DbName = "maquinaria_usada",
    [string]$DbHost = "localhost",
    [string]$DbPort = "5432"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Aplicando Migraciones" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que psql está instalado
$psqlVersion = & psql --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: psql no está instalado o no está en el PATH" -ForegroundColor Red
    Write-Host "Instala PostgreSQL 17 y asegúrate de que está en el PATH" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ PostgreSQL encontrado: $psqlVersion" -ForegroundColor Green
Write-Host ""

# Solicitar password
$DbPassword = Read-Host "Ingresa la contraseña de PostgreSQL" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($DbPassword)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Establecer variable de entorno para password
$env:PGPASSWORD = $PlainPassword

Write-Host "Conectando a: $DbHost`:$DbPort/$DbName" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar conexión
Write-Host "[1/5] Verificando conexión..." -ForegroundColor Yellow
$result = & psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -c "SELECT version();" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: No se pudo conectar a la base de datos" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    exit 1
}
Write-Host "✓ Conexión exitosa" -ForegroundColor Green
Write-Host ""

# 2. Aplicar configuración inicial
Write-Host "[2/5] Aplicando configuración inicial..." -ForegroundColor Yellow
$result = & psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -f "scripts/setup-database.sql" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR al aplicar setup-database.sql" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    exit 1
}
Write-Host "✓ Configuración inicial aplicada" -ForegroundColor Green
Write-Host ""

# 3. Aplicar migración 1: schema inicial
Write-Host "[3/5] Aplicando migración 1: Schema inicial..." -ForegroundColor Yellow
$result = & psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -f "supabase/migrations/20251015221509_create_initial_schema.sql" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR al aplicar create_initial_schema.sql" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    exit 1
}
Write-Host "✓ Schema inicial creado" -ForegroundColor Green
Write-Host ""

# 4. Aplicar migración 2: datos semilla
Write-Host "[4/5] Aplicando migración 2: Datos semilla..." -ForegroundColor Yellow
$result = & psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -f "supabase/migrations/20251015222311_seed_initial_data.sql" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR al aplicar seed_initial_data.sql" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    exit 1
}
Write-Host "✓ Datos semilla insertados" -ForegroundColor Green
Write-Host ""

# 5. Aplicar migración 3: schema completo
Write-Host "[5/5] Aplicando migración 3: Schema completo..." -ForegroundColor Yellow
$result = & psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -f "supabase/migrations/20251015230000_update_schema_complete.sql" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR al aplicar update_schema_complete.sql" -ForegroundColor Red
    Write-Host $result -ForegroundColor Red
    exit 1
}
Write-Host "✓ Schema completo aplicado" -ForegroundColor Green
Write-Host ""

# Limpiar password de memoria
$env:PGPASSWORD = $null

Write-Host "========================================" -ForegroundColor Green
Write-Host "¡MIGRACIONES APLICADAS EXITOSAMENTE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Usuarios de prueba creados:" -ForegroundColor Cyan
Write-Host "  - sebastian@partequipos.com / sebastian123" -ForegroundColor White
Write-Host "  - eliana@partequipos.com / eliana123" -ForegroundColor White
Write-Host "  - gerencia@partequipos.com / gerencia123" -ForegroundColor White
Write-Host "  - admin@partequipos.com / admin123" -ForegroundColor White
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Cyan
Write-Host "  1. Copia database.config.example.js a database.config.js" -ForegroundColor White
Write-Host "  2. Configura las variables de entorno en .env" -ForegroundColor White
Write-Host "  3. Ejecuta: npm run dev" -ForegroundColor White
Write-Host ""

