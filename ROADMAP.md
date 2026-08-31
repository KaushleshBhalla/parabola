# Parabola Roadmap

Parabola is a project management system built chat-native from the ground up — not a dashboard with notification webhooks bolted on. This document tracks what's live today, what's next, and the differentiation bets we're making on where the product goes.

**Honest framing:** connecting a PM tool to chat apps isn't unclaimed territory — ClickUp pushes notifications to Discord, and tools like Delegram already run task management through WhatsApp/Telegram. What's differentiated here isn't "we connect to chat apps," it's *how deep* that connection goes: full bidirectional task management from inside the channel, one consistent data model across every channel instead of three bolted-on integrations, and an agent layer that reads context instead of waiting for commands.

---

## Live Today

- Core work-item board with drag-and-drop, status workflow, roadmap view
- RBAC (roles, project-level access control)
- Admin panel, activity log, notifications
- **Discord integration** — bidirectional: slash commands, status-gated board transitions, `/board` and `/guide` commands, not just outbound notifications

## Near-Term

- **WhatsApp integration** — task visibility and updates via WhatsApp, matching the depth already live in Discord (not yet started in the codebase)
- **Telegram integration** — same bar: real task management, not just alerts

## Differentiation Ideas

These are the ideas that make the multi-channel angle a genuine wedge rather than a checkbox feature. Ordered roughly by build complexity, lowest first.

### 1. Reply-to-close (natural language status updates)
Instead of requiring slash commands, parse natural replies in-channel ("done, pushed the fix") into status changes. Removes the context switch of leaving chat to update a dashboard. Harder to build than a command parser (needs real intent parsing), which is also what makes it harder to copy quickly.

### 2. Workload nudges delivered where people already are
Push workload alerts ("6 open items, 2 overdue, 1 blocking someone else") as a DM in whatever channel the person actually uses, instead of a dashboard nobody opens. Resource overload is one of the most commonly cited PM tool complaints — solving it by meeting people in their existing habit, not adding a new one.

### 3. Blocker escalation routed to the right channel
If Task A is blocked on Task B, escalate to Task B's owner through whichever channel they're actually active on — not a generic email that gets ignored. Targets the "missed dependencies causing cascading blockers" pattern that shows up repeatedly in PM tool research as a top-three deal-breaker.

### 4. Silent standups
Auto-generate a daily digest from status changes and chat activity already happening across channels — no live meeting, no manual "what did you do yesterday" ritual. Posted back into the channel the team actually lives in.

### 5. Cross-channel thread merging
When one task gets discussed across a Discord thread, a WhatsApp DM, and a Telegram group, pull every mention into one summarized activity log on the task itself. Existing summarization tools work within one platform — merging context *across* three is the harder, less-copied version of this.

### 6. Cross-channel identity resolution
Someone is `@handle` on Discord, a phone number on WhatsApp, and a different `@handle` on Telegram. Merge one person's activity across all three into a single accurate profile and workload view. Fiddly, unglamorous, and exactly the kind of infrastructure work competitors tend to skip — which is what makes it a real moat if done well.

---

## AI Agent Layer — Context-Aware Work Item Suggestions

**The core idea:** agents read context across every connected channel and suggest new work items to assignors, instead of requiring someone to manually create a task from a scattered conversation.

Current AI in PM tools (ClickUp, Asana, Notion) is assistive, not autonomous — it drafts and suggests, it doesn't decide unsupervised. That's the appetite to build for. Specifically:

- **Sourced suggestions only.** Every proposed work item shows the exact excerpt it was pulled from. No black-box task creation — the assignor can verify the source before accepting.
- **Duplicate detection before suggesting.** Check semantic similarity (not just keyword match) against the existing backlog before proposing a new item; merge into an existing task or flag as a possible duplicate instead of creating clutter.
- **Dependency inference, not just task creation.** When the agent reads "waiting on the API before I can start the frontend," it proposes a *dependency link* between tasks, not just a flat new item. Directly targets the missed-dependency problem above.
- **Load-aware assignee suggestions.** Combine with workload visibility (see #2 above) — suggest an assignee based on real current load across all channels, not just whoever was mentioned in the conversation.
- **Human review queue, never silent auto-creation.** The agent proposes; a human approves, edits, or dismisses. A daily digest ("found 4 possible tasks across your channels — review here") is the trustworthy version of this. Autonomous, unreviewed ticket creation is both outside current market appetite and a fast way to fill the backlog with noise.

---

## Positioning Note

The claim we make publicly should stay: *"Parabola syncs project state bidirectionally with Discord — not just notifications, full task management from inside the chat. WhatsApp and Telegram are next."* Overclaiming shipped multi-channel support before it's built erodes trust faster than it builds momentum.
