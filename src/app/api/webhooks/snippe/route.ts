import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import crypto from 'crypto';
import { ensureSnippeSchema, creditSnippePaymentToLedger } from '@/lib/snippe-db';
import { ensureNtzsSchema } from '@/lib/ntzs-db';

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Verify HMAC signature if secret is configured
  const webhookSecret = process.env.SNIPPE_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = request.headers.get('x-webhook-signature') ?? '';
    if (!signature || !verifySignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
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
    await ensureNtzsSchema(client);

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

    // Credit the custodial ledger (group/member balance) so the deposit
    // reflects on the wallet — exactly once, guarded by ledger_posted.
    if (eventType === 'payment.completed') {
      await client.query('BEGIN');
      try {
        const credited = await creditSnippePaymentToLedger(client, reference);
        await client.query('COMMIT');
        if (credited > 0) console.log(`Snippe ${reference}: credited ${credited} TZS to ledger`);
      } catch (creditErr) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Snippe ledger credit failed for', reference, creditErr);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Snippe webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
