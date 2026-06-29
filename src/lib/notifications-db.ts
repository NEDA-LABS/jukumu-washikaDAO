import type { PoolClient } from 'pg';

let _ready: Promise<void> | null = null;

/**
 * Ensure the notifications table + helper functions exist. Cached per process.
 * The notifications schema was never applied in production, so the route used
 * to 500 on every call — this makes it self-healing, like the wallet routes.
 */
export function ensureNotificationsSchema(client: PoolClient) {
  if (_ready) return _ready;
  _ready = _run(client);
  return _ready;
}

async function _run(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'info',
      category VARCHAR(50) NOT NULL DEFAULT 'general',
      is_read BOOLEAN DEFAULT FALSE,
      action_url VARCHAR(255),
      action_text VARCHAR(100),
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      read_at TIMESTAMP,
      expires_at TIMESTAMP
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)`);

  await client.query(`
    CREATE OR REPLACE FUNCTION create_notification(
      p_user_id INTEGER, p_title VARCHAR(255), p_message TEXT,
      p_type VARCHAR(50) DEFAULT 'info', p_category VARCHAR(50) DEFAULT 'general',
      p_action_url VARCHAR(255) DEFAULT NULL, p_action_text VARCHAR(100) DEFAULT NULL,
      p_metadata JSONB DEFAULT NULL, p_expires_at TIMESTAMP DEFAULT NULL
    ) RETURNS INTEGER AS $$
    DECLARE notification_id INTEGER;
    BEGIN
      INSERT INTO notifications (user_id, title, message, type, category, action_url, action_text, metadata, expires_at)
      VALUES (p_user_id, p_title, p_message, p_type, p_category, p_action_url, p_action_text, p_metadata, p_expires_at)
      RETURNING id INTO notification_id;
      RETURN notification_id;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await client.query(`
    CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id INTEGER, p_user_id INTEGER)
    RETURNS BOOLEAN AS $$
    BEGIN
      UPDATE notifications SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
      WHERE id = p_notification_id AND user_id = p_user_id;
      RETURN FOUND;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await client.query(`
    CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id INTEGER)
    RETURNS INTEGER AS $$
    DECLARE updated_count INTEGER;
    BEGIN
      UPDATE notifications SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
      WHERE user_id = p_user_id AND is_read = FALSE;
      GET DIAGNOSTICS updated_count = ROW_COUNT;
      RETURN updated_count;
    END;
    $$ LANGUAGE plpgsql;
  `);
}
