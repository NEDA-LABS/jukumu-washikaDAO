import type { NextRequest } from 'next/server';
import type { PoolClient } from 'pg';
import { getAuthTokenPayload } from '@/lib/auth';

/**
 * Who is actually asking.
 *
 * The wallet routes were written to take `userId` from the request body or
 * query string. That is a caller-supplied claim, not an identity: any signed-in
 * person could pass someone else's id and move or read their money. These
 * helpers derive the acting user from the signed auth cookie instead.
 *
 * Callers still send `userId` — it is simply ignored now rather than trusted,
 * so no client needed changing.
 */

export interface Actor {
  userId: number;
  isAdmin: boolean;
}

/** The signed-in user, or null when there is no valid token. */
export function getActor(request: NextRequest): Actor | null {
  const auth = getAuthTokenPayload(request);
  if (!auth) return null;
  return { userId: auth.userId, isAdmin: auth.role === 'admin' };
}

/**
 * Whether this actor may read or spend a group's treasury.
 *
 * Membership, not leadership — leadership is checked separately by the routes
 * that need it. Platform admins pass for support purposes.
 */
export async function actorInGroup(
  client: PoolClient,
  actor: Actor,
  groupId: number
): Promise<boolean> {
  if (actor.isAdmin) return true;
  const res = await client.query(
    `SELECT 1
       FROM group_members gm
       JOIN members m ON m.id = gm.member_id
      WHERE m.user_id = $1 AND gm.group_id = $2 AND gm.status = 'active'
      LIMIT 1`,
    [actor.userId, groupId]
  );
  return res.rows.length > 0;
}
