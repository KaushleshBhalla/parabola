import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userAiKeys } from "@/lib/db/schema";
import { encryptSecret, decryptSecret, secretHint } from "@/lib/crypto";
import { validateAiKey } from "./validate-key";
import type { AiProvider } from "./types";

/** Every provider the user has a key stored for — never the key itself. */
export async function listUserAiKeys(
  userId: string
): Promise<{ provider: AiProvider; hint: string }[]> {
  return db
    .select({ provider: userAiKeys.provider, hint: userAiKeys.keyHint })
    .from(userAiKeys)
    .where(eq(userAiKeys.userId, userId));
}

/** What the UI shows about one provider's key — never the key itself. */
export async function getUserAiKeyInfo(
  userId: string,
  provider: AiProvider
): Promise<{ provider: AiProvider; hint: string } | null> {
  const [row] = await db
    .select({ provider: userAiKeys.provider, hint: userAiKeys.keyHint })
    .from(userAiKeys)
    .where(and(eq(userAiKeys.userId, userId), eq(userAiKeys.provider, provider)))
    .limit(1);
  return row ?? null;
}

/**
 * The decrypted key for one provider, for actually making an AI call.
 * Server-only path. Pass no provider to get whichever key the user set
 * first (used by callers, like Discord's /setkey confirmation, that don't
 * yet know which provider the caller means).
 */
export async function getUserAiKey(
  userId: string,
  provider?: AiProvider
): Promise<{ provider: AiProvider; apiKey: string } | null> {
  const where = provider
    ? and(eq(userAiKeys.userId, userId), eq(userAiKeys.provider, provider))
    : eq(userAiKeys.userId, userId);
  const [row] = await db
    .select({ provider: userAiKeys.provider, ciphertext: userAiKeys.keyCiphertext })
    .from(userAiKeys)
    .where(where)
    .limit(1);
  if (!row) return null;
  try {
    return { provider: row.provider, apiKey: decryptSecret(row.ciphertext) };
  } catch {
    // ENCRYPTION_KEY changed, or corrupt row — treat as "no key".
    return null;
  }
}

export async function setUserAiKey(
  userId: string,
  provider: AiProvider,
  apiKey: string
): Promise<{ error: string } | undefined> {
  const trimmed = apiKey.trim();
  if (!trimmed) return { error: "Paste your API key." };

  const check = await validateAiKey(provider, trimmed);
  if ("error" in check) return check;

  const values = {
    keyCiphertext: encryptSecret(trimmed),
    keyHint: secretHint(trimmed),
    updatedAt: new Date(),
  };
  await db
    .insert(userAiKeys)
    .values({ userId, provider, ...values })
    .onConflictDoUpdate({ target: [userAiKeys.userId, userAiKeys.provider], set: values });
}

export async function clearUserAiKey(userId: string, provider: AiProvider) {
  await db.delete(userAiKeys).where(and(eq(userAiKeys.userId, userId), eq(userAiKeys.provider, provider)));
}
