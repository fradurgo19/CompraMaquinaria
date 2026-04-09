<#
.SYNOPSIS
  Volcado logico Supabase origen -> destino (pg_dump / pg_restore).

.DESCRIPTION
  Requiere PostgreSQL client tools (pg_dump, pg_restore, psql) en PATH.
  Define las URLs en supabase-pg-clone.local.env o en variables de entorno:
  SUPABASE_DB_SOURCE_URL, SUPABASE_DB_TARGET_URL
  Opcional: SUPABASE_DB_SOURCE_PASSWORD y SUPABASE_DB_TARGET_PASSWORD si la clave tiene @ o :
  (la URI debe ser postgresql://USUARIO@HOST:5432/postgres sin clave en la URL).
  Preferir Direct db.*:5432; si hay timeout, usar Session pooler *pooler.supabase.com:5432
  (usuario postgres.PROJECTREF). No usar Transaction pooler :6543 con pg_dump.

.NOTES
  Si pg_restore informa errores por objetos ya existentes en el proyecto nuevo,
  revisar la salida; puede ser necesario un volcado por esquema (--schema=public).
#>

$ErrorActionPreference = 'Stop'

$envFile = Join-Path $PSScriptRoot 'supabase-pg-clone.local.env'
if (Test-Path -LiteralPath $envFile) {
  Get-Content -LiteralPath $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq '' -or $line.StartsWith('#')) { return }
    $pair = $line -split '=', 2
    if ($pair.Length -eq 2) {
      $key = $pair[0].Trim()
      $val = $pair[1].Trim().Trim('"').Trim("'")
      if ($key) { Set-Item -Path "Env:$key" -Value $val }
    }
  }
}

$source = $env:SUPABASE_DB_SOURCE_URL
$target = $env:SUPABASE_DB_TARGET_URL

if ([string]::IsNullOrWhiteSpace($source) -or [string]::IsNullOrWhiteSpace($target)) {
  Write-Error 'Definir SUPABASE_DB_SOURCE_URL y SUPABASE_DB_TARGET_URL (ver supabase-pg-clone.env.example).'
}

function Remove-PasswordFromPostgresUri {
  param([string]$Uri)
  if ($Uri -match '^(postgres(?:ql)?://)([^:]+):([^@]+)@(.+)$') {
    return "$($matches[1])$($matches[2])@$($matches[4])"
  }
  return $Uri
}

function Resolve-DbConnection {
  param([string]$Uri, [string]$SeparatePassword)
  $pwd = $SeparatePassword
  if ([string]::IsNullOrWhiteSpace($pwd)) {
    return @{ Uri = $Uri; Password = $null }
  }
  $uriNoPass = Remove-PasswordFromPostgresUri -Uri $Uri
  return @{ Uri = $uriNoPass; Password = $pwd }
}

$srcConn = Resolve-DbConnection -Uri $source -SeparatePassword $env:SUPABASE_DB_SOURCE_PASSWORD
$tgtConn = Resolve-DbConnection -Uri $target -SeparatePassword $env:SUPABASE_DB_TARGET_PASSWORD

function Invoke-WithOptionalPgPassword {
  param([string]$Password, [scriptblock]$ScriptBlock)
  $prev = $env:PGPASSWORD
  try {
    if (-not [string]::IsNullOrWhiteSpace($Password)) {
      $env:PGPASSWORD = $Password
    }
    & $ScriptBlock
  } finally {
    if ($null -eq $prev) {
      Remove-Item 'Env:PGPASSWORD' -ErrorAction SilentlyContinue
    } else {
      $env:PGPASSWORD = $prev
    }
  }
}

function Assert-SupabasePostgresUri {
  param([string]$Uri, [string]$VarName)
  if ($Uri -match '^\s*https?://') {
    Write-Error (
      "$VarName apunta a la URL HTTPS de la API (navegador), no a PostgreSQL.`n`n" +
      'Supabase Dashboard -> Project Settings -> Database -> Connection string -> URI.`n' +
      'Direct: postgresql://postgres:PASSWORD@db.TUREF.supabase.co:5432/postgres`n' +
      'Si da timeout: Session pooler (puerto 5432), usuario postgres.TUREF'
    )
  }
  if ($Uri -notmatch '^\s*postgres(ql)?://') {
    Write-Error "$VarName debe empezar con postgresql:// (cadena de la base de datos, no https://....supabase.co)."
  }
  $directOk = $Uri -match 'db\.[^@:]+\.supabase\.co:5432'
  $sessionPoolerOk = $Uri -match 'pooler\.supabase\.com:5432'
  if (-not $directOk -and -not $sessionPoolerOk) {
    Write-Warning "${VarName}: se esperaba db.REF.supabase.co:5432 (Direct) o *.pooler.supabase.com:5432 (Session pooler)."
  }
  if ($Uri -match 'pooler\.supabase\.com:6543') {
    Write-Error "${VarName}: Transaction pooler :6543 no es adecuado para pg_dump. Usa Session pooler puerto 5432."
  }
}

Assert-SupabasePostgresUri -Uri $source -VarName 'SUPABASE_DB_SOURCE_URL'
Assert-SupabasePostgresUri -Uri $target -VarName 'SUPABASE_DB_TARGET_URL'

if (-not [string]::IsNullOrWhiteSpace($env:SUPABASE_DB_SOURCE_PASSWORD)) {
  Assert-SupabasePostgresUri -Uri $srcConn.Uri -VarName 'SUPABASE_DB_SOURCE_URL (sin password en URI)'
}
if (-not [string]::IsNullOrWhiteSpace($env:SUPABASE_DB_TARGET_PASSWORD)) {
  Assert-SupabasePostgresUri -Uri $tgtConn.Uri -VarName 'SUPABASE_DB_TARGET_URL (sin password en URI)'
}

if ([string]::IsNullOrWhiteSpace($env:PGSSLMODE)) {
  $env:PGSSLMODE = 'require'
}

foreach ($tool in @('pg_dump', 'pg_restore', 'psql')) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
    Write-Error "No se encontró '$tool' en PATH. Instala PostgreSQL client tools (o agrega su bin al PATH)."
  }
}

$dumpsDir = Join-Path $PSScriptRoot '.db-dumps'
if (-not (Test-Path -LiteralPath $dumpsDir)) {
  New-Item -ItemType Directory -Path $dumpsDir | Out-Null
}

$stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$dumpFile = Join-Path $dumpsDir "supabase_clone_$stamp.dump"

Write-Host '--- PostgreSQL (origen) ---' -ForegroundColor Cyan
Invoke-WithOptionalPgPassword -Password $srcConn.Password -ScriptBlock {
  & psql -d $srcConn.Uri -X -q -c 'SELECT version();'
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '--- PostgreSQL (destino, antes del restore) ---' -ForegroundColor Cyan
Invoke-WithOptionalPgPassword -Password $tgtConn.Password -ScriptBlock {
  & psql -d $tgtConn.Uri -X -q -c 'SELECT version();'
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '--- pg_dump (origen -> archivo) ---' -ForegroundColor Cyan
Invoke-WithOptionalPgPassword -Password $srcConn.Password -ScriptBlock {
  & pg_dump -d $srcConn.Uri -Fc --no-owner --no-privileges -f $dumpFile
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Volcado guardado en: $dumpFile" -ForegroundColor Green

Write-Host '--- pg_restore (archivo -> destino) ---' -ForegroundColor Cyan
Write-Host 'Si aparecen errores por objetos duplicados, es frecuente en proyectos Supabase nuevos; revisa el log.' -ForegroundColor Yellow
Invoke-WithOptionalPgPassword -Password $tgtConn.Password -ScriptBlock {
  & pg_restore -d $tgtConn.Uri --no-owner --no-privileges --verbose $dumpFile
}
$restoreCode = $LASTEXITCODE
# Código 1: a veces advertencias u objetos ya existentes; 2+: fallo más serio
if ($restoreCode -ge 2) {
  Write-Error "pg_restore terminó con código $restoreCode"
}
if ($restoreCode -eq 1) {
  Write-Host 'pg_restore codigo 1: revisa mensajes arriba; puede haberse aplicado la mayoria de objetos.' -ForegroundColor Yellow
}

Write-Host '--- Verificacion rapida (destino): tablas en public ---' -ForegroundColor Cyan
Invoke-WithOptionalPgPassword -Password $tgtConn.Password -ScriptBlock {
  & psql -d $tgtConn.Uri -X -q -c "SELECT count(*) AS public_tables FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
}
exit $LASTEXITCODE
