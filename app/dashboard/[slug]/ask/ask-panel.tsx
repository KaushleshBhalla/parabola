"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Send, Trash2, Plus, X, Sparkles, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  askAi,
  clearAiConversation,
  addDiscordChannel,
  removeDiscordChannel,
} from "./actions";
import type { TimeRange } from "@/lib/ai/discord-context";

type Message = { id: string; role: "user" | "assistant"; content: string; createdAt: Date };
type Channel = { id: string; name: string | null };

const RANGE_LABELS: Record<TimeRange, string> = {
  "24h": "Last 24 hours",
  "3d": "Last 3 days",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

export function AskPanel({
  slug,
  initialMessages,
  channels,
  canManage,
  hasKey,
}: {
  slug: string;
  initialMessages: Message[];
  channels: Channel[];
  canManage: boolean;
  hasKey: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [question, setQuestion] = useState("");
  const [range, setRange] = useState<TimeRange>("7d");
  const [selectedChannels, setSelectedChannels] = useState<string[]>(channels.map((c) => c.id));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [contextNote, setContextNote] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [newChannel, setNewChannel] = useState("");
  const [channelError, setChannelError] = useState<string | null>(null);
  const [channelPending, startChannelTransition] = useTransition();

  function toggleChannel(id: string) {
    setSelectedChannels((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function handleAsk() {
    const q = question.trim();
    if (!q || pending) return;
    setError(null);
    setContextNote(null);
    const userMsg: Message = { id: `tmp-${Date.now()}`, role: "user", content: q, createdAt: new Date() };
    setMessages((m) => [...m, userMsg]);
    setQuestion("");
    startTransition(async () => {
      const result = await askAi(slug, q, { range, channelIds: selectedChannels });
      if ("error" in result) {
        setError(result.error);
        setMessages((m) => m.filter((x) => x.id !== userMsg.id));
        setQuestion(q);
        return;
      }
      setMessages((m) => [
        ...m,
        { id: `tmp-a-${Date.now()}`, role: "assistant", content: result.answer, createdAt: new Date() },
      ]);
      setContextNote(result.contextSummary);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    });
  }

  function handleAddChannel() {
    const input = newChannel.trim();
    if (!input) return;
    setChannelError(null);
    startChannelTransition(async () => {
      const result = await addDiscordChannel(slug, input);
      if ("error" in result) {
        setChannelError(result.error);
        return;
      }
      setNewChannel("");
      // The server revalidates; a refresh picks up the new channel. For
      // immediate feedback we just clear the input — the list re-renders on
      // navigation/refresh.
      location.reload();
    });
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 px-6 py-6">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-xl font-semibold">
          <Sparkles className="size-5 text-primary" />
          Ask AI
        </h1>
        <p className="text-sm text-muted-foreground">
          Ask questions about what your team discussed in the linked Discord channels.
        </p>
      </div>

      {!hasKey && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <p className="font-medium">Add your free AI key to use this</p>
            <p className="text-muted-foreground">
              Ask AI runs on your own key, not a shared one.{" "}
              <Link href="/dashboard/settings" className="text-primary hover:underline">
                Add one in Settings
              </Link>{" "}
              — a minute, no card.{" "}
              <Link href="/blog/free-ai-api-keys" target="_blank" className="text-primary hover:underline">
                How →
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Channel management */}
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Linked channels:</span>
          {channels.length === 0 && (
            <span className="text-xs text-muted-foreground">none yet</span>
          )}
          {channels.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs ring-1 ring-foreground/10"
            >
              #{c.name ?? c.id}
              {canManage && (
                <button
                  type="button"
                  title="Unlink"
                  disabled={channelPending}
                  onClick={() =>
                    startChannelTransition(async () => {
                      await removeDiscordChannel(slug, c.id);
                      location.reload();
                    })
                  }
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Input
              value={newChannel}
              onChange={(e) => setNewChannel(e.target.value)}
              placeholder="Paste a Discord channel link or ID"
              className="h-8 text-xs"
            />
            <Button size="sm" variant="outline" disabled={channelPending} onClick={handleAddChannel}>
              <Plus className="size-3.5" />
              Link
            </Button>
          </div>
        )}
        {channelError && <p className="mt-1 text-xs text-destructive">{channelError}</p>}
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-lg border p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No questions yet. Try &ldquo;What did the team decide about the login redesign?&rdquo;
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                  m.role === "user" ? "self-end bg-primary text-primary-foreground" : "self-start bg-muted"
                )}
              >
                {m.content}
              </div>
            ))}
            {pending && (
              <div className="self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                Reading Discord and thinking…
              </div>
            )}
          </div>
        )}
      </div>

      {contextNote && <p className="text-xs text-muted-foreground">Answered from {contextNote}.</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Controls + input */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as TimeRange)}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RANGE_LABELS) as TimeRange[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {RANGE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {channels.length > 1 &&
            channels.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleChannel(c.id)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs ring-1 transition-colors",
                  selectedChannels.includes(c.id)
                    ? "bg-primary/10 text-primary ring-primary/30"
                    : "text-muted-foreground ring-foreground/10 hover:bg-muted"
                )}
              >
                #{c.name ?? c.id}
              </button>
            ))}
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            placeholder="Ask about the team's Discord discussions…"
            rows={2}
            disabled={pending}
            className="flex-1 resize-none"
          />
          <Button onClick={handleAsk} disabled={pending || !question.trim()}>
            <Send className="size-4" />
          </Button>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => startTransition(async () => { await clearAiConversation(slug); setMessages([]); })}
            className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3" />
            Clear conversation
          </button>
        )}
      </div>
    </div>
  );
}
