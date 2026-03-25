-- Migration: Add group_code and join_policy to groups table

ALTER TABLE groups ADD COLUMN IF NOT EXISTS group_code VARCHAR(20) UNIQUE;

-- Backfill existing groups with a deterministic code
UPDATE groups
SET group_code = 'JKM-' || upper(left(md5(id::text || lower(name)), 6))
WHERE group_code IS NULL;

ALTER TABLE groups ALTER COLUMN group_code SET NOT NULL;

ALTER TABLE groups ADD COLUMN IF NOT EXISTS join_policy VARCHAR(20) DEFAULT 'invite_only'
  CHECK (join_policy IN ('open', 'invite_only'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_group_code ON groups(group_code);
