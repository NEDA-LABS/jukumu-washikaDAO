import type { PoolClient } from 'pg';

/**
 * Ensure nTZS wallet columns and transaction table exist.
 * Safe to call multiple times (uses IF NOT EXISTS / IF NOT EXISTS).
 */
export async function ensureNtzsSchema(client: PoolClient) {
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
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'minted', 'failed')),
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

  // Indexes
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ntzs_tx_ntzs_id ON ntzs_transactions(ntzs_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ntzs_tx_type ON ntzs_transactions(type)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ntzs_tx_status ON ntzs_transactions(status)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ntzs_tx_from_member ON ntzs_transactions(from_member_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ntzs_tx_to_member ON ntzs_transactions(to_member_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ntzs_tx_from_group ON ntzs_transactions(from_group_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ntzs_tx_to_group ON ntzs_transactions(to_group_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_ntzs_tx_created ON ntzs_transactions(created_at DESC)`);
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
    ntzsId: string;
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
  }
) {
  const result = await client.query(
    `INSERT INTO ntzs_transactions (
      ntzs_id, type, status,
      from_member_id, from_group_id, to_member_id, to_group_id,
      amount_tzs, fee_tzs, net_tzs,
      phone, tx_hash, purpose, note, metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    RETURNING id`,
    [
      tx.ntzsId, tx.type, tx.status,
      tx.fromMemberId ?? null, tx.fromGroupId ?? null,
      tx.toMemberId ?? null, tx.toGroupId ?? null,
      tx.amountTzs, tx.feeTzs ?? 0, tx.netTzs ?? null,
      tx.phone ?? null, tx.txHash ?? null,
      tx.purpose, tx.note ?? null,
      tx.metadata ? JSON.stringify(tx.metadata) : null,
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
