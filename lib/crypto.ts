import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// AES-256-GCM for secrets we have to store and read back later (unlike a
// password, which would just be hashed). The key is derived from
// ENCRYPTION_KEY so it survives redeploys; the salt is fixed so the same
// ENCRYPTION_KEY always derives the same AES key.
function aesKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) throw new Error("ENCRYPTION_KEY is not set");
  return scryptSync(secret, "parabola-secret-storage-v1", 32);
}

/** Returns "ivBase64:authTagBase64:cipherBase64". */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted secret");
  const decipher = createDecipheriv("aes-256-gcm", aesKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

/** A safe-to-display fragment of a secret, e.g. "AIza…x9Qp". */
export function secretHint(plaintext: string): string {
  if (plaintext.length <= 8) return "••••";
  return `${plaintext.slice(0, 4)}…${plaintext.slice(-4)}`;
}
