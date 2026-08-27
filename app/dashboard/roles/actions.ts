"use server";

import { revalidatePath } from "next/cache";
import { eq, and, inArray } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db/client";
import {
  organizations,
  roles,
  rolePermissions,
  organizationMembers,
  memberRoles,
} from "@/lib/db/schema";
import { requireUser, hasPermission } from "@/lib/auth/rbac";
import { isPermissionKey, type PermissionKey } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

type ActionResult = { error: string } | undefined;

async function requireCanManageRoles(organizationId: string) {
  const user = await requireUser();
  if (!(await hasPermission(user.id, organizationId, "role.manage"))) {
    return { user, ok: false as const };
  }
  return { user, ok: true as const };
}

export async function inviteMember(
  organizationId: string,
  email: string
): Promise<ActionResult> {
  const { user, ok } = await requireCanManageRoles(organizationId);
  if (!ok) return { error: "You don't have permission to invite members." };
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { error: "Email is required." };

  const client = await clerkClient();
  await client.invitations.createInvitation({
    emailAddress: normalizedEmail,
    publicMetadata: { organizationId },
  });

  await logActivity({
    actorId: user.id,
    action: "organization.member_invited",
    entityType: "organization",
    entityId: organizationId,
    searchText: `Invited ${normalizedEmail} to the organization`,
  });

  revalidatePath("/dashboard/roles");
}

export async function createRole(
  organizationId: string,
  name: string,
  permissionKeys: string[]
): Promise<ActionResult> {
  const { user, ok } = await requireCanManageRoles(organizationId);
  if (!ok) return { error: "You don't have permission to manage roles." };
  const trimmed = name.trim();
  if (!trimmed) return { error: "Role name is required." };

  const validKeys = permissionKeys.filter(isPermissionKey) as PermissionKey[];

  const [role] = await db
    .insert(roles)
    .values({ organizationId, name: trimmed })
    .returning();

  if (validKeys.length > 0) {
    await db
      .insert(rolePermissions)
      .values(validKeys.map((permissionKey) => ({ roleId: role.id, permissionKey })));
  }

  await logActivity({
    actorId: user.id,
    action: "role.created",
    entityType: "role",
    entityId: role.id,
    after: { name: trimmed, permissions: validKeys },
    searchText: `Created role "${trimmed}"`,
  });

  revalidatePath("/dashboard/roles");
}

export async function updateRolePermissions(
  roleId: string,
  permissionKeys: string[]
): Promise<ActionResult> {
  const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!role) return { error: "Role not found." };
  if (role.isOwnerRole) return { error: "The Owner role can't be edited." };

  const { user, ok } = await requireCanManageRoles(role.organizationId);
  if (!ok) return { error: "You don't have permission to manage roles." };

  const validKeys = permissionKeys.filter(isPermissionKey) as PermissionKey[];

  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    if (validKeys.length > 0) {
      await tx
        .insert(rolePermissions)
        .values(validKeys.map((permissionKey) => ({ roleId, permissionKey })));
    }
  });

  await logActivity({
    actorId: user.id,
    action: "role.permissions_updated",
    entityType: "role",
    entityId: roleId,
    after: { permissions: validKeys },
    searchText: `Updated permissions for role "${role.name}"`,
  });

  revalidatePath("/dashboard/roles");
}

export async function deleteRole(roleId: string): Promise<ActionResult> {
  const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!role) return { error: "Role not found." };
  if (role.isOwnerRole || role.isDefault) {
    return { error: "The Owner and Everyone roles can't be deleted." };
  }

  const { user, ok } = await requireCanManageRoles(role.organizationId);
  if (!ok) return { error: "You don't have permission to manage roles." };

  await db.delete(roles).where(eq(roles.id, roleId));

  await logActivity({
    actorId: user.id,
    action: "role.deleted",
    entityType: "role",
    entityId: roleId,
    searchText: `Deleted role "${role.name}"`,
  });

  revalidatePath("/dashboard/roles");
}

export async function setMemberRoles(
  organizationMemberId: string,
  roleIds: string[]
): Promise<ActionResult> {
  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.id, organizationMemberId))
    .limit(1);
  if (!member) return { error: "Member not found." };

  const { user, ok } = await requireCanManageRoles(member.organizationId);
  if (!ok) return { error: "You don't have permission to manage roles." };

  // The Owner role is immutable and never touched by this generic picker —
  // otherwise anyone holding role.manage could grant themselves Owner, or
  // strip it from the organization's real owner. It can only be granted at
  // organization-creation time.
  const validRoles = roleIds.length
    ? await db
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.organizationId, member.organizationId),
            eq(roles.isOwnerRole, false),
            inArray(roles.id, roleIds)
          )
        )
    : [];

  await db.transaction(async (tx) => {
    await tx
      .delete(memberRoles)
      .where(
        and(
          eq(memberRoles.organizationMemberId, organizationMemberId),
          inArray(
            memberRoles.roleId,
            tx
              .select({ id: roles.id })
              .from(roles)
              .where(
                and(
                  eq(roles.organizationId, member.organizationId),
                  eq(roles.isOwnerRole, false)
                )
              )
          )
        )
      );
    if (validRoles.length > 0) {
      await tx.insert(memberRoles).values(
        validRoles.map((r) => ({
          organizationMemberId,
          roleId: r.id,
        }))
      );
    }
  });

  await logActivity({
    actorId: user.id,
    action: "member.roles_updated",
    entityType: "organization_member",
    entityId: organizationMemberId,
    after: { roleIds: validRoles.map((r) => r.id) },
    searchText: "Updated a member's roles",
  });

  revalidatePath("/dashboard/roles");
}

export async function removeMember(
  organizationMemberId: string
): Promise<ActionResult> {
  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.id, organizationMemberId))
    .limit(1);
  if (!member) return { error: "Member not found." };

  const [org] = await db
    .select({ createdBy: organizations.createdBy })
    .from(organizations)
    .where(eq(organizations.id, member.organizationId))
    .limit(1);
  if (org?.createdBy === member.userId) {
    return { error: "The organization's creator can't be removed." };
  }

  const { user, ok } = await requireCanManageRoles(member.organizationId);
  if (!ok) return { error: "You don't have permission to remove members." };

  await db
    .delete(organizationMembers)
    .where(eq(organizationMembers.id, organizationMemberId));

  await logActivity({
    actorId: user.id,
    action: "member.removed",
    entityType: "organization_member",
    entityId: organizationMemberId,
    searchText: "Removed a member from the organization",
  });

  revalidatePath("/dashboard/roles");
}
