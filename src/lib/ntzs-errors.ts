import { NtzsApiError } from '@/lib/ntzs';

/**
 * nTZS failures, turned into something a person can act on.
 *
 * Their errors are written for whoever is integrating, which is right for a
 * log and wrong for a screen. One of them reached a member's phone verbatim:
 *
 *   "We could not confirm whether the payment prompt was delivered, and the
 *    collection may still have been taken. DO NOT retry this deposit — poll
 *    GET /api/v1/deposits/26399ad4-… instead. It settles automatically if the
 *    customer paid."
 *
 * Someone topping up a savings account was shown an internal route, a UUID and
 * an instruction in capitals aimed at a developer. Worse, the sentence that
 * mattered — your money may well have gone through, do not pay twice — was the
 * part hardest to find in it.
 *
 * So the text is replaced, and the instruction is obeyed by the application
 * rather than passed to the member: that case is not an error at all here. It
 * is a deposit whose id we now hold and can poll, which is what the caller
 * does with every other pending deposit.
 */

export type NtzsErrorKind =
  | 'unconfirmed_delivery'
  | 'insufficient_funds'
  | 'invalid_phone'
  | 'limit_exceeded'
  | 'duplicate'
  | 'unavailable'
  | 'unknown';

export interface ClassifiedNtzsError {
  kind: NtzsErrorKind;
  /** Set when the failure still left a deposit worth polling. */
  depositId: string | null;
  /** English, for the API contract and for logs. */
  message: string;
  /** True when trying again is safe. False means a payment may be in flight. */
  safeToRetry: boolean;
  /** What the raw provider said. Kept for the server log, never for a screen. */
  raw: string;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const MESSAGES: Record<NtzsErrorKind, string> = {
  unconfirmed_delivery:
    'We could not confirm the payment prompt reached your phone. If you were charged, the top-up will appear on its own — please do not pay again.',
  insufficient_funds: 'There was not enough balance in that mobile money account.',
  invalid_phone: 'That mobile number was not accepted. Check it and try again.',
  limit_exceeded: 'That amount is outside the limits for this account. Try a smaller amount.',
  duplicate: 'That payment has already been started. Check your phone for the prompt.',
  unavailable: 'Mobile money is not responding right now. Please try again in a few minutes.',
  unknown: 'The payment could not be started. Please try again in a few minutes.',
};

export function classifyNtzsError(error: unknown): ClassifiedNtzsError {
  const body = error instanceof NtzsApiError ? error.body : null;
  const status = error instanceof NtzsApiError ? error.status : 0;
  const raw = String(
    body?.message || body?.error || (error instanceof Error ? error.message : error) || ''
  );
  const low = raw.toLowerCase();

  // nTZS may name the deposit in a field; if not, it names it in the sentence.
  const extra = body as unknown as { depositId?: unknown } | null;
  const fromBody = typeof extra?.depositId === 'string' ? extra.depositId : null;
  const depositId = fromBody ?? raw.match(UUID)?.[0] ?? null;

  // The dangerous one first: a collection may already have been taken, so
  // retrying risks charging someone twice.
  const kind: NtzsErrorKind =
    /do not retry|could not confirm|may still have been taken|settles automatically/.test(low)
      ? 'unconfirmed_delivery'
      : /insufficient|not enough|low balance/.test(low) ? 'insufficient_funds'
      : /invalid (phone|msisdn|number)|phone.*(invalid|not valid)|wrong number/.test(low) ? 'invalid_phone'
      : /limit|maximum|minimum|exceed/.test(low) ? 'limit_exceeded'
      : /duplicate|already (exists|in progress|submitted)/.test(low) ? 'duplicate'
      : status === 429 || status === 503 || status === 502 || /timeout|unavailable|try again/.test(low)
        ? 'unavailable'
        : 'unknown';

  return {
    kind,
    depositId: kind === 'unconfirmed_delivery' ? depositId : null,
    message: MESSAGES[kind],
    safeToRetry: kind !== 'unconfirmed_delivery' && kind !== 'duplicate',
    raw,
  };
}
