/**
 * Telling a person the database is unreachable, without telling them that.
 *
 * "Internal server error (DB_CONNECT_FAILED) [b8d9c3c8-ec1f-49af-943d-…]" is
 * what someone trying to sign in actually saw. Every part of that is for us:
 * the phrase, the code, the request id. None of it tells them whether to try
 * again, wait, or check their password — which is the only thing they wanted
 * to know.
 *
 * A database that cannot be reached is not an internal error in the sense the
 * phrase implies either. It is the service being down, which is a different
 * promise: try again shortly, and nothing you did caused this.
 */

/** Failures that mean "we could not reach the database", not "the query was bad". */
export function isConnectivityError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  const code = String(e?.code ?? '');
  const msg = String(e?.message ?? '').toLowerCase();

  // Postgres classes: 53000 insufficient resources (Neon quota), 53300 too many
  // connections, 57P03 cannot connect now (starting up), 08xxx connection
  // exceptions.
  if (['53000', '53300', '57P03', '08000', '08003', '08006', '08001', '08004'].includes(code)) return true;
  if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'ECONNRESET', 'EPIPE'].includes(code)) return true;

  return /connection terminated|connection timeout|timeout expired|exceeded the quota|too many clients|could not connect|server closed the connection/
    .test(msg);
}

export interface FriendlyDbError {
  /** What the person reads. */
  message: string;
  messageSw: string;
  /** For the client to localise or branch on. */
  code: 'service_unavailable';
  /** 503, because the service is unavailable rather than confused. */
  status: 503;
}

export const SERVICE_UNAVAILABLE: FriendlyDbError = {
  message: 'We cannot reach our service right now. Please try again in a few minutes — nothing is wrong with your account.',
  messageSw: 'Hatuwezi kufikia huduma kwa sasa. Tafadhali jaribu tena baada ya dakika chache — hakuna tatizo na akaunti yako.',
  code: 'service_unavailable',
  status: 503,
};
