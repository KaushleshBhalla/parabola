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
  .badge.creator { background: var(--danger-soft); color: var(--danger); }
  .badge.everyone { background: var(--success-soft); color: var(--success); }
  .cmd-desc { color: var(--text-dim); font-size: 14px; margin: 10px 0 14px; }
  .params { display: grid; grid-template-columns: auto 1fr; gap: 5px 16px; font-size: 13px; margin-bottom: 14px; }
  .params .p-name { font-family: var(--mono); color: var(--text); white-space: nowrap; }
  .params .p-desc { color: var(--text-dim); }
  .params .p-req { color: var(--danger); font-size: 10px; vertical-align: super; }
  .maps-to { font-size: 12px; color: var(--text-faint); font-family: var(--mono); margin-bottom: 14px; }
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
  .embed .field { display: flex; gap: 6px; margin-top: 5px; font-size: 12px; }
  .embed .field b { color: var(--text-faint); font-weight: 600; min-width: 62px; }
  .event-card { display: flex; gap: 14px; padding: 14px 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); margin-bottom: 10px; align-items: flex-start; }
  .event-icon { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
  .event-title { font-weight: 700; font-size: 13.5px; margin-bottom: 2px; }
  .event-desc { font-size: 13px; color: var(--text-dim); }
  .event-trigger { font-family: var(--mono); font-size: 11px; color: var(--text-faint); margin-top: 4px; }
  .trouble-list { margin: 0; padding-left: 18px; color: var(--text-dim); font-size: 13px; display: flex; flex-direction: column; gap: 6px; }
  .trouble-list strong { color: var(--text); }
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
      <a class="nav-link" href="#task-new"><span class="hash">/</span>task new</a>
      <a class="nav-link" href="#task-list"><span class="hash">/</span>task list</a>
      <a class="nav-link" href="#task-view"><span class="hash">/</span>task view</a>
      <a class="nav-link" href="#task-assign"><span class="hash">/</span>task assign</a>
      <a class="nav-link" href="#task-move"><span class="hash">/</span>task move</a>
      <a class="nav-link" href="#task-comment"><span class="hash">/</span>task comment</a>
      <a class="nav-link" href="#task-score"><span class="hash">/</span>task score</a>
      <a class="nav-link" href="#mytasks"><span class="hash">/</span>mytasks</a>
    </div>
    <div class="nav-group">
      <span class="nav-label">Team &amp; projects</span>
      <a class="nav-link" href="#projects"><span class="hash">/</span>projects</a>
      <a class="nav-link" href="#teamtasks"><span class="hash">/</span>teamtasks</a>
      <a class="nav-link" href="#roadmap"><span class="hash">/</span>roadmap</a>
      <a class="nav-link" href="#activity"><span class="hash">/</span>activity</a>
    </div>
    <div class="nav-group">
      <span class="nav-label">Organization</span>
      <a class="nav-link" href="#roles"><span class="hash">/</span>roles</a>
      <a class="nav-link" href="#invite"><span class="hash">/</span>invite</a>
      <a class="nav-link" href="#notifications"><span class="hash">/</span>notifications</a>
    </div>
    <div class="nav-group">
      <span class="nav-label">Passive events</span>
      <a class="nav-link" href="#events"><span class="hash">#</span>Automatic messages</a>
    </div>
  </nav>

  <main>
    <div class="intro">
      <span class="eyebrow"><span class="dot"></span>VERTEX IS LIVE</span>
      <h1 class="title">Vertex</h1>
      <p class="lede">Parabola, wherever your team already is. Every command below works right now, in any Discord server that's been set up — creating tasks, assigning work, scoring quality, checking the roadmap, all without leaving chat.</p>
      <div class="stat-row">
        <div class="stat"><b>17</b><span>Slash commands</span></div>
        <div class="stat"><b>4</b><span>Automatic notifications</span></div>
        <div class="stat"><b>1:1</b><span>Server ↔ organization</span></div>
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
          <span class="cmd-syntax">/setup <span class="opt">org:&lt;name&gt;</span></span>
          <span class="badge perm">Requires role.manage</span>
        </div>
        <p class="cmd-desc">Run this once, in the server, as whoever manages roles for your Parabola organization. It links the whole server to that organization — nobody has to specify which org again, ever.</p>
        <div class="params">
          <span class="p-name">org</span><span class="p-desc">The Parabola organization's name or slug.</span>
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
      <p class="category-desc">The board, without leaving chat. Every <code class="mono">/task</code> command operates on your linked organization's projects.</p>

      <div class="cmd-card" id="task-new">
        <div class="cmd-head">
          <span class="cmd-syntax">/task new <span class="opt">project title [assignees] [priority] [due]</span></span>
          <span class="badge everyone">Project members</span>
        </div>
        <p class="cmd-desc">Creates a work item straight into Backlog. Assigning it to someone (yourself included) is optional — but the moment you do, a deadline becomes required, same rule as the board.</p>
        <div class="params">
          <span class="p-name">project<span class="p-req">•</span></span><span class="p-desc">Which project.</span>
          <span class="p-name">title<span class="p-req">•</span></span><span class="p-desc">The task title.</span>
          <span class="p-name">assignees</span><span class="p-desc">Mention one or more teammates: <code>@nova @kaushlesh</code>.</span>
          <span class="p-name">priority</span><span class="p-desc">None · Low · Medium · High · Urgent.</span>
          <span class="p-name">due</span><span class="p-desc">Deadline — required once assignees is set.</span>
        </div>
        <div class="exchange">
          <div class="msg">
            <div class="avatar user">K</div>
            <div class="msg-body"><span class="msg-name">Kaushlesh</span><span class="msg-text">/task new project:Bug Tracker title:"Checkout crashes on Safari" assignees:@nova priority:Urgent due:2026-09-02</span></div>
          </div>
          <div class="msg">
            <div class="avatar bot">V</div>
            <div class="msg-body">
              <span class="msg-name">Vertex<span class="tag">BOT</span></span>
              <div class="embed"><strong>#14 Checkout crashes on Safari</strong>Created in Bug Tracker · Backlog
                <div class="field"><b>Assignee</b>Nova</div>
                <div class="field"><b>Priority</b>Urgent</div>
                <div class="field"><b>Due</b>Sep 2</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="cmd-card" id="task-list">
        <div class="cmd-head">
          <span class="cmd-syntax">/task list <span class="opt">[project] [status] [assignee]</span></span>
          <span class="badge everyone">Project members</span>
        </div>
        <p class="cmd-desc">A filtered slice of the board as a compact list — narrow it to one project, one status column, or one person's queue.</p>
        <div class="params">
          <span class="p-name">project</span><span class="p-desc">Limit to one project.</span>
          <span class="p-name">status</span><span class="p-desc">Backlog · Todo · In Progress · Testing Pending · Done · Cancelled.</span>
          <span class="p-name">assignee</span><span class="p-desc">Limit to one teammate's tasks.</span>
        </div>
      </div>

      <div class="cmd-card" id="task-view">
        <div class="cmd-head">
          <span class="cmd-syntax">/task view <span class="opt">project id</span></span>
          <span class="badge everyone">Project members</span>
        </div>
        <p class="cmd-desc">The full detail view — description, every assignee, priority, due date, quality score if it's been scored, and the last few comments.</p>
        <div class="params">
          <span class="p-name">project<span class="p-req">•</span></span><span class="p-desc">Which project the task is in.</span>
          <span class="p-name">id<span class="p-req">•</span></span><span class="p-desc">The task number, e.g. <code>14</code>.</span>
        </div>
      </div>

      <div class="cmd-card" id="task-assign">
        <div class="cmd-head">
          <span class="cmd-syntax">/task assign <span class="opt">project id mentions [due]</span></span>
          <span class="badge everyone">Project members</span>
        </div>
        <p class="cmd-desc">Sets who's on a task — replaces the current assignee list with whoever you mention, so re-running it is how you add or remove someone. You can assign it to yourself.</p>
        <div class="params">
          <span class="p-name">mentions<span class="p-req">•</span></span><span class="p-desc">One or more @mentions.</span>
          <span class="p-name">due</span><span class="p-desc">Required whenever the list is non-empty.</span>
        </div>
      </div>

      <div class="cmd-card" id="task-move">
        <div class="cmd-head">
          <span class="cmd-syntax">/task move <span class="opt">project id status</span></span>
          <span class="badge everyone">Project members</span>
        </div>
        <p class="cmd-desc">Changes a task's column. Moving something to Cancelled quietly notifies whoever created it — no extra step needed.</p>
      </div>

      <div class="cmd-card" id="task-comment">
        <div class="cmd-head">
          <span class="cmd-syntax">/task comment <span class="opt">project id message</span></span>
          <span class="badge everyone">Project members</span>
        </div>
        <p class="cmd-desc">Adds a comment to a task's thread — the same thread that shows up when anyone opens it on the board.</p>
      </div>

      <div class="cmd-card" id="task-score">
        <div class="cmd-head">
          <span class="cmd-syntax">/task score <span class="opt">project id score</span></span>
          <span class="badge creator">Creator only</span>
        </div>
        <p class="cmd-desc">Rates a finished task 1–10. Only works once the task has reached Done, and only the person who created it can score it.</p>
      </div>

      <div class="cmd-card" id="mytasks">
        <div class="cmd-head">
          <span class="cmd-syntax">/mytasks</span>
          <span class="badge everyone">Everyone</span>
        </div>
        <p class="cmd-desc">Your own queue, sorted the same way the My Tasks page sorts it — overdue first, then due soon, then everything else.</p>
      </div>
    </section>

    <section class="category" id="team-heading">
      <div class="category-head"><h2>Team &amp; projects</h2></div>
      <p class="category-desc">Zoomed-out views — what exists, what's shipping, and what's already happened.</p>

      <div class="cmd-card" id="projects">
        <div class="cmd-head"><span class="cmd-syntax">/projects</span><span class="badge everyone">Everyone</span></div>
        <p class="cmd-desc">Lists every project in your linked organization.</p>
      </div>

      <div class="cmd-card" id="teamtasks">
        <div class="cmd-head"><span class="cmd-syntax">/teamtasks</span><span class="badge everyone">Everyone</span></div>
        <p class="cmd-desc">The Team Tasks dashboard as an embed — assigned, overdue, due soon, and done counts, broken down by project.</p>
      </div>

      <div class="cmd-card" id="roadmap">
        <div class="cmd-head"><span class="cmd-syntax">/roadmap <span class="opt">[project]</span></span><span class="badge everyone">Everyone</span></div>
        <p class="cmd-desc">Milestones and their status, grouped the same way as the Roadmap tab.</p>
      </div>

      <div class="cmd-card" id="activity">
        <div class="cmd-head"><span class="cmd-syntax">/activity <span class="opt">[project]</span></span><span class="badge everyone">Everyone</span></div>
        <p class="cmd-desc">The last 10 entries from the activity log — who did what, most recent first.</p>
      </div>
    </section>

    <section class="category" id="org-heading">
      <div class="category-head"><h2>Organization</h2></div>
      <p class="category-desc">The Discord-style role system, from the server it's inspired by.</p>

      <div class="cmd-card" id="roles">
        <div class="cmd-head">
          <span class="cmd-syntax">/roles list</span>
          <span class="cmd-syntax" style="margin-top:4px">/roles assign <span class="opt">user role</span></span>
          <span class="badge perm">Assign requires role.manage</span>
        </div>
        <p class="cmd-desc">List every role and who holds it, or grant one to a teammate — the same roles from your Roles page, now assignable without opening a browser.</p>
      </div>

      <div class="cmd-card" id="invite">
        <div class="cmd-head"><span class="cmd-syntax">/invite</span><span class="badge perm">Requires role.manage</span></div>
        <p class="cmd-desc">Posts the organization's join link — the same one from the Pro checklist's "Copy invite link."</p>
      </div>

      <div class="cmd-card" id="notifications">
        <div class="cmd-head"><span class="cmd-syntax">/notifications</span><span class="badge everyone">Everyone</span></div>
        <p class="cmd-desc">Your unread notifications — assignments, due-date changes, cancellations — the same feed as the bell icon.</p>
      </div>
    </section>

    <section class="category" id="events">
      <div class="category-head"><h2>Automatic messages</h2></div>
      <p class="category-desc">Vertex also speaks up on its own, without anyone asking.</p>

      <div class="event-card">
        <div class="event-icon" style="background:var(--success-soft);color:var(--success)">✓</div>
        <div><div class="event-title">You were assigned a task</div><div class="event-desc">Sent the moment someone adds you to a task, with its title, priority and due date.</div></div>
      </div>
      <div class="event-card">
        <div class="event-icon" style="background:var(--danger-soft);color:var(--danger)">✕</div>
        <div><div class="event-title">Your task was cancelled</div><div class="event-desc">Sent to a task's creator the moment anyone moves it to Cancelled.</div></div>
      </div>
      <div class="event-card">
        <div class="event-icon" style="background:var(--warning-soft);color:var(--warning)">⏰</div>
        <div><div class="event-title">Due date changed</div><div class="event-desc">Sent when someone with permission edits your deadline for you.</div></div>
      </div>
      <div class="event-card">
        <div class="event-icon" style="background:var(--accent-soft);color:var(--accent)">✦</div>
        <div><div class="event-title">Someone requested Pro access</div><div class="event-desc">Posted to your admin channel whenever the Request Access form is submitted.</div></div>
      </div>
    </section>

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
