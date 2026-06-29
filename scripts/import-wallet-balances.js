/**
 * One-time import: seed wallet_accounts balances from each entity's current
 * on-chain nTZS balance. Run this BEFORE the custodial ledger goes live.
 *
 *   DATABASE_URL=... NTZS_API_KEY=... [NTZS_BASE_URL=...] \
 *     node scripts/import-wallet-balances.js
 *
 * Safe to re-run: it only seeds an account whose ledger balance is still 0, so
 * it never clobbers balances once the ledger has activity.
 *
 * NOTE: this imports the *display* balances. Funds physically remain in the
 * per-entity wallets until you run a separate sweep into the master wallet.
 * Until then, internal transfers work, but external withdrawals draw on the
 * master float — watch GET /api/admin/treasury/reconcile for the gap.
 */
const { Pool } = require('pg');

const NTZS_BASE_URL = process.env.NTZS_BASE_URL || 'https://www.ntzs.co.tz';
const NTZS_API_KEY = process.env.NTZS_API_KEY;

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is required'); process.exit(1); }
if (!NTZS_API_KEY) { console.error('NTZS_API_KEY is required'); process.exit(1); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function ensureSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS wallet_accounts (
      id SERIAL PRIMARY KEY,
      owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('member','group','investor','master','fee')),
      owner_id INTEGER NOT NULL DEFAULT 0,
      balance_tzs BIGINT NOT NULL DEFAULT 0 CHECK (balance_tzs >= 0),
      ntzs_user_id VARCHAR(100),
      ntzs_wallet_address VARCHAR(42),
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_accounts_owner ON wallet_accounts(owner_type, owner_id)`);
}

async function getOnchainBalance(ntzsUserId) {
  const res = await fetch(`${NTZS_BASE_URL}/api/v1/users/${ntzsUserId}`, {
    headers: { Authorization: `Bearer ${NTZS_API_KEY}` },
  });
  if (!res.ok) throw new Error(`nTZS HTTP ${res.status}`);
  const data = await res.json();
  return Math.round(Number(data.balanceTzs || 0));
}

async function seed(client, ownerType, ownerId, balanceTzs) {
  await client.query(
    `INSERT INTO wallet_accounts (owner_type, owner_id, balance_tzs)
     VALUES ($1, $2, $3)
     ON CONFLICT (owner_type, owner_id)
     DO UPDATE SET balance_tzs = EXCLUDED.balance_tzs, updated_at = NOW()
     WHERE wallet_accounts.balance_tzs = 0`,
    [ownerType, ownerId, balanceTzs]
  );
}

async function importType(client, label, rows) {
  let seeded = 0, total = 0, failed = 0;
  for (const r of rows) {
    try {
      const bal = await getOnchainBalance(r.ntzs_user_id);
      await seed(client, label, r.id, bal);
      total += bal;
      if (bal > 0) seeded++;
      console.log(`  ${label} ${r.id}: ${bal.toLocaleString()} TZS`);
    } catch (e) {
      failed++;
      console.error(`  ${label} ${r.id}: FAILED — ${e.message}`);
    }
  }
  console.log(`${label}s: ${seeded} funded, total ${total.toLocaleString()} TZS, ${failed} failed\n`);
  return total;
}

(async () => {
  const client = await pool.connect();
  try {
    await ensureSchema(client);
    console.log('Importing on-chain balances into wallet_accounts...\n');

    const members = (await client.query(`SELECT id, ntzs_user_id FROM members WHERE ntzs_user_id IS NOT NULL`)).rows;
    const groups = (await client.query(`SELECT id, ntzs_user_id FROM groups WHERE ntzs_user_id IS NOT NULL`)).rows;
    let investors = [];
    try {
      investors = (await client.query(`SELECT user_id AS id, ntzs_user_id FROM investor_profiles WHERE ntzs_user_id IS NOT NULL`)).rows;
    } catch { /* investor_profiles may not exist on older schemas */ }

    const m = await importType(client, 'member', members);
    const g = await importType(client, 'group', groups);
    const i = await importType(client, 'investor', investors);

    const accounts = members.length + groups.length + investors.length;
    console.log(`Done. Imported ${(m + g + i).toLocaleString()} TZS across ${accounts} accounts.`);
    console.log('Next: sweep these funds into the master wallet, then verify GET /api/admin/treasury/reconcile.');
  } catch (e) {
    console.error('Import failed:', e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
