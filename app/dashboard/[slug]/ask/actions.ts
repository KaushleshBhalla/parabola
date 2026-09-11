"use server";

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiChatMessages } from "@/lib/db/schema";
import { requireUser, canAccessProject } from "@/lib/auth/rbac";
import { getProjectBySlug } from "@/lib/projects";
import { logActivity } from "@/lib/activity";
import { askAiProvider, type AiTurn } from "@/lib/ai/providers";
import { getUserAiKey } from "@/lib/ai/user-keys";
import {
  buildDiscordContext,
  addProjectDiscordChannel,
  removeProjectDiscordChannel,
  type TimeRange,
} from "@/lib/ai/discord-context";

const HISTORY_LIMIT = 20; // prior turns handed back to the model

export async function askAi(
  slug: string,
  question: string,
  opts: { range: TimeRange; channelIds: string[] }
): Promise<{ error: string } | { answer: string; contextSummary: string }> {
  const user = await requireUser();
  const project = await getProjectBySlug(slug);
  if (!project) return { error: "Project not found." };
  if (!(await canAccessProject(user, project.id))) return { error: "You don't have access to this project." };

  const trimmed = question.trim();
  if (!trimmed) return { error: "Ask something first." };

  const key = await getUserAiKey(user.id);
  if (!key) {
    return { error: "Add your own free AI API key in Settings first — Ask AI uses your key, not a shared one." };
  }

  const context = await buildDiscordContext(project.id, { range: opts.range, channelIds: opts.channelIds });

  const priorTurns = await db
    .select({ role: aiChatMessages.role, content: aiChatMessages.content })
    .from(aiChatMessages)
    .where(eq(aiChatMessages.projectId, project.id))
    .orderBy(asc(aiChatMessages.createdAt));
  const history: AiTurn[] = priorTurns.slice(-HISTORY_LIMIT).map((t) => ({ role: t.role, content: t.content }));

  const system = [
    `You are an assistant for the "${project.name}" project. Answer the user's question using the Discord chat history below.`,
    `Only use what's in the messages — if the answer isn't there, say so plainly. Quote or name people when it helps. Be concise.`,
    ``,
    `--- DISCORD CHAT (${context.summary}) ---`,
    context.text,
    `--- END DISCORD CHAT ---`,
  ].join("\n");

  const result = await askAiProvider(key.provider, key.apiKey, system, history, trimmed);
  if ("error" in result) return { error: result.error };

  await db.insert(aiChatMessages).values([
    { projectId: project.id, userId: user.id, role: "user", content: trimmed },
    { projectId: project.id, userId: user.id, role: "assistant", content: result.text },
  ]);

  await logActivity({
    actorId: user.id,
    projectId: project.id,
    action: "ai_chat.asked",
    entityType: "project",
    entityId: project.id,
    searchText: `Asked AI: "${trimmed.slice(0, 120)}"`,
  });

  revalidatePath(`/dashboard/${slug}/ask`);
  return { answer: result.text, contextSummary: context.summary };
}

export async function clearAiConversation(slug: string): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  const project = await getProjectBySlug(slug);
  if (!project) return { error: "Project not found." };
  if (!(await canAccessProject(user, project.id))) return { error: "You don't have access to this project." };

  await db.delete(aiChatMessages).where(eq(aiChatMessages.projectId, project.id));
  revalidatePath(`/dashboard/${slug}/ask`);
}

export async function addDiscordChannel(
  slug: string,
  input: string
): Promise<{ error: string } | { name: string | null }> {
  const user = await requireUser();
  const project = await getProjectBySlug(slug);
  if (!project) return { error: "Project not found." };

  const result = await addProjectDiscordChannel(project.id, user.id, input);
  if (!("error" in result)) revalidatePath(`/dashboard/${slug}/ask`);
  return result;
}

export async function removeDiscordChannel(
  slug: string,
  discordChannelId: string
): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  const project = await getProjectBySlug(slug);
  if (!project) return { error: "Project not found." };

  const result = await removeProjectDiscordChannel(project.id, user.id, discordChannelId);
  if (result?.error) return result;
  revalidatePath(`/dashboard/${slug}/ask`);
}
