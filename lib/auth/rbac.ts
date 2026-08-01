import "server-only";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "./session";
import { db } from "@/lib/db/client";
import { projectMembers } from "@/lib/db/schema";

const ROLE_RANK = { viewer: 0, member: 1, admin: 2, owner: 3 } as const;
export type Role = keyof typeof ROLE_RANK;

export function hasRole(userRole: Role, minRole: Role) {
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole];
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(minRole: Role) {
  const user = await requireUser();
  if (!hasRole(user.role, minRole)) {
    redirect("/dashboard");
  }
  return user;
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
