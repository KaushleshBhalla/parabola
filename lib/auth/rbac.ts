import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";

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
