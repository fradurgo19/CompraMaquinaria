# ========================================
# Script para Iniciar el Frontend
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FRONTEND - Sistema de Maquinaria" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que Node.js está instalado
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Node.js no está instalado" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Node.js: $nodeVersion" -ForegroundColor Green

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: No se encuentra package.json" -ForegroundColor Red
    Write-Host "Ejecuta este script desde la raíz del proyecto" -ForegroundColor Yellow
    exit 1
}

# Verificar archivo .env
if (-not (Test-Path ".env")) {
    Write-Host "⚠ ADVERTENCIA: No se encuentra archivo .env" -ForegroundColor Yellow
    Write-Host "El sistema puede no funcionar correctamente" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Iniciando servidor de desarrollo..." -ForegroundColor Yellow
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Frontend estará disponible en:" -ForegroundColor Green
Write-Host "  http://localhost:5173" -ForegroundColor White
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Presiona Ctrl+C para detener el servidor" -ForegroundColor Yellow
Write-Host ""

# Verificar que las dependencias están instaladas
if (-not (Test-Path "node_modules")) {
    Write-Host "Instalando dependencias del frontend..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Fallo la instalación de dependencias" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Dependencias instaladas" -ForegroundColor Green
    Write-Host ""
}

# Iniciar Vite
npm run dev

