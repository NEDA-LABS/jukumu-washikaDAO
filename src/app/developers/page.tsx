import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { SECTIONS, ERRORS, API_BASE, type Endpoint } from '@/lib/api/spec';

export const metadata: Metadata = {
  title: 'Developers — WashikaDAU API',
  description:
    'Build on WashikaDAU. REST endpoints for savings groups, members, contributions, wallets, transactions and governance proposals.',
};

const METHOD_STYLE: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
  POST: 'bg-primary/15 text-primary border-primary/25',
  PATCH: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25',
  DELETE: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25',
};

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-border bg-muted/60 p-4 text-[12.5px] leading-relaxed">
      <code className="font-mono text-foreground/90">{children}</code>
    </pre>
  );
}

function ParamTable({ title, rows }: { title: string; rows: NonNullable<Endpoint['params']> }) {
  return (
    <div className="mt-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {rows.map((p) => (
              <tr key={p.name} className="align-top">
                <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs text-foreground">
                  {p.name}
                  {p.required && <span className="ml-1 text-red-500">*</span>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[11px] text-muted-foreground">{p.type}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EndpointCard({ e }: { e: Endpoint }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={`shrink-0 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${METHOD_STYLE[e.method]}`}>
          {e.method}
        </span>
        <code className="font-mono text-sm text-foreground break-all">{e.path}</code>
        <span className="ml-auto rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {e.scope}
        </span>
      </div>

      <p className="mt-3 text-sm font-semibold text-foreground">{e.summary}</p>
      {e.description && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{e.description}</p>}

      {e.params && <ParamTable title="Query parameters" rows={e.params} />}
      {e.body && <ParamTable title="Body" rows={e.body} />}
      {e.example && <div className="mt-4"><Code>{e.example}</Code></div>}
    </div>
  );
}

export default function DevelopersPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="wd-container py-28 sm:py-32">
        {/* Hero */}
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            v1 · stable
          </span>
          <h1 className="mt-5 text-4xl sm:text-5xl font-bold tracking-tight">
            WashikaDAU <span className="text-gold">API</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg leading-relaxed text-muted-foreground">
            A REST API over Tanzania&rsquo;s community savings infrastructure. Read groups and their
            rosters, see exactly who has contributed and who hasn&rsquo;t, follow every nTZS
            transaction, inspect wallet balances, and track governance proposals with live vote
            tallies.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/member-dashboard?section=settings"
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5"
            >
              Get an API key
            </Link>
            <a
              href="#reference"
              className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-all hover:-translate-y-0.5"
            >
              Jump to reference
            </a>
          </div>
        </div>

        {/* Quickstart */}
        <section className="mt-16 grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold">Quickstart</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Create a key from your dashboard settings, then send it as a bearer token. Keys are
              shown once at creation and only a hash is stored, so save it somewhere safe.
            </p>
            <ol className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              {[
                'Sign in and open Settings → API keys.',
                'Create a key with the read (and optionally write) scope.',
                'Send it as an Authorization: Bearer header on every request.',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <Code>{`# Every request carries your key
export WD_KEY="wd_live_xxxxxxxxxxxxxxxxxxxxxxxx"

curl -H "Authorization: Bearer $WD_KEY" \\
  "${API_BASE}/api/v1/stats"

# Who hasn't paid this month?
curl -H "Authorization: Bearer $WD_KEY" \\
  "${API_BASE}/api/v1/groups/30/contributions?period=2026-07&include_unpaid=true"`}</Code>
          </div>
        </section>

        {/* Conventions */}
        <section className="mt-16">
          <h2 className="text-xl font-bold">Conventions</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: 'Envelope', d: 'Success returns { data, meta }. Failure returns { error: { code, message } }.' },
              { t: 'Money', d: 'Always an integer number of TZS. Field names end in _tzs. No floats, no currency strings.' },
              { t: 'Time', d: 'Every timestamp is an ISO-8601 UTC string.' },
              { t: 'Paging', d: '?limit= (1–100, default 25) and ?offset=. meta carries total and has_more.' },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-semibold text-foreground">{c.t}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <strong>Rate limit:</strong> 120 requests per minute per key. Exceeding it returns{' '}
              <code className="font-mono text-xs">429 rate_limited</code> with a{' '}
              <code className="font-mono text-xs">Retry-After</code> header.
            </p>
          </div>
        </section>

        {/* Reference */}
        <section id="reference" className="mt-16 scroll-mt-24">
          <h2 className="text-xl font-bold">API reference</h2>

          <nav className="mt-4 flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {s.title}
              </a>
            ))}
          </nav>

          <div className="mt-8 space-y-14">
            {SECTIONS.map((s) => (
              <div key={s.id} id={s.id} className="scroll-mt-24">
                <h3 className="text-lg font-bold text-foreground">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.blurb}</p>
                <div className="mt-5 space-y-4">
                  {s.endpoints.map((e) => (
                    <EndpointCard key={`${e.method}${e.path}`} e={e} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Errors */}
        <section className="mt-16">
          <h2 className="text-xl font-bold">Errors</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Failures use standard HTTP status codes and a stable machine-readable{' '}
            <code className="font-mono text-xs">code</code>. Branch on the code, show the message.
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Code</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ERRORS.map((e) => (
                  <tr key={e.code}>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{e.status}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground">{e.code}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Privacy note */}
        <section className="mt-16 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold">What the API will not return</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Member phone numbers, email addresses and national ID details are never exposed, on any
            endpoint, at any scope. Neither are proposal file attachments or the platform&rsquo;s own
            master and fee wallet accounts. If you need data that is deliberately withheld here, talk
            to us rather than scraping around it.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
