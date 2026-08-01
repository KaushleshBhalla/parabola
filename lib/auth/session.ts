import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";

const COOKIE_NAME = "parabola_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const [row] = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1);

  if (!row || row.expiresAt < new Date() || !row.user.isActive) {
    return null;
  }

  const now = new Date();
  const isStale =
    !row.user.lastSeenAt ||
    now.getTime() - row.user.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS;

  if (isStale) {
    await db
      .update(users)
      .set({ lastSeenAt: now })
      .where(eq(users.id, row.user.id));
    row.user.lastSeenAt = now;
  }

  return row.user;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  cookieStore.delete(COOKIE_NAME);
}
