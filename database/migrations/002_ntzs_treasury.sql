-- Migration: Add nTZS treasury support to groups
-- This replaces CDP USDC wallets with nTZS treasury wallets

-- 1. Add voting thresholds to groups (e.g., 3/5 = numerator 3, denominator 5)
ALTER TABLE groups ADD COLUMN IF NOT EXISTS voting_threshold_numerator INTEGER DEFAULT 3;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS voting_threshold_denominator INTEGER DEFAULT 5;

-- 2. Extend group_proposals to support payment requests
ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS payment_amount_tzs INTEGER;
ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS recipient_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL;
ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(30);
ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'approved', 'executed', 'rejected'));
ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS payment_tx_id VARCHAR(100);
ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP;

-- 3. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_group_proposals_payment_status ON group_proposals(payment_status);
CREATE INDEX IF NOT EXISTS idx_group_proposals_recipient_member ON group_proposals(recipient_member_id);

-- 4. Ensure groups have ntzs wallet columns (from ntzs-db.ts ensureNtzsSchema)
ALTER TABLE groups ADD COLUMN IF NOT EXISTS ntzs_user_id VARCHAR(100);
ALTER TABLE groups ADD COLUMN IF NOT EXISTS ntzs_wallet_address VARCHAR(42);

-- 5. Add unique constraint on group ntzs_user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_ntzs_user_id ON groups(ntzs_user_id) WHERE ntzs_user_id IS NOT NULL;

-- Note: Old CDP wallet tables (group_wallets, group_wallet_transfers, group_wallet_transfer_approvals)
-- are kept for historical data but will not be used for new groups.
-- They can be dropped in a future migration after data archival.
