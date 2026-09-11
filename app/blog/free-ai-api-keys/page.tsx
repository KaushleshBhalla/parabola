import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free AI API keys — how to get one (and which to pick) · Parabola",
  description:
    "A practical guide to the AI APIs with a genuinely free tier — Gemini, Groq, and the rest — how to get a key, and what the trade-offs are.",
};

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-20 font-heading text-xl font-semibold">
      {children}
    </h2>
  );
}

export default function FreeAiKeysBlogPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Guide</p>
      <h1 className="mt-2 font-heading text-3xl font-bold text-balance">
        Free AI API keys: how to get one, and which to pick
      </h1>
      <p className="mt-3 text-muted-foreground">
        Parabola&apos;s <strong>Ask AI</strong> feature runs on <em>your</em> API key, not a shared
        one. That means no shared rate limit, and your team&apos;s chat isn&apos;t funneled through
        one account. Every option below has a real free tier with no credit card. Here&apos;s how to
        get one and what you&apos;re trading off.
      </p>

      <div className="mt-6 rounded-lg border bg-muted/40 p-4 text-sm">
        <p className="font-medium">Short version</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            <strong>Want the most chat history in context?</strong> Use{" "}
            <a href="#gemini" className="text-primary hover:underline">
              Gemini
            </a>{" "}
            — 1M-token window, but its free tier may train on what you send.
          </li>
          <li>
            <strong>Care about privacy?</strong> Use{" "}
            <a href="#groq" className="text-primary hover:underline">
              Groq
            </a>{" "}
            — it doesn&apos;t train on API data. Smaller context, very fast.
          </li>
        </ul>
      </div>

      <H2 id="why">Why you need a key at all</H2>
      <p className="mt-2 text-muted-foreground">
        Every hosted AI model — Gemini, GPT, Claude, Llama-on-someone-else&apos;s-servers — sits
        behind an API that requires a key. The key is a credential tied to one account: it tracks
        that account&apos;s usage and, on paid tiers, its billing. There is no shared or anonymous
        key. A key &ldquo;found online&rdquo; belongs to someone else, and gets revoked fast. Making
        your own is the only real path, and on a free tier it costs nothing.
      </p>

      <H2 id="gemini">Google Gemini — biggest free context window</H2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
        <li>
          Go to{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            aistudio.google.com/apikey
          </a>
        </li>
        <li>Sign in with any Google account (a personal or throwaway one is fine)</li>
        <li>
          Click <strong>Create API key</strong> → <strong>Create API key in new project</strong>
        </li>
        <li>
          Copy the key (starts with <code>AIza…</code>)
        </li>
      </ol>
      <p className="mt-3 text-sm text-muted-foreground">
        <strong>Free tier:</strong> roughly 1,500 requests/day, ~1M token context on Gemini 2.0
        Flash. That huge context is why it&apos;s the pick when you want &ldquo;summarize the last
        month&rdquo; over a busy channel.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        <strong>Catch:</strong> Google&apos;s terms for the <em>free</em> tier say they may use
        submitted content to improve their products. For Ask AI that means your team&apos;s Discord
        messages could be seen and used by Google. The paid tier doesn&apos;t do this. If that
        matters, use Groq.
      </p>

      <H2 id="groq">Groq — fast, and doesn&apos;t train on your data</H2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
        <li>
          Go to{" "}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            console.groq.com/keys
          </a>
        </li>
        <li>Sign in (Google/GitHub/email)</li>
        <li>
          Click <strong>Create API Key</strong>, name it, copy it (starts with <code>gsk_…</code>)
        </li>
      </ol>
      <p className="mt-3 text-sm text-muted-foreground">
        <strong>Free tier:</strong> generous daily request and token limits, extremely fast
        responses. Runs open models — Parabola uses Llama 3.3 70B (128k token context). Groq
        does not train on data sent through the API.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        <strong>Catch:</strong> 128k context is large but not Gemini-large — an &ldquo;all
        time&rdquo; question over months of a busy channel will get truncated sooner.
      </p>

      <H2 id="others">Other free options (not wired into Parabola, but worth knowing)</H2>
      <ul className="mt-2 space-y-3 text-sm text-muted-foreground">
        <li>
          <strong>Cerebras</strong> (
          <a
            href="https://cloud.cerebras.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            cloud.cerebras.ai
          </a>
          ) — free tier, the fastest inference of any provider, open models. Similar profile to
          Groq.
        </li>
        <li>
          <strong>OpenRouter</strong> (
          <a
            href="https://openrouter.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            openrouter.ai
          </a>
          ) — one key, many models, including several tagged <code>:free</code>. Good for
          experimenting across models without separate signups.
        </li>
        <li>
          <strong>Mistral</strong> (
          <a
            href="https://console.mistral.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            console.mistral.ai
          </a>
          ) — free experimental tier on their own hosted models.
        </li>
        <li>
          <strong>Hugging Face Inference</strong> (
          <a
            href="https://huggingface.co/settings/tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            huggingface.co
          </a>
          ) — free token, access to thousands of models, but rate limits are tight and cold-starts
          are slow. Better for tinkering than production.
        </li>
        <li>
          <strong>Cloudflare Workers AI</strong> — a free daily allocation if you&apos;re already on
          Cloudflare. Runs open models at the edge.
        </li>
      </ul>

      <H2 id="safety">Keeping your key safe</H2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Never paste it into a public chat, screenshot, or commit it to a repo.</li>
        <li>
          Parabola stores it encrypted (AES-256-GCM) and never shows it back — only a masked hint
          like <code>AIza…x9Qp</code>.
        </li>
        <li>
          If it leaks, revoke it in the provider&apos;s console and create a new one — that instantly
          kills the old one.
        </li>
        <li>
          On a free tier you have no billing exposure anyway, but the habit is worth keeping for
          when you move to paid.
        </li>
      </ul>

      <div className="mt-12 border-t pt-6">
        <Link href="/dashboard/settings" className="text-sm font-medium text-primary hover:underline">
          ← Add your key in Settings
        </Link>
      </div>
    </div>
  );
}
