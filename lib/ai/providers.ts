import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PROVIDER_LABELS, type AiProvider, type AiTurn } from "./types";

export type { AiProvider, AiTurn } from "./types";
export { PROVIDER_LABELS } from "./types";

// gemini-2.0-flash: ~1M token context — fits a lot of chat history.
// llama-3.3-70b-versatile (Groq): 128k context, but Groq doesn't train on
// API data, so it's the privacy-safe pick.
const GEMINI_MODEL = "gemini-2.0-flash";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export async function askAiProvider(
  provider: AiProvider,
  apiKey: string,
  system: string,
  history: AiTurn[],
  question: string
): Promise<{ text: string } | { error: string }> {
  try {
    if (provider === "gemini") return await askGemini(apiKey, system, history, question);
    return await askGroq(apiKey, system, history, question);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    if (/quota|rate|429|resource.*exhausted/i.test(message)) {
      return { error: `Hit ${PROVIDER_LABELS[provider]}'s free-tier rate limit — wait a minute and try again.` };
    }
    if (/api.?key|permission|401|403|invalid/i.test(message)) {
      return { error: `${PROVIDER_LABELS[provider]} rejected your API key — update it in Settings.` };
    }
    console.error(`${provider} error:`, message);
    return { error: "The AI request failed. Try again in a moment." };
  }
}

async function askGemini(
  apiKey: string,
  system: string,
  history: AiTurn[],
  question: string
): Promise<{ text: string } | { error: string }> {
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: system,
  });
  const chat = model.startChat({
    history: history.map((t) => ({
      role: t.role === "assistant" ? "model" : "user",
      parts: [{ text: t.content }],
    })),
  });
  const result = await chat.sendMessage(question);
  const text = result.response.text().trim();
  return text ? { text } : { error: "The model returned an empty answer — try rephrasing." };
}

async function askGroq(
  apiKey: string,
  system: string,
  history: AiTurn[],
  question: string
): Promise<{ text: string } | { error: string }> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: system },
        ...history.map((t) => ({ role: t.role, content: t.content })),
        { role: "user", content: question },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Groq ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const text = (data.choices?.[0]?.message?.content ?? "").trim();
  return text ? { text } : { error: "The model returned an empty answer — try rephrasing." };
}
