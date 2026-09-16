/**
 * What a collection can be for.
 *
 * Kept apart from the rest of the harambee module because the browser needs
 * this list to draw the form, and the rest of that module imports the Postgres
 * driver. One shared import of a server file is all it takes to pull `pg` into
 * a client bundle, and the failure arrives as "Can't resolve 'fs'" rather than
 * as anything resembling its cause.
 */
export const HARAMBEE_KINDS = [
  'wedding', 'funeral', 'medical', 'education', 'emergency', 'community', 'other',
] as const;

export type HarambeeKind = (typeof HARAMBEE_KINDS)[number];

export function normalizeKind(input: unknown): HarambeeKind {
  const k = String(input ?? '').toLowerCase();
  return (HARAMBEE_KINDS as readonly string[]).includes(k) ? (k as HarambeeKind) : 'other';
}
