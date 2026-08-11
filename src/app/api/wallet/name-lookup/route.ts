import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/wallet/authorize';
import { lookupMobileName } from '@/lib/ntzs';

export const runtime = 'nodejs';

/**
 * GET /api/wallet/name-lookup?phone=07XXXXXXXX&direction=deposit|withdraw
 *
 * The registered account holder behind a mobile-money number, so someone can
 * see who they are about to pay before they commit.
 *
 * Deliberately fail-soft: a name is a confirmation aid, not a precondition. If
 * the lookup is unavailable the response is `{ name: null }` with HTTP 200 and
 * the form carries on exactly as it did before. Making a top-up depend on a
 * third-party lookup being healthy would be a bad trade.
 */
export async function GET(request: NextRequest) {
  const actor = getActor(request);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const phone = (sp.get('phone') || '').trim();
  const direction = sp.get('direction') === 'withdraw' ? 'withdraw' : 'deposit';

  const digits = phone.replace(/\D/g, '');
  const normalized =
    digits.length === 10 && digits.startsWith('0') ? `255${digits.slice(1)}`
    : digits.length === 9 ? `255${digits}`
    : digits;

  // Too short to be a Tanzanian mobile number — no point asking.
  if (normalized.length < 12) {
    return NextResponse.json({ name: null, phone: normalized });
  }

  const name = await lookupMobileName(normalized, direction);
  return NextResponse.json({ name, phone: normalized, available: name !== null });
}
