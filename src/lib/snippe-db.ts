import type { PoolClient } from 'pg';
import { credit } from '@/lib/wallet/ledger';
import { recordTransaction } from '@/lib/ntzs-db';

let _snippeSchemaReady: Promise<void> | null = null;

/** Cached per process like ensureNtzsSchema; a failed run is retried, never cached. */
export function ensureSnippeSchema(client: PoolClient): Promise<void> {
  if (!_snippeSchemaReady) {
    _snippeSchemaReady = _runEnsureSnippeSchema(client).catch((err) => {
      _snippeSchemaReady = null;
      throw err;
    });
  }
  return _snippeSchemaReady;
}

async function _runEnsureSnippeSchema(client: PoolClient) {
  await client.query(`
    ALTER TABLE monthly_contributions
    ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100)
  `).catch(() => { /* table may not exist yet */ });

  await client.query(`
    CREATE TABLE IF NOT EXISTS snippe_payments (
      id SERIAL PRIMARY KEY,
      reference VARCHAR(100) NOT NULL UNIQUE,
      external_reference VARCHAR(100),
      event_type VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL,
      amount_tzs INTEGER NOT NULL,
      net_tzs INTEGER,
      channel_type VARCHAR(30),
      channel_provider VARCHAR(30),
      customer_phone VARCHAR(30),
      customer_name VARCHAR(100),
      payment_type VARCHAR(20) NOT NULL DEFAULT 'contribution',
      member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
      group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
      metadata JSONB,
      failure_reason TEXT,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // Tracks whether a completed payment has been credited to the custodial
  // ledger (wallet_accounts). Guards exactly-once crediting across webhook
  // re-delivery, polling, and backfill.
  await client.query(`ALTER TABLE snippe_payments ADD COLUMN IF NOT EXISTS ledger_posted BOOLEAN NOT NULL DEFAULT false`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_snippe_payments_reference ON snippe_payments(reference);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_snippe_payments_member_id ON snippe_payments(member_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_snippe_payments_group_id ON snippe_payments(group_id);`);
}

/**
 * Credit a completed Snippe payment to the custodial ledger, exactly once.
 * Contributions and group top-ups fund the GROUP treasury; a member-only
 * payment (no group) funds the member. Idempotent via the `ledger_posted`
 * flag + a row lock, so webhook re-delivery / polling / backfill can't
 * double-credit. Caller must hold an open transaction.
 *
 * Returns the amount credited (0 if nothing was done).
 */
export async function creditSnippePaymentToLedger(
  client: PoolClient,
  reference: string
): Promise<number> {
  const r = await client.query(
    `SELECT id, event_type, status, amount_tzs, member_id, group_id, payment_type, ledger_posted
     FROM snippe_payments WHERE reference = $1 FOR UPDATE`,
    [reference]
  );
  if (r.rows.length === 0) return 0;
  const p = r.rows[0] as {
    id: number; event_type: string; status: string; amount_tzs: number;
    member_id: number | null; group_id: number | null; payment_type: string; ledger_posted: boolean;
  };

  if (p.ledger_posted) return 0;                       // already credited
  // Settle on the authoritative `status` field: the webhook sets it AND so does
  // the status-poll fallback, whereas `event_type` stays 'payment.pending' when
  // only the poll ran. Keying on status means a completed payment credits no
  // matter which path observed the completion.
  const isComplete = p.status === 'completed' || p.event_type === 'payment.completed';
  if (!isComplete) return 0;
  const amount = Math.round(Number(p.amount_tzs));
  if (!(amount > 0)) return 0;

  const owner: { ownerType: 'member' | 'group'; ownerId: number } | null =
    p.group_id ? { ownerType: 'group', ownerId: p.group_id }
    : p.member_id ? { ownerType: 'member', ownerId: p.member_id }
    : null;
  if (!owner) return 0;

  await credit(client, owner, amount);
  await recordTransaction(client, {
    ntzsId: reference,
    type: 'deposit',
    status: 'completed',
    toMemberId: owner.ownerType === 'member' ? owner.ownerId : null,
    toGroupId: owner.ownerType === 'group' ? owner.ownerId : null,
    amountTzs: amount,
    netTzs: amount,
    purpose: p.payment_type === 'contribution' ? 'contribution' : 'topup',
    note: `Snippe ${p.payment_type} (${reference})`,
    posted: true,
    metadata: { snippeReference: reference, memberId: p.member_id, paymentType: p.payment_type },
  });
  await client.query(`UPDATE snippe_payments SET ledger_posted = true WHERE id = $1`, [p.id]);
  return amount;
}

/**
 * Pre-insert a pending payment record so that both webhook updates and
 * polling fallback updates have a row to work with.
 */
export async function insertPendingPayment(
  client: PoolClient,
  params: {
    reference: string;
    amount: number;
    phone: string;
    customerName: string;
    paymentType: string;
    memberId: number;
    groupId: number;
    metadata: Record<string, string>;
  }
) {
  await ensureSnippeSchema(client);
  await client.query(
    `INSERT INTO snippe_payments (
       reference, event_type, status, amount_tzs,
       customer_phone, customer_name,
       payment_type, member_id, group_id, metadata
     ) VALUES ($1, 'payment.pending', 'pending', $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (reference) DO NOTHING`,
    [
      params.reference,
      params.amount,
      params.phone,
      params.customerName,
      params.paymentType,
      params.memberId,
      params.groupId,
      JSON.stringify(params.metadata),
    ]
  );
}
