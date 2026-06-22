/**
 * Custodial wallet ledger.
 *
 * The platform holds ONE on-chain nTZS wallet (the "master" / treasury). Every
 * member, group and investor has a database balance in `wallet_accounts`.
 *
 * - Internal movements (contribution, disbursement, p2p, funding, expense) are
 *   pure database transfers: debit one account, credit another, atomically.
 *   Nothing touches the chain.
 * - Money only touches the chain when it enters (deposit → mint into master) or
 *   leaves (withdrawal → burn from master) the platform.
 *
 * All balances are integer TZS.
 */

import type { PoolClient } from 'pg';
import { ensureNtzsSchema, recordTransaction } from '@/lib/ntzs-db';
import { ntzs } from '@/lib/ntzs';

export type OwnerType = 'member' | 'group' | 'investor' | 'master' | 'fee';

export interface OwnerRef {
  ownerType: OwnerType;
  /** Real entity id; 0 (or null) for the master/fee singletons. */
  ownerId: number | null;
}

export const MASTER: OwnerRef = { ownerType: 'master', ownerId: 0 };
export const FEE: OwnerRef = { ownerType: 'fee', ownerId: 0 };

/** Ledger errors carry a stable `code` so routes can map them to user messages. */
export class LedgerError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'LedgerError';
    this.code = code;
  }
}

// ── Pure helpers (exported for unit testing) ──

/** Coerce an amount to a positive whole-TZS integer or throw. */
export function normalizeAmountTzs(amount: unknown): number {
  const n = typeof amount === 'string' ? Number(amount) : (amount as number);
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new LedgerError('invalid_amount', 'Amount must be a number');
  }
  const whole = Math.round(n);
  if (whole <= 0) {
    throw new LedgerError('invalid_amount', 'Amount must be greater than zero');
  }
  return whole;
}

/** Map an owner ref to the member/group columns on the journal (investors live in metadata). */
export function ownerToJournalColumns(owner: OwnerRef): { memberId: number | null; groupId: number | null } {
  return {
    memberId: owner.ownerType === 'member' ? owner.ownerId : null,
    groupId: owner.ownerType === 'group' ? owner.ownerId : null,
  };
}

interface JournalOwnerRow {
  from_member_id: number | null;
  from_group_id: number | null;
  to_member_id: number | null;
  to_group_id: number | null;
  metadata: Record<string, unknown> | null;
}

/** Recover the owner of one side of a journal row (for settlement posting). */
export function resolveOwnerFromRow(row: JournalOwnerRow, side: 'from' | 'to'): OwnerRef | null {
  const memberId = side === 'from' ? row.from_member_id : row.to_member_id;
  const groupId = side === 'from' ? row.from_group_id : row.to_group_id;
  if (memberId) return { ownerType: 'member', ownerId: memberId };
  if (groupId) return { ownerType: 'group', ownerId: groupId };
  const investorId = row.metadata?.investor_id ?? row.metadata?.investor_user_id;
  if (investorId) return { ownerType: 'investor', ownerId: Number(investorId) };
  return null;
}

// ── Accounts ──

export interface WalletAccount {
  id: number;
  owner_type: OwnerType;
  owner_id: number;
  balance_tzs: number;
}

function oid(owner: OwnerRef): number {
  return owner.ownerId ?? 0;
}

export async function getOrCreateAccount(client: PoolClient, owner: OwnerRef): Promise<WalletAccount> {
  await ensureNtzsSchema(client);
  await client.query(
    `INSERT INTO wallet_accounts (owner_type, owner_id) VALUES ($1, $2)
     ON CONFLICT (owner_type, owner_id) DO NOTHING`,
    [owner.ownerType, oid(owner)]
  );
  const res = await client.query(
    `SELECT id, owner_type, owner_id, balance_tzs FROM wallet_accounts
     WHERE owner_type = $1 AND owner_id = $2 LIMIT 1`,
    [owner.ownerType, oid(owner)]
  );
  const row = res.rows[0] as { id: number; owner_type: OwnerType; owner_id: number; balance_tzs: string };
  return { id: row.id, owner_type: row.owner_type, owner_id: row.owner_id, balance_tzs: Number(row.balance_tzs) };
}

/** Read a balance without creating the account row. Returns 0 if none exists. */
export async function getBalanceTzs(client: PoolClient, owner: OwnerRef): Promise<number> {
  await ensureNtzsSchema(client);
  const res = await client.query(
    `SELECT balance_tzs FROM wallet_accounts WHERE owner_type = $1 AND owner_id = $2 LIMIT 1`,
    [owner.ownerType, oid(owner)]
  );
  return res.rows[0] ? Number((res.rows[0] as { balance_tzs: string }).balance_tzs) : 0;
}

/** Sum of all non-platform balances, grouped by owner type (for admin totals). */
export async function getTotalsByOwnerType(client: PoolClient): Promise<Record<string, number>> {
  await ensureNtzsSchema(client);
  const res = await client.query(
    `SELECT owner_type, COALESCE(SUM(balance_tzs), 0)::bigint AS total
     FROM wallet_accounts GROUP BY owner_type`
  );
  const out: Record<string, number> = {};
  for (const r of res.rows as { owner_type: string; total: string }[]) {
    out[r.owner_type] = Number(r.total);
  }
  return out;
}

// ── Internal transfer (the core money primitive) ──

export interface InternalTransferInput {
  from: OwnerRef;
  to: OwnerRef;
  amountTzs: number;
  purpose: 'contribution' | 'disbursement' | 'p2p' | 'funding' | 'expense' | 'topup' | 'fee';
  note?: string;
  metadata?: Record<string, unknown>;
}

export interface InternalTransferResult {
  journalId: number;
  amountTzs: number;
  fromBalanceTzs: number;
  toBalanceTzs: number;
}

/**
 * Move funds between two database accounts atomically.
 *
 * MUST be called inside a transaction the caller controls (BEGIN/COMMIT) so the
 * balance updates and the journal row commit together. Locks both account rows
 * in id order to avoid deadlocks, and refuses to overdraw the source.
 */
export async function internalTransfer(
  client: PoolClient,
  input: InternalTransferInput
): Promise<InternalTransferResult> {
  const amount = normalizeAmountTzs(input.amountTzs);

  const fromAcct = await getOrCreateAccount(client, input.from);
  const toAcct = await getOrCreateAccount(client, input.to);
  if (fromAcct.id === toAcct.id) {
    throw new LedgerError('same_account', 'Cannot transfer to the same account');
  }

  // Lock both rows in a deterministic order, then re-read the locked balances.
  const ids = [fromAcct.id, toAcct.id].sort((a, b) => a - b);
  const locked = await client.query(
    `SELECT id, balance_tzs FROM wallet_accounts WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`,
    [ids]
  );
  const balById = new Map<number, number>(
    (locked.rows as { id: number; balance_tzs: string }[]).map((r) => [r.id, Number(r.balance_tzs)])
  );
  const fromBal = balById.get(fromAcct.id) ?? 0;
  if (fromBal < amount) {
    throw new LedgerError('insufficient_balance', 'Insufficient balance');
  }

  await client.query(
    `UPDATE wallet_accounts SET balance_tzs = balance_tzs - $1, updated_at = NOW() WHERE id = $2`,
    [amount, fromAcct.id]
  );
  await client.query(
    `UPDATE wallet_accounts SET balance_tzs = balance_tzs + $1, updated_at = NOW() WHERE id = $2`,
    [amount, toAcct.id]
  );

  const fromCols = ownerToJournalColumns(input.from);
  const toCols = ownerToJournalColumns(input.to);
  const journalId = await recordTransaction(client, {
    ntzsId: null,
    type: 'transfer',
    status: 'completed',
    fromMemberId: fromCols.memberId,
    fromGroupId: fromCols.groupId,
    toMemberId: toCols.memberId,
    toGroupId: toCols.groupId,
    amountTzs: amount,
    netTzs: amount,
    purpose: input.purpose,
    note: input.note,
    posted: true,
    metadata: {
      ...input.metadata,
      internal: true,
      from: input.from,
      to: input.to,
    },
  });

  return {
    journalId,
    amountTzs: amount,
    fromBalanceTzs: fromBal - amount,
    toBalanceTzs: (balById.get(toAcct.id) ?? 0) + amount,
  };
}

/** Credit an account (used by deposit settlement and balance imports). */
export async function credit(client: PoolClient, owner: OwnerRef, amountTzs: number): Promise<number> {
  const amount = normalizeAmountTzs(amountTzs);
  const acct = await getOrCreateAccount(client, owner);
  const res = await client.query(
    `UPDATE wallet_accounts SET balance_tzs = balance_tzs + $1, updated_at = NOW() WHERE id = $2 RETURNING balance_tzs`,
    [amount, acct.id]
  );
  return Number((res.rows[0] as { balance_tzs: string }).balance_tzs);
}

/** Debit an account, refusing to overdraw. Used to reserve funds for a withdrawal. */
export async function debit(client: PoolClient, owner: OwnerRef, amountTzs: number): Promise<number> {
  const amount = normalizeAmountTzs(amountTzs);
  const acct = await getOrCreateAccount(client, owner);
  const locked = await client.query(
    `SELECT balance_tzs FROM wallet_accounts WHERE id = $1 FOR UPDATE`,
    [acct.id]
  );
  const bal = Number((locked.rows[0] as { balance_tzs: string }).balance_tzs);
  if (bal < amount) {
    throw new LedgerError('insufficient_balance', 'Insufficient balance');
  }
  const res = await client.query(
    `UPDATE wallet_accounts SET balance_tzs = balance_tzs - $1, updated_at = NOW() WHERE id = $2 RETURNING balance_tzs`,
    [amount, acct.id]
  );
  return Number((res.rows[0] as { balance_tzs: string }).balance_tzs);
}

// ── Master / treasury wallet ──

/**
 * The master account's on-chain nTZS user id. Auto-provisions the single
 * treasury wallet on first use and persists it on the master account row.
 */
export async function getMasterNtzsUserId(client: PoolClient): Promise<string> {
  await ensureNtzsSchema(client);
  await getOrCreateAccount(client, MASTER);

  const existing = await client.query(
    `SELECT ntzs_user_id FROM wallet_accounts WHERE owner_type = 'master' AND owner_id = 0 LIMIT 1`
  );
  const current = (existing.rows[0] as { ntzs_user_id: string | null } | undefined)?.ntzs_user_id;
  if (current) return current;

  const externalId = process.env.NTZS_MASTER_EXTERNAL_ID || 'master_treasury';
  const user = await ntzs.users.create({
    externalId,
    email: process.env.NTZS_MASTER_EMAIL || 'treasury@washikadau.com',
  });

  // Only the first writer wins; re-read to return whatever ended up stored.
  await client.query(
    `UPDATE wallet_accounts SET ntzs_user_id = $1, ntzs_wallet_address = $2, updated_at = NOW()
     WHERE owner_type = 'master' AND owner_id = 0 AND ntzs_user_id IS NULL`,
    [user.id, user.walletAddress]
  );
  const reread = await client.query(
    `SELECT ntzs_user_id FROM wallet_accounts WHERE owner_type = 'master' AND owner_id = 0 LIMIT 1`
  );
  return (reread.rows[0] as { ntzs_user_id: string }).ntzs_user_id;
}

// ── External settlement (deposits in / withdrawals out), idempotent ──

interface SettlementRow extends JournalOwnerRow {
  id: number;
  type: 'deposit' | 'transfer' | 'withdrawal';
  status: string;
  posted: boolean;
  amount_tzs: number;
  net_tzs: number | null;
}

/**
 * Apply the balance effect of a settled external transaction, exactly once.
 *
 * - deposit success → credit the destination by the net amount
 * - withdrawal failure → refund (credit back) the source
 *
 * Caller must hold an open transaction. Safe under webhook/sync re-delivery
 * thanks to the row lock + `posted` guard.
 */
export async function settleExternalTransaction(
  client: PoolClient,
  ntzsId: string,
  finalStatus: string,
  txHash?: string | null
): Promise<{ applied: boolean; type?: string }> {
  await ensureNtzsSchema(client);
  const res = await client.query(
    `SELECT id, type, status, posted, amount_tzs, net_tzs,
            from_member_id, from_group_id, to_member_id, to_group_id, metadata
     FROM ntzs_transactions WHERE ntzs_id = $1 FOR UPDATE`,
    [ntzsId]
  );
  if (res.rows.length === 0) return { applied: false };
  const row = res.rows[0] as SettlementRow;

  let applied = false;

  if (row.type === 'deposit' && !row.posted && (finalStatus === 'minted' || finalStatus === 'completed')) {
    const owner = resolveOwnerFromRow(row, 'to');
    if (owner) {
      await credit(client, owner, row.net_tzs ?? row.amount_tzs);
      applied = true;
    }
  } else if (row.type === 'withdrawal' && row.posted && finalStatus === 'failed') {
    // The debit happened at creation; give it back.
    const owner = resolveOwnerFromRow(row, 'from');
    if (owner) {
      await credit(client, owner, row.amount_tzs);
    }
  }

  await client.query(
    `UPDATE ntzs_transactions
       SET status = $1,
           tx_hash = COALESCE($2, tx_hash),
           posted = CASE
             WHEN $3::boolean THEN true
             WHEN type = 'withdrawal' AND $1 = 'failed' THEN false
             ELSE posted
           END,
           updated_at = NOW()
     WHERE id = $4`,
    [finalStatus, txHash ?? null, applied, row.id]
  );

  return { applied, type: row.type };
}
