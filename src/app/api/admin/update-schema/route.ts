import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {

  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const client = await pool.connect();
    
    try {
      // Create join_requests table
      await client.query(`
        CREATE TABLE IF NOT EXISTS join_requests (
            id SERIAL PRIMARY KEY,
            member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
            group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
            message TEXT,
            status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reviewed_by INTEGER REFERENCES members(id),
            reviewed_at TIMESTAMP,
            review_notes TEXT
        );
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_join_requests_member_id ON join_requests(member_id);
        CREATE INDEX IF NOT EXISTS idx_join_requests_group_id ON join_requests(group_id);
        CREATE INDEX IF NOT EXISTS idx_join_requests_status ON join_requests(status);
      `);

      // Create unique constraint
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_join_requests_unique_pending 
        ON join_requests(member_id, group_id) 
        WHERE status = 'pending';
      `);

      // Create functions and triggers
      await client.query(`
        CREATE OR REPLACE FUNCTION update_join_requests_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      await client.query(`
        DROP TRIGGER IF EXISTS trigger_join_requests_updated_at ON join_requests;
        CREATE TRIGGER trigger_join_requests_updated_at
            BEFORE UPDATE ON join_requests
            FOR EACH ROW
            EXECUTE FUNCTION update_join_requests_updated_at();
      `);

      await client.query(`
        CREATE OR REPLACE FUNCTION approve_join_request(request_id INTEGER, reviewer_id INTEGER, notes TEXT DEFAULT NULL)
        RETURNS BOOLEAN AS $$
        DECLARE
            req_record RECORD;
            existing_membership INTEGER;
        BEGIN
            SELECT * INTO req_record FROM join_requests WHERE id = request_id AND status = 'pending';
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Join request not found or already processed';
            END IF;
            
            SELECT COUNT(*) INTO existing_membership 
            FROM group_members 
            WHERE member_id = req_record.member_id AND group_id = req_record.group_id AND status = 'active';
            
            IF existing_membership > 0 THEN
                RAISE EXCEPTION 'Member is already in this group';
            END IF;
            
            INSERT INTO group_members (group_id, member_id, joined_date, role, status)
            VALUES (req_record.group_id, req_record.member_id, CURRENT_DATE, 'member', 'active');
            
            UPDATE join_requests 
            SET status = 'approved', 
                reviewed_by = reviewer_id, 
                reviewed_at = CURRENT_TIMESTAMP,
                review_notes = notes
            WHERE id = request_id;
            
            RETURN TRUE;
        END;
        $$ LANGUAGE plpgsql;
      `);

      await client.query(`
        CREATE OR REPLACE FUNCTION reject_join_request(request_id INTEGER, reviewer_id INTEGER, notes TEXT DEFAULT NULL)
        RETURNS BOOLEAN AS $$
        BEGIN
            UPDATE join_requests 
            SET status = 'rejected', 
                reviewed_by = reviewer_id, 
                reviewed_at = CURRENT_TIMESTAMP,
                review_notes = notes
            WHERE id = request_id AND status = 'pending';
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Join request not found or already processed';
            END IF;
            
            RETURN TRUE;
        END;
        $$ LANGUAGE plpgsql;
      `);

      // Update group_members table to support new leadership roles
      await client.query(`
        ALTER TABLE group_members 
        DROP CONSTRAINT IF EXISTS group_members_role_check;
      `);
      
      await client.query(`
        ALTER TABLE group_members 
        ADD CONSTRAINT group_members_role_check 
        CHECK (role IN ('leader', 'member', 'mwenyekiti', 'katibu', 'mwekahazina'));
      `);

      // Verify table creation
      const tableCheck = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'join_requests'
      `);
      
      client.release();
      
      return NextResponse.json({ 
        success: true, 
        message: 'Schema updated successfully! Join requests table and group leadership roles are now available.',
        tableExists: tableCheck.rows.length > 0
      });
      
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Schema update error:', error);
    return NextResponse.json(
      { error: 'Failed to update schema', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
