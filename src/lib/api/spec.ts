/**
 * Single source of truth for the public API reference rendered at /developers.
 * Adding an endpoint here is what documents it — keeping the docs beside the
 * route definitions rather than in prose that silently rots.
 */

export interface Param {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

export interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  scope: 'read' | 'write';
  summary: string;
  description?: string;
  params?: Param[];
  body?: Param[];
  example?: string;
}

export interface Section {
  id: string;
  title: string;
  blurb: string;
  endpoints: Endpoint[];
}

export const API_BASE = 'https://washikadau.com';

export const SECTIONS: Section[] = [
  {
    id: 'stats',
    title: 'Platform',
    blurb: 'Aggregate figures across every group, member and transaction.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/stats',
        scope: 'read',
        summary: 'Platform-wide totals',
        description:
          'Group and member counts, money processed, money currently held in group treasuries, contributions collected and proposal counts.',
        example: `{
  "data": {
    "groups":    { "total": 23, "active": 23 },
    "members":   { "total": 193, "with_business": 189 },
    "money": {
      "volume_processed_tzs": 3587538,
      "held_in_groups_tzs": 1261000,
      "contributions_collected_tzs": 0
    },
    "proposals": { "total": 23, "funded": 4 },
    "generated_at": "2026-07-27T23:24:15.596Z"
  }
}`,
      },
    ],
  },
  {
    id: 'groups',
    title: 'Groups',
    blurb: 'Savings groups: create them, read their configuration, treasury and totals.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/groups',
        scope: 'read',
        summary: 'List groups',
        params: [
          { name: 'status', type: 'string', description: 'Filter by group status, e.g. `active`.' },
          { name: 'q', type: 'string', description: 'Case-insensitive search on group name.' },
          { name: 'limit', type: 'integer', description: '1–100. Defaults to 25.' },
          { name: 'offset', type: 'integer', description: 'Rows to skip. Defaults to 0.' },
        ],
        description:
          'Logos are stored inline, so list responses return `has_logo` and omit `logo_url`. Fetch a single group to get the image.',
        example: `curl -H "Authorization: Bearer $WD_KEY" \\
  "${API_BASE}/api/v1/groups?status=active&limit=2"`,
      },
      {
        method: 'GET',
        path: '/api/v1/groups/{id}',
        scope: 'read',
        summary: 'Retrieve a group',
        description:
          '`{id}` accepts the numeric id or the human group code (e.g. `JKM-ZK79KQ`). Includes treasury balance, lifetime collected/disbursed totals and proposal counts.',
        example: `{
  "data": {
    "id": 32,
    "name": "THE BOYS FC",
    "code": "JKM-ZK79KQ",
    "contribution": { "amount_tzs": 10000, "frequency": "weekly" },
    "voting_threshold": { "numerator": 3, "denominator": 5 },
    "member_count": 1,
    "treasury_balance_tzs": 0,
    "totals": { "collected_tzs": 0, "disbursed_tzs": 0, "transactions_90d": 0 },
    "proposals": { "total": 0, "open": 0, "funded": 0 }
  }
}`,
      },
      {
        method: 'POST',
        path: '/api/v1/groups',
        scope: 'write',
        summary: 'Create a group',
        description:
          'The member profile behind `leader_user_id` is added as the group leader in the same transaction. A join code is generated automatically.',
        body: [
          { name: 'name', type: 'string', required: true, description: 'Unique group name.' },
          { name: 'monthly_contribution_tzs', type: 'integer', required: true, description: 'Contribution amount per cycle, in TZS.' },
          { name: 'leader_user_id', type: 'integer', required: true, description: 'User id who becomes the leader.' },
          { name: 'contribution_frequency', type: '"monthly" | "weekly"', description: 'Defaults to `monthly`.' },
          { name: 'voting_numerator', type: 'integer', description: 'Defaults to 3.' },
          { name: 'voting_denominator', type: 'integer', description: 'Defaults to 5.' },
        ],
        example: `curl -X POST "${API_BASE}/api/v1/groups" \\
  -H "Authorization: Bearer $WD_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
        "name": "Kilimo Pamoja",
        "monthly_contribution_tzs": 20000,
        "leader_user_id": 42,
        "contribution_frequency": "monthly"
      }'`,
      },
      {
        method: 'GET',
        path: '/api/v1/groups/{id}/members',
        scope: 'read',
        summary: 'List group members',
        params: [
          { name: 'role', type: 'string', description: '`leader`, `mwenyekiti`, `katibu`, `mwekahazina`, `mwanachama`.' },
          { name: 'status', type: 'string', description: 'Membership status, e.g. `active`.' },
          { name: 'limit', type: 'integer', description: '1–100. Defaults to 25.' },
          { name: 'offset', type: 'integer', description: 'Rows to skip.' },
        ],
      },
      {
        method: 'GET',
        path: '/api/v1/groups/{id}/proposals',
        scope: 'read',
        summary: 'List proposals with vote tallies',
        params: [
          { name: 'status', type: '"open" | "closed"', description: 'Filter by voting status.' },
          { name: 'type', type: 'string', description: '`general`, `ask`, `spend` or `prodcast`.' },
          { name: 'limit', type: 'integer', description: '1–100. Defaults to 25.' },
          { name: 'offset', type: 'integer', description: 'Rows to skip.' },
        ],
        example: `{
  "data": [{
    "id": 16,
    "title": "Pesa ya majaribio",
    "type": "spend",
    "status": "closed",
    "created_by": { "member_id": 69, "name": "Victor" },
    "payment": { "amount_tzs": 6000, "status": "completed", "executed_at": "2026-06-29T06:09:16.644Z" },
    "votes": { "yes": 1, "no": 0, "abstain": 0, "total": 1 }
  }],
  "meta": { "total": 2, "limit": 1, "offset": 0, "has_more": true }
}`,
      },
    ],
  },
  {
    id: 'contributions',
    title: 'Contributions',
    blurb: 'Who has paid their contribution — and who has not.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/groups/{id}/contributions',
        scope: 'read',
        summary: 'Contribution ledger',
        description:
          'Returns paid contributions plus a `summary` of amounts and counts. Pass `include_unpaid=true` with a `period` to also get the roster of active members who have not paid for that month.',
        params: [
          { name: 'period', type: 'string (YYYY-MM)', description: 'Restrict to one contribution month.' },
          { name: 'status', type: 'string', description: '`paid`, `pending`, `overdue`.' },
          { name: 'member_id', type: 'integer', description: 'Restrict to one member.' },
          { name: 'include_unpaid', type: 'boolean', description: 'Requires `period`. Adds `meta.unpaid_members`.' },
          { name: 'limit', type: 'integer', description: '1–100. Defaults to 25.' },
          { name: 'offset', type: 'integer', description: 'Rows to skip.' },
        ],
        example: `curl -H "Authorization: Bearer $WD_KEY" \\
  "${API_BASE}/api/v1/groups/30/contributions?period=2026-07&include_unpaid=true"

# meta.summary      -> { paid_tzs, paid_count, unpaid_count }
# meta.unpaid_members -> [{ id, full_name, username }]`,
      },
    ],
  },
  {
    id: 'members',
    title: 'Members',
    blurb: 'Directory data. Phone numbers, emails and national IDs are never returned.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/members',
        scope: 'read',
        summary: 'List members',
        params: [
          { name: 'q', type: 'string', description: 'Search on full name or username.' },
          { name: 'group_id', type: 'integer', description: 'Only members of this group.' },
          { name: 'status', type: 'string', description: 'Member status.' },
          { name: 'has_business', type: 'boolean', description: '`true` to return only members running a business.' },
          { name: 'limit', type: 'integer', description: '1–100. Defaults to 25.' },
          { name: 'offset', type: 'integer', description: 'Rows to skip.' },
        ],
      },
      {
        method: 'GET',
        path: '/api/v1/members/{id}',
        scope: 'read',
        summary: 'Retrieve a member',
        description: 'Includes every group membership with role, the wallet balance, and lifetime contributions paid.',
      },
    ],
  },
  {
    id: 'money',
    title: 'Wallets & transactions',
    blurb: 'nTZS balances and the full money ledger. All amounts are integer TZS.',
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/wallets/{ownerType}/{ownerId}',
        scope: 'read',
        summary: 'Wallet balance',
        description:
          '`ownerType` is `member`, `group` or `investor`. Includes a 30-day money-in / money-out summary. Platform `master` and `fee` accounts are not exposed.',
        example: `{
  "data": {
    "owner_type": "group",
    "owner_id": 30,
    "owner_name": "Ali & Vic Admi",
    "balance_tzs": 5000,
    "provisioned": true,
    "last_30_days": { "money_in_tzs": 0, "money_out_tzs": 6000, "transaction_count": 1 }
  }
}`,
      },
      {
        method: 'GET',
        path: '/api/v1/transactions',
        scope: 'read',
        summary: 'List transactions',
        params: [
          { name: 'group_id', type: 'integer', description: 'Either side of the transfer.' },
          { name: 'member_id', type: 'integer', description: 'Either side of the transfer.' },
          { name: 'type', type: 'string', description: '`deposit`, `withdrawal`, `transfer`, `disbursement`.' },
          { name: 'purpose', type: 'string', description: '`deposit`, `withdrawal`, `contribution`, `disbursement`, `p2p`, `fee`.' },
          { name: 'status', type: 'string', description: 'Provider status, e.g. `completed`.' },
          { name: 'since', type: 'ISO-8601', description: 'Only transactions at or after this time.' },
          { name: 'until', type: 'ISO-8601', description: 'Only transactions at or before this time.' },
          { name: 'limit', type: 'integer', description: '1–100. Defaults to 25.' },
          { name: 'offset', type: 'integer', description: 'Rows to skip.' },
        ],
      },
    ],
  },
];

export const ERRORS: { code: string; status: number; meaning: string }[] = [
  { code: 'missing_api_key', status: 401, meaning: 'No Authorization header was sent.' },
  { code: 'invalid_api_key', status: 401, meaning: 'The key does not exist or has been revoked.' },
  { code: 'insufficient_scope', status: 403, meaning: 'The key lacks the scope this endpoint needs.' },
  { code: 'not_found', status: 404, meaning: 'No resource with that identifier.' },
  { code: 'group_exists', status: 409, meaning: 'A group with that name already exists.' },
  { code: 'invalid_request', status: 422, meaning: 'A parameter is missing or malformed. The message names the field.' },
  { code: 'rate_limited', status: 429, meaning: 'Over 120 requests/minute. Retry after the Retry-After header.' },
  { code: 'internal_error', status: 500, meaning: 'Unexpected server error. Safe to retry.' },
];
