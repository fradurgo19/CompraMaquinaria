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
    user: 'tu_usuario',
    password: 'tu_password',
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
// O si usas PostgreSQL local:
// VITE_DATABASE_URL=postgresql://usuario:password@localhost:5432/maquinaria_usada

