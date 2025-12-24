# ========================================
# Script PowerShell de verificación de esquema (no destructivo)
# Usa psql para comprobar tablas/columnas clave según el estado actual del app.
# Ejecuta solo consultas de lectura. No modifica datos.
# ========================================

param(
    [string]$DbUser = "postgres",
    [string]$DbName = "maquinaria_usada",
    [string]$DbHost = "localhost",
    [string]$DbPort = "5432"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verificacion de esquema (lectura)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que psql está instalado
$psqlVersion = & psql --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: psql no está instalado o no está en el PATH" -ForegroundColor Red
    exit 1
}
Write-Host "OK PostgreSQL encontrado: $psqlVersion" -ForegroundColor Green

# Password
$DbPassword = Read-Host "Ingresa la contraseña de PostgreSQL" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($DbPassword)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
$env:PGPASSWORD = $PlainPassword

Write-Host ""
Write-Host "Conectando a: $DbHost`:$DbPort/$DbName" -ForegroundColor Cyan

$script:failures = @()

function Test-Exists {
    param(
        [string]$Name,
        [string]$Sql
    )
    $result = & psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -At -c $Sql 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host ("FAIL {0} (error de consulta)" -f $Name) -ForegroundColor Red
        $script:failures += ("{0} -> {1}" -f $Name, $result)
        return
    }
    if ([string]::IsNullOrWhiteSpace($result)) {
        Write-Host ("FAIL {0} (no encontrado)" -f $Name) -ForegroundColor Red
        $script:failures += ("{0} -> sin resultado" -f $Name)
    } else {
        Write-Host ("OK {0}" -f $Name) -ForegroundColor Green
    }
}

function Test-NotExists {
    param(
        [string]$Name,
        [string]$Sql
    )
    $result = & psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -At -c $Sql 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host ("FAIL {0} (error de consulta)" -f $Name) -ForegroundColor Red
        $script:failures += ("{0} -> {1}" -f $Name, $result)
        return
    }
    if ([string]::IsNullOrWhiteSpace($result)) {
        Write-Host ("OK {0} (no existe, OK)" -f $Name) -ForegroundColor Green
    } else {
        Write-Host ("FAIL {0} (existe y deberia no estar)" -f $Name) -ForegroundColor Red
        $script:failures += ("{0} -> {1}" -f $Name, $result)
    }
}

Write-Host ""
Write-Host "Checks principales..." -ForegroundColor Yellow

# Tablas base
Test-Exists "Tabla equipments" "SELECT to_regclass('public.equipments');"
Test-Exists "Tabla equipment_reservations" "SELECT to_regclass('public.equipment_reservations');"
Test-Exists "Tabla purchases" "SELECT to_regclass('public.purchases');"
Test-Exists "Tabla new_purchases" "SELECT to_regclass('public.new_purchases');"
Test-Exists "Tabla service_records" "SELECT to_regclass('public.service_records');"

# Columnas clave (estado actual del app)
Test-Exists "equipments.state" "SELECT column_name FROM information_schema.columns WHERE table_name='equipments' AND column_name='state';"
Test-NotExists "equipments.reservation_status (debe NO existir)" "SELECT column_name FROM information_schema.columns WHERE table_name='equipments' AND column_name='reservation_status';"
Test-Exists "equipments.reservation_deadline_date" "SELECT column_name FROM information_schema.columns WHERE table_name='equipments' AND column_name='reservation_deadline_date';"
Test-Exists "equipments.staging_type" "SELECT column_name FROM information_schema.columns WHERE table_name='equipments' AND column_name='staging_type';"

Test-Exists "purchases.empresa" "SELECT column_name FROM information_schema.columns WHERE table_name='purchases' AND column_name='empresa';"
Test-Exists "new_purchases.empresa" "SELECT column_name FROM information_schema.columns WHERE table_name='new_purchases' AND column_name='empresa';"
Test-Exists "new_purchases.due_date" "SELECT column_name FROM information_schema.columns WHERE table_name='new_purchases' AND column_name='due_date';"

Test-Exists "service_records.staging_type" "SELECT column_name FROM information_schema.columns WHERE table_name='service_records' AND column_name='staging_type';"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($script:failures.Count -eq 0) {
    Write-Host "Resultado: OK (sin fallos detectados)" -ForegroundColor Green
} else {
    Write-Host "Resultado: Hay fallos. Revisalos abajo:" -ForegroundColor Red
    $script:failures | ForEach-Object { Write-Host (" - {0}" -f $_) -ForegroundColor Red }
}
Write-Host "========================================" -ForegroundColor Cyan

# Limpiar password
$env:PGPASSWORD = $null


