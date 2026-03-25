const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Applying group codes migration...');
    const sql = fs.readFileSync(
      path.join(__dirname, 'database', 'migrations', '003_group_codes.sql'),
      'utf8'
    );
    await client.query(sql);
    console.log('✅ Migration applied.');

    const check = await client.query(
      `SELECT id, name, group_code, join_policy FROM groups ORDER BY id LIMIT 10`
    );
    console.log('Sample groups after migration:');
    console.table(check.rows);
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
