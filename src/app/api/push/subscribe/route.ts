import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { saveSubscription, deleteSubscription, pushConfigured } from '@/lib/push';

// POST — register a push subscription for a user
export async function POST(request: NextRequest) {
  try {
    if (!pushConfigured()) {
      return NextResponse.json({ error: 'Push is not configured on the server' }, { status: 503 });
    }
    const { userId, subscription } = await request.json();
    if (!userId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'userId and a valid subscription are required' }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      await saveSubscription(client, Number(userId), subscription);
      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Push subscribe error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — remove a subscription (unsubscribe)
export async function DELETE(request: NextRequest) {
  try {
    const { endpoint } = await request.json();
    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint is required' }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      await deleteSubscription(client, endpoint);
      return NextResponse.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
