/**
 * Configuración de Base de Datos
 * 
 * Copiar este archivo como database.config.js y configurar según tu entorno
 */

export const databaseConfig = {
  // Usar PostgreSQL local o Supabase
  useLocal: false, // Cambiar a true para usar PostgreSQL local
  
  // Configuración para PostgreSQL 17 Local
  local: {
    host: 'localhost',
    port: 5432,
    database: 'maquinaria_usada',
    user: process.env.DATABASE_USER || '',
    password: process.env.DATABASE_PASSWORD || '', // Nunca poner contraseñas aquí; usar .env
  },
  
  // Configuración para Supabase (Cloud)
  supabase: {
    url: process.env.VITE_SUPABASE_URL || '',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
  },
};

// Variables de entorno requeridas (crear archivo .env)
// VITE_SUPABASE_URL=https://your-project.supabase.co
// VITE_SUPABASE_ANON_KEY=your-anon-key
// Si usas PostgreSQL local:
// DATABASE_USER=tu_usuario
// DATABASE_PASSWORD=tu_contraseña
// O: VITE_DATABASE_URL=postgresql://usuario:password@localhost:5432/maquinaria_usada

