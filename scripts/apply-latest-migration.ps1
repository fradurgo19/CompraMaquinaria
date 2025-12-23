# Script para aplicar la migración más reciente
# Uso: .\scripts\apply-latest-migration.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Aplicando Migración: Update CPD y Currency" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$migrationFile = "supabase\migrations\20250117_update_cpd_and_currency_constraints.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "ERROR: No se encontró el archivo de migración: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "Archivo de migración encontrado: $migrationFile" -ForegroundColor Green
Write-Host ""
Write-Host "Ejecutando migración..." -ForegroundColor Yellow
Write-Host ""

# Ejecutar migración (pedirá contraseña)
psql -U postgres -d maquinaria_usada -f $migrationFile

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "¡MIGRACIÓN APLICADA EXITOSAMENTE!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "ERROR: La migración falló. Revisa los errores arriba." -ForegroundColor Red
    exit 1
}
