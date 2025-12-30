# Script para aplicar migraciones a Supabase
# Usa la connection string de Supabase

$supabaseDbUrl = "postgresql://postgres.hoqigshqvbnlicuvirpo:GvvFx3tMF1AykszO@aws-0-us-west-2.pooler.supabase.com:5432/postgres"
$migrationsPath = "supabase\migrations"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Aplicando Migraciones a Supabase" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que psql esta instalado
$psqlCheck = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlCheck) {
    Write-Host "ERROR: psql no esta instalado o no esta en el PATH" -ForegroundColor Red
    exit 1
}

$psqlVersion = & psql --version 2>&1
Write-Host "PostgreSQL encontrado: $psqlVersion" -ForegroundColor Green
Write-Host ""

# Obtener todas las migraciones ordenadas por nombre
$migrations = Get-ChildItem -Path $migrationsPath -Filter "*.sql" | Sort-Object Name

Write-Host "Migraciones encontradas: $($migrations.Count)" -ForegroundColor Yellow
Write-Host ""

$successCount = 0
$errorCount = 0

foreach ($migration in $migrations) {
    $current = $successCount + $errorCount + 1
    Write-Host "[$current/$($migrations.Count)] Aplicando: $($migration.Name)" -ForegroundColor Cyan
    
    # Aplicar migracion usando psql con la URL de Supabase
    $result = & psql $supabaseDbUrl -f $migration.FullName 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK - Migracion aplicada exitosamente" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "  ERROR - Error aplicando migracion" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        $errorCount++
        Write-Host ""
        Write-Host "Continuar con las siguientes migraciones? (S/N)" -ForegroundColor Yellow
        $continue = Read-Host
        if ($continue -ne "S" -and $continue -ne "s") {
            break
        }
    }
    Write-Host ""
}

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Resumen" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Exitosas: $successCount" -ForegroundColor Green
$errorColor = if ($errorCount -eq 0) { "Green" } else { "Red" }
Write-Host "  Errores: $errorCount" -ForegroundColor $errorColor
Write-Host "=========================================" -ForegroundColor Cyan
