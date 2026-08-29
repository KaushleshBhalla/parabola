import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const LINK_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes, matches the DM copy

function secret() {
  const s = process.env.ENCRYPTION_KEY;
  if (!s) throw new Error("ENCRYPTION_KEY is not set");
  return s;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/**
 * A stateless, signed token binding a Discord user to a linking attempt — no
 * new table needed. `/link`'s DM carries this; the confirm page (running
 * inside the user's already-authenticated Parabola session) verifies it and
 * completes the pairing.
 */
export function createLinkToken(discordUserId: string, discordUsername: string) {
  const payload = JSON.stringify({
    discordUserId,
    discordUsername,
    exp: Date.now() + LINK_TOKEN_TTL_MS,
  });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyLinkToken(
  token: string
): { discordUserId: string; discordUsername: string } | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = sign(encodedPayload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString());
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    if (typeof payload.discordUserId !== "string") return null;
    return {
      discordUserId: payload.discordUserId,
      discordUsername: String(payload.discordUsername ?? ""),
    };
  } catch {
    return null;
  }
}
