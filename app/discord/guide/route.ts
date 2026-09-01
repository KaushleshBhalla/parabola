import { NextResponse } from "next/server";

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Discord Bot Guide — Parabola</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #F7F6FB;
    --surface: #FFFFFF;
    --surface-raised: #F0EFF8;
    --border: #E1DFEC;
    --text: #1E1F29;
    --text-dim: #66647A;
    --text-faint: #9997AC;
    --accent: #4C5FE0;
    --accent-ink: #FFFFFF;
    --accent-soft: rgba(76,95,224,0.10);
    --accent-soft-strong: rgba(76,95,224,0.16);
    --success: #2BAF6B;
    --success-soft: rgba(43,175,107,0.12);
    --warning: #A9860A;
    --warning-soft: rgba(169,134,10,0.14);
    --danger: #D8383B;
    --danger-soft: rgba(216,56,59,0.12);
    --mono: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
    --display: 'Unbounded', ui-sans-serif, system-ui, sans-serif;
    --body: 'Manrope', ui-sans-serif, system-ui, sans-serif;
    --shadow: 0 1px 2px rgba(30,31,41,0.04), 0 8px 24px -12px rgba(30,31,41,0.10);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1B1C24; --surface: #22232D; --surface-raised: #2A2C38; --border: #383A48;
      --text: #EDEBF5; --text-dim: #A6A4B8; --text-faint: #716F84;
      --accent: #7C8AF2; --accent-ink: #14151C;
      --accent-soft: rgba(124,138,242,0.14); --accent-soft-strong: rgba(124,138,242,0.22);
      --success: #57D992; --success-soft: rgba(87,217,146,0.14);
      --warning: #F0CD5C; --warning-soft: rgba(240,205,92,0.14);
      --danger: #F0696C; --danger-soft: rgba(240,105,108,0.14);
      --shadow: 0 1px 2px rgba(0,0,0,0.2), 0 12px 32px -16px rgba(0,0,0,0.5);
    }
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--body); font-size: 15px; line-height: 1.55; }
  h1, h2, h3 { font-family: var(--display); text-wrap: balance; margin: 0; }
  code, .mono { font-family: var(--mono); }
  a { color: var(--accent); }
  .shell { display: grid; grid-template-columns: 264px minmax(0,1fr); min-height: 100vh; }
  .sidebar { background: var(--surface); border-right: 1px solid var(--border); padding: 20px 14px 28px; position: sticky; top: 0; height: 100vh; overflow-y: auto; display: flex; flex-direction: column; gap: 22px; }
  .brand { display: flex; align-items: center; gap: 10px; padding: 4px 8px 14px; border-bottom: 1px solid var(--border); }
  .brand-mark { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(155deg, var(--accent), #8A6BF0); display: flex; align-items: center; justify-content: center; color: #fff; font-family: var(--display); font-weight: 800; font-size: 15px; flex-shrink: 0; }
  .brand-text { display: flex; flex-direction: column; }
  .brand-text strong { font-family: var(--display); font-weight: 700; font-size: 15px; letter-spacing: 0.01em; }
  .brand-text span { font-size: 11px; color: var(--text-faint); }
  .nav-group { display: flex; flex-direction: column; gap: 2px; }
  .nav-label { font-size: 10.5px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--text-faint); padding: 0 10px 6px; }
  .nav-link { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 7px; color: var(--text-dim); text-decoration: none; font-size: 13.5px; font-weight: 500; }
  .nav-link:hover { background: var(--surface-raised); color: var(--text); }
  .nav-link .hash { font-family: var(--mono); color: var(--text-faint); font-size: 12px; }
  main { padding: 48px clamp(24px, 5vw, 72px) 96px; max-width: 920px; }
  .intro { display: flex; flex-direction: column; gap: 14px; padding-bottom: 36px; margin-bottom: 40px; border-bottom: 1px solid var(--border); }
  .eyebrow { display: inline-flex; align-items: center; gap: 7px; font-family: var(--mono); font-size: 11.5px; color: var(--success); background: var(--success-soft); border: 1px solid var(--success); padding: 4px 10px; border-radius: 100px; width: fit-content; letter-spacing: 0.02em; }
  .eyebrow .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--success); }
  h1.title { font-size: clamp(32px, 4.4vw, 44px); font-weight: 800; letter-spacing: -0.01em; }
  .lede { font-size: 16px; color: var(--text-dim); max-width: 62ch; }
  .stat-row { display: flex; gap: 28px; flex-wrap: wrap; margin-top: 6px; }
  .stat { display: flex; flex-direction: column; gap: 2px; }
  .stat b { font-family: var(--display); font-size: 20px; font-weight: 700; }
  .stat span { font-size: 11.5px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.06em; }
  section.category { margin-bottom: 52px; scroll-margin-top: 24px; }
  .category-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 6px; }
  .category-head h2 { font-size: 21px; font-weight: 700; }
  .category-desc { color: var(--text-dim); font-size: 14px; margin-bottom: 20px; max-width: 66ch; }
  .cmd-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px 22px; margin-bottom: 14px; box-shadow: var(--shadow); scroll-margin-top: 24px; }
  .cmd-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .cmd-syntax { font-family: var(--mono); font-weight: 600; font-size: 14.5px; color: var(--accent); background: var(--accent-soft); padding: 5px 11px; border-radius: 8px; display: inline-block; }
  .cmd-syntax .opt { color: var(--text-faint); font-weight: 400; }
  .badge { font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 3px 8px; border-radius: 100px; }
  .badge.perm { background: var(--warning-soft); color: var(--warning); }
  .badge.everyone { background: var(--success-soft); color: var(--success); }
  .cmd-desc { color: var(--text-dim); font-size: 14px; margin: 10px 0 14px; }
  .invite-btn { display: inline-flex; align-items: center; gap: 8px; background: var(--accent); color: var(--accent-ink); font-weight: 600; font-size: 14px; padding: 10px 18px; border-radius: 9px; text-decoration: none; }
  .invite-btn:hover { opacity: 0.92; }
  .params { display: grid; grid-template-columns: auto 1fr; gap: 5px 16px; font-size: 13px; margin-bottom: 14px; }
  .params .p-name { font-family: var(--mono); color: var(--text); white-space: nowrap; }
  .params .p-desc { color: var(--text-dim); }
  .params .p-req { color: var(--danger); font-size: 10px; vertical-align: super; }
  .exchange { background: var(--surface-raised); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
  .msg { display: flex; gap: 10px; align-items: flex-start; }
  .avatar { width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #fff; }
  .avatar.user { background: #7A7C88; }
  .avatar.bot { background: linear-gradient(155deg, var(--accent), #8A6BF0); }
  .msg-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .msg-name { font-size: 12.5px; font-weight: 700; }
  .msg-name .tag { font-size: 9.5px; font-weight: 700; background: var(--accent); color: var(--accent-ink); padding: 1px 4px; border-radius: 3px; margin-left: 5px; vertical-align: 1px; }
  .msg-text { font-size: 13.5px; color: var(--text); font-family: var(--mono); }
  .embed { border-left: 3px solid var(--accent); background: var(--surface); border-radius: 6px; padding: 10px 12px; font-size: 13px; color: var(--text-dim); margin-top: 3px; max-width: 460px; }
  .embed strong { color: var(--text); display: block; margin-bottom: 3px; font-size: 13.5px; }
  .trouble-list { margin: 0; padding-left: 18px; color: var(--text-dim); font-size: 13px; display: flex; flex-direction: column; gap: 6px; }
  .trouble-list strong { color: var(--text); }
  .note { background: var(--surface-raised); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; font-size: 13px; color: var(--text-dim); margin-top: 6px; }
  footer { margin-top: 60px; padding-top: 24px; border-top: 1px solid var(--border); color: var(--text-faint); font-size: 12.5px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
  @media (max-width: 720px) { .shell { grid-template-columns: 1fr; } .sidebar { display: none; } }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
</style>
</head>
<body>
<div class="shell">
  <nav class="sidebar">
    <div class="brand">
      <div class="brand-mark">P</div>
      <div class="brand-text"><strong>Parabola</strong><span>Discord bot</span></div>
    </div>
    <div class="nav-group">
      <span class="nav-label">Start here</span>
      <a class="nav-link" href="#getting-started"><span class="hash">/</span>link</a>
    </div>
    <div class="nav-group">
      <span class="nav-label">Tasks</span>
      <a class="nav-link" href="#task-list"><span class="hash">/</span>task list</a>
      <a class="nav-link" href="#task-view"><span class="hash">/</span>task view</a>
      <a class="nav-link" href="#board"><span class="hash">/</span>board</a>
      <a class="nav-link" href="#assign"><span class="hash">/</span>assign</a>
      <a class="nav-link" href="#progress"><span class="hash">/</span>progress</a>
      <a class="nav-link" href="#mytasks"><span class="hash">/</span>mytasks</a>
    </div>
    <div class="nav-group">
      <span class="nav-label">In Discord</span>
      <a class="nav-link" href="#guide-cmd"><span class="hash">/</span>guide</a>
    </div>
    <div class="nav-group">
      <span class="nav-label">On the website</span>
      <a class="nav-link" href="#pro-access"><span class="hash">#</span>Request Pro access</a>
      <a class="nav-link" href="#create-project"><span class="hash">#</span>Create a project</a>
      <a class="nav-link" href="#invite-members"><span class="hash">#</span>Add members</a>
    </div>
  </nav>

  <main>
    <div class="intro">
      <span class="eyebrow"><span class="dot"></span>BOT IS LIVE</span>
      <h1 class="title">Parabola for Discord</h1>
      <p class="lede">Parabola, wherever your team already is. It keeps things deliberately minimal — check tasks, create and assign new ones, from Discord, across every project you're in. Creating projects and adding members lives on the website.</p>
      <div class="stat-row">
        <div class="stat"><b>7</b><span>Slash commands</span></div>
        <div class="stat"><b>All</b><span>Your projects, one bot</span></div>
      </div>
    </div>

    <section class="category" id="getting-started">
      <div class="category-head"><h2>Getting started</h2></div>
      <p class="category-desc">Two steps, both one-time. There's no per-server setup command — the bot just works, everywhere, for every project you're in.</p>

      <div class="cmd-card">
        <div class="cmd-head"><span class="cmd-syntax">Step 1 — Invite the bot to your server</span></div>
        <p class="cmd-desc">One click adds it as a real member of your server (not just its commands) and registers every command below — both happen in this one authorization.</p>
        <a class="invite-btn" href="https://discord.com/oauth2/authorize?client_id=1543380430831624222&amp;permissions=0&amp;scope=bot%20applications.commands" target="_blank" rel="noopener">Add Parabola to Discord</a>
      </div>

      <div class="cmd-card" id="link">
        <div class="cmd-head">
          <span class="cmd-syntax">Step 2 — /link</span>
          <span class="badge everyone">Everyone</span>
        </div>
        <p class="cmd-desc">Each teammate connects their own Discord account to their Parabola login, once. It DMs you a one-time link — open it, sign in to Parabola (or confirm you're already signed in), and the two accounts are paired for good. Nothing else works for someone until they've done this.</p>
        <div class="exchange">
          <div class="msg">
            <div class="avatar user">K</div>
            <div class="msg-body"><span class="msg-name">Kaushlesh</span><span class="msg-text">/link</span></div>
          </div>
          <div class="msg">
            <div class="avatar bot">P</div>
            <div class="msg-body">
              <span class="msg-name">Parabola<span class="tag">BOT</span></span>
              <div class="embed"><strong>Check your DMs</strong>I've sent you a private link to connect your Parabola account. It expires in 10 minutes.</div>
            </div>
          </div>
        </div>
      </div>

      <div class="cmd-card">
        <div class="cmd-head"><span class="cmd-syntax">Troubleshooting</span></div>
        <ul class="trouble-list">
          <li><strong>"Link your account first"</strong> — run <code>/link</code> and check your DMs.</li>
          <li><strong>"You're in N projects — pass project to pick one"</strong> — you belong to more than one project, so a command can't guess which you mean; add <code>project:</code> and start typing to pick from a list.</li>
          <li><strong>A command doesn't show up</strong> — new commands can take up to an hour to appear everywhere; usually instant in the first server that tried them.</li>
          <li><strong>The bot doesn't respond at all</strong> — ping whoever runs your Parabola instance, something's misconfigured on our end, not yours.</li>
          <li><strong>"X isn't in this project"</strong> when using <code>/assign</code> — that person needs to be added to the project first, by email, from that project's Members page on the website (see <a href="#invite-members">Add members</a> below).</li>
        </ul>
      </div>
    </section>

    <section class="category" id="tasks-heading">
      <div class="category-head"><h2>Tasks</h2></div>
      <p class="category-desc">Every command below except <code>/progress</code> takes an optional <code>project</code> (autocomplete over every project you're in) — leave it out and it defaults to your only project if you're just in one, or asks you to pick if you're in several. <code>/assign</code> creates and assigns a task; <code>/progress</code> is how it moves forward from there — Discord's only two ways to change anything, everything else here is read-only.</p>

      <div class="cmd-card" id="task-list">
        <div class="cmd-head">
          <span class="cmd-syntax">/task list <span class="opt">[project] [status] [assignee]</span></span>
          <span class="badge everyone">Everyone</span>
        </div>
        <p class="cmd-desc">A filtered slice of one project's board as a compact list — narrow it to one status column or one person's queue.</p>
        <div class="params">
          <span class="p-name">project</span><span class="p-desc">Which project (autocomplete).</span>
          <span class="p-name">status</span><span class="p-desc">Backlog · Todo · In Progress · Testing Pending · In Review · Done · Cancelled.</span>
          <span class="p-name">assignee</span><span class="p-desc">Limit to one teammate's tasks.</span>
        </div>
      </div>

      <div class="cmd-card" id="task-view">
        <div class="cmd-head">
          <span class="cmd-syntax">/task view <span class="opt">id [project]</span></span>
          <span class="badge everyone">Everyone</span>
        </div>
        <p class="cmd-desc">The full detail view — description, every assignee, priority, current status, and due date.</p>
        <div class="params">
          <span class="p-name">id<span class="p-req">•</span></span><span class="p-desc">Type a number or pick from the list — every suggestion shows its number, title, and current status.</span>
          <span class="p-name">project</span><span class="p-desc">Which project (autocomplete).</span>
        </div>
      </div>

      <div class="cmd-card" id="board">
        <div class="cmd-head">
          <span class="cmd-syntax">/board <span class="opt">[project] [column]</span></span>
          <span class="badge everyone">Everyone</span>
        </div>
        <p class="cmd-desc">A snapshot of one project's whole board — every column, with counts — or pass <code>column</code> to zoom into just one (e.g. Todo, In Progress, Testing Pending).</p>
        <div class="params">
          <span class="p-name">project</span><span class="p-desc">Which project (autocomplete).</span>
          <span class="p-name">column</span><span class="p-desc">Backlog · Todo · In Progress · Testing Pending · In Review · Done · Cancelled. Leave it out to see every column.</span>
        </div>
      </div>

      <div class="cmd-card" id="assign">
        <div class="cmd-head">
          <span class="cmd-syntax">/assign <span class="opt">mentions work [project] [priority] [deadline]</span></span>
          <span class="badge everyone">Everyone</span>
        </div>
        <p class="cmd-desc">Creates a new task and assigns it to whoever you mention. Everything but the mentions and the work itself is optional. Everyone you mention needs to already be a member of that project — see <a href="#invite-members">Add members</a> below if they aren't yet.</p>
        <div class="params">
          <span class="p-name">mentions<span class="p-req">•</span></span><span class="p-desc">One or more @mentions — each needs to be a member of the project and have run /link.</span>
          <span class="p-name">work<span class="p-req">•</span></span><span class="p-desc">What the task is — becomes its title.</span>
          <span class="p-name">project</span><span class="p-desc">Which project (autocomplete).</span>
          <span class="p-name">priority</span><span class="p-desc">Low · Medium · High.</span>
          <span class="p-name">deadline</span><span class="p-desc"><code>2d</code>, <code>5hr</code>, <code>1w</code>, or <code>YYYY-MM-DD</code>. Due dates only track a calendar date, not a time of day, so anything under 24h just rounds to today (or tomorrow, right around midnight).</span>
        </div>
      </div>

      <div class="cmd-card" id="progress">
        <div class="cmd-head">
          <span class="cmd-syntax">/progress <span class="opt">project work_item comment</span></span>
          <span class="badge perm">All three required</span>
        </div>
        <p class="cmd-desc">Moves a task one step forward and leaves your comment on it — the only way to advance work from Discord. Todo and In Progress both advance straight to Testing Pending; Testing Pending advances to In Review. In Review is as far as this goes — turning something Done needs the project's creator to review and score it, from the website.</p>
        <div class="params">
          <span class="p-name">project<span class="p-req">•</span></span><span class="p-desc">Which project (autocomplete) — not optional here, unlike elsewhere.</span>
          <span class="p-name">work_item<span class="p-req">•</span></span><span class="p-desc">Pick from the list — every suggestion shows its number, title, and current status, e.g. "#3 Fix login bug — Testing Pending".</span>
          <span class="p-name">comment<span class="p-req">•</span></span><span class="p-desc">What changed. Always required.</span>
        </div>
      </div>

      <div class="cmd-card" id="mytasks">
        <div class="cmd-head">
          <span class="cmd-syntax">/mytasks</span>
          <span class="badge everyone">Everyone</span>
        </div>
        <p class="cmd-desc">Your own queue across every project you're in, sorted the same way the My Tasks page sorts it — overdue first, then due soon, then everything else.</p>
      </div>

      <div class="cmd-card" id="guide-cmd">
        <div class="cmd-head">
          <span class="cmd-syntax">/guide</span>
          <span class="badge everyone">Everyone</span>
        </div>
        <p class="cmd-desc">Posts this same command list right in Discord, with a link back here for the full detail.</p>
      </div>
    </section>

    <section class="category" id="website-heading">
      <div class="category-head"><h2>On the website</h2></div>
      <p class="category-desc">Three things Discord deliberately can't do — setting up a project and its people is website-only, on purpose.</p>

      <div class="cmd-card" id="pro-access">
        <div class="cmd-head"><span class="cmd-syntax">Request Pro access</span></div>
        <p class="cmd-desc">Every new signup starts on a private demo project — enough to explore, but capped and yours alone. To create a real project, request Pro access from the dashboard sidebar (or the banner on your demo project). Fill in your name and email — everything else is optional — and it goes to an admin to approve. The sidebar shows <strong>Request Pro access</strong> until you're approved, then <strong>You have Pro</strong>.</p>
      </div>

      <div class="cmd-card" id="create-project">
        <div class="cmd-head"><span class="cmd-syntax">Create a project</span></div>
        <p class="cmd-desc">Once approved, a banner appears on your demo project: give the new project a name and create it. It's a fresh, fully independent project — your demo project is untouched and still there to explore in. If Pro access is ever revoked, the project is locked (not deleted) until it's granted again.</p>
      </div>

      <div class="cmd-card" id="invite-members">
        <div class="cmd-head"><span class="cmd-syntax">Add members</span></div>
        <p class="cmd-desc">From a project's Members page, any admin on that project can add someone by typing their email — no invite link, no waiting. They need to already have a Parabola account (ask them to sign up first if they don't); once added, they're a full member of that project, mentionable in <code>/assign</code> and everywhere else in Discord.</p>
      </div>
    </section>

    <div class="note">Everything else — changing a task's status, viewing the roadmap and activity log — lives on <a href="https://parabolaa.vercel.app/dashboard">the website</a> too.</div>

    <footer>
      <span>Parabola Discord bot</span>
      <span><a href="https://parabolaa.vercel.app/dashboard">Back to Parabola →</a></span>
    </footer>
  </main>
</div>
</body>
</html>`;

export async function GET() {
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
