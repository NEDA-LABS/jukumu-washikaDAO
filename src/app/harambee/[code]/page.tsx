import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import pool from '@/lib/db';
import { ensureHarambeeSchema, harambeeTotals } from '@/lib/harambee';
import HarambeeView from '@/components/harambee/HarambeeView';

export const dynamic = 'force-dynamic';

/**
 * The shared page for one collection.
 *
 * Rendered from the database directly rather than by calling our own HTTP API.
 * The first version did the latter and built its base URL from
 * NEXT_PUBLIC_APP_URL, which meant the server fetched a different server than
 * the one it was running on the moment those disagreed — the page came back
 * with no title, no description and an empty contributor list, all while
 * answering 200. A server component is already inside the process that has the
 * data; going out over the network to ask itself is a round trip that can only
 * ever be wrong in new ways.
 *
 * Rendered on the server so a link pasted into WhatsApp carries a title and a
 * total with it. A funeral collection forwarded as a bare URL with no preview
 * looks exactly like a scam, which is the one thing a page asking people for
 * money cannot afford to look like.
 */

type Row = {
  id: number; code: string; title: string; kind: string; story: string | null;
  beneficiary: string | null; target_tzs: string | null; deadline: string | null;
  status: string; created_at: string; closed_at: string | null;
  has_cover: boolean;
  group_name: string | null; organiser_name: string | null;
};

/**
 * Where a crawler should fetch the preview image from.
 *
 * Absolute and public, because WhatsApp and Facebook resolve og:image from
 * their own servers with no session and no notion of our origin. A relative
 * path works in a browser and produces no preview at all in a chat.
 */
function absoluteBase(): string {
  for (const raw of [process.env.NEXT_PUBLIC_APP_URL, process.env.URL, process.env.DEPLOY_PRIME_URL]) {
    if (!raw) continue;
    const url = raw.trim().replace(/\/$/, '');
    if (!/^https?:\/\//i.test(url)) continue;
    if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(url)) continue;
    return url;
  }
  return 'https://washikadau.com';
}

async function load(code: string) {
  await ensureHarambeeSchema();
  const res = await pool.query(
    `SELECT h.id, h.code, h.title, h.kind, h.story, h.beneficiary, h.target_tzs,
            h.deadline, h.status, h.created_at, h.closed_at,
            (h.cover_image IS NOT NULL) AS has_cover,
            g.name AS group_name, m.full_name AS organiser_name
       FROM harambees h
       LEFT JOIN groups g ON g.id = h.group_id
       LEFT JOIN members m ON m.id = h.organiser_member_id
      WHERE h.code = $1 LIMIT 1`,
    [code]
  );
  if (res.rows.length === 0) return null;
  const h = res.rows[0] as Row;

  const [totals, contributions] = await Promise.all([
    harambeeTotals(h.id),
    pool.query(
      `SELECT CASE WHEN anonymous THEN NULL ELSE contributor_name END AS name,
              amount_tzs, message, anonymous, COALESCE(settled_at, created_at) AS at
         FROM harambee_contributions
        WHERE harambee_id = $1 AND status = 'settled'
        ORDER BY COALESCE(settled_at, created_at) DESC
        LIMIT 100`,
      [h.id]
    ),
  ]);

  return {
    harambee: {
      code: h.code, title: h.title, kind: h.kind, story: h.story,
      beneficiary: h.beneficiary,
      targetTzs: h.target_tzs != null ? Number(h.target_tzs) : null,
      deadline: h.deadline, status: h.status,
      groupName: h.group_name, organiserName: h.organiser_name,
      hasCover: !!h.has_cover,
    },
    totals,
    contributions: contributions.rows.map((r) => {
      const row = r as { name: string | null; amount_tzs: string; message: string | null; anonymous: boolean; at: string };
      return { name: row.name, amountTzs: Number(row.amount_tzs), message: row.message, anonymous: row.anonymous, at: row.at };
    }),
  };
}

export async function generateMetadata(
  { params }: { params: Promise<{ code: string }> }
): Promise<Metadata> {
  const { code } = await params;
  const data = await load(code).catch(() => null);
  if (!data) return { title: 'Harambee — WashikaDAU' };

  const raised = Math.round(data.totals.raisedTzs).toLocaleString('en-US');
  const description = data.harambee.targetTzs
    ? `TSh ${raised} raised of TSh ${Math.round(data.harambee.targetTzs).toLocaleString('en-US')}. Give by mobile money or bank — no account needed.`
    : `TSh ${raised} raised so far. Give by mobile money or bank — no account needed.`;

  // A photo of the person or the occasion is most of why a forwarded link
  // gets opened, so the card gets the large format when there is one to show.
  const image = data.harambee.hasCover
    ? `${absoluteBase()}/api/public/harambee/${encodeURIComponent(code)}/cover`
    : null;

  return {
    title: `${data.harambee.title} — Harambee`,
    description,
    openGraph: {
      title: data.harambee.title,
      description,
      type: 'website',
      url: `${absoluteBase()}/harambee/${encodeURIComponent(code)}`,
      ...(image ? { images: [{ url: image, width: 1200, height: 630, alt: data.harambee.title }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: data.harambee.title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function HarambeePage(
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const data = await load(code).catch(() => null);
  if (!data) notFound();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:py-14">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground">
            WashikaDAU
          </Link>
          <Link href="/#harambee" className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground">
            Kuhusu / About
          </Link>
        </div>
        <HarambeeView code={code} initial={data} />
      </div>
    </main>
  );
}
