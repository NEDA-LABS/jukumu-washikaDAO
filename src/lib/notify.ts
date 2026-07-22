import type { PoolClient } from 'pg';
import { ensureNotificationsSchema } from './notifications-db';

export type NotifyType = 'info' | 'success' | 'warning' | 'error';

export interface NotifyOpts {
  title: string;       // Swahili (default language)
  message: string;     // Swahili (default language)
  titleEn?: string;    // English variant, stored in metadata and shown to EN users
  messageEn?: string;
  type?: NotifyType;
  category?: string; // e.g. 'wallet' | 'group' | 'proposal'
  actionUrl?: string;
  actionText?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create an in-app notification for a single user and fire an (optional) web
 * push. Never throws — notifications are a side-effect and must not break the
 * primary transaction that triggered them.
 */
export async function notify(client: PoolClient, userId: number, o: NotifyOpts): Promise<void> {
  try {
    await ensureNotificationsSchema(client);
    const metadata = {
      ...(o.metadata ?? {}),
      ...(o.titleEn ? { title_en: o.titleEn } : {}),
      ...(o.messageEn ? { message_en: o.messageEn } : {}),
    };
    await client.query(
      `SELECT create_notification($1, $2, $3, $4, $5, $6, $7, $8, NULL)`,
      [
        userId,
        o.title,
        o.message,
        o.type ?? 'info',
        o.category ?? 'general',
        o.actionUrl ?? null,
        o.actionText ?? null,
        Object.keys(metadata).length ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (err) {
    console.error('[notify] failed to create notification:', err);
  }

  // Fire-and-forget web push. Loaded lazily so a missing web-push dep / VAPID
  // config degrades to in-app-only instead of crashing the route.
  try {
    const { sendPushToUser } = await import('./push');
    void sendPushToUser(client, userId, {
      title: o.title,
      body: o.message,
      url: o.actionUrl ?? '/member-dashboard?section=notifications',
    }).catch(() => {});
  } catch {
    /* push not configured — in-app notification already stored */
  }
}

/**
 * Notify every active member of a group (optionally skipping one user, e.g. the
 * actor who triggered the event).
 */
export async function notifyGroupMembers(
  client: PoolClient,
  groupId: number,
  o: NotifyOpts,
  exceptUserId?: number
): Promise<void> {
  try {
    const res = await client.query<{ user_id: number }>(
      `SELECT DISTINCT u.id AS user_id
         FROM group_members gm
         JOIN members m ON m.id = gm.member_id
         JOIN users u ON u.id = m.user_id
        WHERE gm.group_id = $1 AND gm.status = 'active'`,
      [groupId]
    );
    for (const row of res.rows) {
      if (exceptUserId && Number(row.user_id) === Number(exceptUserId)) continue;
      await notify(client, row.user_id, o);
    }
  } catch (err) {
    console.error('[notifyGroupMembers] failed:', err);
  }
}
