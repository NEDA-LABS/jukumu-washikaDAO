// Netlify Scheduled Function — the automatic trigger for deposit crediting.
//
// Every 2 minutes it calls the internal reconcile endpoint, which credits every
// confirmed-but-uncredited deposit (nTZS + Snippe) to the right member/group.
// This is what makes balances reflect deposits WITHOUT anyone opening a wallet
// or clicking a button. The endpoint is idempotent, so overlapping runs are safe.
export const config = { schedule: '*/2 * * * *' };

export default async () => {
  const base =
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.DEPLOY_URL ||
    process.env.NEXT_PUBLIC_APP_URL;

  if (!base) {
    console.error('settle-deposits: no site URL in env; cannot reach the reconcile endpoint');
    return new Response('no base url', { status: 500 });
  }

  try {
    const res = await fetch(`${base}/api/cron/settle-deposits`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Only enforced if CRON_SECRET is configured; harmless otherwise.
        'x-cron-key': process.env.CRON_SECRET || '',
      },
    });
    const body = await res.text();
    console.log(`settle-deposits: ${res.status} ${body.slice(0, 300)}`);
    return new Response(body, { status: res.ok ? 200 : 502 });
  } catch (err) {
    console.error('settle-deposits: failed to call reconcile endpoint', err);
    return new Response('error', { status: 500 });
  }
};
