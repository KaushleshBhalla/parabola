"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/rbac";
import { setUserAiKey, clearUserAiKey } from "@/lib/ai/user-keys";
import type { AiProvider } from "@/lib/ai/types";

export async function saveAiKey(
  provider: AiProvider,
  apiKey: string
): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  if (provider !== "gemini" && provider !== "groq") return { error: "Unknown provider." };

  const result = await setUserAiKey(user.id, provider, apiKey);
  if (result?.error) return result;

  revalidatePath("/dashboard/settings");
}

export async function removeAiKey(provider: AiProvider) {
  const user = await requireUser();
  await clearUserAiKey(user.id, provider);
  revalidatePath("/dashboard/settings");
}
