import pool from '@/lib/db';
import { sendMail, isMailConfigured } from '@/lib/mailer';
import { ensureHarambeeSchema } from '@/lib/harambee';

/**
 * The note a contributor gets when their money reaches a collection.
 *
 * Sent only once the payment has actually settled. Someone who gave to a
 * funeral collection and is told it arrived when it has not will stop watching
 * for it, which is worse than telling them nothing.
 *
 * Shorter than the donation receipt on purpose: there is no certificate to
 * hand over here, and the thing the giver actually wants to know is that the
 * family received it and how far along the collection now is.
 */

const CANONICAL = 'https://washikadau.com';

function publicBase(): string {
  for (const raw of [process.env.NEXT_PUBLIC_APP_URL, process.env.URL, process.env.DEPLOY_PRIME_URL]) {
    if (!raw) continue;
    const url = raw.trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(url)) continue;
    // A developer's localhost in a stranger's inbox is a dead link.
    if (/localhost|127\.0\.0\.1|0\.0\.0\.0|\.local(?::|$)/i.test(url)) continue;
    return url;
  }
  return CANONICAL;
}

const INK = '#1a1714';
const CREAM = '#f4ede4';
const GOLD_DEEP = '#a97416';

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tsh = (n: number) => `TSh ${Math.round(n).toLocaleString('en-US')}`;

interface Row {
  id: number; contributor_name: string; email: string; amount_tzs: string;
  reference: string; lang: string | null;
  title: string; code: string; beneficiary: string | null;
  target_tzs: string | null; raised_tzs: string;
}

export function buildHarambeeReceipt(r: Row) {
  const sw = r.lang === 'sw';
  const amount = tsh(Number(r.amount_tzs));
  const url = `${publicBase()}/harambee/${encodeURIComponent(r.code)}`;
  const raised = Number(r.raised_tzs);
  const target = r.target_tzs != null ? Number(r.target_tzs) : null;
  const pct = target ? Math.min(100, Math.round((raised / target) * 100)) : null;

  const subject = sw
    ? `Asante — mchango wako wa ${amount} umefika`
    : `Thank you — your ${amount} reached the collection`;

  const lines = sw ? {
    lede: 'Mchango wako umefika.',
    body: `Umechangia ${amount} kwa "${r.title}".${r.beneficiary ? ` Pesa zinamfikia ${r.beneficiary}.` : ''}`,
    progress: target
      ? `Hadi sasa zimekusanywa ${tsh(raised)} kati ya ${tsh(target)} (${pct}%).`
      : `Hadi sasa zimekusanywa ${tsh(raised)}.`,
    cta: 'Ona mchango',
    refLabel: 'Kumbukumbu',
    foot: 'Umepokea barua hii kwa sababu uliacha anwani yako ulipochangia.',
  } : {
    lede: 'Your contribution arrived.',
    body: `You gave ${amount} to “${r.title}”.${r.beneficiary ? ` It goes to ${r.beneficiary}.` : ''}`,
    progress: target
      ? `The collection now stands at ${tsh(raised)} of ${tsh(target)} (${pct}%).`
      : `The collection now stands at ${tsh(raised)}.`,
    cta: 'View the collection',
    refLabel: 'Reference',
    foot: 'You are receiving this because you left your address when you contributed.',
  };

  const text = [lines.lede, '', lines.body, '', lines.progress, '',
    `${lines.refLabel}: ${r.reference}`, url, '', lines.foot].join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${CREAM};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:28px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf9;border:2px solid ${INK};">
    <tr><td style="padding:26px 30px 18px;border-bottom:1px solid rgba(26,23,20,0.16);">
      <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:5px;color:${GOLD_DEEP};">W A S H I K A &nbsp;D A U</div>
    </td></tr>
    <tr><td style="padding:30px 30px 8px;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:27px;font-weight:700;color:${INK};line-height:1.2;">${esc(lines.lede)}</div>
      <p style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:rgba(26,23,20,0.72);margin:16px 0 0;">${esc(lines.body)}</p>
      <p style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:rgba(26,23,20,0.6);margin:12px 0 0;">${esc(lines.progress)}</p>
    </td></tr>
    <tr><td style="padding:22px 30px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(26,23,20,0.16);"><tr>
        <td style="padding:16px 18px;">
          <div style="font-family:'DM Mono',Menlo,monospace;font-size:9px;letter-spacing:2px;color:rgba(26,23,20,0.5);text-transform:uppercase;">${esc(lines.refLabel)}</div>
          <div style="font-family:'DM Mono',Menlo,monospace;font-size:14px;color:${INK};margin-top:5px;">${esc(r.reference)}</div>
        </td>
        <td align="right" style="padding:16px 18px;">
          <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:${GOLD_DEEP};">${esc(amount)}</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:22px 30px 0;">
      <a href="${url}" style="display:inline-block;background:${INK};color:${CREAM};font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:15px 26px;">${esc(lines.cta)}</a>
    </td></tr>
    <tr><td style="padding:24px 30px 30px;">
      <p style="font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:rgba(26,23,20,0.45);margin:0;border-top:1px solid rgba(26,23,20,0.16);padding-top:18px;">${esc(lines.foot)}</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  return { subject, text, html, url };
}

/**
 * Send receipts for settled contributions that have an address and no receipt.
 *
 * The row is claimed with an UPDATE before the send, so two callers arriving
 * together cannot both win it; a failed send releases the claim so the next
 * sweep tries again rather than recording a receipt nobody received.
 */
export async function deliverHarambeeReceipts(
  opts: { ntzsId?: string; limit?: number } = {}
): Promise<{ sent: number; failed: number }> {
  if (!isMailConfigured()) return { sent: 0, failed: 0 };
  const { ntzsId, limit = 20 } = opts;
  let sent = 0, failed = 0;

  await ensureHarambeeSchema();
  const client = await pool.connect();
  try {
    const claimed = await client.query(
      `UPDATE harambee_contributions c
          SET receipt_sent_at = NOW()
        WHERE c.id IN (
          SELECT id FROM harambee_contributions
           WHERE status = 'settled' AND email IS NOT NULL AND receipt_sent_at IS NULL
             ${ntzsId ? 'AND ntzs_id = $2' : ''}
           ORDER BY COALESCE(settled_at, created_at) DESC
           LIMIT $1
           FOR UPDATE SKIP LOCKED
        )
        RETURNING c.id, c.contributor_name, c.email, c.amount_tzs, c.reference, c.lang, c.harambee_id`,
      ntzsId ? [limit, ntzsId] : [limit]
    );

    for (const row of claimed.rows as (Row & { harambee_id: number })[]) {
      // The running total is read at send time, so the message says where the
      // collection actually stands rather than where it stood at payment.
      const h = await client.query(
        `SELECT h.title, h.code, h.beneficiary, h.target_tzs,
                COALESCE((SELECT SUM(x.amount_tzs) FILTER (WHERE x.status = 'settled')
                            FROM harambee_contributions x WHERE x.harambee_id = h.id), 0)::bigint AS raised_tzs
           FROM harambees h WHERE h.id = $1`,
        [row.harambee_id]
      );
      if (h.rows.length === 0) continue;
      const full = { ...row, ...(h.rows[0] as object) } as Row;

      const { subject, text, html } = buildHarambeeReceipt(full);
      const ok = await sendMail({ to: row.email, subject, text, html });
      if (ok) sent += 1;
      else {
        failed += 1;
        await client.query(`UPDATE harambee_contributions SET receipt_sent_at = NULL WHERE id = $1`, [row.id]);
      }
    }
  } catch (error) {
    console.error('[harambee-receipt]', error);
  } finally {
    client.release();
  }
  return { sent, failed };
}
