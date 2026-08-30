import "server-only";
import { cache } from "react";
import { randomBytes } from "node:crypto";
import { eq, and, asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  organizations,
  roles,
  rolePermissions,
  organizationMembers,
  memberRoles,
  users,
  accessRequests,
} from "@/lib/db/schema";
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";
import { isRazorpayConfigured } from "@/lib/payments/razorpay";
import { seedDemoProject, ensureBotUsers } from "@/lib/demo/seed";

/**
 * Adds a user to an organization with its default ("Everyone") role, if
 * they aren't already a member. Shared by the Clerk-invite webhook
 * (app/api/webhooks/clerk/route.ts) and the shareable-invite-link flow
 * (app/join/[code]/page.tsx) so both paths join the same way.
 */
export async function joinOrganizationById(userId: string, organizationId: string) {
  const [existingMember] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);
  if (existingMember) return;

  const [member] = await db
    .insert(organizationMembers)
    .values({ organizationId, userId })
    .returning();

  const [everyoneRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.organizationId, organizationId), eq(roles.isDefault, true)))
    .limit(1);
  if (everyoneRole) {
    await db
      .insert(memberRoles)
      .values({ organizationMemberId: member.id, roleId: everyoneRole.id });
  }
}

export async function getOrCreateInviteCode(organizationId: string) {
  const [org] = await db
    .select({ inviteCode: organizations.inviteCode })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (org?.inviteCode) return org.inviteCode;

  const code = randomBytes(6).toString("base64url");
  await db
    .update(organizations)
    .set({ inviteCode: code })
    .where(eq(organizations.id, organizationId));
  return code;
}

export async function renameOrganization(organizationId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db
    .update(organizations)
    .set({ name: trimmed })
    .where(eq(organizations.id, organizationId));
}

// Cached per-request: multiple layouts/pages resolve the same user's orgs
// without each re-querying the DB. Real (non-demo) orgs sort first, so once
// someone has one, it — not their original demo workspace — becomes
// "primary" everywhere automatically (see getPrimaryOrganization).
export const getUserOrganizations = cache(async function getUserOrganizations(
  userId: string
) {
  return db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      paymentStatus: organizations.paymentStatus,
      isDemo: organizations.isDemo,
    })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id)
    )
    .where(eq(organizationMembers.userId, userId))
    .orderBy(asc(organizations.isDemo));
});

/**
 * A user can belong to multiple organizations in the data model, but the
 * app doesn't yet have org-scoped routing (that's a larger follow-up) — for
 * now, every org-aware page just resolves "the" organization as the first
 * one a user joined. Fine for the common single-org case this MVP targets.
 */
export async function getPrimaryOrganization(userId: string) {
  const orgs = await getUserOrganizations(userId);
  return orgs[0] ?? null;
}

/**
 * True once an admin has approved this user's access request and they
 * haven't already created their own real organization — gates the
 * "Create your organization" prompt in app/dashboard/layout.tsx.
 */
export async function canCreateOwnOrganization(userId: string) {
  const orgs = await getUserOrganizations(userId);
  if (orgs.some((o) => !o.isDemo)) return false;

  const [approved] = await db
    .select({ id: accessRequests.id })
    .from(accessRequests)
    .where(and(eq(accessRequests.userId, userId), eq(accessRequests.status, "approved")))
    .limit(1);
  return !!approved;
}

/**
 * Active users assignable to work items — scoped to the given organization's
 * members so demo/tenant users never see or assign work to strangers in
 * other organizations. Falls back to every active user for legacy projects
 * that predate organizations (organizationId null).
 */
export async function getOrganizationMemberUsers(organizationId: string | null) {
  if (!organizationId) {
    return db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.isActive, true));
  }
  return db
    .select({ id: users.id, name: users.name })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(users.isActive, true)
      )
    );
}

/**
 * Creates a new organization, its "Owner" role (all permissions) and
 * "Everyone" default role, and adds the creator as its first member holding
 * the Owner role. Payment enforcement is stubbed: without Razorpay keys
 * configured, the org is created already marked paid so the whole flow is
 * testable end to end (see lib/payments/razorpay.ts).
 */
export async function createOrganizationForUser(
  userId: string,
  name: string,
  slug: string
) {
  return db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({
        name,
        slug,
        createdBy: userId,
        paymentStatus: isRazorpayConfigured() ? "pending" : "paid",
      })
      .returning();

    const [ownerRole] = await tx
      .insert(roles)
      .values({
        organizationId: org.id,
        name: "Owner",
        isOwnerRole: true,
        position: 0,
      })
      .returning();

    await tx.insert(rolePermissions).values(
      ALL_PERMISSIONS.map((permissionKey) => ({
        roleId: ownerRole.id,
        permissionKey,
      }))
    );

    const [everyoneRole] = await tx
      .insert(roles)
      .values({
        organizationId: org.id,
        name: "Everyone",
        isDefault: true,
        position: 1,
      })
      .returning();

    await tx.insert(rolePermissions).values(
      DEFAULT_ROLE_PERMISSIONS.map((permissionKey) => ({
        roleId: everyoneRole.id,
        permissionKey,
      }))
    );

    const [member] = await tx
      .insert(organizationMembers)
      .values({ organizationId: org.id, userId })
      .returning();

    await tx.insert(memberRoles).values([
      { organizationMemberId: member.id, roleId: ownerRole.id },
      { organizationMemberId: member.id, roleId: everyoneRole.id },
    ]);

    return org;
  });
}

/**
 * Every new sign-up gets one of these automatically, no payment step: a
 * solo, sandboxed org pre-loaded with a bot-guided demo project. Upgrading
 * someone to a real paid org is a manual step for now (see
 * app/dashboard/request-access) — this is not wired to Razorpay.
 */
export async function createDemoOrganizationForUser(userId: string, name: string) {
  const slug = `demo-${userId.slice(0, 8)}`;
  const { nova, rex } = await ensureBotUsers();

  const org = await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({
        name: `${name}'s Demo Workspace`,
        slug,
        createdBy: userId,
        paymentStatus: "paid",
        isDemo: true,
      })
      .returning();

    const [ownerRole] = await tx
      .insert(roles)
      .values({
        organizationId: org.id,
        name: "Owner",
        isOwnerRole: true,
        position: 0,
      })
      .returning();

    await tx.insert(rolePermissions).values(
      ALL_PERMISSIONS.map((permissionKey) => ({
        roleId: ownerRole.id,
        permissionKey,
      }))
    );

    const [everyoneRole] = await tx
      .insert(roles)
      .values({
        organizationId: org.id,
        name: "Everyone",
        isDefault: true,
        position: 1,
      })
      .returning();

    await tx.insert(rolePermissions).values(
      DEFAULT_ROLE_PERMISSIONS.map((permissionKey) => ({
        roleId: everyoneRole.id,
        permissionKey,
      }))
    );

    const [member] = await tx
      .insert(organizationMembers)
      .values({ organizationId: org.id, userId })
      .returning();

    await tx.insert(memberRoles).values([
      { organizationMemberId: member.id, roleId: ownerRole.id },
      { organizationMemberId: member.id, roleId: everyoneRole.id },
    ]);

    const botMembers = await tx
      .insert(organizationMembers)
      .values([
        { organizationId: org.id, userId: nova.id },
        { organizationId: org.id, userId: rex.id },
      ])
      .returning();

    await tx.insert(memberRoles).values(
      botMembers.map((m) => ({ organizationMemberId: m.id, roleId: everyoneRole.id }))
    );

    return org;
  });

  await seedDemoProject(org.id, userId);

  return org;
}
