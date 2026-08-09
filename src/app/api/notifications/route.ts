import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { ensureNotificationsSchema } from '@/lib/notifications-db';
import { getActor } from '@/lib/wallet/authorize';

// GET - Fetch notifications for a user
export async function GET(request: NextRequest) {
  try {
    // Your own notifications, always. A `userId` in the query string is
    // ignored — it used to let any session read anyone's notifications, and
    // callers that omitted it got a 400 instead of their own list.
    const actor = getActor(request);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = String(actor.userId);

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const category = searchParams.get('category');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const client = await pool.connect();

    try {
      await ensureNotificationsSchema(client);
      let query = `
        SELECT 
          id,
          title,
          message,
          type,
          category,
          is_read,
          action_url,
          action_text,
          metadata,
          created_at,
          read_at,
          expires_at
        FROM notifications 
        WHERE user_id = $1
      `;
      const params = [userId];
      let paramIndex = 2;

      if (unreadOnly) {
        query += ` AND is_read = FALSE`;
      }

      if (category) {
        query += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      // Filter out expired notifications
      query += ` AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`;
      
      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit.toString(), offset.toString());

      const result = await client.query(query, params);

      // Get unread count
      const unreadCountResult = await client.query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = FALSE AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)',
        [userId]
      );

      client.release();

      return NextResponse.json({
        notifications: result.rows,
        unreadCount: parseInt(unreadCountResult.rows[0].count),
        total: result.rows.length,
        hasMore: result.rows.length === limit
      });
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Error fetching notifications:', error);
    // Degrade gracefully — an empty bell beats a 500 on every dashboard load.
    return NextResponse.json({ notifications: [], unreadCount: 0, total: 0, hasMore: false });
  }
}

// POST - Create a new notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      title,
      message,
      type = 'info',
      category = 'general',
      actionUrl,
      actionText,
      metadata,
      expiresAt
    } = body;

    if (!userId || !title || !message) {
      return NextResponse.json({ 
        error: 'User ID, title, and message are required' 
      }, { status: 400 });
    }

    const client = await pool.connect();

    try {
      await ensureNotificationsSchema(client);
      const result = await client.query(`
        SELECT create_notification($1, $2, $3, $4, $5, $6, $7, $8, $9) as notification_id
      `, [
        userId,
        title,
        message,
        type,
        category,
        actionUrl,
        actionText,
        metadata ? JSON.stringify(metadata) : null,
        expiresAt
      ]);

      client.release();

      return NextResponse.json({
        success: true,
        notificationId: result.rows[0].notification_id,
        message: 'Notification created successfully'
      }, { status: 201 });
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Mark notification(s) as read
export async function PUT(request: NextRequest) {
  try {
    const actor = getActor(request);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const { notificationId, markAllRead } = body;
    const userId = String(actor.userId);

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const client = await pool.connect();

    try {
      await ensureNotificationsSchema(client);
      let result;
      
      if (markAllRead) {
        // Mark all notifications as read for the user
        result = await client.query(
          'SELECT mark_all_notifications_read($1) as updated_count',
          [userId]
        );
        
        client.release();
        
        return NextResponse.json({
          success: true,
          updatedCount: result.rows[0].updated_count,
          message: 'All notifications marked as read'
        });
      } else if (notificationId) {
        // Mark specific notification as read
        result = await client.query(
          'SELECT mark_notification_read($1, $2) as success',
          [notificationId, userId]
        );
        
        client.release();
        
        if (result.rows[0].success) {
          return NextResponse.json({
            success: true,
            message: 'Notification marked as read'
          });
        } else {
          return NextResponse.json({
            error: 'Notification not found or access denied'
          }, { status: 404 });
        }
      } else {
        return NextResponse.json({
          error: 'Either notificationId or markAllRead must be provided'
        }, { status: 400 });
      }
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a notification
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!notificationId || !userId) {
      return NextResponse.json({ 
        error: 'Notification ID and User ID are required' 
      }, { status: 400 });
    }

    const client = await pool.connect();

    try {
      const result = await client.query(
        'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
        [notificationId, userId]
      );

      client.release();

      if (result.rowCount && result.rowCount > 0) {
        return NextResponse.json({
          success: true,
          message: 'Notification deleted successfully'
        });
      } else {
        return NextResponse.json({
          error: 'Notification not found or access denied'
        }, { status: 404 });
      }
    } catch (dbError) {
      client.release();
      throw dbError;
    }
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
