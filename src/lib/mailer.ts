import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Outgoing mail, over whatever SMTP account is configured.
 *
 * There is no mail provider SDK here on purpose: the only thing this
 * application sends is the occasional receipt, and SMTP credentials are
 * something the operator can change without a deploy.
 *
 * Nothing in the product depends on a message being delivered. A send that
 * fails is logged and the caller carries on, because a donation is settled by
 * the money arriving, not by our being able to reach a mailbox.
 */

// Read on each call rather than captured at import: a module that snapshots
// process.env is at the mercy of when it first happens to be imported.
const cfg = () => ({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
});

/**
 * Values shipped in env.example as things to replace. They arrive verbatim in
 * a real .env more often than anyone would like, and treating them as working
 * credentials is worse than having none: the form would offer a receipt and
 * every send would fail at the far end, silently.
 */
const PLACEHOLDERS = [
  'your-email@gmail.com', 'your-app-password', 'your-email', 'changeme',
];

function looksReal(v: string | undefined): v is string {
  if (!v || !v.trim()) return false;
  const low = v.trim().toLowerCase();
  return !PLACEHOLDERS.includes(low) && !low.startsWith('your-');
}

/**
 * Whether mail can actually be sent. The donation form asks this before it
 * offers to email a receipt — promising one we cannot send is worse than not
 * offering, because the donor then waits for it.
 */
export function isMailConfigured(): boolean {
  const { host, user, pass } = cfg();
  return looksReal(host) && looksReal(user) && looksReal(pass);
}

/** The address receipts come from. Gmail rewrites this to the account anyway. */
export function mailFrom(): string {
  const address = process.env.SMTP_FROM || cfg().user || 'no-reply@washikadau.com';
  return address.includes('<') ? address : `WashikaDAU <${address}>`;
}

let cached: Transporter | null = null;

function transport(): Transporter | null {
  if (!isMailConfigured()) return null;
  if (cached) return cached;
  const { host, port, user, pass } = cfg();
  cached = nodemailer.createTransport({
    host,
    port,
    // 465 is implicit TLS; 587 starts plain and upgrades with STARTTLS.
    secure: port === 465,
    auth: { user, pass },
  });
  return cached;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: { filename: string; content: string | Buffer; contentType?: string }[];
}

/**
 * Send one message. Resolves false rather than throwing — every caller is in
 * the middle of something more important than the mail.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  const t = transport();
  if (!t) {
    console.warn('[mailer] SMTP not configured; skipping mail to', mail.to);
    return false;
  }
  try {
    await t.sendMail({ from: mailFrom(), ...mail });
    return true;
  } catch (error) {
    console.error('[mailer] send failed:', error);
    return false;
  }
}

/** Shape check only. Deliverability is proven by delivery, not by a regex. */
export function isValidEmail(input: unknown): input is string {
  return typeof input === 'string'
    && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim())
    && input.trim().length <= 200;
}

export function normalizeEmail(input: unknown): string | null {
  if (!isValidEmail(input)) return null;
  return input.trim().toLowerCase();
}
