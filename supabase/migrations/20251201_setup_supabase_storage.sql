-- Migration: Setup Supabase Storage buckets for file uploads
-- Created: 2025-12-01
-- Description: Configura buckets de Supabase Storage para almacenar archivos en producción
--              - equipment-reservations: Documentos de reservas de equipos
--              - machine-files: Fotos y documentos de máquinas
--              - purchase-files: Archivos relacionados con compras
--              - new-purchase-files: Archivos de compras nuevas

-- Nota: Esta migración crea los buckets en Supabase Storage
-- Los buckets se crean automáticamente cuando se usa el cliente de Supabase Storage
-- Esta migración documenta la estructura esperada

-- Bucket: equipment-reservations
-- Almacena documentos adjuntos de solicitudes de reserva de equipos
-- Política: Solo usuarios autenticados pueden subir, solo el jefe comercial y el comercial que creó la reserva pueden ver

-- Bucket: machine-files
-- Almacena fotos y documentos de máquinas
-- Política: Usuarios autenticados pueden subir y ver sus propios archivos

-- Bucket: purchase-files
-- Almacena archivos relacionados con compras (facturas, documentos, etc.)
-- Política: Usuarios con rol de compras pueden subir y ver

-- Bucket: new-purchase-files
-- Almacena archivos de compras nuevas
-- Política: Usuarios con rol de compras pueden subir y ver

-- Nota: Los buckets se crearán automáticamente desde el código del backend
-- cuando se detecte que estamos en producción (SUPABASE_STORAGE_ENABLED=true)
-- Esta migración es principalmente documentación

COMMENT ON SCHEMA storage IS 'Supabase Storage buckets para archivos del sistema';

