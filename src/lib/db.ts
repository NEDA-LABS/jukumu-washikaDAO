import { Pool, type PoolConfig } from 'pg';

const config: PoolConfig = {};

let databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  databaseUrl = databaseUrl.trim();
  if (
    (databaseUrl.startsWith('"') && databaseUrl.endsWith('"')) ||
    (databaseUrl.startsWith("'") && databaseUrl.endsWith("'"))
  ) {
    databaseUrl = databaseUrl.slice(1, -1);
  }

  try {
    new URL(databaseUrl);

    config.connectionString = databaseUrl;
    config.ssl = {
      rejectUnauthorized: false
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      'Invalid DATABASE_URL: must be a valid postgres URL. If your password contains special characters, URL-encode it. Underlying error:',
      msg
    );
  }
}

const pool = new Pool({
  ...config,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export default pool;
