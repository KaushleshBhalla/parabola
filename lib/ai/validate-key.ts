import "server-only";
import type { AiProvider } from "./types";

// Deliberately fetch-only — no SDK import — so modules that only need to
// verify a key (the Discord interactions route, lib/ai/user-keys) don't
// pull the Gemini SDK into their bundle.

/** Cheap check that a key works — no token cost. */
export async function validateAiKey(
  provider: AiProvider,
  apiKey: string
): Promise<{ ok: true } | { error: string }> {
  try {
    if (provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
      );
      if (res.ok) return { ok: true };
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        return { error: "Gemini didn't accept that key. Double-check you copied the whole thing." };
      }
      return { error: `Couldn't verify the key (Gemini returned ${res.status}). Try again in a moment.` };
    }

    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) return { error: "Groq didn't accept that key. Double-check you copied the whole thing." };
    return { error: `Couldn't verify the key (Groq returned ${res.status}). Try again in a moment.` };
  } catch {
    return { error: "Couldn't reach the provider to verify the key. Try again." };
  }
}
