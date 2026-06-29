-- Custodial wallet ledger — one master nTZS wallet + per-entity DB balances.
--
-- This mirrors the idempotent DDL in src/lib/ntzs-db.ts (ensureNtzsSchema),
-- which runs automatically on first request. Kept here for operators who apply
-- migrations manually. Safe to run repeatedly.
--
-- Run with: psql $DATABASE_URL -f database/migrations/006_wallet_ledger.sql

BEGIN;

-- Internal ledger transfers have no external nTZS id.
ALTER TABLE ntzs_transactions ALTER COLUMN ntzs_id DROP NOT NULL;

-- Idempotent balance-posting guard (legacy rows already settled → true).
ALTER TABLE ntzs_transactions ADD COLUMN IF NOT EXISTS posted BOOLEAN;
UPDATE ntzs_transactions SET posted = true WHERE posted IS NULL;
ALTER TABLE ntzs_transactions ALTER COLUMN posted SET DEFAULT false;
ALTER TABLE ntzs_transactions ALTER COLUMN posted SET NOT NULL;

-- Widen purpose to cover internal flows (the missing 'expense' value silently
-- broke spend-proposal execution).
ALTER TABLE ntzs_transactions DROP CONSTRAINT IF EXISTS ntzs_transactions_purpose_check;
ALTER TABLE ntzs_transactions ADD CONSTRAINT ntzs_transactions_purpose_check
  CHECK (purpose IN ('deposit','withdrawal','contribution','disbursement','p2p','fee','expense','funding','topup'));

-- Per-entity balance accounts. owner_id = 0 marks the master/fee singletons.
CREATE TABLE IF NOT EXISTS wallet_accounts (
  id SERIAL PRIMARY KEY,
  owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('member','group','investor','master','fee')),
  owner_id INTEGER NOT NULL DEFAULT 0,
  balance_tzs BIGINT NOT NULL DEFAULT 0 CHECK (balance_tzs >= 0),
  ntzs_user_id VARCHAR(100),
  ntzs_wallet_address VARCHAR(42),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_accounts_owner ON wallet_accounts(owner_type, owner_id);

-- The master account holds the real on-chain float; fee collects spreads.
INSERT INTO wallet_accounts (owner_type, owner_id) VALUES ('master', 0) ON CONFLICT (owner_type, owner_id) DO NOTHING;
INSERT INTO wallet_accounts (owner_type, owner_id) VALUES ('fee', 0) ON CONFLICT (owner_type, owner_id) DO NOTHING;

COMMIT;
