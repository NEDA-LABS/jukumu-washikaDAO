-- Migration: Add nTZS wallet support to members and groups
-- Replaces CDP wallet + Snippe payment system with nTZS

-- Add nTZS wallet columns to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS ntzs_user_id VARCHAR(100);
ALTER TABLE members ADD COLUMN IF NOT EXISTS ntzs_wallet_address VARCHAR(42);

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_ntzs_user_id ON members(ntzs_user_id) WHERE ntzs_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_ntzs_wallet ON members(ntzs_wallet_address) WHERE ntzs_wallet_address IS NOT NULL;

-- Add nTZS wallet columns to groups
ALTER TABLE groups ADD COLUMN IF NOT EXISTS ntzs_user_id VARCHAR(100);
ALTER TABLE groups ADD COLUMN IF NOT EXISTS ntzs_wallet_address VARCHAR(42);

CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_ntzs_user_id ON groups(ntzs_user_id) WHERE ntzs_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_ntzs_wallet ON groups(ntzs_wallet_address) WHERE ntzs_wallet_address IS NOT NULL;

-- Unified transaction ledger for all nTZS operations
CREATE TABLE IF NOT EXISTS ntzs_transactions (
    id SERIAL PRIMARY KEY,
    ntzs_id VARCHAR(100) NOT NULL,           -- nTZS API resource ID (deposit/transfer/withdrawal ID)
    type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'transfer', 'withdrawal')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'minted', 'failed')),

    -- Actor references (nullable depending on type)
    from_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    from_group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
    to_member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    to_group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,

    -- Money
    amount_tzs INTEGER NOT NULL,
    fee_tzs INTEGER DEFAULT 0,
    net_tzs INTEGER,

    -- M-Pesa (for deposits/withdrawals)
    phone VARCHAR(30),

    -- On-chain
    tx_hash VARCHAR(100),

    -- Context
    purpose VARCHAR(50) CHECK (purpose IN ('deposit', 'withdrawal', 'contribution', 'disbursement', 'p2p', 'fee')),
    note TEXT,
    metadata JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ntzs_tx_ntzs_id ON ntzs_transactions(ntzs_id);
CREATE INDEX IF NOT EXISTS idx_ntzs_tx_type ON ntzs_transactions(type);
CREATE INDEX IF NOT EXISTS idx_ntzs_tx_status ON ntzs_transactions(status);
CREATE INDEX IF NOT EXISTS idx_ntzs_tx_from_member ON ntzs_transactions(from_member_id);
CREATE INDEX IF NOT EXISTS idx_ntzs_tx_to_member ON ntzs_transactions(to_member_id);
CREATE INDEX IF NOT EXISTS idx_ntzs_tx_from_group ON ntzs_transactions(from_group_id);
CREATE INDEX IF NOT EXISTS idx_ntzs_tx_to_group ON ntzs_transactions(to_group_id);
CREATE INDEX IF NOT EXISTS idx_ntzs_tx_created ON ntzs_transactions(created_at DESC);
