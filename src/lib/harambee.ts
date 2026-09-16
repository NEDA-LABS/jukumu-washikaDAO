import type { PoolClient } from 'pg';
import pool from '@/lib/db';
import { oncePerProcess } from '@/lib/db-once';
import { isDepositSuccessStatus } from '@/lib/wallet/ledger';
import { notify } from '@/lib/notify';

/**
 * Harambee — pooled funding for one occasion.
 *
 * A wedding, a funeral, a hospital bill, a school fee. The thing Tanzanians
 * already do constantly with a WhatsApp group and a spreadsheet: someone opens
 * a collection, shares it, and people put money in until the need is met.
 *
 * Deliberately not a group. A chama is a standing arrangement with members,
 * rules and a wall; a harambee is one event with a deadline and whoever turns
 * up. Forcing the second into the first would make people create a group per
 * funeral, which is the wrong shape for both.
 *
 * The money rails are the ones already in use for donations, because they are
 * the ones that have been debugged: a contribution is an nTZS deposit into the
 * master wallet, credited on settlement to the organiser's wallet — or the
 * group's, when one is named — by exactly the same ledger code that settles
 * every other deposit. Nothing here moves money on its own.
 */

export { HARAMBEE_KINDS, normalizeKind } from '@/lib/harambee-kinds';
export type { HarambeeKind } from '@/lib/harambee-kinds';

export function ensureHarambeeSchema() {
  return oncePerProcess('harambee_schema', async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS harambees (
        id                SERIAL PRIMARY KEY,
        -- The public handle. Unguessable, because the page carries a
        -- beneficiary's name and circumstances and is not behind a login.
        code              VARCHAR(24) NOT NULL UNIQUE,
        title             VARCHAR(160) NOT NULL,
        kind              VARCHAR(16) NOT NULL DEFAULT 'other',
        story             TEXT,
        beneficiary       VARCHAR(160),
        target_tzs        BIGINT CHECK (target_tzs IS NULL OR target_tzs > 0),
        deadline          DATE,
        -- Who receives the money. A group when the collection belongs to one,
        -- otherwise the member who opened it.
        organiser_member_id INTEGER NOT NULL,
        group_id          INTEGER,
        status            VARCHAR(16) NOT NULL DEFAULT 'open',
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        closed_at         TIMESTAMPTZ
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS harambee_contributions (
        id               SERIAL PRIMARY KEY,
        harambee_id      INTEGER NOT NULL REFERENCES harambees(id) ON DELETE CASCADE,
        contributor_name VARCHAR(160) NOT NULL,
        phone            VARCHAR(32),
        email            VARCHAR(200),
        amount_tzs       BIGINT NOT NULL CHECK (amount_tzs > 0),
        method           VARCHAR(12) NOT NULL DEFAULT 'mobile',
        ntzs_id          VARCHAR(120),
        status           VARCHAR(24) NOT NULL DEFAULT 'pending',
        message          TEXT,
        -- A contributor may give without their name on the public list. The
        -- name is still stored, because the organiser needs to know who paid.
        anonymous        BOOLEAN NOT NULL DEFAULT false,
        reference        VARCHAR(24) NOT NULL UNIQUE,
        lang             VARCHAR(2),
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        settled_at       TIMESTAMPTZ
      )
    `);
    // Stored inline, the same way avatars and group logos are: resized and
    // JPEG-encoded in the browser first, so a cover is tens of kilobytes and
    // needs no object store to exist.
    await pool.query(`ALTER TABLE harambees ADD COLUMN IF NOT EXISTS cover_image TEXT`);

    // Claimed before sending, never written after. Settlement is reached from
    // the webhook, the sweep and the contributor's own page at once.
    await pool.query(`ALTER TABLE harambee_contributions ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMPTZ`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS harambee_invites (
        id           SERIAL PRIMARY KEY,
        harambee_id  INTEGER NOT NULL REFERENCES harambees(id) ON DELETE CASCADE,
        member_id    INTEGER NOT NULL,
        invited_by   INTEGER NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        -- One ask per person per collection. Being invited twice to the same
        -- funeral reads as nagging, and the unique index is a cheaper guard
        -- than remembering to check.
        UNIQUE (harambee_id, member_id)
      )
    `);
    // The ledger's purpose column is a closed list, and 'harambee' was not on
    // it: a contribution created a real STK push, wrote its own row, then died
    // inserting the ledger entry — the giver was shown "Internal server error"
    // while their phone was asking them to pay. 'harambee' was added to that
    // list in ensureNtzsSchema, where the constraint is actually defined.
    // Adding it from here as well meant two places fighting over one
    // constraint, and ensureNtzsSchema won by recreating it without the new
    // value — which then failed outright once a harambee row existed.

    await pool.query(`CREATE INDEX IF NOT EXISTS harambee_contrib_by_pool ON harambee_contributions (harambee_id, status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS harambee_contrib_by_ntzs ON harambee_contributions (ntzs_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS harambees_by_organiser ON harambees (organiser_member_id)`);
  });
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no O/0/I/1 — these get read aloud

function randomCode(len: number): string {
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** Short enough to say over the phone, long enough not to be guessed. */
export function newHarambeeCode(): string {
  return `H-${randomCode(4)}-${randomCode(4)}`;
}

export function newContributionReference(): string {
  return `HC-${randomCode(5)}-${randomCode(5)}`;
}

/**
 * Move a contribution to match what nTZS says about its deposit.
 *
 * Same shape, and same reasoning, as the donation settle step: the contributor
 * is long gone from the page by the time a bank transfer lands, so the record
 * cannot depend on anyone watching it.
 */
export async function settleHarambeeByNtzsId(
  client: PoolClient,
  ntzsId: string,
  status: string
): Promise<'settled' | 'failed' | null> {
  if (!ntzsId) return null;

  if (isDepositSuccessStatus(status)) {
    const res = await client.query(
      `UPDATE harambee_contributions
          SET status = 'settled', settled_at = NOW()
        WHERE ntzs_id = $1 AND status <> 'settled'
      RETURNING id, harambee_id, contributor_name, amount_tzs, anonymous`,
      [ntzsId]
    );
    if ((res.rowCount ?? 0) === 0) return null;

    // The organiser is the one person who needs to know a contribution
    // arrived, and until now nobody told them: money landed in their wallet
    // with no indication of what it was or who sent it. Sent from inside the
    // same guarded UPDATE, so a contribution that settles twice cannot
    // announce itself twice.
    const row = res.rows[0] as {
      harambee_id: number; contributor_name: string; amount_tzs: string; anonymous: boolean;
    };
    try {
      const h = await client.query(
        `SELECT h.title, h.code, m.user_id,
                COALESCE((SELECT SUM(c.amount_tzs) FILTER (WHERE c.status = 'settled')
                            FROM harambee_contributions c WHERE c.harambee_id = h.id), 0)::bigint AS raised
           FROM harambees h JOIN members m ON m.id = h.organiser_member_id
          WHERE h.id = $1 LIMIT 1`,
        [row.harambee_id]
      );
      const o = h.rows[0] as { title: string; code: string; user_id: number | null; raised: string } | undefined;
      if (o?.user_id) {
        const who = row.anonymous ? 'Asiyetajwa' : row.contributor_name;
        const whoEn = row.anonymous ? 'Someone' : row.contributor_name;
        const amount = `TSh ${Math.round(Number(row.amount_tzs)).toLocaleString('en-US')}`;
        const total = `TSh ${Math.round(Number(o.raised)).toLocaleString('en-US')}`;
        await notify(client, o.user_id, {
          title: `${who} amechangia ${amount}`,
          titleEn: `${whoEn} gave ${amount}`,
          message: `"${o.title}" — sasa jumla ni ${total}.`,
          messageEn: `“${o.title}” — the collection now stands at ${total}.`,
          type: 'success',
          category: 'harambee',
          actionUrl: `/harambee/${o.code}`,
          actionText: 'Ona mchango',
          metadata: { harambee_id: row.harambee_id, code: o.code },
        });
      }
    } catch (error) {
      // A notification that fails must never undo a settlement.
      console.error('[harambee] could not notify organiser', error);
    }
    return 'settled';
  }
  if (status === 'failed' || status === 'rejected' || status === 'cancelled') {
    const res = await client.query(
      `UPDATE harambee_contributions SET status = 'failed'
        WHERE ntzs_id = $1 AND status NOT IN ('settled', 'failed')`,
      [ntzsId]
    );
    return (res.rowCount ?? 0) > 0 ? 'failed' : null;
  }
  return null;
}

export interface HarambeeTotals {
  raisedTzs: number;
  contributors: number;
  pendingTzs: number;
}

/** Only settled money is raised. A pending prompt is not a contribution yet. */
export async function harambeeTotals(harambeeId: number): Promise<HarambeeTotals> {
  const res = await pool.query(
    `SELECT
       COALESCE(SUM(amount_tzs) FILTER (WHERE status = 'settled'), 0)::bigint AS raised,
       COUNT(*) FILTER (WHERE status = 'settled')::int AS contributors,
       COALESCE(SUM(amount_tzs) FILTER (WHERE status NOT IN ('settled','failed')), 0)::bigint AS pending
     FROM harambee_contributions WHERE harambee_id = $1`,
    [harambeeId]
  );
  const r = res.rows[0] as { raised: string; contributors: number; pending: string };
  return {
    raisedTzs: Number(r.raised),
    contributors: r.contributors,
    pendingTzs: Number(r.pending),
  };
}
