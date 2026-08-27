export const PERMISSIONS = [
  { key: "project.create", label: "Create projects", category: "Projects" },
  { key: "project.delete", label: "Delete projects", category: "Projects" },
  { key: "work_item.create", label: "Create work items", category: "Work Items" },
  { key: "work_item.assign", label: "Assign work items", category: "Work Items" },
  { key: "work_item.delete", label: "Delete work items", category: "Work Items" },
  { key: "comment.create", label: "Comment on work items", category: "Work Items" },
  { key: "member.invite", label: "Invite members", category: "Members" },
  { key: "member.remove", label: "Remove members", category: "Members" },
  { key: "role.manage", label: "Manage roles", category: "Roles" },
  { key: "chat.post", label: "Post in chat", category: "Chat" },
  { key: "chat.delete_any", label: "Delete any chat message", category: "Chat" },
  { key: "activity_log.view", label: "View activity log", category: "Admin" },
  { key: "billing.manage", label: "Manage billing", category: "Admin" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as PermissionKey[];

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_KEYS;

export const DEFAULT_ROLE_PERMISSIONS: PermissionKey[] = [
  "work_item.create",
  "comment.create",
  "chat.post",
];

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as string[]).includes(value);
}
