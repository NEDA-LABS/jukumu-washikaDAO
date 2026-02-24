import type { PoolClient } from 'pg';

export async function ensureSnippeSchema(client: PoolClient) {
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
  await client.query(`CREATE INDEX IF NOT EXISTS idx_snippe_payments_reference ON snippe_payments(reference);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_snippe_payments_member_id ON snippe_payments(member_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_snippe_payments_group_id ON snippe_payments(group_id);`);
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
