import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import pg from "pg";

const ACCESS_TOKEN_TTL_SECS = 30 * 60;
const REFRESH_TOKEN_TTL_SECS = 7 * 24 * 60 * 60;

export type Account = {
  userId: string;
  teamId: string;
  authSessionId: string;
  accessToken: string;
  refreshToken: string;
};

export type TokenSecrets = {
  accessTokenSecret: string;
  refreshTokenSecret: string;
};

export async function createAccount(
  pool: pg.Pool,
  secrets: TokenSecrets,
): Promise<Account> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const email = `e2e-${Date.now()}@measure.local`;
    const userId = randomUUID();
    const teamId = randomUUID();
    const authSessionId = randomUUID();
    const now = new Date();

    await client.query(
      `INSERT INTO users (id, name, email, confirmed_at, last_sign_in_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, "E2E User", email, now, now, now, now],
    );

    await client.query(
      `INSERT INTO notif_prefs (user_id, created_at, updated_at) VALUES ($1, $2, $3)`,
      [userId, now, now],
    );

    await client.query(
      `INSERT INTO teams (id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)`,
      [teamId, "E2E Team", now, now],
    );

    await client.query(
      `INSERT INTO team_membership (team_id, user_id, role, role_updated_at, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [teamId, userId, "owner", now, now],
    );

    const accessExpiry = new Date(now.getTime() + ACCESS_TOKEN_TTL_SECS * 1000);
    const refreshExpiry = new Date(
      now.getTime() + REFRESH_TOKEN_TTL_SECS * 1000,
    );

    const userMeta = {
      name: "E2E User",
      email,
      picture: "https://lh3.googleusercontent.com/a/default-user",
      provider: "google",
      e2e: "true",
    };
    await client.query(
      `INSERT INTO auth_sessions (id, user_id, oauth_provider, user_metadata, at_expiry_at, rt_expiry_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        authSessionId,
        userId,
        "google",
        JSON.stringify(userMeta),
        accessExpiry,
        refreshExpiry,
      ],
    );

    await client.query("COMMIT");

    const { accessToken, refreshToken } = createSessionTokens(
      userId,
      authSessionId,
      secrets,
    );
    return { userId, teamId, authSessionId, accessToken, refreshToken };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export function createSessionTokens(
  userId: string,
  authSessionId: string,
  secrets: TokenSecrets,
): { accessToken: string; refreshToken: string } {
  const nowSec = Math.floor(Date.now() / 1000);
  const accessToken = jwt.sign(
    {
      iat: nowSec,
      sub: userId,
      jti: authSessionId,
      exp: nowSec + ACCESS_TOKEN_TTL_SECS,
      iss: "measure",
    },
    secrets.accessTokenSecret,
    { algorithm: "HS256", noTimestamp: true },
  );
  const refreshToken = jwt.sign(
    {
      jti: authSessionId,
      exp: nowSec + REFRESH_TOKEN_TTL_SECS,
    },
    secrets.refreshTokenSecret,
    { algorithm: "HS256", noTimestamp: true },
  );
  return { accessToken, refreshToken };
}
