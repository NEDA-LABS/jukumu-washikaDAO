import type { PoolClient } from 'pg';

/**
 * Web Push helper. Everything degrades gracefully: if VAPID keys aren't set or
 * the `web-push` package isn't installed, push is a no-op and the app keeps
 * working with in-app notifications only.
 */

let _schemaReady: Promise<void> | null = null;

export function ensurePushSchema(client: PoolClient): Promise<void> {
  if (_schemaReady) return _schemaReady;
  _schemaReady = client
    .query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    .then(() => client.query(`CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id)`))
    .then(() => undefined);
  return _schemaReady;
}

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function saveSubscription(client: PoolClient, userId: number, sub: PushSubscriptionInput): Promise<void> {
  await ensurePushSchema(client);
  await client.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
  );
}

export async function deleteSubscription(client: PoolClient, endpoint: string): Promise<void> {
  await ensurePushSchema(client);
  await client.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Send a web push to every registered device of a user. No-ops (and never
 * throws) when push isn't configured or the web-push dep is missing.
 */
export async function sendPushToUser(client: PoolClient, userId: number, payload: PushPayload): Promise<void> {
  if (!pushConfigured()) return;

  let webpush: typeof import('web-push');
  try {
    webpush = await import('web-push');
  } catch {
    return; // web-push not installed
  }

  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:info@jukumufund.co.tz',
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
  } catch {
    return;
  }

  await ensurePushSchema(client);
  const subs = await client.query<{ endpoint: string; p256dh: string; auth: string }>(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  );

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/member-dashboard?section=notifications',
  });

  await Promise.all(
    subs.rows.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
      } catch (err: unknown) {
        // 404/410 => subscription expired; clean it up.
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await deleteSubscription(client, s.endpoint).catch(() => {});
        }
      }
    })
  );
}
