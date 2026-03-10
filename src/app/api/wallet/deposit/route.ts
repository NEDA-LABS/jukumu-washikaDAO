import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';

export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const { userId, amountTzs, phone } = await request.json();

    if (!userId || !amountTzs || !phone) {
      return NextResponse.json({ error: 'userId, amountTzs, and phone are required' }, { status: 400 });
    }

    if (amountTzs < 100) {
      return NextResponse.json({ error: 'Minimum deposit is 100 TZS' }, { status: 400 });
    }

    await ensureNtzsSchema(client);

    // Find the member and their nTZS user ID
    const memberRes = await client.query(
      `SELECT m.id, m.ntzs_user_id, m.ntzs_wallet_address, m.full_name
       FROM members m
       JOIN users u ON u.id = m.user_id
       WHERE u.id = $1 LIMIT 1`,
      [userId]
    );

    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const member = memberRes.rows[0] as {
      id: number;
      ntzs_user_id: string | null;
      ntzs_wallet_address: string | null;
      full_name: string;
    };

    if (!member.ntzs_user_id) {
      return NextResponse.json({ error: 'Wallet not provisioned. Please contact support.' }, { status: 400 });
    }

    // Check API key before calling nTZS
    if (!process.env.NTZS_API_KEY) {
      console.error('NTZS_API_KEY not configured');
      return NextResponse.json({ error: 'Wallet service is not configured. Contact admin.' }, { status: 503 });
    }

    // Normalize phone to 255XXXXXXXXX format
    let normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.length === 10 && normalizedPhone.startsWith('0')) {
      normalizedPhone = `255${normalizedPhone.slice(1)}`;
    } else if (normalizedPhone.length === 9) {
      normalizedPhone = `255${normalizedPhone}`;
    } else if (!normalizedPhone.startsWith('255')) {
      return NextResponse.json({ error: 'Invalid phone number format. Use 07XX XXX XXX or 255 7XX XXX XXX' }, { status: 400 });
    }

    console.log(`[Deposit] User ${userId}, Amount: ${amountTzs}, Phone: ${normalizedPhone}`);

    // Create deposit via nTZS (triggers mobile money prompt)
    const deposit = await ntzs.deposits.create({
      userId: member.ntzs_user_id,
      amountTzs,
      phoneNumber: normalizedPhone,
    });

    // Record in local ledger
    await recordTransaction(client, {
      ntzsId: deposit.id,
      type: 'deposit',
      status: deposit.status,
      toMemberId: member.id,
      amountTzs,
      phone: normalizedPhone,
      purpose: 'deposit',
      note: `Mobile money deposit by ${member.full_name}`,
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
      return NextResponse.json({
        error: error.body.message || error.body.error || 'Deposit failed',
        details: error.body,
        ntzsStatus: error.status,
      }, { status: error.status });
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Deposit error:', errMsg, error);
    return NextResponse.json({ error: errMsg || 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
