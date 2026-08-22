import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/admin/reports/members[?format=csv|json]
 *
 * Every member, with who they are and what they have done — one row each,
 * for a spreadsheet.
 *
 * This is the most sensitive response the application produces: names beside
 * phone numbers beside national ID numbers, for every member on the platform.
 * It is therefore admin-only, checked against the database rather than the
 * token's claim, and it is never cached anywhere.
 *
 * The activity columns are counted from the ledger, not from any per-member
 * total kept on a row somewhere — a stored figure that nothing maintains is
 * how a report ends up confidently wrong.
 */

function requireAdmin(request: NextRequest) {
  return getAuthTokenPayload(request);
}

/** RFC 4180: quote everything, double any inner quote. Simple and total. */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '""';
  const s = String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * Excel decides a field's type by looking at it, and will read a Tanzanian
 * mobile number as a number — dropping the leading zero and, past fifteen
 * digits, rounding it. A leading apostrophe is the long-standing way to say
 * "this is text"; ID numbers get the same treatment for the same reason.
 */
function csvText(v: unknown): string {
  if (v === null || v === undefined || v === '') return '""';
  return csvCell(`'${String(v)}`);
}

const COLUMNS: { header: string; key: string; kind?: 'text' }[] = [
  { header: 'Member ID', key: 'member_id' },
  { header: 'Full name', key: 'full_name' },
  { header: 'Username', key: 'username' },
  { header: 'Phone', key: 'phone', kind: 'text' },
  { header: 'Email', key: 'email' },
  { header: 'ID type', key: 'id_type' },
  { header: 'ID number', key: 'id_number', kind: 'text' },
  { header: 'Gender', key: 'gender' },
  { header: 'Age', key: 'age' },
  { header: 'Location', key: 'location' },
  { header: 'Business name', key: 'business_name' },
  { header: 'Business type', key: 'business_type' },
  { header: 'Monthly revenue (TZS)', key: 'monthly_revenue' },
  { header: 'Employees', key: 'employee_count' },
  { header: 'Status', key: 'status' },
  { header: 'Registered', key: 'registered' },
  { header: 'Groups', key: 'groups' },
  { header: 'Roles', key: 'roles' },
  { header: 'Wallet balance (TZS)', key: 'balance_tzs' },
  { header: 'Deposits', key: 'deposit_count' },
  { header: 'Deposited (TZS)', key: 'deposited_tzs' },
  { header: 'Withdrawals', key: 'withdrawal_count' },
  { header: 'Withdrawn (TZS)', key: 'withdrawn_tzs' },
  { header: 'Contributions', key: 'contribution_count' },
  { header: 'Contributed (TZS)', key: 'contributed_tzs' },
  { header: 'Transfers sent', key: 'sent_count' },
  { header: 'Sent (TZS)', key: 'sent_tzs' },
  { header: 'Transfers received', key: 'received_count' },
  { header: 'Received (TZS)', key: 'received_tzs' },
  { header: 'Last activity', key: 'last_activity' },
];

const QUERY = `
  WITH settled AS (
    -- Only money that actually moved. A pending or failed row on someone's
    -- record is not activity, and counting it would overstate every total.
    SELECT * FROM ntzs_transactions
     WHERE status IN ('minted', 'completed', 'confirmed', 'success', 'successful')
  ),
  outgoing AS (
    SELECT from_member_id AS member_id, type, purpose, amount_tzs, created_at
      FROM settled WHERE from_member_id IS NOT NULL
  ),
  incoming AS (
    SELECT to_member_id AS member_id, type, purpose, amount_tzs, created_at
      FROM settled WHERE to_member_id IS NOT NULL
  )
  SELECT
    m.id                                   AS member_id,
    m.full_name,
    m.username,
    m.phone,
    m.email,
    m.id_type,
    m.id_number,
    m.gender,
    m.age,
    m.location,
    m.business_name,
    m.business_type,
    m.monthly_revenue,
    m.employee_count,
    m.status,
    to_char(m.created_at, 'YYYY-MM-DD')    AS registered,
    COALESCE((
      SELECT string_agg(g.name, ' | ' ORDER BY g.name)
        FROM group_members gm JOIN groups g ON g.id = gm.group_id
       WHERE gm.member_id = m.id AND gm.status = 'active'
    ), '')                                 AS groups,
    COALESCE((
      SELECT string_agg(DISTINCT gm.role, ' | ')
        FROM group_members gm WHERE gm.member_id = m.id AND gm.status = 'active'
    ), '')                                 AS roles,
    COALESCE((
      SELECT w.balance_tzs FROM wallet_accounts w
       WHERE w.owner_type = 'member' AND w.owner_id = m.id
    ), 0)                                  AS balance_tzs,
    (SELECT count(*) FROM incoming i WHERE i.member_id = m.id AND i.type = 'deposit')          AS deposit_count,
    (SELECT COALESCE(SUM(i.amount_tzs), 0) FROM incoming i WHERE i.member_id = m.id AND i.type = 'deposit') AS deposited_tzs,
    (SELECT count(*) FROM outgoing o WHERE o.member_id = m.id AND o.type = 'withdrawal')       AS withdrawal_count,
    (SELECT COALESCE(SUM(o.amount_tzs), 0) FROM outgoing o WHERE o.member_id = m.id AND o.type = 'withdrawal') AS withdrawn_tzs,
    (SELECT count(*) FROM outgoing o WHERE o.member_id = m.id AND o.purpose = 'contribution')  AS contribution_count,
    (SELECT COALESCE(SUM(o.amount_tzs), 0) FROM outgoing o WHERE o.member_id = m.id AND o.purpose = 'contribution') AS contributed_tzs,
    (SELECT count(*) FROM outgoing o WHERE o.member_id = m.id AND o.type = 'transfer')         AS sent_count,
    (SELECT COALESCE(SUM(o.amount_tzs), 0) FROM outgoing o WHERE o.member_id = m.id AND o.type = 'transfer') AS sent_tzs,
    (SELECT count(*) FROM incoming i WHERE i.member_id = m.id AND i.type = 'transfer')         AS received_count,
    (SELECT COALESCE(SUM(i.amount_tzs), 0) FROM incoming i WHERE i.member_id = m.id AND i.type = 'transfer') AS received_tzs,
    COALESCE(to_char((
      SELECT max(t) FROM (
        SELECT max(o.created_at) AS t FROM outgoing o WHERE o.member_id = m.id
        UNION ALL
        SELECT max(i.created_at) FROM incoming i WHERE i.member_id = m.id
      ) x
    ), 'YYYY-MM-DD HH24:MI'), '')          AS last_activity
  FROM members m
  ORDER BY m.created_at DESC
`;

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const roleRes = await pool.query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [auth.userId]);
  if ((roleRes.rows[0] as { role?: string } | undefined)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const format = new URL(request.url).searchParams.get('format') || 'csv';

  try {
    const res = await pool.query(QUERY);
    const rows = res.rows as Record<string, unknown>[];

    if (format === 'json') {
      return NextResponse.json({ members: rows, count: rows.length }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const header = COLUMNS.map((c) => csvCell(c.header)).join(',');
    const body = rows
      .map((r) => COLUMNS.map((c) => (c.kind === 'text' ? csvText(r[c.key]) : csvCell(r[c.key]))).join(','))
      .join('\r\n');

    // A BOM, so Excel opens it as UTF-8 and Tanzanian names keep their letters.
    const csv = `﻿${header}\r\n${body}\r\n`;
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="WashikaDAU-members-${stamp}.csv"`,
        // Personal data: never held by a CDN or a browser cache.
        'Cache-Control': 'no-store, private',
      },
    });
  } catch (error) {
    console.error('[admin/reports/members]', error);
    return NextResponse.json({ error: 'Could not build the report' }, { status: 500 });
  }
}
