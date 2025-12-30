-- =====================================================
-- SISTEMA DE PRECIOS SUGERIDOS
-- Tablas para históricos de precios (Excel)
-- =====================================================

-- Tabla 1: Histórico de Precios de Subastas
CREATE TABLE IF NOT EXISTS public.auction_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Datos de la máquina
  model VARCHAR(100) NOT NULL,
  brand VARCHAR(50),
  serial VARCHAR(100),
  year INTEGER,
  hours INTEGER,
  
  -- Precio pagado en subasta
  precio_comprado NUMERIC(15,2),
  
  -- Datos de subasta (fecha opcional)
  fecha_subasta DATE,
  proveedor VARCHAR(100),
  lot_number VARCHAR(50),
  
  -- Metadatos
  notas TEXT,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  imported_by UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
  
  -- Índices para búsqueda rápida
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla 2: Histórico de PVP Estimados (Consolidado)
CREATE TABLE IF NOT EXISTS public.pvp_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Datos de la máquina
  provee VARCHAR(100),        -- Proveedor
  modelo VARCHAR(100) NOT NULL,
  serie VARCHAR(100),
  anio INTEGER,               -- Año
  hour INTEGER,               -- Horas
  
  -- Costos
  precio NUMERIC(15,2),       -- Precio FOB
  inland NUMERIC(15,2),       -- Inland
  cif_usd NUMERIC(15,2),      -- CIF USD
  cif NUMERIC(15,2),          -- CIF
  gastos_pto NUMERIC(15,2),   -- Gastos Puerto
  flete NUMERIC(15,2),        -- Flete
  trasld NUMERIC(15,2),       -- Traslado
  rptos NUMERIC(15,2),        -- Repuestos
  proyectado NUMERIC(15,2),   -- Proyectado
  pvp_est NUMERIC(15,2),      -- PVP Estimado
  
  -- Metadatos
  notas TEXT,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  imported_by UUID REFERENCES public.users_profile(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejorar rendimiento de búsquedas
CREATE INDEX IF NOT EXISTS idx_auction_history_model ON public.auction_price_history(model);
CREATE INDEX IF NOT EXISTS idx_auction_history_year ON public.auction_price_history(year);
CREATE INDEX IF NOT EXISTS idx_auction_history_hours ON public.auction_price_history(hours);
CREATE INDEX IF NOT EXISTS idx_auction_history_brand ON public.auction_price_history(brand);

CREATE INDEX IF NOT EXISTS idx_pvp_history_modelo ON public.pvp_history(modelo);
CREATE INDEX IF NOT EXISTS idx_pvp_history_anio ON public.pvp_history(anio);
CREATE INDEX IF NOT EXISTS idx_pvp_history_hour ON public.pvp_history(hour);
CREATE INDEX IF NOT EXISTS idx_pvp_history_pvp ON public.pvp_history(pvp_est);
CREATE INDEX IF NOT EXISTS idx_pvp_history_rptos ON public.pvp_history(rptos);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION public.update_price_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_auction_price_history_updated_at
  BEFORE UPDATE ON public.auction_price_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_price_history_updated_at();

CREATE TRIGGER update_pvp_history_updated_at
  BEFORE UPDATE ON public.pvp_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_price_history_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE public.auction_price_history IS 'Histórico de precios de subastas ganadas importado desde Excel';
COMMENT ON TABLE public.pvp_history IS 'Histórico de PVP estimados y repuestos importado desde Excel';
COMMENT ON COLUMN public.pvp_history.rptos IS 'Valor histórico de repuestos para sugerencias';
COMMENT ON COLUMN public.pvp_history.pvp_est IS 'PVP estimado histórico para sugerencias';

-- RLS: keep disabled for now; Vercel backend uses service role. Enable and add policies when exposing via anon key.
ALTER TABLE public.auction_price_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pvp_history DISABLE ROW LEVEL SECURITY;

