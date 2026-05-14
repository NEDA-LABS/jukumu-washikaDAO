-- Migration: Add investor role and investor_profiles table

-- 1. Update the role CHECK constraint to include 'investor'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'member', 'investor'));

-- 2. Investor profiles table
CREATE TABLE IF NOT EXISTS investor_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  investor_type VARCHAR(50) DEFAULT 'individual' CHECK (investor_type IN ('individual', 'institutional', 'ngo', 'fund')),
  country VARCHAR(100) DEFAULT 'Tanzania',
  focus_areas TEXT[],              -- e.g. ['agriculture', 'trade', 'manufacturing']
  min_investment_tzs NUMERIC(15,2),
  max_investment_tzs NUMERIC(15,2),
  website VARCHAR(500),
  linkedin VARCHAR(500),
  bio TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_investor_profiles_user_id ON investor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_investor_profiles_verified ON investor_profiles(verified);
