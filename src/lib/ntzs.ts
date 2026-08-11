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
  phoneNumber: string;
  status: 'pending' | 'submitted' | 'processing' | 'minted' | 'failed';
  createdAt: string;
  /** Bank transfers only: what to pay, and the reference that matches it. */
  paymentMethod?: 'mobile_money' | 'bank_transfer';
  reference?: string;
  instructions?: {
    institution: string;
    accountNumber: string;
    accountName: string;
    reference: string;
    amountTzs: number;
    /** nTZS's own wording of the conditions — shown to the donor verbatim. */
    note?: string;
  };
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
  phoneNumber: string;
  status: 'pending' | 'submitted' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}

/**
 * Signed authorisation for a cash-out. Fetch via POST /withdrawals/quote,
 * pass the returned `quoteId` on POST /withdrawals within the 5-minute TTL.
 */
export interface NtzsWithdrawalQuote {
  quoteId: string | null;
  expiresAt: string;
  recipientName: string | null;
  receiveAmountTzs: number;
  burnAmountTzs: number;
  fees: {
    platformFeeTzs?: number;
    pspFeeTzs?: number;
    totalFeeTzs?: number;
    [k: string]: unknown;
  };
  balance: {
    availableTzs: number;
    sufficient: boolean;
  };
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

  console.log(`[nTZS] ${method} ${url}`);

  const res = await fetch(url, options);

  const rawText = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error(`[nTZS] Non-JSON response (HTTP ${res.status}):`, rawText.slice(0, 500));
    data = { error: 'parse_error', message: `Non-JSON response (HTTP ${res.status}): ${rawText.slice(0, 200)}` };
  }

  if (!res.ok) {
    console.error(`[nTZS] Error ${res.status}:`, JSON.stringify(data));
    throw new NtzsApiError(res.status, data as { error: string; message: string });
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

  /** Get user's on-chain nTZS balance (balance is on the user profile object) */
  getBalance: (userId: string) =>
    ntzsRequest<NtzsUser>('GET', `/users/${userId}`),
};

// ── Deposits (On-Ramp: Mobile Money → nTZS) ──

export const ntzsDeposits = {
  /**
   * Start a deposit.
   *
   * Mobile money pushes a prompt to `phoneNumber`. A bank transfer returns
   * `instructions` — the account to pay into — and requires
   * `payerAccountNumber`, the account the money will come FROM. nTZS matches
   * on the sending account rather than the narration, because the narration
   * does not survive TIPS. The published docs describe the reference as the
   * matching key; the API disagrees, and the API is what runs.
   *
   * Either way nTZS mints once the money lands, so both settle through the
   * same webhook.
   */
  create: (params: {
    userId: string;
    amountTzs: number;
    phoneNumber?: string;
    paymentMethod?: 'mobile_money' | 'bank_transfer';
    /** Required for bank_transfer: the account the transfer is sent from. */
    payerAccountNumber?: string;
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

// ── Withdrawals (Off-Ramp: nTZS → Mobile Money) ──

export const ntzsWithdrawals = {
  /**
   * Price a cash-out. Returns a signed `quoteId` (valid ~5 minutes) plus the
   * fee/net breakdown to show on a confirmation card. Quotes are now
   * mandatory: cash-outs without a `quoteId` are rejected with `quote_required`.
   */
  quote: (params: {
    userId: string;
    amountTzs: number;
    phoneNumber: string;
  }) => ntzsRequest<NtzsWithdrawalQuote>('POST', '/withdrawals/quote', params),

  /** Burn nTZS and send TZS to M-Pesa. Requires a fresh `quoteId`. */
  create: (params: {
    userId: string;
    amountTzs: number;
    phoneNumber: string;
    quoteId: string;
  }) => ntzsRequest<NtzsWithdrawal>('POST', '/withdrawals', params),

  /** Check withdrawal status */
  get: (withdrawalId: string) =>
    ntzsRequest<NtzsWithdrawal>('GET', `/withdrawals/${withdrawalId}`),
};

// ── Name lookup (mobile money account holder) ──

/**
 * The registered name behind a mobile-money number.
 *
 * nTZS exposes GET /withdrawals/name-lookup and /deposits/name-lookup — OPTIONS
 * on both returns "Allow: GET, HEAD, OPTIONS", so the routes are deployed — but
 * as of writing every call returns HTTP 500 with an empty body, for every
 * parameter name tried (phoneNumber, phone, msisdn, accountNumber, number,
 * with and without a provider), while the same credentials work on other
 * endpoints. Whatever the cause, it is upstream.
 *
 * So this never throws. It returns the name when the service answers and null
 * when it does not, and callers show a name only if one comes back. When nTZS
 * fixes the endpoint — or tells us the parameter it wants — the only change
 * needed is the query string below.
 */
export async function lookupMobileName(
  phoneNumber: string,
  direction: 'deposit' | 'withdraw' = 'deposit'
): Promise<string | null> {
  if (!NTZS_API_KEY) return null;
  const base = direction === 'withdraw' ? '/withdrawals/name-lookup' : '/deposits/name-lookup';
  try {
    const res = await fetch(
      `${NTZS_BASE_URL}/api/v1${base}?phoneNumber=${encodeURIComponent(phoneNumber)}`,
      { headers: { Authorization: `Bearer ${NTZS_API_KEY}` } }
    );
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    const data = JSON.parse(text) as Record<string, unknown>;
    // Accept whichever field the service uses for the holder's name.
    const name = data.name ?? data.accountName ?? data.recipientName ?? data.fullName
      ?? (data.data as Record<string, unknown> | undefined)?.name;
    return typeof name === 'string' && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}

// ── Convenience: full client object ──

export const ntzs = {
  users: ntzsUsers,
  deposits: ntzsDeposits,
  transfers: ntzsTransfers,
  withdrawals: ntzsWithdrawals,
};

export default ntzs;
