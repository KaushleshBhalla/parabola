// Discord application command definitions — the single source of truth used
// both by scripts/register-discord-commands.ts (to register them with
// Discord) and as a reference for the option shapes handlers.ts expects.
//
// Deliberately minimal: Discord is for day-to-day visibility and reassigning
// work, nothing more. Creating organizations/projects, roles, invites, and
// changing a task's status all stay website-only.

const STATUS_CHOICES = [
  { name: "Backlog", value: "backlog" },
  { name: "Todo", value: "todo" },
  { name: "In Progress", value: "in_progress" },
  { name: "Testing Pending", value: "in_review" },
  { name: "Done", value: "done" },
  { name: "Cancelled", value: "cancelled" },
];

// Option type numbers per Discord's API: 3 STRING, 4 INTEGER, 6 USER.
export const discordCommands = [
  {
    name: "guide",
    description: "Get a link to the full Vertex guide.",
    options: [
      {
        name: "for",
        description: "Which part of the guide",
        type: 3,
        required: false,
        choices: [
          { name: "Admin setup", value: "admin" },
          { name: "Everyone (commands)", value: "user" },
        ],
      },
    ],
  },
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
    description: "View or reassign work items.",
    options: [
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
    ],
  },
  { name: "mytasks", description: "Your assigned tasks, most urgent first." },
];
