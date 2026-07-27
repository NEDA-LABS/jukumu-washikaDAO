/**
 * Run a keyed piece of work at most once per server process.
 *
 * The self-healing schema pattern (ALTER TABLE ... IF NOT EXISTS on request)
 * is what keeps deploys migration-free, but unmemoized it re-runs dozens of
 * DDL round-trips against the remote database on EVERY request — the main
 * source of slow page loads. Wrapping each ensure step in oncePerProcess
 * keeps the self-healing behaviour (first request after a cold start still
 * repairs the schema) while making every subsequent request skip straight to
 * the real query.
 *
 * Failures are not cached: a transient error (cold DB start, lock timeout)
 * clears the slot so the next request retries instead of poisoning the
 * process until redeploy.
 */
const done = new Map<string, Promise<void>>();

export function oncePerProcess(key: string, run: () => Promise<unknown>): Promise<void> {
  let p = done.get(key);
  if (!p) {
    p = Promise.resolve()
      .then(run)
      .then(() => undefined)
      .catch((err) => {
        done.delete(key);
        throw err;
      });
    done.set(key, p);
  }
  return p;
}
