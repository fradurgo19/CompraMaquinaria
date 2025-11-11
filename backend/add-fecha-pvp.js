import pg from 'pg';

const { Client } = pg;

const sql = `
-- Agregar columna fecha a pvp_history
ALTER TABLE pvp_history ADD COLUMN IF NOT EXISTS fecha INTEGER;

-- Comentario
COMMENT ON COLUMN pvp_history.fecha IS 'Año de compra (solo el año, ej: 2019, 2020)';
`;

async function runMigration() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'maquinaria_usada',
    user: 'postgres',
    password: 'password'
  });

  try {
    console.log('🔄 Conectando a la base de datos...');
    await client.connect();
    console.log('✅ Conectado');
    
    console.log('🔄 Agregando columna fecha a pvp_history...');
    await client.query(sql);
    
    console.log('✅ Columna fecha agregada exitosamente');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    process.exit(0);
  }
}

runMigration();

