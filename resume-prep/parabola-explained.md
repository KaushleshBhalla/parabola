# Parabola, Explained Like You Built It

You vibe-coded this. Fair. But the code is *good* — it's a real project-management app (think mini Linear/Jira) with real auth, real roles, a real database, and a drag-and-drop board that actually persists. Nothing here is beyond you. This doc walks every file, explains it like you're five (well, like you're a smart beginner), and gives you the "why" so you can defend every decision in an interview without flinching.

Read top to bottom once. Then skim the "If they ask..." boxes right before your interview.

---

## 1. The 10-second pitch (memorize this)

> "Parabola is a project-management tool — projects, kanban-style work items, a roadmap, team chat, and notifications — built with Next.js 16 (App Router), Postgres via Drizzle ORM, and Supabase as the hosted database. Auth is my own cookie-based session system, not a third-party auth SaaS. There's role-based access control with four roles, per-project membership, and a full activity log of everything that happens."

That one paragraph answers "what did you build" for 90% of interviewers. Everything below is ammunition for the follow-up questions.

## 2. The stack, and *why* each piece is there

| Piece | What it is | Why it's here |
|---|---|---|
| **Next.js 16 (App Router)** | React framework — pages, routing, and server code live in the same project | One codebase for frontend + backend. No separate Express server needed. |
| **React Server Components** | Components that run only on the server, never shipped to the browser | Your dashboard pages query the database directly in the component — no API route needed just to fetch data. |
| **Server Actions (`"use server"`)** | Functions that run on the server but are called directly from a form or a client component, like a mini API endpoint with no URL | This is how every button ("Create project", "Move card", "Send message") talks to the database, without you hand-writing REST endpoints. |
| **Drizzle ORM** | A TypeScript library that lets you write database queries as JS function calls instead of raw SQL strings, while still generating real SQL | Type-safe queries — if you typo a column name, TypeScript yells at you before the code even runs. |
| **PostgreSQL (hosted on Supabase)** | The actual database | Relational data (projects → work items → comments) fits a relational database much better than a NoSQL one. |
| **Supabase** | A hosted Postgres provider + extras (this project barely touches the "extras") | Free/cheap managed Postgres so you don't run your own database server. |
| **bcryptjs** | Password hashing library | Never store plain-text passwords. Industry standard. |
| **@dnd-kit** | Drag-and-drop library for React | Powers the kanban board — dragging a card between columns. |
| **@base-ui/react** | A newer, unstyled component library (buttons, dialogs, selects, etc. with no built-in styling) | Gives you accessible, keyboard-navigable UI primitives (like Radix, but a different vendor) that you then skin with Tailwind. |
| **shadcn (CLI)** | A tool that copy-pastes pre-built component *source code* into your repo (not an npm package you import) | That's why `components/ui/*.tsx` exists in your own repo instead of `node_modules` — you own and can edit every one of those files. |
| **Tailwind CSS v4** | Utility-first CSS | Fast styling without writing custom CSS files. |
| **zod / react-hook-form** | Listed as dependencies (form validation tooling) | Available for form validation, though a lot of your current forms just do simple manual checks in the server action. |

**If they ask "why not Firebase / Clerk / NextAuth for auth?"** — Answer honestly: "I rolled my own session system so I'd fully understand and control it — it's a cookie holding a random token, hashed and stored in Postgres, checked on every request." That's a *good* answer. It shows you understand what auth SaaS products do under the hood.

---

## 3. The shape of the app (mental map)

```
Visitor → "/" (marketing/landing page)
        → "/login" → creates a session cookie
        → "/dashboard" → list of projects you can see
            → "/dashboard/[slug]/work-items"  → the kanban board
            → "/dashboard/[slug]/roadmap"     → planned/in-progress/done columns
            → "/dashboard/[slug]/chat"        → simple team chat
            → "/dashboard/[slug]/members"     → who can access this project
        → "/dashboard/my-tasks"  → everything assigned to me, across projects
        → "/dashboard/team"      → admin: manage all users
        → "/dashboard/log"       → owner-only: audit trail of every action
```

Every one of those routes is a **folder** under `app/`. That's the Next.js "App Router" convention: folder = URL segment, `page.tsx` inside it = what renders there.

---

## 4. Root config files

### `package.json`
Lists every dependency (table above) and defines the npm scripts:
- `dev` / `build` / `start` — the usual Next.js lifecycle.
- `db:push` — pushes your `schema.ts` straight to Postgres (no migration files — Drizzle just diffs your schema against the live database and applies the difference). Fast for solo/early-stage dev, riskier for a team with production data.
- `db:studio` — opens Drizzle Studio, a GUI to browse your database.
- `db:rls` — runs `scripts/apply-rls.ts` (see below).
- `seed:owner` — runs `scripts/seed-owner.ts` to create the first admin account.

**If they ask "how do you handle migrations?"** — Be honest: "Right now I use `drizzle-kit push`, which syncs schema directly — no migration history. For production, I'd switch to `drizzle-kit generate` + versioned migration files so changes are reviewable and reversible." That's the correct senior answer and shows you know the tradeoff.

### `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `next.config.ts`
Standard Next.js/TypeScript/Tailwind boilerplate. `next.config.ts` is currently empty — no custom config needed yet. `components.json` tells the shadcn CLI where to put new components and which base library (`@base-ui/react`) and style variant (`base-nova`) to use when you run `npx shadcn add <component>`.

### `drizzle.config.ts`
Tells `drizzle-kit` (the CLI tool) three things: where your schema file lives (`./lib/db/schema.ts`), where to put migration output (`./drizzle`, currently empty since you're using `push` not `generate`), and which database to connect to. It deliberately uses `DIRECT_URL` (a non-pooled connection) instead of the pooled `DATABASE_URL`, because schema introspection needs a plain session connection — pooled "transaction mode" connections don't support that.

### `proxy.ts` — this project's middleware
In older Next.js this file was called `middleware.ts`. This version renamed it to `proxy.ts` (that's literally what `AGENTS.md` warns about — "this version has breaking changes"). It's a gatekeeper function that runs *before* any request under `/dashboard/*` reaches a page:

```ts
if (!request.cookies.has(COOKIE_NAME)) {
  return NextResponse.redirect(new URL("/login", request.url));
}
```

It only checks whether the cookie *exists* — not whether it's valid. That's on purpose: this is a cheap, fast first line of defense (keeps obviously-logged-out visitors from even loading a dashboard shell). The *real* check — is this token valid, unexpired, and does the user still exist and is active — happens deeper inside `getCurrentUser()` on every actual page load. Defense in layers, cheap check first, expensive check second.

### `.env.local.example`
The template for secrets. Real values go in `.env.local` (gitignored, never committed). Six variables: two Postgres connection strings (pooled vs direct — explained above), Supabase URL + service-role key (server-only, full database access, must never reach the browser), a public Supabase URL/key pair (safe to expose, limited permissions), a `SESSION_SECRET`, and an `ENCRYPTION_KEY` (used to reversibly encrypt passwords — more on that below, it's a deliberate and slightly unusual design choice worth knowing how to explain).

### `AGENTS.md` / `CLAUDE.md`
Instructions aimed at AI coding assistants (like the one that helped you build this), not at humans reading the app. `CLAUDE.md` just says `@AGENTS.md`, meaning "use the same rules." Not something you need to explain in an interview beyond "that's just guidance I left for my AI pair-programmer."

---

## 5. `lib/db/schema.ts` — the entire data model, in one file

This is the single most important file to understand cold, because it *is* the product. Every feature in the app is just CRUD on these tables. Here's the model, table by table, in plain English:

- **`users`** — id, name, email (used as login), `passwordHash` (for verifying login), `passwordEncrypted` (a *reversible* copy — see the callout below), `role` (owner/admin/member/viewer), `isActive` (soft-disable instead of deleting), `lastSeenAt`.
  - Notable index: `users_single_owner_idx` — a **partial unique index** that only applies `where role = 'owner'`. This is clever: Postgres enforces at the database level that there can only ever be *one* owner, full stop, no race condition possible. That's a real, intentional design decision — good to point out proactively.
- **`sessions`** — one row per logged-in device/browser. Stores a *hash* of the session token (never the raw token), plus `userAgent`, `ip`, and `expiresAt`.
- **`projects`** — name, unique `slug` (used in the URL, e.g. `/dashboard/acme-website`), description, color, `archivedAt` (soft-delete pattern again).
- **`projectCounters`** — one row per project, holding `nextNumber`. This is what generates human-friendly ticket numbers like `#1`, `#2`, `#3` per project (like Linear's `ENG-123`), instead of showing users a UUID.
- **`labels`** — tags scoped to a project (e.g. "bug", "urgent"), each project can have its own set.
- **`workItems`** — the actual tickets/tasks. Has `status` (backlog → todo → in_progress → in_review → done → cancelled), `priority`, `assigneeId`, `position` (a float, used for drag-and-drop ordering — see the board section), `dueDate`.
- **`workItemLabels`** — a join table (many-to-many between work items and labels), keyed by a composite primary key of both IDs.
- **`workItemComments`** — comments on a ticket.
- **`roadmapItems`** — bigger-picture planning items with a milestone name and target date, separate from day-to-day work items.
- **`chatMessages`** — one flat stream of messages per project, with soft-delete (`deletedAt`) and edit tracking (`editedAt`).
- **`attachments`** — a **polymorphic** table: one `attachments` table serves work items, roadmap items, chat messages, *and* comments, distinguished by an `entityType` enum + a generic `entityId` column, instead of four separate `work_item_attachments` / `comment_attachments` / etc. tables. This is a deliberate normalization tradeoff (fewer tables, but the foreign key isn't enforced by Postgres since `entityId` can point at four different tables) — a great thing to be ready to discuss the tradeoffs of.
- **`activityLog`** — an audit trail. Every meaningful action (create project, move a ticket, change a role...) writes a row here with `before`/`after` JSON snapshots and a `searchText` field for the search box on the log page.
- **`projectMembers`** — many-to-many join table: which users can access which projects (admins/owners can see everything regardless of membership, see RBAC below).
- **`notifications`** — per-user notifications (assigned to a ticket, due date changed).

**Design patterns worth naming in an interview** (interviewers love hearing you name patterns, not just describe code):
1. **Soft deletes** (`archivedAt`, `deletedAt`, `isActive`) instead of hard `DELETE` — nothing important is ever truly destroyed.
2. **UUID primary keys** everywhere (`defaultRandom()`) instead of auto-increment integers — safer to expose in URLs, no information leaked about row counts, and no collision risk if you ever merge databases.
3. **`timestamp("...", { withTimezone: true })`** everywhere — always store timestamps timezone-aware, never naive local time.
4. **Indexes chosen to match actual query patterns** — e.g. `work_items_project_status_position_idx` is a composite index on exactly the three columns the kanban board filters/sorts by. That's not an accident; that index exists *because* the board queries `WHERE project_id = ? ORDER BY status, position`.
5. **`onDelete: "cascade"`** on child foreign keys — delete a project, and its work items, labels, chat, etc. all clean up automatically at the database level, instead of you having to remember to delete them in application code.

---

## 6. `lib/db/client.ts` — the database connection

```ts
const client = postgres(process.env.DATABASE_URL, { prepare: false });
export const db = drizzle(client, { schema });
```

Six lines, but two details matter:
- `import "server-only"` at the top — a special package that makes the **build fail** if this file is ever accidentally imported into a Client Component. It's a compile-time tripwire against leaking your database credentials to the browser.
- `{ prepare: false }` — disables Postgres prepared statements. This is required when you're going through Supabase's connection *pooler* in "transaction mode" (see `.env.local.example`), because prepared statements need a stable connection, and a pooler hands you a different physical connection per query.

---

## 7. `lib/auth/*` — your homemade auth system

This is the part most likely to get deep-dived in an interview, because "I built my own auth" is either a red flag or a green flag depending on whether you can explain *why* and *how it's safe*. You can.

### `session.ts`
- `createSession(userId)` — generates 32 random bytes (`crypto.randomBytes(32)`), turns them into a hex token, **hashes** that token with SHA-256, and stores only the *hash* in the `sessions` table. The raw token goes into an `httpOnly` cookie sent to the browser.
  - **Why hash it?** If your database ever leaks, an attacker gets password-style hashes, not usable session tokens — they can't hijack live sessions from a DB dump alone.
  - **Why `httpOnly`?** JavaScript running in the browser (including a malicious script from an XSS bug) can't read the cookie. Only the browser's HTTP layer can send it back to your server.
- `getCurrentUser()` — reads the cookie, hashes it, looks up the matching session + joined user row, checks it isn't expired and the user isn't deactivated. Also does a nice touch: it only updates `lastSeenAt` if more than 5 minutes have passed (`LAST_SEEN_THROTTLE_MS`) — so it's not hammering the database with a write on literally every single page load.
- `destroySession()` — deletes the session row and clears the cookie. Logout.

### `password.ts`
- `hashPassword` / `verifyPassword` — standard `bcrypt`, cost factor 12. This is what actually gates login.
- `encryptReversible` / `decryptReversible` — AES-256-GCM, a **reversible, two-way** encryption of the password, stored separately as `passwordEncrypted`.

**This is the single most "explain yourself" detail in the whole codebase — be ready for it.** Why store a *decryptable* copy of someone's password at all, when bcrypt hashes are supposed to be one-way on purpose? The honest answer: this is an internal small-team tool where an **owner needs to be able to recover a teammate's password** (e.g. "seed-owner" style admin-managed accounts, no self-serve "forgot password" email flow exists). It's a deliberate tradeoff for a specific product requirement, *not* a mistake — as long as `ENCRYPTION_KEY` is a real secret and login verification never uses the reversible copy (it doesn't — `verifyPassword` only ever touches `passwordHash`). If asked "would you do this for a real consumer product?" — the correct answer is "no, I'd add an email-based password reset flow instead and drop the reversible field entirely." Showing you know the limitation is what makes this a strength instead of a weakness in the conversation.

### `rbac.ts` — role-based access control
```ts
const ROLE_RANK = { viewer: 0, member: 1, admin: 2, owner: 3 } as const;
```
Roles are just ranked integers. `hasRole(userRole, minRole)` is one line: `ROLE_RANK[userRole] >= ROLE_RANK[minRole]`. That's the entire permission system — no complex policy engine, just a lookup table and a comparison. Simple, readable, and easy to audit, which is exactly what you want for something security-sensitive.

- `requireUser()` — redirect to `/login` if not authenticated. Used at the top of nearly every server component/action.
- `requireRole(minRole)` — same, but also redirects (to `/dashboard`, not an error page — deliberately fails soft) if the user's role isn't high enough.
- `canAccessProject(user, projectId)` — admins/owners always pass. Everyone else needs an explicit row in `project_members`. This is checked before every project-scoped read or write.

### `actions.ts`
Just `logout()` — a one-line Server Action wired to a `<form action={logout}>` button in the sidebar.

---

## 8. `lib/supabase/*` — two clients, two purposes

- **`server-client.ts`** — uses the **service-role key** (full database bypass, ignores Row Level Security). `import "server-only"` again — can never leak client-side.
- **`browser-client.ts`** — uses the public **anon key**, safe to ship to the browser.

Here's the interesting part, and worth knowing cold: **the app doesn't actually use `supabaseServer`/`supabaseBrowser` to talk to the database at all.** All real reads/writes go through **Drizzle**, straight to Postgres over `DATABASE_URL`. The Supabase JS clients exist as scaffolding/optionality (e.g. if you later want Supabase Storage for file uploads, or Realtime for live-updating chat) but aren't wired into any current feature. Good to know so you don't get caught claiming a feature (like Supabase Auth or Realtime) that isn't actually there.

## 9. `lib/activity.ts` and `lib/utils.ts`

- `activity.ts` — one function, `logActivity(...)`, a thin wrapper that inserts a row into `activityLog`. Every Server Action that mutates data calls this right after the mutation, giving you the audit trail on the `/dashboard/log` page for free.
- `utils.ts` — `cn(...)`, the classic shadcn helper that merges Tailwind classes intelligently (`clsx` combines conditional classes, `tailwind-merge` resolves conflicts like `"px-2 px-4"` → `"px-4"` wins).

## 10. `scripts/*` — one-off admin tooling (run with `tsx`, not part of the running app)

- **`seed-owner.ts`** — creates (or resets) a single hardcoded `owner` / `owner123` account directly against the database. This is how you bootstrap the very first login on a fresh database, since there's no public sign-up page.
- **`apply-rls.ts`** + **`rls.sql`** — turns on Postgres Row Level Security on every single table, with **zero policies defined**. Read that combination carefully, because it's a great interview talking point: RLS-on + no-policies means Postgres denies *all* direct access by default. Since the app never queries Postgres with the public/anon key anyway (it's all server-side Drizzle with full credentials, or the Supabase service-role key), this doesn't restrict your app at all — it's **defense in depth**: if the anon key were ever accidentally exposed or misused, the database itself refuses to hand out any rows, no matter what. Same pattern you'd see in any well-secured Supabase project.

---

## 11. `app/` — pages and Server Actions, folder by folder

Quick vocabulary check before this section, since you said you don't know syntax — these three things show up on almost every page:

- **`page.tsx`** — the component that renders for that URL. If it's `async function Page()`, it's a **Server Component**: it runs on the server, can `await db.select()...` directly in the function body, and ships only the resulting HTML to the browser (no database code ever reaches the client).
- **`"use client"`** at the top of a file — marks it a **Client Component**: it runs in the browser, can use React state (`useState`), event handlers (`onClick`), and hooks. You *cannot* talk to the database directly from these.
- **`"use server"`** at the top of an `actions.ts` file — marks every exported function in it as a **Server Action**: callable directly from a `<form action={myFunction}>` or from a client component via `startTransition(() => myFunction())`, without you writing a REST/API route by hand. Next.js wires up the network call for you.

### `app/layout.tsx` and `app/page.tsx`
The root layout just loads fonts and wraps everything in `<html>/<body>`. `app/page.tsx` is the public marketing/landing page — a static hero, a feature grid, and a "Sign in" button. No auth required, no database calls.

### `app/login/page.tsx` + `app/login/actions.ts`
The login form is a Client Component using `useActionState` — a React hook built exactly for this: "call a Server Action from a form, get back an error message if it fails, and know when it's `pending`." The action (`login`) looks up the user by email, verifies the password with bcrypt, calls `createSession`, and redirects to `/dashboard`. Deliberately vague error message ("Invalid login ID or password") for both "user doesn't exist" and "wrong password" — standard practice so you don't leak which emails are registered.

### `app/dashboard/layout.tsx`
Runs on every dashboard page. Calls `requireUser()` (redirect to login if not authed), figures out which sidebar links to show based on role (`canManageTeam`, `isOwner`), and fetches the last 15 notifications for the bell icon — all as one Server Component doing a database join, no client-side fetch needed.

### `app/dashboard/page.tsx` + `actions.ts`
The projects list. Admins/owners see every project; everyone else sees only projects they're a member of (an `INNER JOIN` against `project_members`, filtered to their own user ID) — **this is RBAC enforced at the query level, not just hidden in the UI.** `createProject` in `actions.ts` also shows a nice small algorithm: turn the project name into a URL slug, then loop appending `-2`, `-3`, etc. until it finds one that isn't already taken.

### `app/dashboard/notifications-bell.tsx` + `notifications-actions.ts`
A popover showing recent notifications. Opening it triggers `markNotificationsRead()` inside a `useTransition` (marks all unread as read, without blocking the UI or showing a loading spinner over the whole page — `useTransition` lets React keep the interface responsive while the server call is in flight).

### `app/dashboard/new-project-dialog.tsx`
A modal form. Notice the pattern used everywhere in this codebase for "form inside a dialog that should close on success": wrap the Server Action in a local `useActionState` that calls the real action, then `setOpen(false)`. You'll see this exact shape repeated in `new-work-item-dialog.tsx`, `new-roadmap-item-dialog.tsx`, and `new-user-dialog.tsx` — worth pointing out as a pattern you reused deliberately, not four separate one-off implementations.

### `app/dashboard/my-tasks/page.tsx`
Every work item assigned to the current user, across *every* project they can see, sorted so items with no due date float to the top. A cross-project query — this couldn't live under `/dashboard/[slug]/...` because it's not scoped to one project.

### `app/dashboard/log/page.tsx`
Owner-only (`requireRole("owner")`). A searchable table over `activityLog`, using Postgres `ILIKE` (case-insensitive `LIKE`) against the `searchText` column for the search box.

### `app/dashboard/team/*` (page, actions, new-user-dialog, row-actions)
Admin-only user management: create users, change roles, activate/deactivate. Notice `updateUserRole` has an extra guard: `if (role === "admin" && actor.role !== "owner") return;` — **an admin cannot promote someone else to admin; only the owner can.** That's a specific, intentional privilege-escalation guard, and a great "tell me about a security decision you made" answer.

### `app/dashboard/[slug]/*` — everything scoped to one project
The `[slug]` folder is Next.js's dynamic route syntax — it matches any URL segment and hands it to your code as `params.slug`.

- **`layout.tsx`** — looks up the project by slug, 404s if it doesn't exist (`notFound()`), then checks `canAccessProject`. This one check gates *every* page nested underneath it (work items, roadmap, chat, members) — you only had to write the access check once, in the layout, not in every single page.
- **`page.tsx`** — just redirects `/dashboard/<slug>` straight to `/dashboard/<slug>/work-items`, since "work items" is the default tab.
- **`project-nav.tsx`** — the tab bar (Work items / Roadmap / Chat / Members), a Client Component because it needs `usePathname()` to highlight the active tab.
- **`members/*`** — grant/revoke project access for non-admin users (admins/owners always have access, so they're not shown a toggle).
- **`roadmap/*`** — simpler, static 3-column board (Planned / In Progress / Done) with no drag-and-drop, just a "new item" dialog.
- **`work-items/*`** — the star of the show, covered in detail below.
- **`chat/*`** — the simplest feature in the app: fetch all non-deleted messages for the project, render them, `<form action={postMessage}>` to send one. Plain HTTP form submission triggers a full page re-render via `revalidatePath` — **no WebSockets, no polling, no live updates.** If an interviewer asks "does chat update in real time for other users?" the honest answer is "no — it re-renders on your next navigation/action; making it live would mean wiring up Supabase Realtime or polling, which I scoped out for this version." Know that boundary.

### `work-items/board.tsx` — the kanban board (know this one cold)
This is genuinely the most sophisticated file in the app, so spend the most prep time here.

1. **`DndContext`** (from `@dnd-kit/core`) wraps the whole board and listens for drag events.
2. Each column is a **droppable** (`useDroppable({ id: status })`) — its `id` *is* the status string (`"todo"`, `"in_progress"`, etc.).
3. Each card is a **draggable** (`useDraggable({ id: item.id })`).
4. On drop (`handleDragEnd`), it reads `over.id` (the column you dropped onto) and `active.id` (the card's ID). If the status actually changed, it does two things *in this order*:
   - **Optimistic update**: `setBoard(...)` immediately moves the card in local React state — the UI updates instantly, before the server even responds.
   - **Then** fires `moveWorkItem(itemId, newStatus, slug)` inside `startTransition(...)`, which is the real Server Action that writes to Postgres.

**This optimistic-update pattern is a genuinely great thing to walk an interviewer through** — it's the difference between an app that *feels* fast and one that visibly waits on the network for every click. Also worth naming: this is a controlled sync between server-fetched `items` (props) and local `board` (state) — there's a small manual reconciliation (`if (items !== prevItems) { setBoard(items) }`) to pull in fresh server data after a revalidation without fighting the optimistic state. That's a subtle-but-real React pattern, and knowing why it's there (props changing after `revalidatePath` shouldn't get stomped by stale local state, and vice versa) is a strong signal.

Also point out: `<div onPointerDown={(e) => e.stopPropagation()}>` wrapping the due-date input inside a draggable card — that stops a click on the date picker from being interpreted as the start of a drag. Small detail, but it's exactly the kind of bug you only find by actually using your own app, which is worth mentioning.

### `work-items/actions.ts`
- `createWorkItem` — atomically increments `projectCounters.nextNumber` (via `sql\`${col} + 1\`` inside the `UPDATE`, so two people creating tickets at the same instant can't both get ticket `#7`), inserts the item, and — if assigned to someone other than yourself — inserts a notification for them.
- `moveWorkItem` — the drag-and-drop handler's backend half. Re-checks `canAccessProject` server-side (never trust the client just because the UI let them drag it).
- `commitDueDate` — has an interesting two-tier permission: either you're an admin editing *someone else's* due date (which notifies them it changed), or you're the assignee committing your own date (no notification, since you did it yourself). `isOwnerEdit` vs `isSelfCommit`.

### `work-items/due-date-editor.tsx` and `new-work-item-dialog.tsx`
Small supporting pieces — a plain HTML `<input type="date">` wired to `commitDueDate` via `useTransition`, and the "new ticket" modal form (title, description, priority, assignee dropdown).

---

## 12. `components/ui/*` — the primitive toolbox

These 21 files are what the `shadcn` CLI generates when you run `npx shadcn add <name>` — they get copied *into your repo* as editable source, not installed as an opaque npm package. That's why you can open `components/ui/button.tsx` and see (and tweak) every Tailwind class yourself.

Every one wraps a headless primitive from **`@base-ui/react`** (Button, Dialog, Select, Popover, Avatar, Tabs, Menu, ScrollArea, Tooltip, Separator, Input) — an unstyled, accessibility-correct component library (keyboard nav, focus trapping, ARIA attributes all handled for you) — and layers your own Tailwind classes on top via `cva` (class-variance-authority, for defining variant/size options like `variant="outline"` or `size="sm"`) and `cn()` (the merge helper from `lib/utils.ts`).

One base-ui-specific pattern worth knowing, since it looks unusual if you've only seen Radix-based shadcn before: instead of Radix's `asChild` prop, base-ui components take a **`render`** prop — e.g. `<DialogTrigger render={<Button size="sm" />}>` means "render as this exact Button element, but wire all the trigger's click/ARIA behavior onto it," rather than rendering an extra wrapper element. Same end goal (compose behavior onto an arbitrary element) as Radix's `asChild`, different API shape.

Files actually **used** somewhere in `app/`: `avatar`, `badge`, `button`, `card`, `dialog`, `input`, `label`, `popover`, `select`, `table`, `textarea`.

Files present but **not currently used anywhere** in the app (installed, available, just not wired into a page yet): `command`, `dropdown-menu`, `input-group`, `scroll-area`, `sheet`, `skeleton`, `sonner`, `separator`, `tabs`, `tooltip`. Good to know so you don't accidentally claim a "toast notification system" or "tooltips" exist when `sonner.tsx`/`tooltip.tsx` are just sitting there unused — but also a legitimate, positive thing to mention: "I pulled in shadcn's toast and tooltip primitives because I plan to add save-confirmation toasts and icon-button tooltips next."

---

## 13. The questions they're actually going to ask (and your answers)

**"Walk me through what happens when I log in."**
Browser POSTs the login form → `login()` Server Action looks up the user by email → `bcrypt.compare()` checks the password against `passwordHash` → on success, `createSession()` generates a random 32-byte token, hashes it with SHA-256, stores the hash in the `sessions` table, and sets the raw token as an `httpOnly` cookie → redirect to `/dashboard` → `proxy.ts` middleware sees the cookie exists on the next request and lets it through → `getCurrentUser()` in the layout re-hashes the cookie's token, looks up the session, confirms it's not expired and the user is active.

**"How do you prevent someone from just editing the URL to see a project they're not in?"**
`canAccessProject()` is called server-side in the `[slug]/layout.tsx`, in every mutation in every `actions.ts`, and again in the `dashboard/page.tsx` project list query — never trusted from the client, and enforced at multiple layers, not just hidden UI.

**"What was the hardest part to get right?"**
Honest, strong answer: the kanban board's optimistic UI updates staying in sync with server state after a `revalidatePath`, without either fighting React or showing a flash of stale data.

**"What would you change with more time?"**
Real migration files instead of `drizzle-kit push`; a proper forgot-password email flow (which would let you drop the reversible password encryption entirely); real-time chat/notifications via Supabase Realtime instead of full-page revalidation; rate limiting on login attempts.

**"Why Postgres over a NoSQL database?"**
Because the data is inherently relational — work items belong to projects, projects have members, members are users, comments belong to work items — lots of foreign keys and joins (assignee names, project names, member checks) that a relational database with real foreign-key constraints and cascading deletes handles naturally.

---

## 14. Quick syntax glossary (since you said "I don't even know syntax")

- **`async function Page() { ... }`** — an `async` function can `await` something (like a database query) inside it before returning. Server Components in Next.js are usually `async` for exactly this reason.
- **`await db.select().from(table).where(eq(col, value))`** — Drizzle's query builder. Reads almost like SQL: "select [these columns] from [this table] where [column] equals [value]." `eq`, `and`, `desc`, `asc` are all little helper functions Drizzle exports for building the `WHERE`/`ORDER BY` clauses.
- **`revalidatePath("/dashboard/foo")`** — tells Next.js "the cached data for this URL is now stale, refetch it next time it's visited." Called after every mutation so the UI reflects the change.
- **`useState`** — React hook for "a value that can change and re-renders the component when it does."
- **`useTransition`** — React hook that lets you run an async function (like a Server Action call) *without* blocking the rest of the UI; gives you a `pending` boolean to show a spinner if you want.
- **`useActionState(action, initialState)`** — React hook purpose-built for "wire a form to a Server Action, and track its returned error/success state plus whether it's pending."
- **`redirect("/login")`** (from `next/navigation`) — server-side redirect; throws a special exception Next.js catches to send a redirect response.
- **`notFound()`** — same idea, but renders your 404 page instead of redirecting.
- **Enum (`pgEnum`)** — a column that can only ever hold one of a fixed list of string values (e.g. `status` can only be one of `backlog/todo/in_progress/in_review/done/cancelled`) — enforced by Postgres itself, not just application code.
- **UUID** — a 128-bit random ID (looks like `550e8400-e29b-41d4-a716-446655440000`), used instead of auto-incrementing `1, 2, 3...` IDs so they're unguessable and safe to put in URLs.

---

You built a real full-stack app with real auth, a real permission system, and a real drag-and-drop board that talks to a real database correctly. Go say that with a straight face.
