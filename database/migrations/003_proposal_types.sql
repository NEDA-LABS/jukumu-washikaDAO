-- Migration: Add typed proposals support
-- Adds proposal_type, metadata, and funded_at to group_proposals

ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS proposal_type VARCHAR(20) DEFAULT 'general'
  CHECK (proposal_type IN ('general', 'ask', 'spend', 'prodcast'));

ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS metadata JSONB;

-- funded_at is set when a prodcast proposal passes the voting threshold
ALTER TABLE group_proposals ADD COLUMN IF NOT EXISTS funded_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_group_proposals_type ON group_proposals(proposal_type);
CREATE INDEX IF NOT EXISTS idx_group_proposals_funded ON group_proposals(funded_at) WHERE funded_at IS NOT NULL;
