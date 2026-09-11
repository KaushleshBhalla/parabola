import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userAiKeys } from "@/lib/db/schema";
import { encryptSecret, decryptSecret, secretHint } from "@/lib/crypto";
import { validateAiKey } from "./validate-key";
import type { AiProvider } from "./types";

/** What the UI shows about the current key — never the key itself. */
export async function getUserAiKeyInfo(
  userId: string
): Promise<{ provider: AiProvider; hint: string } | null> {
  const [row] = await db
    .select({ provider: userAiKeys.provider, hint: userAiKeys.keyHint })
    .from(userAiKeys)
    .where(eq(userAiKeys.userId, userId))
    .limit(1);
  return row ?? null;
}

/** The decrypted key, for actually making an AI call. Server-only path. */
export async function getUserAiKey(
  userId: string
): Promise<{ provider: AiProvider; apiKey: string } | null> {
  const [row] = await db
    .select({ provider: userAiKeys.provider, ciphertext: userAiKeys.keyCiphertext })
    .from(userAiKeys)
    .where(eq(userAiKeys.userId, userId))
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
    provider,
    keyCiphertext: encryptSecret(trimmed),
    keyHint: secretHint(trimmed),
    updatedAt: new Date(),
  };
  await db
    .insert(userAiKeys)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: userAiKeys.userId, set: values });
}

export async function clearUserAiKey(userId: string) {
  await db.delete(userAiKeys).where(eq(userAiKeys.userId, userId));
}
