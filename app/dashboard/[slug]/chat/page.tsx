import { notFound } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { formatDistanceToNow } from "date-fns";
import { db } from "@/lib/db/client";
import { projects, chatMessages, users } from "@/lib/db/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { postMessage } from "./actions";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);
  if (!project) notFound();

  const messages = await db
    .select({
      id: chatMessages.id,
      body: chatMessages.body,
      createdAt: chatMessages.createdAt,
      authorName: users.name,
    })
    .from(chatMessages)
    .innerJoin(users, eq(chatMessages.authorId, users.id))
    .where(
      and(eq(chatMessages.projectId, project.id), isNull(chatMessages.deletedAt))
    )
    .orderBy(asc(chatMessages.createdAt));

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <div key={m.id} className="flex items-start gap-3">
                <Avatar size="sm">
                  <AvatarFallback>
                    {m.authorName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">{m.authorName}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(m.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm">{m.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <form
        action={postMessage}
        className="flex items-center gap-2 border-t px-6 py-3"
      >
        <input type="hidden" name="projectId" value={project.id} />
        <input type="hidden" name="slug" value={slug} />
        <Input name="body" placeholder="Message the team…" required />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
