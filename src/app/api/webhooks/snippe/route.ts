import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

async function ensureSnippeSchema(client: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) {
  // Add payment_reference to monthly_contributions if it doesn't exist yet
  await client.query(`
    ALTER TABLE monthly_contributions
    ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100)
  `);

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
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_snippe_payments_reference ON snippe_payments(reference);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_snippe_payments_member_id ON snippe_payments(member_id);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_snippe_payments_group_id ON snippe_payments(group_id);
  `);
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = body.type as string;
  const data = body.data as Record<string, unknown> | undefined;

  if (!data || !eventType) {
    return NextResponse.json({ error: 'Missing event data' }, { status: 400 });
  }

  const reference = data.reference as string;
  const status = data.status as string;
  const amount = (data.amount as { value?: number } | undefined)?.value ?? 0;
  const net = (data.settlement as { net?: { value?: number } } | undefined)?.net?.value ?? null;
  const channel = data.channel as { type?: string; provider?: string } | undefined;
  const customer = data.customer as { phone?: string; name?: string } | undefined;
  const metadata = (data.metadata ?? {}) as Record<string, string>;
  const failureReason = (data.failure_reason as string) ?? null;
  const completedAt = (data.completed_at as string) ?? null;

  const memberId = metadata.member_id ? Number(metadata.member_id) : null;
  const groupId = metadata.group_id ? Number(metadata.group_id) : null;
  const paymentType = metadata.payment_type ?? 'contribution';

  const client = await pool.connect();
  try {
    await ensureSnippeSchema(client);

    await client.query(
      `
      INSERT INTO snippe_payments (
        reference, external_reference, event_type, status, amount_tzs, net_tzs,
        channel_type, channel_provider, customer_phone, customer_name,
        payment_type, member_id, group_id, metadata, failure_reason, completed_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (reference) DO UPDATE SET
        event_type = EXCLUDED.event_type,
        status = EXCLUDED.status,
        net_tzs = EXCLUDED.net_tzs,
        failure_reason = EXCLUDED.failure_reason,
        completed_at = EXCLUDED.completed_at
      `,
      [
        reference,
        (data.external_reference as string) ?? null,
        eventType,
        status,
        amount,
        net,
        channel?.type ?? null,
        channel?.provider ?? null,
        customer?.phone ?? null,
        customer?.name ?? null,
        paymentType,
        memberId && Number.isFinite(memberId) ? memberId : null,
        groupId && Number.isFinite(groupId) ? groupId : null,
        JSON.stringify(metadata),
        failureReason,
        completedAt,
      ]
    );

    // On successful contribution payment: upsert monthly_contributions record
    if (eventType === 'payment.completed' && paymentType === 'contribution' && memberId && groupId) {
      // contribution_month is stored as 'YYYY-MM', convert to first-of-month DATE for the DB column
      const monthStr = metadata.contribution_month ?? new Date().toISOString().slice(0, 7);
      const monthDate = `${monthStr}-01`;
      await client.query(
        `
        INSERT INTO monthly_contributions (member_id, group_id, amount, contribution_month, payment_date, status, payment_reference)
        VALUES ($1, $2, $3, $4::date, CURRENT_DATE, 'paid', $5)
        ON CONFLICT (member_id, group_id, contribution_month) DO UPDATE
          SET status = 'paid', amount = EXCLUDED.amount,
              payment_date = CURRENT_DATE,
              payment_reference = EXCLUDED.payment_reference
        `,
        [memberId, groupId, amount, monthDate, reference]
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Snippe webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
