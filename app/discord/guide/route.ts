import { NextResponse } from "next/server";

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Vertex Guide — Parabola</title>
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
      <div class="brand-mark">V</div>
      <div class="brand-text"><strong>Vertex</strong><span>for Parabola</span></div>
    </div>
    <div class="nav-group">
      <span class="nav-label">Admins start here</span>
      <a class="nav-link" href="#admin-setup"><span class="hash">#</span>Admin setup</a>
    </div>
    <div class="nav-group">
      <span class="nav-label">Everyone starts here</span>
      <a class="nav-link" href="#getting-started"><span class="hash">/</span>link</a>
    </div>
    <div class="nav-group">
      <span class="nav-label">Tasks</span>
      <a class="nav-link" href="#task-list"><span class="hash">/</span>task list</a>
      <a class="nav-link" href="#task-view"><span class="hash">/</span>task view</a>
      <a class="nav-link" href="#assign"><span class="hash">/</span>assign</a>
      <a class="nav-link" href="#mytasks"><span class="hash">/</span>mytasks</a>
    </div>
    <div class="nav-group">
      <span class="nav-label">In Discord</span>
      <a class="nav-link" href="#guide-cmd"><span class="hash">/</span>guide</a>
    </div>
  </nav>

  <main>
    <div class="intro">
      <span class="eyebrow"><span class="dot"></span>VERTEX IS LIVE</span>
      <h1 class="title">Vertex</h1>
      <p class="lede">Parabola, wherever your team already is. Vertex keeps things deliberately minimal — check tasks, create and assign new ones, from Discord. Everything else (projects, members, roadmap) lives on the website.</p>
      <div class="stat-row">
        <div class="stat"><b>6</b><span>Slash commands</span></div>
        <div class="stat"><b>1:1</b><span>Server ↔ project</span></div>
      </div>
    </div>

    <section class="category" id="admin-setup">
      <div class="category-head"><h2>Admin setup</h2></div>
      <p class="category-desc">One person does this once per Discord server. After that, everyone below just uses the commands.</p>

      <div class="cmd-card">
        <div class="cmd-head"><span class="cmd-syntax">Step 1 — Invite Vertex to your server</span></div>
        <p class="cmd-desc">Get an invite link from whoever runs your Parabola instance, open it, and pick your server. Vertex needs the <code>bot</code> and <code>applications.commands</code> scopes to work at all.</p>
      </div>

      <div class="cmd-card" id="setup">
        <div class="cmd-head">
          <span class="cmd-syntax">/setup <span class="opt">project:&lt;name&gt;</span></span>
          <span class="badge perm">Requires project admin</span>
        </div>
        <p class="cmd-desc">Run this once, in the server, as an admin on the Parabola project you want linked. It links the whole server to that one project — <code>/task</code> and <code>/assign</code> default to it from then on. Start typing and pick from the projects you belong to; this links an <em>existing</em> project, creating a new one only happens on the website.</p>
        <div class="params">
          <span class="p-name">project</span><span class="p-desc">Pick from the projects you're a member of (autocomplete).</span>
        </div>
      </div>

      <div class="cmd-card">
        <div class="cmd-head"><span class="cmd-syntax">Step 3 — everyone runs /link</span></div>
        <p class="cmd-desc">Each teammate connects their own account once — see <a href="#link">/link</a> just below. Nothing else works for someone until they've done this.</p>
      </div>

      <div class="cmd-card">
        <div class="cmd-head"><span class="cmd-syntax">Troubleshooting</span></div>
        <ul class="trouble-list">
          <li><strong>"This server isn't linked yet"</strong> — an admin needs to run <code>/setup</code>.</li>
          <li><strong>"Link your account first"</strong> — run <code>/link</code> and check your DMs.</li>
          <li><strong>A command doesn't show up</strong> — new commands can take up to an hour to appear everywhere; usually instant in the first server that tried them.</li>
          <li><strong>Vertex doesn't respond at all</strong> — ping whoever runs your Parabola instance, something's misconfigured on our end, not yours.</li>
        </ul>
      </div>
    </section>

    <section class="category" id="getting-started">
      <div class="category-head"><h2>Connect your account</h2></div>
      <p class="category-desc">Run this once — every command after reads and writes as you.</p>

      <div class="cmd-card" id="link">
        <div class="cmd-head">
          <span class="cmd-syntax">/link</span>
          <span class="badge everyone">Everyone</span>
        </div>
        <p class="cmd-desc">Connects your Discord account to your Parabola login. Vertex DMs you a one-time link — open it, sign in to Parabola (or confirm you're already signed in), and the two accounts are paired for good.</p>
        <div class="exchange">
          <div class="msg">
            <div class="avatar user">K</div>
            <div class="msg-body"><span class="msg-name">Kaushlesh</span><span class="msg-text">/link</span></div>
          </div>
          <div class="msg">
            <div class="avatar bot">V</div>
            <div class="msg-body">
              <span class="msg-name">Vertex<span class="tag">BOT</span></span>
              <div class="embed"><strong>Check your DMs</strong>I've sent you a private link to connect your Parabola account. It expires in 10 minutes.</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="category" id="tasks-heading">
      <div class="category-head"><h2>Tasks</h2></div>
      <p class="category-desc"><code>/task</code> reads this server's linked project. <code>/assign</code> creates a task and assigns it — the only way to add work from Discord.</p>

      <div class="cmd-card" id="task-list">
        <div class="cmd-head">
          <span class="cmd-syntax">/task list <span class="opt">[status] [assignee]</span></span>
          <span class="badge everyone">Project members</span>
        </div>
        <p class="cmd-desc">A filtered slice of this server's linked project as a compact list — narrow it to one status column or one person's queue.</p>
        <div class="params">
          <span class="p-name">status</span><span class="p-desc">Backlog · Todo · In Progress · Testing Pending · Done · Cancelled.</span>
          <span class="p-name">assignee</span><span class="p-desc">Limit to one teammate's tasks.</span>
        </div>
      </div>

      <div class="cmd-card" id="task-view">
        <div class="cmd-head">
          <span class="cmd-syntax">/task view <span class="opt">id</span></span>
          <span class="badge everyone">Project members</span>
        </div>
        <p class="cmd-desc">The full detail view — description, every assignee, priority, and due date.</p>
        <div class="params">
          <span class="p-name">id<span class="p-req">•</span></span><span class="p-desc">The task number, e.g. <code>14</code>.</span>
        </div>
      </div>

      <div class="cmd-card" id="assign">
        <div class="cmd-head">
          <span class="cmd-syntax">/assign <span class="opt">mentions work [project] [priority] [deadline]</span></span>
          <span class="badge everyone">Project members</span>
        </div>
        <p class="cmd-desc">Creates a new task and assigns it to whoever you mention. Everything but the mentions and the work itself is optional — pick a project (autocomplete over every project you're in; defaults to this server's linked one), a priority, and a deadline if you have them.</p>
        <div class="params">
          <span class="p-name">mentions<span class="p-req">•</span></span><span class="p-desc">One or more @mentions.</span>
          <span class="p-name">work<span class="p-req">•</span></span><span class="p-desc">What the task is — becomes its title.</span>
          <span class="p-name">project</span><span class="p-desc">Which project. Defaults to this server's linked project.</span>
          <span class="p-name">priority</span><span class="p-desc">Low · Medium · High.</span>
          <span class="p-name">deadline</span><span class="p-desc">YYYY-MM-DD, optional.</span>
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

    <div class="note">Everything else — creating projects, requesting access, inviting teammates, changing a task's status, viewing the roadmap and activity log — lives on <a href="https://parabolaa.vercel.app/dashboard">the website</a>.</div>

    <footer>
      <span>Vertex — a Parabola integration</span>
      <span><a href="https://parabolaa.vercel.app/dashboard">Back to Parabola →</a></span>
    </footer>
  </main>
</div>
</body>
</html>`;

export async function GET() {
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
