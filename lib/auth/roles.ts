import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projectMembers } from "@/lib/db/schema";

// Deliberately Clerk-free — kept separate from lib/auth/rbac.ts so callers
// that only need role/project-access checks (notably the Discord
// interactions route) don't drag the entire Clerk SDK into their bundle
// just by importing rbac.ts. That bundle bloat was adding real seconds to
// the route's cold start, which matters a lot against Discord's 3-second
// interaction ACK deadline. rbac.ts re-exports everything here so existing
// website imports are unaffected.

const ROLE_RANK = { viewer: 0, member: 1, admin: 2, owner: 3 } as const;
export type Role = keyof typeof ROLE_RANK;

export function hasRole(userRole: Role, minRole: Role) {
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole];
}

export async function canAccessProject(
  user: { id: string; role: Role },
  projectId: string
) {
  if (hasRole(user.role, "admin")) return true;

  const [row] = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, user.id)
      )
    )
    .limit(1);

  return !!row;
}
