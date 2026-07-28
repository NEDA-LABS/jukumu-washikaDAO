import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1 — unauthenticated discovery document, so a developer can see
 * what exists before they have a key.
 */
export function GET() {
  return NextResponse.json({
    data: {
      name: 'WashikaDAU API',
      version: '1.0',
      docs: 'https://washikadau.com/developers',
      authentication: {
        scheme: 'Bearer',
        header: 'Authorization: Bearer wd_live_...',
        scopes: ['read', 'write'],
      },
      rate_limit: { requests_per_minute: 120, scope: 'per API key' },
      conventions: {
        envelope: '{ "data": ..., "meta": ... } on success, { "error": { "code", "message" } } on failure',
        money: 'Integer TZS. Field names end in _tzs.',
        timestamps: 'ISO-8601 UTC strings.',
        pagination: '?limit= (1-100, default 25) &offset= ; meta contains total and has_more.',
      },
      endpoints: [
        { method: 'GET',  path: '/api/v1/stats',                            scope: 'read',  description: 'Platform-wide aggregates.' },
        { method: 'GET',  path: '/api/v1/groups',                           scope: 'read',  description: 'List groups. ?status= &q=' },
        { method: 'POST', path: '/api/v1/groups',                           scope: 'write', description: 'Create a group.' },
        { method: 'GET',  path: '/api/v1/groups/{id}',                      scope: 'read',  description: 'One group by id or code, with totals.' },
        { method: 'GET',  path: '/api/v1/groups/{id}/members',              scope: 'read',  description: 'Group roster. ?role= &status=' },
        { method: 'GET',  path: '/api/v1/groups/{id}/contributions',        scope: 'read',  description: 'Who paid. ?period=YYYY-MM &include_unpaid=true' },
        { method: 'GET',  path: '/api/v1/groups/{id}/proposals',            scope: 'read',  description: 'Proposals with vote tallies. ?status= &type=' },
        { method: 'GET',  path: '/api/v1/proposals',                        scope: 'read',  description: 'All proposals across groups. ?group_id= &status= &type= &funded=' },
        { method: 'GET',  path: '/api/v1/proposals/{id}',                   scope: 'read',  description: 'One proposal with full vote breakdown.' },
        { method: 'PATCH',path: '/api/v1/proposals/{id}',                   scope: 'write', description: 'Close or reopen voting.' },
        { method: 'GET',  path: '/api/v1/proposals/{id}/votes',             scope: 'read',  description: 'Every ballot cast, plus the tally.' },
        { method: 'POST', path: '/api/v1/proposals/{id}/votes',             scope: 'write', description: 'Cast or change a vote.' },
        { method: 'POST', path: '/api/v1/groups/{id}/proposals/create',     scope: 'write', description: 'Open a proposal: general | ask | spend | prodcast.' },
        { method: 'GET',  path: '/api/v1/members',                          scope: 'read',  description: 'Member directory. ?q= &group_id= &has_business=' },
        { method: 'GET',  path: '/api/v1/members/{id}',                     scope: 'read',  description: 'One member with groups + wallet.' },
        { method: 'GET',  path: '/api/v1/wallets/{ownerType}/{ownerId}',    scope: 'read',  description: 'Balance + 30-day flow for member|group|investor.' },
        { method: 'GET',  path: '/api/v1/transactions',                     scope: 'read',  description: 'Money ledger. ?group_id= &member_id= &type= &since=' },
        { method: 'GET',  path: '/api/v1/transactions/{id}',                scope: 'read',  description: 'One transaction by our id or the provider id.' },
        { method: 'POST', path: '/api/v1/deposits',                         scope: 'write', description: 'Mobile money -> nTZS. Triggers an STK push.' },
        { method: 'POST', path: '/api/v1/withdrawals/quote',                scope: 'write', description: 'Price a cash-out. Required before withdrawing.' },
        { method: 'POST', path: '/api/v1/withdrawals',                      scope: 'write', description: 'nTZS -> mobile money. Needs a fresh quote_id.' },
        { method: 'POST', path: '/api/v1/transfers',                        scope: 'write', description: 'Internal transfer: contribution | p2p | disbursement.' },
        { method: 'POST', path: '/api/v1/groups/{id}/members/add',          scope: 'write', description: 'Add an existing member to a group.' },
        { method: 'POST', path: '/api/v1/groups/{id}/contributions/record', scope: 'write', description: 'Record a contribution for a period.' },
      ],
    },
  });
}
