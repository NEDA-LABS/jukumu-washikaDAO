require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not found in environment');
  }
  
  console.log('📡 Connecting to database...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const client = await pool.connect();
  
  try {
    console.log('🚀 Running nTZS treasury migration...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../database/migrations/002_ntzs_treasury.sql'),
      'utf8'
    );

    await client.query('BEGIN');
    
    // Split by semicolons and run each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement) {
        console.log(`Executing: ${statement.substring(0, 60)}...`);
        await client.query(statement);
      }
    }

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error(err);
  process.exit(1);
});
