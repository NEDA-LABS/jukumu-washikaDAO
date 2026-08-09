/**
 * One definition of what a username is, shared by signup, the claim modal and
 * the settings route. These three used to each carry their own copy of the
 * regex; keeping them in sync by hand is how a handle gets accepted in one
 * place and rejected in another.
 */

/** 3-30 chars, letters/numbers/underscore. Matched against the normalized form. */
export const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

export const USERNAME_RULE_TEXT =
  'Username must be 3-30 characters (letters, numbers, underscore only)';

/**
 * Fold a typed handle into its canonical form. Usernames are stored and
 * compared lowercase, so this is what goes into the database and what any
 * uniqueness check must run against.
 */
export function normalizeUsername(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30);
}

export function isValidUsername(input: string): boolean {
  return USERNAME_RE.test(normalizeUsername(input));
}

/**
 * Propose a handle from a person's name, e.g. "Fefe Republic" -> "feferepublic".
 * Names here are frequently Swahili and may carry trailing spaces or single
 * names, so this stays deliberately forgiving: it returns '' when it cannot
 * build something valid rather than emitting a handle that fails validation.
 */
export function suggestUsername(fullName: string): string {
  const base = normalizeUsername(String(fullName || '').replace(/\s+/g, ''));
  if (base.length < 3) return '';
  return base.slice(0, 24);
}
