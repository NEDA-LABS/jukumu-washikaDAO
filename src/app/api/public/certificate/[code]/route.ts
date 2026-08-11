import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureDonationsSchema } from '@/lib/donations';
import { renderCertificateSvg } from '@/lib/certificate';

export const runtime = 'nodejs';

/**
 * GET /api/public/certificate/<code>[?inline=1]
 *
 * The certificate for a completed donation. Downloads by default; `inline=1`
 * renders it in place so the page can show what is about to be saved.
 *
 * Only completed donations have one. Issuing a certificate for a payment that
 * was never approved would be handing out proof of a gift nobody made.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  await ensureDonationsSchema();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT donor_name, amount_tzs, token, token_amount, certificate_code, status, settled_at, created_at
         FROM donations WHERE certificate_code = $1 LIMIT 1`,
      [code]
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const d = res.rows[0] as {
      donor_name: string; amount_tzs: string; certificate_code: string;
      status: string; settled_at: string | null; created_at: string;
      token: string | null; token_amount: string | null;
    };
    if (d.status !== 'completed') {
      return NextResponse.json({ error: 'This donation has not been completed' }, { status: 409 });
    }

    const svg = renderCertificateSvg({
      donorName: d.donor_name,
      amountTzs: Number(d.amount_tzs),
      reference: d.certificate_code,
      date: new Date(d.settled_at || d.created_at),
      token: d.token,
      tokenAmount: d.token_amount != null ? Number(d.token_amount) : null,
    });

    const inline = new URL(request.url).searchParams.get('inline') === '1';
    const filename = `WashikaDAU-Certificate-${d.certificate_code}.svg`;

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[public/certificate]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
