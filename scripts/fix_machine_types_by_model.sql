-- Script: Actualizar tipos de máquina basados en modelo
-- Created: 2026-01-09
-- Description: Actualizar machine_type en la tabla machines basándose en el modelo
-- Los modelos se buscan tanto en machines.model como en purchases.model

-- Query 1: Actualizar tipos de máquina para modelos específicos
-- Actualiza machines.machine_type basándose en machines.model
UPDATE machines
SET machine_type = CASE
  WHEN UPPER(TRIM(model)) = 'ARM BOOM CYLINDER' THEN 'PARTS'
  WHEN UPPER(TRIM(model)) = 'C12R' THEN 'MINI CARGADOR'
  WHEN UPPER(TRIM(model)) = 'C12R-B' THEN 'MINI CARGADOR'
  WHEN UPPER(TRIM(model)) = 'CABIN' THEN 'PARTS'
  WHEN UPPER(TRIM(model)) = 'CAB_ZX120-5' THEN 'PARTS'
  WHEN UPPER(TRIM(model)) = 'SWING MOTOR' THEN 'PARTS'
  WHEN UPPER(TRIM(model)) = 'TANK COVER' THEN 'PARTS'
  WHEN UPPER(TRIM(model)) = 'DAT-300RS' THEN 'WELDER'
  WHEN UPPER(TRIM(model)) = 'DLW-300LS' THEN 'WELDER'
  ELSE machine_type -- Mantener el valor actual si no coincide
END,
updated_at = NOW()
WHERE UPPER(TRIM(model)) IN (
  'ARM BOOM CYLINDER',
  'C12R',
  'C12R-B',
  'CABIN',
  'CAB_ZX120-5',
  'SWING MOTOR',
  'TANK COVER',
  'DAT-300RS',
  'DLW-300LS'
);

-- También actualizar basándose en purchases.model para máquinas que no tienen modelo en machines
-- pero sí en purchases
UPDATE machines m
SET machine_type = CASE
  WHEN UPPER(TRIM(p.model)) = 'ARM BOOM CYLINDER' THEN 'PARTS'
  WHEN UPPER(TRIM(p.model)) = 'C12R' THEN 'MINI CARGADOR'
  WHEN UPPER(TRIM(p.model)) = 'C12R-B' THEN 'MINI CARGADOR'
  WHEN UPPER(TRIM(p.model)) = 'CABIN' THEN 'PARTS'
  WHEN UPPER(TRIM(p.model)) = 'CAB_ZX120-5' THEN 'PARTS'
  WHEN UPPER(TRIM(p.model)) = 'SWING MOTOR' THEN 'PARTS'
  WHEN UPPER(TRIM(p.model)) = 'TANK COVER' THEN 'PARTS'
  WHEN UPPER(TRIM(p.model)) = 'DAT-300RS' THEN 'WELDER'
  WHEN UPPER(TRIM(p.model)) = 'DLW-300LS' THEN 'WELDER'
  ELSE m.machine_type
END,
m.updated_at = NOW()
FROM purchases p
WHERE p.machine_id = m.id
  AND p.model IS NOT NULL
  AND UPPER(TRIM(p.model)) IN (
    'ARM BOOM CYLINDER',
    'C12R',
    'C12R-B',
    'CABIN',
    'CAB_ZX120-5',
    'SWING MOTOR',
    'TANK COVER',
    'DAT-300RS',
    'DLW-300LS'
  )
  AND (m.machine_type IS NULL OR m.machine_type = 'EXCAVADORA');

-- Query 2: Corregir nombre del modelo DAT300 RS a DAT-300RS
-- Actualizar en machines
UPDATE machines
SET model = 'DAT-300RS',
    updated_at = NOW()
WHERE UPPER(TRIM(model)) IN ('DAT300 RS', 'DAT300RS', 'DAT 300 RS');

-- Actualizar en purchases
UPDATE purchases
SET model = 'DAT-300RS',
    updated_at = NOW()
WHERE UPPER(TRIM(model)) IN ('DAT300 RS', 'DAT300RS', 'DAT 300 RS');

-- Verificar resultados
-- Mostrar registros actualizados en machines
SELECT 
  id,
  model,
  machine_type,
  updated_at
FROM machines
WHERE UPPER(TRIM(model)) IN (
  'ARM BOOM CYLINDER',
  'C12R',
  'C12R-B',
  'CABIN',
  'CAB_ZX120-5',
  'SWING MOTOR',
  'TANK COVER',
  'DAT-300RS',
  'DLW-300LS'
)
ORDER BY model, machine_type;

-- Mostrar registros actualizados en purchases
SELECT 
  p.id,
  p.model,
  m.machine_type,
  p.updated_at
FROM purchases p
JOIN machines m ON p.machine_id = m.id
WHERE UPPER(TRIM(COALESCE(p.model, m.model))) IN (
  'ARM BOOM CYLINDER',
  'C12R',
  'C12R-B',
  'CABIN',
  'CAB_ZX120-5',
  'SWING MOTOR',
  'TANK COVER',
  'DAT-300RS',
  'DLW-300LS'
)
ORDER BY p.model, m.machine_type;
