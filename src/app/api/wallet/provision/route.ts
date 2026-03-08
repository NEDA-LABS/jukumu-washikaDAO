import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ntzs, NtzsApiError } from '@/lib/ntzs';
import { ensureNtzsSchema, linkMemberWallet } from '@/lib/ntzs-db';

/**
 * Provision an nTZS wallet for an existing member who doesn't have one yet.
 * Called from the dashboard when a member first accesses wallet features.
 */
export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    await ensureNtzsSchema(client);

    const memberRes = await client.query(
      `SELECT m.id, m.ntzs_user_id, m.ntzs_wallet_address, m.phone, m.email, m.full_name
       FROM members m JOIN users u ON u.id = m.user_id
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
      phone: string | null;
      email: string | null;
      full_name: string;
    };

    // Already provisioned
    if (member.ntzs_user_id && member.ntzs_wallet_address) {
      return NextResponse.json({
        walletAddress: member.ntzs_wallet_address,
        provisioned: true,
        message: 'Wallet tayari ipo (Wallet already exists)',
      });
    }

    // Check API key before calling nTZS
    if (!process.env.NTZS_API_KEY) {
      console.error('NTZS_API_KEY not configured');
      return NextResponse.json({ error: 'Wallet service is not configured. Contact admin.' }, { status: 503 });
    }

    // Normalize phone
    const phone = member.phone?.replace(/\D/g, '') || undefined;
    let normalizedPhone = phone;
    if (phone && phone.length === 10 && phone.startsWith('0')) {
      normalizedPhone = `255${phone.slice(1)}`;
    } else if (phone && phone.length === 9) {
      normalizedPhone = `255${phone}`;
    }

    const ntzsUser = await ntzs.users.create({
      externalId: `member_${member.id}`,
      email: member.email || undefined,
      phone: normalizedPhone,
    });

    await linkMemberWallet(client, member.id, ntzsUser.id, ntzsUser.walletAddress);

    console.log(`nTZS wallet provisioned for member ${member.id}: ${ntzsUser.walletAddress}`);

    return NextResponse.json({
      walletAddress: ntzsUser.walletAddress,
      provisioned: true,
      message: 'Wallet imetengenezwa kwa mafanikio! (Wallet created successfully)',
    });
  } catch (error) {
    if (error instanceof NtzsApiError) {
      console.error('nTZS provision error:', error.status, error.body);
      return NextResponse.json({
        error: error.body.message || error.body.error || 'Wallet provisioning failed',
        details: error.body,
        ntzsStatus: error.status,
      }, { status: error.status });
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Provision error:', errMsg);
    return NextResponse.json({ error: errMsg || 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
