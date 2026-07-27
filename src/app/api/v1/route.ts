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
        { method: 'GET',  path: '/api/v1/members',                          scope: 'read',  description: 'Member directory. ?q= &group_id= &has_business=' },
        { method: 'GET',  path: '/api/v1/members/{id}',                     scope: 'read',  description: 'One member with groups + wallet.' },
        { method: 'GET',  path: '/api/v1/wallets/{ownerType}/{ownerId}',    scope: 'read',  description: 'Balance + 30-day flow for member|group|investor.' },
        { method: 'GET',  path: '/api/v1/transactions',                     scope: 'read',  description: 'Money ledger. ?group_id= &member_id= &type= &since=' },
      ],
    },
  });
}
