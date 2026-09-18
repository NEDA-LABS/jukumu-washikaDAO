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
    const memberId = (memberRes.rows[0] as { id: number }).id;

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

    // What this member actually holds, checked before anything is asked of
    // nTZS. Without it, a member requesting more than they have was told the
    // pooled reserve was short — a sentence about our problem, in answer to
    // theirs.
    const balRes = await client.query(
      `SELECT COALESCE(balance_tzs, 0)::bigint AS b FROM wallet_accounts
        WHERE owner_type = 'member' AND owner_id = $1 LIMIT 1`,
      [memberId]
    );
    const available = Number((balRes.rows[0] as { b: string } | undefined)?.b ?? 0);
    if (totalDebitTzs > available) {
      return NextResponse.json({
        error: `You have TSh ${available.toLocaleString('en-US')}. This withdrawal needs TSh ${totalDebitTzs.toLocaleString('en-US')} including the fee.`,
        code: 'member_insufficient',
        availableTzs: available,
        requiredTzs: totalDebitTzs,
      }, { status: 400 });
    }

    const masterUserId = await getMasterNtzsUserId(client);

    const quote = await ntzs.withdrawals.quote({
      userId: masterUserId,
      amountTzs: amount,
      phoneNumber: normalizedPhone,
    });

    // nTZS answers 200 with quoteId null when the pooled reserve cannot cover
    // the payout. The route used to pass that straight through, so the client
    // saw a success with no quote in it and fell back to "could not price this
    // withdrawal" — true, uninformative, and silent about the fact that the
    // float was short while the member's own balance was fine.
    if (!quote.quoteId) {
      const shortfall = quote.balance && quote.balance.sufficient === false;
      if (shortfall) {
        // An operations problem, not the member's. Loud here because nothing
        // else will notice: every cash-out fails until the reserve is topped
        // up, and each one looks like a one-off to the person it happens to.
        console.error(
          '[withdraw/quote] POOLED RESERVE SHORT — payouts are failing.',
          JSON.stringify({
            requestedTzs: amount,
            needsTzs: quote.burnAmountTzs,
            reserveAvailableTzs: quote.balance?.availableTzs,
            memberId,
          })
        );
        return NextResponse.json({
          error: 'Cash-outs are paused right now while we top up the payout account. '
               + 'Your balance is safe — please try again a little later.',
          code: 'reserve_unavailable',
          // Deliberately not the reserve figure: how much float the platform
          // is holding is not a member's business, and printing it on a phone
          // invites a run on it.
          safeToRetry: true,
        }, { status: 503 });
      }
      return NextResponse.json({
        error: quote.message || 'Could not price this withdrawal right now.',
        code: 'quote_unavailable',
      }, { status: 502 });
    }

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
