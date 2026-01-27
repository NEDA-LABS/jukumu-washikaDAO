-- JUKUMU Fund Database Schema

-- Users table (for authentication)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Members table (business profile information)
CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    location VARCHAR(255),
    business_type VARCHAR(100),
    business_name VARCHAR(255),
    business_description TEXT,
    group_name VARCHAR(255),
    id_type VARCHAR(50),
    id_number VARCHAR(100),
    gender VARCHAR(20),
    age INTEGER,
    monthly_revenue DECIMAL(15,2),
    employee_count INTEGER,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Groups table
CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    leader_id INTEGER REFERENCES users(id),
    founded_date DATE,
    total_investment DECIMAL(15,2) DEFAULT 0,
    monthly_contribution DECIMAL(15,2),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Group members relationship
CREATE TABLE group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups(id),
    member_id INTEGER REFERENCES members(id),
    joined_date DATE DEFAULT CURRENT_DATE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('leader', 'member', 'mwenyekiti', 'katibu', 'mwekahazina')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_proposals (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_by_member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_proposal_votes (
    id SERIAL PRIMARY KEY,
    proposal_id INTEGER NOT NULL REFERENCES group_proposals(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    vote VARCHAR(20) NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(proposal_id, member_id)
);

CREATE TABLE group_wallets (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    network VARCHAR(50) NOT NULL DEFAULT 'base',
    cdp_account_name VARCHAR(100) NOT NULL,
    evm_address VARCHAR(42) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id),
    UNIQUE(cdp_account_name),
    UNIQUE(evm_address)
);

CREATE TABLE group_wallet_transfers (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    wallet_id INTEGER NOT NULL REFERENCES group_wallets(id) ON DELETE CASCADE,
    proposed_by_member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    token_address VARCHAR(42) NOT NULL,
    token_symbol VARCHAR(20) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    amount_base_units BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'executed', 'rejected')),
    approvals_required INTEGER NOT NULL DEFAULT 2,
    executed_tx_hash VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_wallet_transfer_approvals (
    id SERIAL PRIMARY KEY,
    transfer_id INTEGER NOT NULL REFERENCES group_wallet_transfers(id) ON DELETE CASCADE,
    approved_by_member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    approved_by_role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(transfer_id, approved_by_role)
);

-- Investments table
CREATE TABLE investments (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups(id),
    amount DECIMAL(15,2) NOT NULL,
    equity_percentage DECIMAL(5,2) DEFAULT 30.00,
    investment_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    expected_return DECIMAL(15,2),
    actual_return DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Training modules
CREATE TABLE training_modules (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_hours DECIMAL(4,2),
    content_url VARCHAR(500),
    category VARCHAR(100),
    level VARCHAR(50) CHECK (level IN ('beginner', 'intermediate', 'advanced')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Member training progress
CREATE TABLE member_training (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES members(id),
    training_id INTEGER REFERENCES training_modules(id),
    status VARCHAR(50) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Monthly contributions tracking
CREATE TABLE monthly_contributions (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES members(id),
    group_id INTEGER REFERENCES groups(id),
    amount DECIMAL(15,2) NOT NULL,
    contribution_month DATE NOT NULL,
    payment_date DATE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
    payment_method VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Announcements
CREATE TABLE announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    target_audience VARCHAR(50) DEFAULT 'all' CHECK (target_audience IN ('all', 'members', 'groups', 'specific')),
    target_group_id INTEGER REFERENCES groups(id),
    created_by INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Business reports
CREATE TABLE business_reports (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES members(id),
    reporting_month DATE NOT NULL,
    revenue DECIMAL(15,2),
    expenses DECIMAL(15,2),
    profit DECIMAL(15,2),
    employee_count INTEGER,
    customers_served INTEGER,
    challenges TEXT,
    achievements TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Educational Content
CREATE TABLE educational_content (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    duration VARCHAR(50),
    difficulty_level VARCHAR(20) DEFAULT 'beginner',
    image_url VARCHAR(500),
    author_id INTEGER REFERENCES users(id),
    is_published BOOLEAN DEFAULT false,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content Progress Tracking
CREATE TABLE content_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    content_id INTEGER REFERENCES educational_content(id),
    progress_percentage INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, content_id)
);

-- Training lessons (supports both training_modules and educational_content)
CREATE TABLE training_lessons (
    id SERIAL PRIMARY KEY,
    training_module_id INTEGER REFERENCES training_modules(id) ON DELETE CASCADE,
    educational_content_id INTEGER REFERENCES educational_content(id) ON DELETE CASCADE,
    language VARCHAR(10) DEFAULT 'sw' CHECK (language IN ('sw', 'en')),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    lesson_order INTEGER NOT NULL,
    duration_minutes INTEGER DEFAULT 15,
    lesson_type VARCHAR(50) DEFAULT 'text' CHECK (lesson_type IN ('text', 'video', 'quiz', 'interactive')),
    video_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lesson progress tracking
CREATE TABLE lesson_progress (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    lesson_id INTEGER REFERENCES training_lessons(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(member_id, lesson_id)
);

CREATE INDEX idx_training_lessons_module ON training_lessons(training_module_id);
CREATE INDEX idx_training_lessons_educational_content ON training_lessons(educational_content_id);
CREATE INDEX idx_training_lessons_language ON training_lessons(language);
CREATE INDEX idx_lesson_progress_member ON lesson_progress(member_id);
CREATE INDEX idx_lesson_progress_lesson ON lesson_progress(lesson_id);

-- System Settings
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin user (password: admin123)
INSERT INTO users (email, password, full_name, role) VALUES
('admin@jukumu.co.tz', '$2b$10$rQZ8kqH9mV7nF2pL3wX8.eK5mN9oP1qR2sT3uV4wX5yZ6aB7cD8eF', 'JUKUMU Admin', 'admin');

-- Insert sample educational content
INSERT INTO educational_content (title, description, content, category, duration, difficulty_level, image_url, author_id, is_published) VALUES
('Msingi wa Biashara', 'Jifunze misingi ya kuanzisha na kuendesha biashara yenye mafanikio', 'Mafunzo haya yanalenga kuwafundisha wajasiriamali misingi muhimu ya biashara...', 'Biashara', '2 masaa', 'beginner', '/PXL_20250618_095258793.PORTRAIT.jpg', 1, true),
('Uongozi wa Kikundi', 'Mbinu za uongozi bora na jinsi ya kuongoza timu kwa ufanisi', 'Uongozi ni ufunguo wa mafanikio ya kila kundi...', 'Uongozi', '1.5 masaa', 'intermediate', '/PXL_20250621_095639982.PORTRAIT.jpg', 1, true),
('Usimamizi wa Fedha', 'Jifunze jinsi ya kusimamia fedha za biashara na makundi', 'Usimamizi mzuri wa fedha ni muhimu kwa mafanikio...', 'Fedha', '3 masaa', 'intermediate', '/PXL_20250707_142902155.PORTRAIT.jpg', 1, true);

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('default_equity_percentage', '30.00', 'Default equity percentage for investments'),
('minimum_monthly_contribution', '50000', 'Minimum monthly contribution in TSH'),
('minimum_group_size', '5', 'Minimum number of members required to form a group'),
('maximum_group_size', '20', 'Maximum number of members allowed in a group');

-- Insert sample training modules
INSERT INTO training_modules (title, description, duration_hours, category, level) VALUES
('Uongozi wa Biashara', 'Jifunze jinsi ya kuongoza biashara yako kwa ufanisi', 2.0, 'Leadership', 'beginner'),
('Utunzaji wa Fedha', 'Mafunzo ya jinsi ya kutunza na kupanga fedha za biashara', 1.5, 'Finance', 'beginner'),
('Masoko na Uuzaji', 'Jinsi ya kupata na kuwashawishi wateja', 3.0, 'Marketing', 'intermediate'),
('Teknolojia katika Biashara', 'Matumizi ya teknolojia kuongeza ufanisi', 2.5, 'Technology', 'intermediate');

-- Create indexes for better performance
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_groups_status ON groups(status);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_member_id ON group_members(member_id);
CREATE INDEX idx_group_proposals_group_id ON group_proposals(group_id);
CREATE INDEX idx_group_proposals_created_at ON group_proposals(created_at DESC);
CREATE INDEX idx_group_proposal_votes_proposal_id ON group_proposal_votes(proposal_id);
CREATE INDEX idx_group_proposal_votes_member_id ON group_proposal_votes(member_id);
CREATE INDEX idx_group_wallets_group_id ON group_wallets(group_id);
CREATE INDEX idx_group_wallets_evm_address ON group_wallets(evm_address);
CREATE INDEX idx_group_wallet_transfers_group_id ON group_wallet_transfers(group_id);
CREATE INDEX idx_group_wallet_transfers_wallet_id ON group_wallet_transfers(wallet_id);
CREATE INDEX idx_group_wallet_transfers_status ON group_wallet_transfers(status);
CREATE INDEX idx_group_wallet_transfers_created_at ON group_wallet_transfers(created_at DESC);
CREATE INDEX idx_group_wallet_transfer_approvals_transfer_id ON group_wallet_transfer_approvals(transfer_id);
CREATE INDEX idx_group_wallet_transfer_approvals_member_id ON group_wallet_transfer_approvals(approved_by_member_id);
CREATE INDEX idx_investments_group_id ON investments(group_id);
CREATE INDEX idx_investments_status ON investments(status);
CREATE INDEX idx_monthly_contributions_member_id ON monthly_contributions(member_id);
CREATE INDEX idx_monthly_contributions_status ON monthly_contributions(status);
CREATE INDEX idx_announcements_status ON announcements(status);
CREATE INDEX idx_business_reports_member_id ON business_reports(member_id);
