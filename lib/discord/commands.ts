// Discord application command definitions — the single source of truth used
// both by scripts/register-discord-commands.ts (to register them with
// Discord) and as a reference for the option shapes handlers.ts expects.

const STATUS_CHOICES = [
  { name: "Backlog", value: "backlog" },
  { name: "Todo", value: "todo" },
  { name: "In Progress", value: "in_progress" },
  { name: "Testing Pending", value: "in_review" },
  { name: "Done", value: "done" },
  { name: "Cancelled", value: "cancelled" },
];

const PRIORITY_CHOICES = [
  { name: "None", value: "none" },
  { name: "Low", value: "low" },
  { name: "Medium", value: "medium" },
  { name: "High", value: "high" },
  { name: "Urgent", value: "urgent" },
];

// Option type numbers per Discord's API: 3 STRING, 4 INTEGER, 6 USER.
export const discordCommands = [
  {
    name: "link",
    description: "Connect your Discord account to your Parabola login.",
  },
  {
    name: "setup",
    description: "Link this server to a Parabola organization (requires role.manage).",
    options: [
      { name: "org", description: "The organization name or slug", type: 3, required: true },
    ],
  },
  {
    name: "task",
    description: "Manage work items.",
    options: [
      {
        name: "new",
        description: "Create a work item.",
        type: 1,
        options: [
          { name: "project", description: "Project name", type: 3, required: true },
          { name: "title", description: "Task title", type: 3, required: true },
          { name: "assignees", description: "Mention one or more teammates", type: 3, required: false },
          { name: "priority", description: "Priority", type: 3, required: false, choices: PRIORITY_CHOICES },
          { name: "due", description: "Deadline, YYYY-MM-DD (required if assigning)", type: 3, required: false },
        ],
      },
      {
        name: "list",
        description: "List work items.",
        type: 1,
        options: [
          { name: "project", description: "Project name", type: 3, required: false },
          { name: "status", description: "Filter by status", type: 3, required: false, choices: STATUS_CHOICES },
          { name: "assignee", description: "Filter by assignee", type: 6, required: false },
        ],
      },
      {
        name: "view",
        description: "Show a work item's full detail.",
        type: 1,
        options: [
          { name: "project", description: "Project name", type: 3, required: true },
          { name: "id", description: "Task number", type: 4, required: true },
        ],
      },
      {
        name: "assign",
        description: "Set who's assigned to a task.",
        type: 1,
        options: [
          { name: "project", description: "Project name", type: 3, required: true },
          { name: "id", description: "Task number", type: 4, required: true },
          { name: "mentions", description: "Mention everyone who should be assigned", type: 3, required: true },
          { name: "due", description: "Deadline, YYYY-MM-DD", type: 3, required: false },
        ],
      },
      {
        name: "move",
        description: "Change a task's status.",
        type: 1,
        options: [
          { name: "project", description: "Project name", type: 3, required: true },
          { name: "id", description: "Task number", type: 4, required: true },
          { name: "status", description: "New status", type: 3, required: true, choices: STATUS_CHOICES },
        ],
      },
      {
        name: "comment",
        description: "Add a comment to a task.",
        type: 1,
        options: [
          { name: "project", description: "Project name", type: 3, required: true },
          { name: "id", description: "Task number", type: 4, required: true },
          { name: "message", description: "Your comment", type: 3, required: true },
        ],
      },
      {
        name: "score",
        description: "Rate a finished task 1-10 (creator only).",
        type: 1,
        options: [
          { name: "project", description: "Project name", type: 3, required: true },
          { name: "id", description: "Task number", type: 4, required: true },
          { name: "score", description: "1-10", type: 4, required: true, min_value: 1, max_value: 10 },
        ],
      },
    ],
  },
  { name: "mytasks", description: "Your assigned tasks, most urgent first." },
  { name: "projects", description: "List projects in this server's organization." },
  { name: "teamtasks", description: "Team-wide task stats by project." },
  {
    name: "roadmap",
    description: "Show roadmap milestones.",
    options: [{ name: "project", description: "Project name", type: 3, required: false }],
  },
  {
    name: "activity",
    description: "Recent activity log entries.",
    options: [{ name: "project", description: "Project name", type: 3, required: false }],
  },
  {
    name: "roles",
    description: "Manage Discord-style organization roles.",
    options: [
      { name: "list", description: "List roles and their members.", type: 1 },
      {
        name: "assign",
        description: "Grant a role to a teammate (requires role.manage).",
        type: 1,
        options: [
          { name: "user", description: "Teammate to grant the role to", type: 6, required: true },
          { name: "role", description: "Role name", type: 3, required: true },
        ],
      },
    ],
  },
  { name: "invite", description: "Get this organization's invite link (requires role.manage)." },
  { name: "notifications", description: "Your unread notifications." },
];
