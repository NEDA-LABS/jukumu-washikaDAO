import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthTokenPayload } from '@/lib/auth';
import { CdpClient } from '@coinbase/cdp-sdk';

export const runtime = 'nodejs';

const NETWORK = 'base';
const USDC_BASE_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

async function ensureWalletSchema(client: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS group_wallets (
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
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_group_wallets_group_id ON group_wallets(group_id);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_group_wallets_evm_address ON group_wallets(evm_address);
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS group_wallet_transfers (
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
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_group_wallet_transfers_group_id ON group_wallet_transfers(group_id);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_group_wallet_transfers_wallet_id ON group_wallet_transfers(wallet_id);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_group_wallet_transfers_status ON group_wallet_transfers(status);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_group_wallet_transfers_created_at ON group_wallet_transfers(created_at DESC);
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS group_wallet_transfer_approvals (
      id SERIAL PRIMARY KEY,
      transfer_id INTEGER NOT NULL REFERENCES group_wallet_transfers(id) ON DELETE CASCADE,
      approved_by_member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      approved_by_role VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(transfer_id, approved_by_role)
    );
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_group_wallet_transfer_approvals_transfer_id ON group_wallet_transfer_approvals(transfer_id);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_group_wallet_transfer_approvals_member_id ON group_wallet_transfer_approvals(approved_by_member_id);
  `);
}

function asEvmAddress(value: string): `0x${string}` | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) return null;
  return v as `0x${string}`;
}

function serializeTokenAmount(amount: unknown): string {
  if (typeof amount === 'bigint') return amount.toString();
  if (typeof amount === 'number' && Number.isFinite(amount)) return String(amount);
  if (typeof amount === 'string') return amount;
  return '';
}

function getEnvConfigError(): string | null {
  const missing: string[] = [];
  if (!process.env.CDP_API_KEY_ID) missing.push('CDP_API_KEY_ID');
  if (!process.env.CDP_API_KEY_SECRET) missing.push('CDP_API_KEY_SECRET');
  if (!process.env.CDP_WALLET_SECRET) missing.push('CDP_WALLET_SECRET');

  if (missing.length > 0) {
    return `Missing env vars: ${missing.join(', ')}. Configure these in your deploy environment.`;
  }

  return null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthTokenPayload(request);
  if (!auth || auth.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const groupId = Number.parseInt(id, 10);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ error: 'Invalid group id' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await ensureWalletSchema(client);

    const walletRes = await client.query(
      `
        SELECT id, group_id, network, cdp_account_name, evm_address, created_at, updated_at
        FROM group_wallets
        WHERE group_id = $1
        LIMIT 1
      `,
      [groupId]
    );

    if (walletRes.rows.length === 0) {
      return NextResponse.json({ success: true, wallet: null, balances: null, recentTransfers: [] });
    }

    const wallet = walletRes.rows[0] as {
      id: number;
      group_id: number;
      network: string;
      cdp_account_name: string;
      evm_address: string;
      created_at: string;
      updated_at: string;
    };

    const transfersRes = await client.query(
      `
        SELECT
          t.id,
          t.to_address,
          t.amount_base_units,
          t.status,
          t.approvals_required,
          t.executed_tx_hash,
          t.created_at,
          t.updated_at,
          COALESCE(a.approval_count, 0) AS approval_count
        FROM group_wallet_transfers t
        LEFT JOIN (
          SELECT transfer_id, COUNT(*)::int AS approval_count
          FROM group_wallet_transfer_approvals
          GROUP BY transfer_id
        ) a ON a.transfer_id = t.id
        WHERE t.group_id = $1
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT 100
      `,
      [groupId]
    );

    const envError = getEnvConfigError();
    if (envError) {
      return NextResponse.json(
        {
          success: true,
          wallet: {
            id: wallet.id,
            network: wallet.network,
            address: wallet.evm_address
          },
          balances: null,
          recentTransfers: transfersRes.rows,
          warning: envError
        },
        { status: 200 }
      );
    }

    const walletAddress = asEvmAddress(wallet.evm_address);
    if (!walletAddress) {
      return NextResponse.json(
        {
          success: true,
          wallet: {
            id: wallet.id,
            network: wallet.network,
            address: wallet.evm_address
          },
          balances: null,
          recentTransfers: transfersRes.rows,
          warning: 'Invalid wallet address'
        },
        { status: 200 }
      );
    }

    const cdp = new CdpClient();
    const balancesRes = await cdp.evm.listTokenBalances({
      address: walletAddress,
      network: NETWORK,
      pageSize: 100
    });

    const usdcBalance = balancesRes.balances.find((b) => {
      const token = b.token as { contractAddress?: string };
      return (token.contractAddress || '').toLowerCase() === USDC_BASE_CONTRACT.toLowerCase();
    });

    const ethBalance = balancesRes.balances.find((b) => {
      const token = b.token as { symbol?: string; name?: string };
      return (token.symbol || '').toUpperCase() === 'ETH' || (token.name || '').toUpperCase() === 'ETH';
    });

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.id,
        network: wallet.network,
        address: wallet.evm_address
      },
      balances: {
        usdc: {
          amountBaseUnits: usdcBalance ? serializeTokenAmount((usdcBalance.amount as { amount?: unknown }).amount) : '0',
          decimals: usdcBalance ? Number((usdcBalance.amount as { decimals?: unknown }).decimals) : 6
        },
        eth: {
          amountBaseUnits: ethBalance ? serializeTokenAmount((ethBalance.amount as { amount?: unknown }).amount) : '0',
          decimals: ethBalance ? Number((ethBalance.amount as { decimals?: unknown }).decimals) : 18
        }
      },
      recentTransfers: transfersRes.rows
    });
  } catch (error) {
    console.error('Admin group wallet GET error:', error);

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: message
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
