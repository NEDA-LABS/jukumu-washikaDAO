-- Migration: Add nTZS wallet support to investor_profiles

ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS ntzs_user_id VARCHAR(100);
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS ntzs_wallet_address VARCHAR(42);

CREATE UNIQUE INDEX IF NOT EXISTS idx_investor_profiles_ntzs_user_id
  ON investor_profiles(ntzs_user_id) WHERE ntzs_user_id IS NOT NULL;

-- GIN index on ntzs_transactions.metadata for investor_id lookups
CREATE INDEX IF NOT EXISTS idx_ntzs_transactions_metadata
  ON ntzs_transactions USING GIN (metadata);
