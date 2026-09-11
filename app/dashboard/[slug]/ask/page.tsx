import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiChatMessages } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";
import { isProjectAdmin } from "@/lib/project-access";
import { listProjectDiscordChannels } from "@/lib/ai/discord-context";
import { getUserAiKeyInfo } from "@/lib/ai/user-keys";
import { getProjectBySlug } from "@/lib/projects";
import { AskPanel } from "./ask-panel";

// The askAi Server Action (triggered from this route) fetches paginated
// Discord history then calls Gemini — an "all time" question can run well
// past the default serverless timeout.
export const maxDuration = 60;

export default async function AskAiPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [user, project] = await Promise.all([requireUser(), getProjectBySlug(slug)]);
  if (!project) notFound();

  const [messages, channels, canManage, keyInfo] = await Promise.all([
    db
      .select({
        id: aiChatMessages.id,
        role: aiChatMessages.role,
        content: aiChatMessages.content,
        createdAt: aiChatMessages.createdAt,
      })
      .from(aiChatMessages)
      .where(eq(aiChatMessages.projectId, project.id))
      .orderBy(asc(aiChatMessages.createdAt)),
    listProjectDiscordChannels(project.id),
    isProjectAdmin(user.id, project.id),
    getUserAiKeyInfo(user.id),
  ]);

  return (
    <AskPanel
      slug={slug}
      initialMessages={messages}
      channels={channels.map((c) => ({ id: c.discordChannelId, name: c.name }))}
      canManage={canManage}
      hasKey={!!keyInfo}
    />
  );
}
