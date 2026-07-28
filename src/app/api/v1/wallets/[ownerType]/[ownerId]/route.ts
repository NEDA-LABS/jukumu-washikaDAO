import pool from '@/lib/db';
import { handleWithParams, ok, fail } from '@/lib/api/http';
import { owned } from '@/lib/api/scope';

export const dynamic = 'force-dynamic';

const OWNERS = new Set(['member', 'group', 'investor']);

/**
 * GET /api/v1/wallets/{ownerType}/{ownerId}
 * Wallet balance for a member, group or investor, with a 30-day money
 * in/out summary. `master` and `fee` accounts are intentionally not
 * exposed through the public API.
 */
export const GET = handleWithParams<{ ownerType: string; ownerId: string }>(
  'read',
  async (_req, { params, scope }) => {
    const ownerType = params.ownerType.toLowerCase();
    const ownerId = Number.parseInt(params.ownerId, 10);

    if (!OWNERS.has(ownerType)) {
      return fail(422, 'invalid_request', `\`ownerType\` must be one of: ${[...OWNERS].join(', ')}.`);
    }
    if (!Number.isFinite(ownerId)) {
      return fail(422, 'invalid_request', '`ownerId` must be numeric.');
    }
    // Investors belong to WashikaDAU, never to an integrator, so there is no
    // such thing as a partner-owned investor wallet.
    if (ownerType === 'investor' && !scope.firstParty) {
      return fail(404, 'not_found', 'No investor with that id.');
    }

    const client = await pool.connect();
    try {
      const values: unknown[] = [ownerId];
      const owner = await client.query(
        ownerType === 'group'
          ? `SELECT name AS label FROM groups g WHERE g.id = $1 AND ${owned(scope, 'g', values)}`
          : ownerType === 'member'
            ? `SELECT full_name AS label FROM members m WHERE m.id = $1 AND ${owned(scope, 'm', values)}`
            : `SELECT full_name AS label FROM investor_profiles WHERE id = $1`,
        values,
      );
      if (owner.rows.length === 0) {
        return fail(404, 'not_found', `No ${ownerType} with that id.`);
      }

      const wallet = await client.query(
        `SELECT balance_tzs, updated_at FROM wallet_accounts
          WHERE owner_type = $1 AND owner_id = $2 LIMIT 1`,
        [ownerType, ownerId],
      );

      const partyFilter = ownerType === 'group'
        ? '(t.from_group_id = $1 OR t.to_group_id = $1)'
        : '(t.from_member_id = $1 OR t.to_member_id = $1)';
      const inboundCol = ownerType === 'group' ? 't.to_group_id' : 't.to_member_id';
      const outboundCol = ownerType === 'group' ? 't.from_group_id' : 't.from_member_id';

      const flow = await client.query(
        `SELECT
           COALESCE(SUM(t.amount_tzs) FILTER (WHERE ${inboundCol} = $1), 0)::bigint  AS money_in,
           COALESCE(SUM(t.amount_tzs) FILTER (WHERE ${outboundCol} = $1), 0)::bigint AS money_out,
           COUNT(*)::int AS tx_count
         FROM ntzs_transactions t
         WHERE ${partyFilter}
           AND t.status IN ('completed','minted','success','successful')
           AND t.created_at > NOW() - INTERVAL '30 days'`,
        [ownerId],
      );
      const f = flow.rows[0] as { money_in: string; money_out: string; tx_count: number };

      return ok({
        owner_type: ownerType,
        owner_id: ownerId,
        owner_name: (owner.rows[0] as { label: string }).label ?? null,
        // A wallet row is created lazily on first use, so "no row" is a real
        // zero balance rather than a missing resource.
        balance_tzs: wallet.rows.length ? Math.round(Number((wallet.rows[0] as { balance_tzs: string }).balance_tzs)) : 0,
        provisioned: wallet.rows.length > 0,
        last_30_days: {
          money_in_tzs: Number(f.money_in),
          money_out_tzs: Number(f.money_out),
          transaction_count: f.tx_count,
        },
        updated_at: wallet.rows.length
          ? new Date((wallet.rows[0] as { updated_at: string }).updated_at).toISOString()
          : null,
      });
    } finally {
      client.release();
    }
  },
);
