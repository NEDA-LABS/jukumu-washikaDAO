import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';
import { getMasterNtzsUserId } from '@/lib/wallet/ledger';
import { normalizeDonorPhone, isValidDonorPhone } from '@/lib/donations';
import { ensureHarambeeSchema, newContributionReference } from '@/lib/harambee';
import { classifyNtzsError } from '@/lib/ntzs-errors';
import { normalizeEmail, isMailConfigured } from '@/lib/mailer';

export const runtime = 'nodejs';

const MIN_TZS = 500;
const MAX_MOBILE_TZS = 20_000_000;

/**
 * POST /api/public/harambee/<code>/contribute
 *
 * Put money into a collection, by mobile money or bank transfer. No account:
 * the people who give to a funeral collection are not going to sign up first,
 * and requiring it would simply mean the money moves over WhatsApp instead.
 *
 * The rails are the ones already proven by donations. A contribution is an
 * nTZS deposit into the master wallet, recorded against the organiser's member
 * wallet — or the group's, when the collection names one — so the existing
 * ledger credits the right account on settlement and the existing
 * reconciliation catches anything the webhook misses. No money code is added
 * here, which is the point: money code that only this feature uses is money
 * code only this feature has debugged.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const body = await request.json().catch(() => null);

  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 160) : '';
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 280) : null;
  const anonymous = body?.anonymous === true;
  const email = normalizeEmail(body?.email);
  const lang = body?.lang === 'sw' ? 'sw' : 'en';
  const method = body?.method === 'bank' ? 'bank' : 'mobile';
  const amountTzs = Math.floor(Number(body?.amountTzs));
  const phone = normalizeDonorPhone(body?.phone ?? '');

  if (name.length < 2) {
    return NextResponse.json({ error: 'Tell us who is giving', field: 'name' }, { status: 400 });
  }
  if (!Number.isFinite(amountTzs) || amountTzs < MIN_TZS) {
    return NextResponse.json(
      { error: `The smallest contribution is TSh ${MIN_TZS.toLocaleString()}`, field: 'amountTzs' },
      { status: 400 }
    );
  }
  if (method === 'mobile' && amountTzs > MAX_MOBILE_TZS) {
    return NextResponse.json({ error: 'That is too large for mobile money', field: 'amountTzs' }, { status: 400 });
  }
  if (method === 'mobile' && !isValidDonorPhone(phone)) {
    return NextResponse.json({ error: 'Enter a valid Tanzanian mobile number', field: 'phone' }, { status: 400 });
  }
  if (body?.email && !email) {
    return NextResponse.json({ error: 'That email address is not valid', field: 'email' }, { status: 400 });
  }

  // nTZS identifies a bank credit by the account it came from; the narration
  // does not survive TIPS, so this is required rather than optional.
  const payerAccountNumber = typeof body?.payerAccountNumber === 'string'
    ? body.payerAccountNumber.replace(/\s+/g, '') : '';
  if (method === 'bank' && !/^[0-9]{6,24}$/.test(payerAccountNumber)) {
    return NextResponse.json(
      { error: 'Enter the bank account number you will send from', field: 'payerAccountNumber' },
      { status: 400 }
    );
  }

  await ensureHarambeeSchema();
  const client = await pool.connect();
  try {
    await ensureNtzsSchema(client);

    const hres = await client.query(
      `SELECT id, title, status, organiser_member_id, group_id FROM harambees WHERE code = $1 LIMIT 1`,
      [code]
    );
    if (hres.rows.length === 0) {
      return NextResponse.json({ error: 'That collection was not found' }, { status: 404 });
    }
    const h = hres.rows[0] as {
      id: number; title: string; status: string; organiser_member_id: number; group_id: number | null;
    };
    if (h.status !== 'open') {
      return NextResponse.json({ error: 'This collection is closed' }, { status: 409 });
    }

    // One prompt at a time per number, so a double tap cannot ring twice.
    if (method === 'mobile') {
      const inFlight = await client.query(
        `SELECT reference FROM harambee_contributions
          WHERE harambee_id = $1 AND phone = $2 AND status = 'pending'
            AND created_at > NOW() - INTERVAL '3 minutes' LIMIT 1`,
        [h.id, phone]
      );
      if (inFlight.rows.length > 0) {
        return NextResponse.json({
          reference: (inFlight.rows[0] as { reference: string }).reference,
          pending: true,
          message: 'A payment request is already on its way to that number.',
        });
      }
    }

    const reference = newContributionReference();
    const masterUserId = await getMasterNtzsUserId(client);

    const deposit = await ntzs.deposits.create(
      method === 'bank'
        ? { userId: masterUserId, amountTzs, paymentMethod: 'bank_transfer' as const, payerAccountNumber }
        : { userId: masterUserId, amountTzs, phoneNumber: phone }
    );

    await client.query(
      `INSERT INTO harambee_contributions
         (harambee_id, contributor_name, phone, email, amount_tzs, method, ntzs_id,
          status, message, anonymous, reference, lang)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [h.id, name, method === 'bank' ? null : phone, email, amountTzs, method, deposit.id,
       deposit.status || 'pending', message, anonymous, reference, lang]
    );

    // Recorded against the account that should end up with the money, so the
    // ordinary settlement path credits it without knowing what a harambee is.
    await recordTransaction(client, {
      ntzsId: deposit.id,
      type: 'deposit',
      status: deposit.status,
      toMemberId: h.group_id ? null : h.organiser_member_id,
      toGroupId: h.group_id,
      amountTzs,
      netTzs: amountTzs,
      phone,
      purpose: 'harambee',
      note: `Harambee "${h.title}" — ${anonymous ? 'anonymous' : name}`,
      metadata: { kind: 'harambee', harambee_id: h.id, code, reference, contributor: name },
      posted: false,
    });

    if (method === 'bank') {
      return NextResponse.json({
        reference,
        status: deposit.status,
        amountTzs,
        bank: deposit.instructions ?? null,
        emailPromised: !!email && isMailConfigured(),
        message: 'Transfer the amount using these details. Include the reference exactly.',
      });
    }

    return NextResponse.json({
      reference,
      status: deposit.status,
      amountTzs,
      emailPromised: !!email && isMailConfigured(),
      message: 'Check your phone and approve the payment.',
    });
  } catch (error) {
    if (error instanceof NtzsApiError) {
      console.error('[harambee/contribute] nTZS', error.status, error.body);
      const c = classifyNtzsError(error);
      return NextResponse.json(
        { error: c.message, code: c.kind, safeToRetry: c.safeToRetry },
        { status: error.status >= 500 ? 502 : error.status }
      );
    }
    console.error('[harambee/contribute]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
