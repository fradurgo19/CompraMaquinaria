# ========================================
# Script para Iniciar el Backend
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BACKEND API - Sistema de Maquinaria" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Cambiar al directorio backend
cd backend

# Verificar que Node.js está instalado
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Node.js no está instalado" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Node.js: $nodeVersion" -ForegroundColor Green

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: No se encuentra package.json en backend/" -ForegroundColor Red
    exit 1
}

# Verificar archivo .env
if (-not (Test-Path ".env")) {
    Write-Host "⚠ ADVERTENCIA: No se encuentra archivo .env" -ForegroundColor Yellow
    Write-Host "Creando .env desde .env.example..." -ForegroundColor Yellow
    
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "✓ Archivo .env creado" -ForegroundColor Green
        Write-Host ""
        Write-Host "IMPORTANTE: Edita backend/.env y configura DB_PASSWORD" -ForegroundColor Yellow
        Write-Host "Presiona Enter para continuar..." -ForegroundColor Yellow
        Read-Host
    } else {
        Write-Host "ERROR: No se encuentra .env.example" -ForegroundColor Red
        exit 1
    }
}

# Verificar que las dependencias están instaladas
if (-not (Test-Path "node_modules")) {
    Write-Host "Instalando dependencias del backend..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Fallo la instalación de dependencias" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Dependencias instaladas" -ForegroundColor Green
    Write-Host ""
}

# Verificar conexión a PostgreSQL
Write-Host "Verificando conexión a PostgreSQL..." -ForegroundColor Yellow
$pgService = Get-Service postgresql* -ErrorAction SilentlyContinue
if ($pgService -and $pgService.Status -eq "Running") {
    Write-Host "✓ PostgreSQL está corriendo" -ForegroundColor Green
} else {
    Write-Host "⚠ PostgreSQL no está corriendo o no está instalado" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Iniciando servidor backend..." -ForegroundColor Yellow
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Backend API estará disponible en:" -ForegroundColor Green
Write-Host "  http://localhost:3000" -ForegroundColor White
Write-Host "  Health check: http://localhost:3000/health" -ForegroundColor White
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Presiona Ctrl+C para detener el servidor" -ForegroundColor Yellow
Write-Host ""

# Iniciar el servidor
npm run dev

