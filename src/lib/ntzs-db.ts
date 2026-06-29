import type { PoolClient } from 'pg';

let _schemaReady: Promise<void> | null = null;

/**
 * Ensure nTZS wallet columns and transaction table exist.
 * Cached per process — DDL only runs once.
 */
export async function ensureNtzsSchema(client: PoolClient) {
  if (_schemaReady) return _schemaReady;
  _schemaReady = _runEnsureNtzsSchema(client);
  return _schemaReady;
}

async function _runEnsureNtzsSchema(client: PoolClient) {
  // Add wallet columns to members
  await client.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS ntzs_user_id VARCHAR(100)`);
  await client.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS ntzs_wallet_address VARCHAR(42)`);

  // Add wallet columns to groups
  await client.query(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS ntzs_user_id VARCHAR(100)`);
  await client.query(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS ntzs_wallet_address VARCHAR(42)`);

  // Transaction ledger
  await client.query(`
    CREATE TABLE IF NOT EXISTS ntzs_transactions (
      id SERIAL PRIMARY KEY,
      ntzs_id VARCHAR(100) NOT NULL,
      type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'transfer', 'withdrawal')),
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'processing', 'completed', 'minted', 'failed')),
      from_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
      from_group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
      to_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
      to_group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
      amount_tzs INTEGER NOT NULL,
      fee_tzs INTEGER DEFAULT 0,
      net_tzs INTEGER,
      phone VARCHAR(30),
      tx_hash VARCHAR(100),
      purpose VARCHAR(50) CHECK (purpose IN ('deposit', 'withdrawal', 'contribution', 'disbursement', 'p2p', 'fee')),
      note TEXT,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Fix status constraint to include 'submitted' (nTZS API uses this status)
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE ntzs_transactions DROP CONSTRAINT IF EXISTS ntzs_transactions_status_check;
      ALTER TABLE ntzs_transactions ADD CONSTRAINT ntzs_transactions_status_check
        CHECK (status IN ('pending', 'submitted', 'processing', 'completed', 'minted', 'failed'));
    EXCEPTION WHEN undefined_table THEN NULL;
    END $$;
  `);

  // Indexes
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ntzs_tx_ntzs_id ON ntzs_transactions(ntzs_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ntzs_tx_type ON ntzs_transactions(type)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ntzs_tx_status ON ntzs_transactions(status)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ntzs_tx_from_member ON ntzs_transactions(from_member_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ntzs_tx_to_member ON ntzs_transactions(to_member_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ntzs_tx_from_group ON ntzs_transactions(from_group_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ntzs_tx_to_group ON ntzs_transactions(to_group_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ntzs_tx_created ON ntzs_transactions(created_at DESC)`);

  // ── Custodial ledger (one master nTZS wallet + per-entity DB balances) ──

  // Internal ledger transfers have no external nTZS id — relax the NOT NULL.
  await client.query(`ALTER TABLE ntzs_transactions ALTER COLUMN ntzs_id DROP NOT NULL`);

  // `posted` tracks whether a row's balance effect has been applied to
  // wallet_accounts, so webhook/sync re-delivery can't double-count.
  // Legacy rows are back-filled to `true` (already settled in the old
  // per-wallet model / reflected in imported balances) so they are never
  // re-applied against the new ledger.
  await client.query(`ALTER TABLE ntzs_transactions ADD COLUMN IF NOT EXISTS posted BOOLEAN`);
  await client.query(`UPDATE ntzs_transactions SET posted = true WHERE posted IS NULL`);
  await client.query(`ALTER TABLE ntzs_transactions ALTER COLUMN posted SET DEFAULT false`);
  await client.query(`ALTER TABLE ntzs_transactions ALTER COLUMN posted SET NOT NULL`);

  // Widen purpose to cover internal flows. 'expense' previously violated the
  // CHECK, which silently broke spend-proposal execution.
  await client.query(`
    DO $$ BEGIN
      ALTER TABLE ntzs_transactions DROP CONSTRAINT IF EXISTS ntzs_transactions_purpose_check;
      ALTER TABLE ntzs_transactions ADD CONSTRAINT ntzs_transactions_purpose_check
        CHECK (purpose IN ('deposit','withdrawal','contribution','disbursement','p2p','fee','expense','funding','topup'));
    EXCEPTION WHEN undefined_table THEN NULL;
    END $$;
  `);

  // Per-entity balance accounts. owner_id = 0 marks the master/fee singletons.
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
  // Seed the platform singletons (master holds the real on-chain float).
  await client.query(`INSERT INTO wallet_accounts (owner_type, owner_id) VALUES ('master', 0) ON CONFLICT (owner_type, owner_id) DO NOTHING`);
  await client.query(`INSERT INTO wallet_accounts (owner_type, owner_id) VALUES ('fee', 0) ON CONFLICT (owner_type, owner_id) DO NOTHING`);
}

/** Link an nTZS wallet to a member record */
export async function linkMemberWallet(
  client: PoolClient,
  memberId: number,
  ntzsUserId: string,
  walletAddress: string
) {
  await client.query(
    `UPDATE members SET ntzs_user_id = $1, ntzs_wallet_address = $2, updated_at = NOW() WHERE id = $3`,
    [ntzsUserId, walletAddress, memberId]
  );
}

/** Link an nTZS wallet to a group record */
export async function linkGroupWallet(
  client: PoolClient,
  groupId: number,
  ntzsUserId: string,
  walletAddress: string
) {
  await client.query(
    `UPDATE groups SET ntzs_user_id = $1, ntzs_wallet_address = $2, updated_at = NOW() WHERE id = $3`,
    [ntzsUserId, walletAddress, groupId]
  );
}

/** Record a transaction in the local ledger */
export async function recordTransaction(
  client: PoolClient,
  tx: {
    ntzsId: string | null;
    type: 'deposit' | 'transfer' | 'withdrawal';
    status: string;
    fromMemberId?: number | null;
    fromGroupId?: number | null;
    toMemberId?: number | null;
    toGroupId?: number | null;
    amountTzs: number;
    feeTzs?: number;
    netTzs?: number;
    phone?: string;
    txHash?: string;
    purpose: string;
    note?: string;
    metadata?: Record<string, unknown>;
    posted?: boolean;
  }
) {
  const result = await client.query(
    `INSERT INTO ntzs_transactions (
      ntzs_id, type, status,
      from_member_id, from_group_id, to_member_id, to_group_id,
      amount_tzs, fee_tzs, net_tzs,
      phone, tx_hash, purpose, note, metadata, posted
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    RETURNING id`,
    [
      tx.ntzsId, tx.type, tx.status,
      tx.fromMemberId ?? null, tx.fromGroupId ?? null,
      tx.toMemberId ?? null, tx.toGroupId ?? null,
      tx.amountTzs, tx.feeTzs ?? 0, tx.netTzs ?? null,
      tx.phone ?? null, tx.txHash ?? null,
      tx.purpose, tx.note ?? null,
      tx.metadata ? JSON.stringify(tx.metadata) : null,
      tx.posted ?? false,
    ]
  );
  return (result as { rows: { id: number }[] }).rows[0].id;
}

/** Update a transaction status (used by webhooks) */
export async function updateTransactionStatus(
  client: PoolClient,
  ntzsId: string,
  status: string,
  txHash?: string
) {
  await client.query(
    `UPDATE ntzs_transactions SET status = $1, tx_hash = COALESCE($2, tx_hash), updated_at = NOW() WHERE ntzs_id = $3`,
    [status, txHash ?? null, ntzsId]
  );
}
