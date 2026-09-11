export type AiProvider = "gemini" | "groq";
export type AiTurn = { role: "user" | "assistant"; content: string };

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  gemini: "Google Gemini",
  groq: "Groq",
};

/** Best-effort provider guess from a key's prefix — Groq keys start "gsk_". */
export function guessProvider(apiKey: string): AiProvider {
  return apiKey.trim().startsWith("gsk_") ? "groq" : "gemini";
}
