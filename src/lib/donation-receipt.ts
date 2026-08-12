import pool from '@/lib/db';
import { sendMail, isMailConfigured } from '@/lib/mailer';
import { renderCertificateSvg } from '@/lib/certificate';
import sharp from 'sharp';
import { ensureDonationsSchema } from '@/lib/donations';

/**
 * The note that goes out when a gift is confirmed.
 *
 * Sent only after the money has actually landed. A donor who is told their
 * gift arrived when it has not is worse off than one told nothing, because
 * they stop watching for it.
 *
 * The certificate travels with the message as an attachment as well as a
 * link: the link needs our site to be up years from now, and the file does
 * not.
 */

/**
 * Where to point a donor. This is the one URL in the codebase that is read by
 * someone who is not us, on a machine that is not ours, so a developer's
 * NEXT_PUBLIC_APP_URL of http://localhost:3000 is not merely unhelpful here —
 * it is a dead link in a stranger's inbox, and the certificate it points at is
 * the whole reason they gave us an address.
 *
 * A local or private host is therefore refused outright in favour of the
 * canonical domain, and Netlify's own URL is preferred over a guess.
 */
const CANONICAL = 'https://washikadau.com';

function publicBase(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.URL,           // Netlify sets this to the live site URL
    process.env.DEPLOY_PRIME_URL,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const url = raw.trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(url)) continue;
    if (/localhost|127\.0\.0\.1|0\.0\.0\.0|\.local(?::|$)/i.test(url)) continue;
    return url;
  }
  return CANONICAL;
}

const INK = '#1a1714';
const CREAM = '#f4ede4';
const GOLD_DEEP = '#a97416';

export interface ReceiptRow {
  donor_name: string;
  email: string;
  amount_tzs: string;
  token: string | null;
  token_amount: string | null;
  certificate_code: string;
  method: string;
  lang: string | null;
  settled_at: string | null;
  created_at: string;
}

function money(r: ReceiptRow): string {
  const isToken = !!r.token && r.token_amount != null && Number(r.token_amount) > 0;
  if (isToken) {
    return `${Number(r.token_amount).toLocaleString('en-US', { maximumFractionDigits: 6 })} ${String(r.token).toUpperCase()}`;
  }
  return `TSh ${Math.round(Number(r.amount_tzs)).toLocaleString('en-US')}`;
}

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Exported so the message can be rendered and looked at without sending it. */
export function buildReceipt(r: ReceiptRow) {
  const sw = r.lang === 'sw';
  const amount = money(r);
  const name = r.donor_name;
  const url = `${publicBase()}/shukrani/${encodeURIComponent(r.certificate_code)}`;

  const subject = sw
    ? `Asante ${name} — mchango wako umethibitishwa`
    : `Thank you ${name} — your gift is confirmed`;

  const lines = sw
    ? {
      lede: 'Mchango wako umefika.',
      body: `Tumepokea ${amount}. Cheti chako cha shukrani kimeambatishwa hapa, na unaweza kukipakua wakati wowote.`,
      cta: 'Ona cheti chako',
      wall: 'Kila mchango ni tofali kwenye ukuta wa vikundi vya akiba Tanzania. Asante kwa kuweka lako.',
      refLabel: 'Kumbukumbu',
      foot: 'Umepokea barua hii kwa sababu uliomba uthibitisho ulipochangia WashikaDAU.',
    }
    : {
      lede: 'Your gift has arrived.',
      body: `We have received ${amount}. Your certificate of support is attached, and you can download it again at any time.`,
      cta: 'View your certificate',
      wall: 'Every gift is a brick in the wall Tanzanian savings groups are building. Thank you for laying yours.',
      refLabel: 'Reference',
      foot: 'You are receiving this because you asked for confirmation when you donated to WashikaDAU.',
    };

  const text = [
    lines.lede,
    '',
    lines.body,
    '',
    `${lines.refLabel}: ${r.certificate_code}`,
    url,
    '',
    lines.wall,
    '',
    lines.foot,
  ].join('\n');

  // Table layout and inline styles: mail clients are not browsers, and a
  // flexbox receipt arrives as a stack of unstyled text in Outlook.
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${CREAM};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:28px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf9;border:2px solid ${INK};">
    <tr><td style="padding:26px 30px 18px;border-bottom:1px solid rgba(26,23,20,0.16);">
      <div style="font-family:'DM Mono',Menlo,monospace;font-size:11px;letter-spacing:5px;color:${GOLD_DEEP};">W A S H I K A &nbsp;D A U</div>
    </td></tr>
    <tr><td style="padding:30px 30px 8px;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:27px;font-weight:700;color:${INK};line-height:1.2;">
        ${esc(lines.lede)}
      </div>
      <p style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:rgba(26,23,20,0.72);margin:16px 0 0;">
        ${esc(lines.body)}
      </p>
    </td></tr>
    <tr><td style="padding:22px 30px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(26,23,20,0.16);">
        <tr>
          <td style="padding:16px 18px;">
            <div style="font-family:'DM Mono',Menlo,monospace;font-size:9px;letter-spacing:2px;color:rgba(26,23,20,0.5);text-transform:uppercase;">${esc(lines.refLabel)}</div>
            <div style="font-family:'DM Mono',Menlo,monospace;font-size:15px;color:${INK};margin-top:5px;">${esc(r.certificate_code)}</div>
          </td>
          <td align="right" style="padding:16px 18px;">
            <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:${GOLD_DEEP};">${esc(amount)}</div>
          </td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:22px 30px 0;">
      <a href="${url}" style="display:inline-block;background:${INK};color:${CREAM};font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:15px 26px;">
        ${esc(lines.cta)}
      </a>
    </td></tr>
    <tr><td style="padding:24px 30px 30px;">
      <p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:rgba(26,23,20,0.6);margin:0;border-top:1px solid rgba(26,23,20,0.16);padding-top:18px;">
        ${esc(lines.wall)}
      </p>
      <p style="font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:rgba(26,23,20,0.45);margin:14px 0 0;">
        ${esc(lines.foot)}
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  return { subject, text, html, url };
}

/**
 * Whether the rasteriser has a real font, or will draw every character as the
 * same empty box.
 *
 * The first production receipts went out with a certificate whose text was
 * rows of tofu. Locally it was perfect — a Mac has Georgia and Times, and the
 * certificate falls back to them. The Linux container the site actually runs
 * on has neither, nor any other font, so every glyph came out as the notdef
 * box while the rules, seal and brick wall drew perfectly. The rendering did
 * not fail; it succeeded at drawing nothing legible.
 *
 * That is hard to assert on directly — a tofu box has ink in it, so "are there
 * dark pixels" says yes. But it is the SAME box for every character, so two
 * different letters rasterise to byte-identical images exactly when no real
 * font is present. That is the test.
 */
let fontProbe: Promise<boolean> | null = null;

function canRenderText(): Promise<boolean> {
  if (fontProbe) return fontProbe;
  fontProbe = (async () => {
    const glyph = (ch: string) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">`
      + `<rect width="40" height="40" fill="#fff"/>`
      + `<text x="4" y="30" font-family="Georgia, serif" font-size="30" fill="#000">${ch}</text></svg>`;
    try {
      const [m, w] = await Promise.all([
        sharp(Buffer.from(glyph('M'))).png().toBuffer(),
        sharp(Buffer.from(glyph('W'))).png().toBuffer(),
      ]);
      if (m.equals(w)) {
        console.error('[donation-receipt] no usable font for rasterising; sending the receipt without the certificate image');
        return false;
      }
      return true;
    } catch {
      return false;
    }
  })();
  return fontProbe;
}

/**
 * The certificate as something a mail client is happy to receive.
 *
 * It is drawn as SVG, and an SVG attachment is a poor thing to send: the
 * format can carry script, so filters treat it with suspicion and it is a
 * plausible reason a receipt lands in spam. Most phones will not preview one
 * either. So it goes as PNG, which every client shows inline, and the SVG
 * stays available from the certificate page for anyone who wants to print it
 * large.
 */
async function certificateAttachment(row: ReceiptRow) {
  const svg = renderCertificateSvg({
    donorName: row.donor_name,
    amountTzs: Number(row.amount_tzs),
    reference: row.certificate_code,
    date: new Date(row.settled_at || row.created_at),
    token: row.token,
    tokenAmount: row.token_amount != null ? Number(row.token_amount) : null,
  });
  // A certificate of illegible boxes is worse than no certificate: it is the
  // one thing the donor was promised, arriving broken and bearing their name.
  if (!(await canRenderText())) return null;

  try {
    const png = await sharp(Buffer.from(svg)).resize({ width: 1600 }).png().toBuffer();
    return {
      filename: `WashikaDAU-Certificate-${row.certificate_code}.png`,
      content: png,
      contentType: 'image/png',
    };
  } catch (error) {
    // Rasterising is the nicety, not the point. A receipt with a working link
    // and no attachment still tells the donor what they need to know.
    console.error('[donation-receipt] could not rasterise certificate:', error);
    return null;
  }
}

/**
 * Send receipts for confirmed gifts that have an address and have not had one.
 *
 * Pass an ntzsId to settle a single donation right after its payment
 * confirmed; pass nothing to sweep whatever was missed.
 *
 * The row is claimed with an UPDATE before the send, so two callers arriving
 * together cannot both win it — the loser's UPDATE matches nothing. A failed
 * send releases the claim so the next sweep tries again.
 */
export async function deliverDonationReceipts(
  opts: { ntzsId?: string; limit?: number } = {}
): Promise<{ sent: number; failed: number }> {
  if (!isMailConfigured()) return { sent: 0, failed: 0 };

  const { ntzsId, limit = 20 } = opts;
  let sent = 0, failed = 0;

  await ensureDonationsSchema();
  const client = await pool.connect();
  try {
    const claimed = await client.query(
      `UPDATE donations SET receipt_sent_at = NOW()
        WHERE id IN (
          SELECT id FROM donations
           WHERE status = 'completed'
             AND email IS NOT NULL
             AND receipt_sent_at IS NULL
             ${ntzsId ? 'AND ntzs_id = $2' : ''}
           ORDER BY COALESCE(settled_at, created_at) DESC
           LIMIT $1
           FOR UPDATE SKIP LOCKED
        )
        RETURNING id, donor_name, email, amount_tzs, token, token_amount,
                  certificate_code, method, lang, settled_at, created_at`,
      ntzsId ? [limit, ntzsId] : [limit]
    );

    for (const row of claimed.rows as (ReceiptRow & { id: number })[]) {
      const { subject, text, html } = buildReceipt(row);
      const attachment = await certificateAttachment(row);

      const ok = await sendMail({
        to: row.email,
        subject,
        text,
        html,
        attachments: attachment ? [attachment] : undefined,
      });

      if (ok) {
        sent += 1;
      } else {
        failed += 1;
        // Hand the row back rather than marking a receipt nobody received.
        await client.query(
          `UPDATE donations SET receipt_sent_at = NULL WHERE id = $1`,
          [row.id]
        );
      }
    }
  } catch (error) {
    console.error('[donation-receipt]', error);
  } finally {
    client.release();
  }

  return { sent, failed };
}
