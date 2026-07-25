import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema } from '@/lib/ntzs-db';
import { getMasterNtzsUserId } from '@/lib/wallet/ledger';
import { withdrawalFeeTzs } from '@/lib/wallet/fees';

/**
 * Withdrawal quote — mandatory pre-step for a cash-out.
 *
 * The client calls this first, shows a confirmation card with the fee
 * breakdown + net amount, and only then POSTs to /api/wallet/withdraw with
 * the returned `quoteId`. Quotes are valid for ~5 minutes; if the user waits
 * too long the confirm call gets an `invalid_quote` and we re-issue.
 *
 * Because cash-outs debit the pooled master reserve (not the member's own
 * nTZS user), the quote is issued against the master user id — matching what
 * /api/wallet/withdraw will send on POST /withdrawals.
 */
export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const { userId, amountTzs, phone } = await request.json();
    if (!userId || !amountTzs || !phone) {
      return NextResponse.json({ error: 'userId, amountTzs, and phone are required' }, { status: 400 });
    }
    const amount = Math.round(Number(amountTzs));
    if (!Number.isFinite(amount) || amount < 100) {
      return NextResponse.json({ error: 'Minimum withdrawal is 100 TZS' }, { status: 400 });
    }
    if (!process.env.NTZS_API_KEY) {
      return NextResponse.json({ error: 'Wallet service is not configured. Contact admin.' }, { status: 503 });
    }

    await ensureNtzsSchema(client);

    // Auth check: caller must own a member record for the given user id.
    const memberRes = await client.query(
      `SELECT m.id FROM members m JOIN users u ON u.id = m.user_id WHERE u.id = $1 LIMIT 1`,
      [userId]
    );
    if (memberRes.rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    let normalizedPhone = String(phone).replace(/\D/g, '');
    if (normalizedPhone.length === 10 && normalizedPhone.startsWith('0')) {
      normalizedPhone = `255${normalizedPhone.slice(1)}`;
    } else if (normalizedPhone.length === 9) {
      normalizedPhone = `255${normalizedPhone}`;
    } else if (!normalizedPhone.startsWith('255')) {
      return NextResponse.json({ error: 'Invalid phone number format. Use 07XX XXX XXX or 255 7XX XXX XXX' }, { status: 400 });
    }

    const platformFeeTzs = withdrawalFeeTzs(amount);
    const totalDebitTzs = amount + platformFeeTzs;
    const masterUserId = await getMasterNtzsUserId(client);

    const quote = await ntzs.withdrawals.quote({
      userId: masterUserId,
      amountTzs: amount,
      phoneNumber: normalizedPhone,
    });

    return NextResponse.json({
      quoteId: quote.quoteId,
      expiresAt: quote.expiresAt,
      recipientName: quote.recipientName,
      receiveAmountTzs: quote.receiveAmountTzs,
      burnAmountTzs: quote.burnAmountTzs,
      fees: quote.fees,
      balance: quote.balance,
      // Our own on-top platform fee (charged to the member on confirm; separate
      // from any nTZS-side fees inside quote.fees).
      platformFeeTzs,
      totalDebitTzs,
      normalizedPhone,
    });
  } catch (error) {
    if (error instanceof NtzsApiError) {
      console.error('nTZS quote error:', error.status, error.body);
      return NextResponse.json({ error: error.body.message || error.body.error || 'Quote failed', details: error.body }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Withdrawal quote error:', msg, error);
    return NextResponse.json({ error: msg || 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
