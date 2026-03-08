/**
 * nTZS REST Client
 * Built from https://www.ntzs.co.tz/developers
 * Replaces @ntzs/sdk (not yet published on npm)
 */

const NTZS_BASE_URL = process.env.NTZS_BASE_URL || 'https://www.ntzs.co.tz';
const NTZS_API_KEY = process.env.NTZS_API_KEY;

// ── Types ──

export interface NtzsUser {
  id: string;
  externalId: string;
  email?: string;
  phone?: string;
  walletAddress: string;
  balanceTzs?: number;
  createdAt: string;
}

export interface NtzsDeposit {
  id: string;
  userId: string;
  amountTzs: number;
  phone: string;
  status: 'pending' | 'processing' | 'minted' | 'failed';
  createdAt: string;
}

export interface NtzsTransfer {
  id: string;
  fromUserId: string;
  toUserId: string;
  amountTzs: number;
  recipientAmountTzs: number;
  feeAmountTzs: number;
  txHash: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export interface NtzsWithdrawal {
  id: string;
  userId: string;
  amountTzs: number;
  phone: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}

export interface NtzsBalance {
  balanceTzs: number;
}

export class NtzsApiError extends Error {
  status: number;
  body: { error: string; message: string };

  constructor(status: number, body: { error: string; message: string }) {
    super(body.message || body.error || 'nTZS API Error');
    this.name = 'NtzsApiError';
    this.status = status;
    this.body = body;
  }
}

// ── HTTP Helper ──

async function ntzsRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  if (!NTZS_API_KEY) {
    throw new Error('NTZS_API_KEY environment variable is not set');
  }

  const url = `${NTZS_BASE_URL}/api/v1${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${NTZS_API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);

  const data = await res.json().catch(() => ({
    error: 'parse_error',
    message: `Failed to parse response (HTTP ${res.status})`,
  }));

  if (!res.ok) {
    throw new NtzsApiError(res.status, data);
  }

  return data as T;
}

// ── Users ──

export const ntzsUsers = {
  /** Register a user and provision an on-chain wallet */
  create: (params: {
    externalId: string;
    email?: string;
    phone?: string;
  }) => ntzsRequest<NtzsUser>('POST', '/users', params),

  /** Get user profile with balance */
  get: (userId: string) =>
    ntzsRequest<NtzsUser>('GET', `/users/${userId}`),

  /** Get user's on-chain nTZS balance */
  getBalance: (userId: string) =>
    ntzsRequest<NtzsBalance>('GET', `/users/${userId}/balance`),
};

// ── Deposits (On-Ramp: M-Pesa → nTZS) ──

export const ntzsDeposits = {
  /** Initiate M-Pesa deposit. User gets STK push. */
  create: (params: {
    userId: string;
    amountTzs: number;
    phone: string;
  }) => ntzsRequest<NtzsDeposit>('POST', '/deposits', params),

  /** Check deposit status */
  get: (depositId: string) =>
    ntzsRequest<NtzsDeposit>('GET', `/deposits/${depositId}`),
};

// ── Transfers (User → User) ──

export const ntzsTransfers = {
  /** Transfer nTZS between two users */
  create: (params: {
    fromUserId: string;
    toUserId: string;
    amountTzs: number;
  }) => ntzsRequest<NtzsTransfer>('POST', '/transfers', params),

  /** Check transfer status */
  get: (transferId: string) =>
    ntzsRequest<NtzsTransfer>('GET', `/transfers/${transferId}`),
};

// ── Withdrawals (Off-Ramp: nTZS → M-Pesa) ──

export const ntzsWithdrawals = {
  /** Burn nTZS and send TZS to M-Pesa */
  create: (params: {
    userId: string;
    amountTzs: number;
    phone: string;
  }) => ntzsRequest<NtzsWithdrawal>('POST', '/withdrawals', params),

  /** Check withdrawal status */
  get: (withdrawalId: string) =>
    ntzsRequest<NtzsWithdrawal>('GET', `/withdrawals/${withdrawalId}`),
};

// ── Convenience: full client object ──

export const ntzs = {
  users: ntzsUsers,
  deposits: ntzsDeposits,
  transfers: ntzsTransfers,
  withdrawals: ntzsWithdrawals,
};

export default ntzs;
