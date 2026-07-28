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
        method: 'POST',
        path: '/api/v1/groups/{id}/members/add',
        scope: 'write',
        summary: 'Add a member to a group',
        body: [
          { name: 'member_id', type: 'integer', required: true, description: 'An existing member id.' },
          { name: 'role', type: 'string', description: 'leader, mwenyekiti, katibu, mwekahazina or mwanachama (default).' },
          { name: 'status', type: 'string', description: 'Defaults to `active`.' },
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
      {
        method: 'POST',
        path: '/api/v1/groups/{id}/contributions/record',
        scope: 'write',
        summary: 'Record a contribution',
        description:
          'Writes the contribution ledger only — it does not move money. To do both, also call POST /api/v1/transfers with purpose "contribution". Returns 409 if a row already exists for that member and period.',
        body: [
          { name: 'member_id', type: 'integer', required: true, description: 'Must already belong to the group.' },
          { name: 'amount_tzs', type: 'integer', required: true, description: 'Positive whole TZS.' },
          { name: 'period', type: 'string (YYYY-MM)', required: true, description: 'Contribution month.' },
          { name: 'status', type: '"paid" | "pending" | "overdue"', description: 'Defaults to `paid`.' },
          { name: 'payment_method', type: 'string', description: 'Free text, defaults to `api`.' },
          { name: 'reference', type: 'string', description: 'Your own payment reference.' },
        ],
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
        method: 'POST',
        path: '/api/v1/deposits',
        scope: 'write',
        summary: 'Deposit — mobile money to nTZS',
        description:
          'Triggers an STK push to the payer. Returns 202 with a pending transaction: the balance is credited only when the provider confirms settlement, so an abandoned push never creates money. Poll GET /api/v1/transactions/{id} for the outcome.',
        body: [
          { name: 'member_id', type: 'integer', required: true, description: 'Member being credited on settlement.' },
          { name: 'amount_tzs', type: 'integer', required: true, description: 'At least 100 TZS.' },
          { name: 'phone', type: 'string', required: true, description: '07XXXXXXXX or 2557XXXXXXXX.' },
        ],
        example: `curl -X POST "${API_BASE}/api/v1/deposits" \\
  -H "Authorization: Bearer $WD_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "member_id": 126, "amount_tzs": 50000, "phone": "0712345678" }'`,
      },
      {
        method: 'POST',
        path: '/api/v1/withdrawals/quote',
        scope: 'write',
        summary: 'Price a cash-out',
        description:
          'Mandatory before withdrawing — the provider rejects any payout without a fresh quote. Quotes expire after about five minutes. Shows the recipient name on the mobile-money account plus the full fee breakdown.',
        body: [
          { name: 'member_id', type: 'integer', required: true, description: 'Member the funds come from.' },
          { name: 'amount_tzs', type: 'integer', required: true, description: 'Net amount the recipient receives.' },
          { name: 'phone', type: 'string', required: true, description: 'Recipient mobile-money number.' },
        ],
        example: `{
  "data": {
    "quote_id": "q_9f2c…",
    "expires_at": "2026-07-28T10:05:00Z",
    "recipient_name": "DAVID MACHUCHE",
    "receive_amount_tzs": 50000,
    "provider_fee_tzs": 1000,
    "platform_fee_tzs": 0,
    "total_debit_tzs": 50000,
    "member_balance_tzs": 82000,
    "sufficient_funds": true
  }
}`,
      },
      {
        method: 'POST',
        path: '/api/v1/withdrawals',
        scope: 'write',
        summary: 'Withdraw — nTZS to mobile money',
        description:
          'Debits the member and pays out. Returns 409 with invalid_quote / quote_stale / quote_mismatch if the quote has expired or its terms changed — fetch a fresh quote and retry. Returns 402 insufficient_balance if the member cannot cover the amount plus fees.',
        body: [
          { name: 'member_id', type: 'integer', required: true, description: 'Member being debited.' },
          { name: 'amount_tzs', type: 'integer', required: true, description: 'Must match the quote.' },
          { name: 'phone', type: 'string', required: true, description: 'Must match the quote.' },
          { name: 'quote_id', type: 'string', required: true, description: 'From POST /api/v1/withdrawals/quote.' },
        ],
      },
      {
        method: 'POST',
        path: '/api/v1/transfers',
        scope: 'write',
        summary: 'Move money inside the platform',
        description:
          'Atomic database transfer between two wallet accounts — nothing touches the chain. Provide exactly one sender and one recipient. Use purpose "contribution" for member → group, "p2p" for member → member, "disbursement" for group → member.',
        body: [
          { name: 'amount_tzs', type: 'integer', required: true, description: 'Positive whole TZS.' },
          { name: 'purpose', type: '"contribution" | "p2p" | "disbursement"', required: true, description: 'What the movement represents.' },
          { name: 'from_member_id', type: 'integer', description: 'Sender. Mutually exclusive with from_group_id.' },
          { name: 'from_group_id', type: 'integer', description: 'Sender. Mutually exclusive with from_member_id.' },
          { name: 'to_member_id', type: 'integer', description: 'Recipient. Mutually exclusive with to_group_id.' },
          { name: 'to_group_id', type: 'integer', description: 'Recipient. Mutually exclusive with to_member_id.' },
        ],
        example: `# Member pays their contribution into the group treasury
curl -X POST "${API_BASE}/api/v1/transfers" \\
  -H "Authorization: Bearer $WD_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
        "from_member_id": 126,
        "to_group_id": 32,
        "amount_tzs": 10000,
        "purpose": "contribution"
      }'`,
      },
      {
        method: 'GET',
        path: '/api/v1/transactions/{id}',
        scope: 'read',
        summary: 'Retrieve one transaction',
        description:
          'Accepts our numeric id or the provider\u2019s external id. `settled` reflects the ledger\u2019s own view — true once the money has actually been applied to a balance.',
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
  { code: 'quote_required', status: 422, meaning: 'A withdrawal was sent without a quote_id.' },
  { code: 'invalid_quote', status: 409, meaning: 'The withdrawal quote expired or was malformed. Fetch a fresh one.' },
  { code: 'quote_stale', status: 409, meaning: 'Pricing moved since the quote was issued. Re-quote and retry.' },
  { code: 'insufficient_balance', status: 402, meaning: 'The sender cannot cover the amount plus fees.' },
  { code: 'already_member', status: 409, meaning: 'That member is already in the group.' },
  { code: 'already_recorded', status: 409, meaning: 'A contribution already exists for that member and period.' },
  { code: 'provider_error', status: 502, meaning: 'The mobile-money provider rejected the request.' },
  { code: 'wallet_unavailable', status: 503, meaning: 'The wallet provider is not configured.' },
  { code: 'rate_limited', status: 429, meaning: 'Over 120 requests/minute. Retry after the Retry-After header.' },
  { code: 'internal_error', status: 500, meaning: 'Unexpected server error. Safe to retry.' },
];
