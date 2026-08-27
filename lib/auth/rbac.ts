import "server-only";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db/client";
import {
  users,
  projectMembers,
  organizationMembers,
  memberRoles,
  roles,
  rolePermissions,
} from "@/lib/db/schema";
import type { PermissionKey } from "@/lib/permissions";

const ROLE_RANK = { viewer: 0, member: 1, admin: 2, owner: 3 } as const;
export type Role = keyof typeof ROLE_RANK;

export function hasRole(userRole: Role, minRole: Role) {
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole];
}

export async function requireUser() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/login");

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  if (existing) {
    if (!existing.isActive) redirect("/login");
    return existing;
  }

  // The Clerk webhook (app/api/webhooks/clerk/route.ts) usually links/creates
  // this row on sign-up, but webhook delivery isn't instant — a brand-new
  // user can hit a page before it arrives. Self-heal here instead of
  // bouncing them back to /login in a loop.
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId
  )?.emailAddress;
  if (!clerkUser || !email) redirect("/login");

  const [byEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (byEmail) {
    if (!byEmail.isActive) redirect("/login");
    const [linked] = await db
      .update(users)
      .set({ clerkUserId })
      .where(eq(users.id, byEmail.id))
      .returning();
    return linked;
  }

  const [created] = await db
    .insert(users)
    .values({
      clerkUserId,
      name:
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
        email,
      email,
      role: "member",
    })
    .returning();
  return created;
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

// ============ ORGANIZATION-SCOPED PERMISSIONS (Discord-style roles) ============

export async function getOrganizationMember(
  userId: string,
  organizationId: string
) {
  const [member] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);
  return member ?? null;
}

export async function hasPermission(
  userId: string,
  organizationId: string,
  permission: PermissionKey
): Promise<boolean> {
  const member = await getOrganizationMember(userId, organizationId);
  if (!member) return false;

  const grants = await db
    .select({
      permissionKey: rolePermissions.permissionKey,
      isOwnerRole: roles.isOwnerRole,
    })
    .from(memberRoles)
    .innerJoin(roles, eq(memberRoles.roleId, roles.id))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .where(eq(memberRoles.organizationMemberId, member.id));

  return grants.some(
    (g) => g.isOwnerRole || g.permissionKey === permission
  );
}

export async function requireOrganizationMember(organizationId: string) {
  const user = await requireUser();
  const member = await getOrganizationMember(user.id, organizationId);
  if (!member) redirect("/dashboard");
  return user;
}
