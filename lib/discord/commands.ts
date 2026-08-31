// Discord application command definitions — the single source of truth used
// both by scripts/register-discord-commands.ts (to register them with
// Discord) and as a reference for the option shapes handlers.ts expects.
//
// Deliberately minimal: Discord is for day-to-day visibility, creating a
// task and assigning it, and reassigning work — nothing more. Creating
// projects, roles, and invites all stay website-only.

const STATUS_CHOICES = [
  { name: "Backlog", value: "backlog" },
  { name: "Todo", value: "todo" },
  { name: "In Progress", value: "in_progress" },
  { name: "Testing Pending", value: "in_review" },
  { name: "In Review", value: "review" },
  { name: "Done", value: "done" },
  { name: "Cancelled", value: "cancelled" },
];

const PRIORITY_CHOICES = [
  { name: "Low", value: "low" },
  { name: "Medium", value: "medium" },
  { name: "High", value: "high" },
];

// Option type numbers per Discord's API: 3 STRING, 4 INTEGER, 6 USER.
export const discordCommands = [
  {
    name: "guide",
    description: "Show every Parabola command and what it does.",
  },
  {
    name: "link",
    description: "Connect your Discord account to your Parabola login.",
  },
  {
    name: "setup",
    description: "Link this server to one of your Parabola projects.",
    options: [
      {
        name: "project",
        description: "Which project to link this server to",
        type: 3,
        required: true,
        autocomplete: true,
      },
    ],
  },
  {
    name: "task",
    description: "View work items in this server's linked project.",
    options: [
      {
        name: "list",
        description: "List work items.",
        type: 1,
        options: [
          { name: "status", description: "Filter by status", type: 3, required: false, choices: STATUS_CHOICES },
          { name: "assignee", description: "Filter by assignee", type: 6, required: false },
        ],
      },
      {
        name: "view",
        description: "Show a work item's full detail.",
        type: 1,
        options: [{ name: "id", description: "Task number", type: 4, required: true }],
      },
    ],
  },
  {
    name: "board",
    description: "See the whole work item board, or just one column.",
    options: [
      {
        name: "column",
        description: "Show just this column instead of the whole board",
        type: 3,
        required: false,
        choices: STATUS_CHOICES,
      },
    ],
  },
  {
    name: "assign",
    description: "Create a task and assign it to one or more people.",
    options: [
      { name: "mentions", description: "Mention everyone who should be assigned", type: 3, required: true },
      { name: "work", description: "What the task is", type: 3, required: true },
      {
        name: "project",
        description: "Which project (defaults to this server's linked project)",
        type: 3,
        required: false,
        autocomplete: true,
      },
      { name: "priority", description: "Priority", type: 3, required: false, choices: PRIORITY_CHOICES },
      { name: "deadline", description: "Deadline, YYYY-MM-DD", type: 3, required: false },
    ],
  },
  { name: "mytasks", description: "Your assigned tasks across every project, most urgent first." },
];
