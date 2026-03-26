/**
 * One-time migration: bcrypt-hash any remaining plaintext passwords.
 * Run this before deploying the signin route changes that remove the plaintext fallback.
 *
 * Usage: node migrate-plaintext-passwords.js
 */
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, password_hash FROM users WHERE password_hash IS NOT NULL`
    );

    let migrated = 0;
    let skipped = 0;

    for (const row of result.rows) {
      const hash = row.password_hash;
      if (!hash || hash.startsWith('$2b$') || hash.startsWith('$2a$')) {
        skipped++;
        continue;
      }
      // Plaintext — hash it now
      const newHash = await bcrypt.hash(hash, 12);
      await client.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, row.id]);
      migrated++;
      console.log(`  ✓ Migrated user id=${row.id}`);
    }

    console.log(`\nDone. Migrated: ${migrated}, already hashed: ${skipped}`);
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
