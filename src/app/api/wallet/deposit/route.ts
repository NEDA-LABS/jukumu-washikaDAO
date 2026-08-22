import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';
import { getMasterNtzsUserId } from '@/lib/wallet/ledger';
import { getActor } from '@/lib/wallet/authorize';
import { classifyNtzsError } from '@/lib/ntzs-errors';

/**
 * On-ramp: mobile money → master wallet. Funds mint into the single master
 * nTZS wallet; the member's database balance is credited on confirmation
 * (webhook/sync), not here — so a never-confirmed deposit never credits.
 */
export async function POST(request: NextRequest) {
  const actor = getActor(request);
  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();

  // Declared out here so the catch can still record a deposit that nTZS may
  // have taken payment for. Inside the try they are out of scope exactly when
  // recovering the payment matters most.
  let member: { id: number; full_name: string } | null = null;
  let normalizedPhone = '';
  let amountTzs = 0;

  try {
    // Identity comes from the signed cookie, never the request body.
    const userId = actor.userId;
    const parsed = await request.json();
    const phone = parsed?.phone;
    amountTzs = Number(parsed?.amountTzs);

    if (!userId || !amountTzs || !phone) {
      return NextResponse.json({ error: 'userId, amountTzs, and phone are required' }, { status: 400 });
    }
    if (amountTzs < 100) {
      return NextResponse.json({ error: 'Minimum deposit is 100 TZS' }, { status: 400 });
    }
    if (!process.env.NTZS_API_KEY) {
      console.error('NTZS_API_KEY not configured');
      return NextResponse.json({ error: 'Wallet service is not configured. Contact admin.' }, { status: 503 });
    }

    await ensureNtzsSchema(client);

    const memberRes = await client.query(
      `SELECT m.id, m.full_name FROM members m JOIN users u ON u.id = m.user_id WHERE u.id = $1 LIMIT 1`,
      [userId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    member = memberRes.rows[0] as { id: number; full_name: string };

    // Normalize phone to 255XXXXXXXXX
    normalizedPhone = String(phone).replace(/\D/g, '');
    if (normalizedPhone.length === 10 && normalizedPhone.startsWith('0')) {
      normalizedPhone = `255${normalizedPhone.slice(1)}`;
    } else if (normalizedPhone.length === 9) {
      normalizedPhone = `255${normalizedPhone}`;
    } else if (!normalizedPhone.startsWith('255')) {
      return NextResponse.json({ error: 'Invalid phone number format. Use 07XX XXX XXX or 255 7XX XXX XXX' }, { status: 400 });
    }

    const masterUserId = await getMasterNtzsUserId(client);

    // Mint into the master wallet via mobile money STK push.
    const deposit = await ntzs.deposits.create({
      userId: masterUserId,
      amountTzs,
      phoneNumber: normalizedPhone,
    });

    // Pending ledger row — balance is credited on settlement, not now.
    await recordTransaction(client, {
      ntzsId: deposit.id,
      type: 'deposit',
      status: deposit.status,
      toMemberId: member.id,
      amountTzs,
      netTzs: amountTzs,
      phone: normalizedPhone,
      purpose: 'deposit',
      note: `Mobile money deposit by ${member.full_name}`,
      posted: false,
    });

    return NextResponse.json({
      depositId: deposit.id,
      status: deposit.status,
      amountTzs,
      message: 'Mobile top-up request sent. Please confirm on your phone.',
    });
  } catch (error) {
    if (error instanceof NtzsApiError) {
      console.error('nTZS deposit error:', error.status, error.body);
      const c = classifyNtzsError(error);

      // nTZS could not confirm the prompt was delivered but may already have
      // taken the money, and asks the integrator to poll rather than retry.
      // That instruction is ours to follow, not the member's to read: the
      // deposit is recorded and handed back as pending, so the same polling
      // that settles every other top-up settles this one. Telling the member
      // it failed would invite them to pay a second time.
      if (c.kind === 'unconfirmed_delivery' && c.depositId && member) {
        try {
          await recordTransaction(client, {
            ntzsId: c.depositId,
            type: 'deposit',
            status: 'pending',
            toMemberId: member.id,
            amountTzs,
            netTzs: amountTzs,
            phone: normalizedPhone,
            purpose: 'deposit',
            note: `Mobile money deposit by ${member.full_name} (delivery unconfirmed)`,
            posted: false,
          });
        } catch (e) {
          console.error('could not record unconfirmed deposit', c.depositId, e);
        }
        return NextResponse.json({
          depositId: c.depositId,
          status: 'pending',
          amountTzs,
          unconfirmed: true,
          message: c.message,
        });
      }

      // Everything else: our words, not theirs. The provider's own sentence
      // stays in the log above, where it is useful.
      return NextResponse.json(
        { error: c.message, code: c.kind, safeToRetry: c.safeToRetry },
        { status: error.status >= 500 ? 502 : error.status }
      );
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Deposit error:', errMsg, error);
    return NextResponse.json({ error: errMsg || 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
