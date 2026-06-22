import { describe, it, expect, vi } from 'vitest';
import type { PoolClient } from 'pg';
import {
  normalizeAmountTzs,
  ownerToJournalColumns,
  resolveOwnerFromRow,
  internalTransfer,
  LedgerError,
} from './ledger';

// ── Pure helpers ──

describe('normalizeAmountTzs', () => {
  it('rounds to whole TZS', () => {
    expect(normalizeAmountTzs(100.4)).toBe(100);
    expect(normalizeAmountTzs(100.6)).toBe(101);
    expect(normalizeAmountTzs('250')).toBe(250);
  });

  it('rejects zero, negatives and non-numbers', () => {
    expect(() => normalizeAmountTzs(0)).toThrow(LedgerError);
    expect(() => normalizeAmountTzs(-5)).toThrow(LedgerError);
    expect(() => normalizeAmountTzs('abc')).toThrow(LedgerError);
    expect(() => normalizeAmountTzs(NaN)).toThrow(LedgerError);
  });
});

describe('ownerToJournalColumns', () => {
  it('maps members and groups to their columns; investors to neither', () => {
    expect(ownerToJournalColumns({ ownerType: 'member', ownerId: 7 })).toEqual({ memberId: 7, groupId: null });
    expect(ownerToJournalColumns({ ownerType: 'group', ownerId: 3 })).toEqual({ memberId: null, groupId: 3 });
    expect(ownerToJournalColumns({ ownerType: 'investor', ownerId: 9 })).toEqual({ memberId: null, groupId: null });
  });
});

describe('resolveOwnerFromRow', () => {
  const base = { from_member_id: null, from_group_id: null, to_member_id: null, to_group_id: null, metadata: null };

  it('resolves member and group sides', () => {
    expect(resolveOwnerFromRow({ ...base, from_member_id: 5 }, 'from')).toEqual({ ownerType: 'member', ownerId: 5 });
    expect(resolveOwnerFromRow({ ...base, to_group_id: 8 }, 'to')).toEqual({ ownerType: 'group', ownerId: 8 });
  });

  it('falls back to investor id in metadata', () => {
    expect(resolveOwnerFromRow({ ...base, metadata: { investor_id: 12 } }, 'to')).toEqual({ ownerType: 'investor', ownerId: 12 });
  });

  it('returns null when no owner is present', () => {
    expect(resolveOwnerFromRow(base, 'from')).toBeNull();
  });
});

// ── internalTransfer against an in-memory fake client ──

interface SeedAccount {
  owner_type: string;
  owner_id: number;
  balance_tzs: number;
}

function makeClient(seed: SeedAccount[]) {
  let nextId = 1;
  const accounts = new Map<string, { id: number; owner_type: string; owner_id: number; balance_tzs: number }>();
  for (const s of seed) accounts.set(`${s.owner_type}:${s.owner_id}`, { id: nextId++, ...s });
  const byId = () => {
    const m = new Map<number, { id: number; owner_type: string; owner_id: number; balance_tzs: number }>();
    for (const a of accounts.values()) m.set(a.id, a);
    return m;
  };

  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    const s = String(sql);
    const p = Array.isArray(params) ? params : [];
    if (s.includes('INSERT INTO wallet_accounts') && s.includes('ON CONFLICT')) {
      if (p.length < 2) return { rows: [] }; // literal master/fee seed rows
      const [ot, id] = p as [string, number];
      const key = `${ot}:${id}`;
      if (!accounts.has(key)) accounts.set(key, { id: nextId++, owner_type: ot, owner_id: id, balance_tzs: 0 });
      return { rows: [] };
    }
    if (s.includes('SELECT id, owner_type, owner_id, balance_tzs FROM wallet_accounts')) {
      const [ot, id] = p as [string, number];
      const a = accounts.get(`${ot}:${id}`);
      return { rows: a ? [{ id: a.id, owner_type: a.owner_type, owner_id: a.owner_id, balance_tzs: String(a.balance_tzs) }] : [] };
    }
    if (s.includes('FROM wallet_accounts WHERE id = ANY')) {
      const ids = (p as [number[]])[0] ?? [];
      const m = byId();
      const rows = ids
        .map((id) => m.get(id))
        .filter(Boolean)
        .sort((a, b) => a!.id - b!.id)
        .map((a) => ({ id: a!.id, balance_tzs: String(a!.balance_tzs) }));
      return { rows };
    }
    if (s.includes('balance_tzs = balance_tzs - $1')) {
      const [amt, id] = p as [number, number];
      const a = byId().get(id)!;
      a.balance_tzs -= amt;
      return { rows: [{ balance_tzs: String(a.balance_tzs) }] };
    }
    if (s.includes('balance_tzs = balance_tzs + $1')) {
      const [amt, id] = p as [number, number];
      const a = byId().get(id)!;
      a.balance_tzs += amt;
      return { rows: [{ balance_tzs: String(a.balance_tzs) }] };
    }
    if (s.includes('INSERT INTO ntzs_transactions')) {
      return { rows: [{ id: 999 }] };
    }
    return { rows: [] };
  });

  return { client: { query } as unknown as PoolClient, query, accounts };
}

describe('internalTransfer', () => {
  it('moves funds and records a journal row', async () => {
    const { client, accounts } = makeClient([{ owner_type: 'member', owner_id: 1, balance_tzs: 1000 }]);
    const res = await internalTransfer(client, {
      from: { ownerType: 'member', ownerId: 1 },
      to: { ownerType: 'group', ownerId: 2 },
      amountTzs: 300,
      purpose: 'contribution',
    });
    expect(res.journalId).toBe(999);
    expect(res.fromBalanceTzs).toBe(700);
    expect(res.toBalanceTzs).toBe(300);
    expect(accounts.get('member:1')!.balance_tzs).toBe(700);
    expect(accounts.get('group:2')!.balance_tzs).toBe(300);
  });

  it('refuses to overdraw the source', async () => {
    const { client, accounts } = makeClient([{ owner_type: 'member', owner_id: 1, balance_tzs: 100 }]);
    await expect(
      internalTransfer(client, {
        from: { ownerType: 'member', ownerId: 1 },
        to: { ownerType: 'group', ownerId: 2 },
        amountTzs: 300,
        purpose: 'contribution',
      })
    ).rejects.toMatchObject({ code: 'insufficient_balance' });
    // Balance untouched
    expect(accounts.get('member:1')!.balance_tzs).toBe(100);
  });

  it('rejects a zero/negative amount', async () => {
    const { client } = makeClient([{ owner_type: 'member', owner_id: 1, balance_tzs: 100 }]);
    await expect(
      internalTransfer(client, {
        from: { ownerType: 'member', ownerId: 1 },
        to: { ownerType: 'group', ownerId: 2 },
        amountTzs: 0,
        purpose: 'contribution',
      })
    ).rejects.toMatchObject({ code: 'invalid_amount' });
  });

  it('rejects a transfer to the same account', async () => {
    const { client } = makeClient([{ owner_type: 'member', owner_id: 1, balance_tzs: 100 }]);
    await expect(
      internalTransfer(client, {
        from: { ownerType: 'member', ownerId: 1 },
        to: { ownerType: 'member', ownerId: 1 },
        amountTzs: 50,
        purpose: 'p2p',
      })
    ).rejects.toMatchObject({ code: 'same_account' });
  });
});
