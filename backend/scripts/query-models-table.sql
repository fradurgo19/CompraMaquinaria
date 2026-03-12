-- Lista de modelos en la tabla `models` (alimentan el select inline "Modelo" en /management junto con MODEL_OPTIONS).
-- Ejecutar en tu cliente PostgreSQL/Supabase.

SELECT id, name, created_at, updated_at
FROM models
ORDER BY name ASC;
