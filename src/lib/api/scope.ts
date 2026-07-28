import type { PoolClient } from 'pg';

/**
 * Tenant scoping for the public API.
 *
 * Every group and member row carries a `partner_id`. A partner's key only
 * ever sees rows stamped with its own id, so two partners integrating against
 * WashikaDAU are invisible to each other, and neither can read the groups and
 * people that live on our own platform (those rows have `partner_id IS NULL`).
 *
 * The helpers below either build a SQL predicate for list queries or assert
 * ownership of a single row before a handler touches it. Routes should never
 * hand-roll `partner_id = ...`: keeping it in one file is what makes the
 * boundary auditable.
 */

export interface Scope {
  /** The calling key's tenant. Null only for first-party internal keys. */
  partnerId: number | null;
  /** Internal WashikaDAU key: reads the whole platform, bypassing scoping. */
  firstParty: boolean;
}

/**
 * Predicate restricting a groups/members row to the caller's own records.
 * Pushes its parameter onto `values`, matching how the routes build queries.
 *
 *   const clause = `WHERE ${owned(scope, 'g', values)}`;
 */
export function owned(scope: Scope, alias: string, values: unknown[]): string {
  if (scope.firstParty) return 'TRUE';
  values.push(scope.partnerId);
  return `${alias}.partner_id = $${values.length}`;
}

/**
 * Predicate for the ledger: a transaction is visible when any party to it —
 * either side, member or group — belongs to the caller. `id IN (NULL, x)`
 * is safe here; a NULL side simply never matches.
 */
export function ownedTransaction(scope: Scope, alias: string, values: unknown[]): string {
  if (scope.firstParty) return 'TRUE';
  values.push(scope.partnerId);
  const p = `$${values.length}`;
  return `(
    EXISTS (SELECT 1 FROM groups sg
             WHERE sg.id IN (${alias}.from_group_id, ${alias}.to_group_id)
               AND sg.partner_id = ${p})
    OR EXISTS (SELECT 1 FROM members sm
                WHERE sm.id IN (${alias}.from_member_id, ${alias}.to_member_id)
                  AND sm.partner_id = ${p})
  )`;
}

/**
 * Predicate for proposals, which inherit their tenant from the group they
 * belong to rather than carrying a `partner_id` of their own.
 */
export function ownedProposal(scope: Scope, alias: string, values: unknown[]): string {
  if (scope.firstParty) return 'TRUE';
  values.push(scope.partnerId);
  return `EXISTS (SELECT 1 FROM groups pg
                   WHERE pg.id = ${alias}.group_id AND pg.partner_id = $${values.length})`;
}

/** Does this key own the group that proposal belongs to? */
export async function ownsProposal(
  client: PoolClient, scope: Scope, proposalId: number,
): Promise<boolean> {
  if (scope.firstParty) {
    const r = await client.query(`SELECT 1 FROM group_proposals WHERE id = $1`, [proposalId]);
    return r.rows.length > 0;
  }
  const r = await client.query(
    `SELECT 1 FROM group_proposals p
       JOIN groups g ON g.id = p.group_id
      WHERE p.id = $1 AND g.partner_id = $2`,
    [proposalId, scope.partnerId],
  );
  return r.rows.length > 0;
}

/** Does this key own that group? Used before reading or mutating one. */
export async function ownsGroup(
  client: PoolClient, scope: Scope, groupId: number,
): Promise<boolean> {
  if (scope.firstParty) {
    const r = await client.query(`SELECT 1 FROM groups WHERE id = $1`, [groupId]);
    return r.rows.length > 0;
  }
  const r = await client.query(
    `SELECT 1 FROM groups WHERE id = $1 AND partner_id = $2`, [groupId, scope.partnerId],
  );
  return r.rows.length > 0;
}

/** Does this key own that member? */
export async function ownsMember(
  client: PoolClient, scope: Scope, memberId: number,
): Promise<boolean> {
  if (scope.firstParty) {
    const r = await client.query(`SELECT 1 FROM members WHERE id = $1`, [memberId]);
    return r.rows.length > 0;
  }
  const r = await client.query(
    `SELECT 1 FROM members WHERE id = $1 AND partner_id = $2`, [memberId, scope.partnerId],
  );
  return r.rows.length > 0;
}

/**
 * Stamp for INSERTs. First-party writes land as NULL (platform-owned), which
 * is exactly what our own app already produces.
 */
export function stamp(scope: Scope): number | null {
  return scope.firstParty ? null : scope.partnerId;
}
