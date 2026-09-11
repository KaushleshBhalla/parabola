"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveAiKey, removeAiKey } from "./actions";
import type { AiProvider } from "@/lib/ai/types";

export function AiKeyForm({
  current,
}: {
  current: { provider: AiProvider; hint: string } | null;
}) {
  const [provider, setProvider] = useState<AiProvider>(current?.provider ?? "gemini");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    if (!key.trim() || pending) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveAiKey(provider, key.trim());
      if (result?.error) {
        setError(result.error);
        return;
      }
      setKey("");
      setSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div>
        <h2 className="font-medium">AI API key</h2>
        <p className="text-sm text-muted-foreground">
          The <strong>Ask AI</strong> tab on your projects uses <em>your</em> key, not a shared one —
          so there&apos;s no shared rate limit and your team&apos;s chat isn&apos;t funneled through one account.
          Both options below have a free tier with no credit card.{" "}
          <Link href="/blog/free-ai-api-keys" target="_blank" className="text-primary hover:underline">
            How to get a free key →
          </Link>
        </p>
      </div>

      {current ? (
        <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
          <span>
            <span className="font-medium capitalize">{current.provider}</span> key set —{" "}
            <code className="text-xs">{current.hint}</code>
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => startTransition(async () => { await removeAiKey(); setSaved(false); })}
          >
            <Trash2 className="size-3.5" />
            Remove
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No key set — Ask AI won&apos;t work until you add one.</p>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-provider">Provider</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as AiProvider)}>
              <SelectTrigger id="ai-provider" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Google Gemini</SelectItem>
                <SelectItem value="groq">Groq</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="ai-key">{current ? "Replace key" : "API key"}</Label>
            <Input
              id="ai-key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={provider === "gemini" ? "AIza…" : "gsk_…"}
              autoComplete="off"
            />
          </div>
          <Button onClick={handleSave} disabled={pending || !key.trim()}>
            {pending ? "Checking…" : "Save"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {provider === "gemini"
            ? "Biggest free context window (fits a lot of chat history). Note: Gemini's free tier may use submitted content for training."
            : "Doesn't train on your data. Smaller context, but fast. Free at console.groq.com."}
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && (
          <p className="flex items-center gap-1 text-sm text-primary">
            <Check className="size-4" /> Key verified and saved.
          </p>
        )}
      </div>
    </div>
  );
}
