import "server-only";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  organizations,
  roles,
  rolePermissions,
  organizationMembers,
  memberRoles,
  users,
} from "@/lib/db/schema";
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";
import { isRazorpayConfigured } from "@/lib/payments/razorpay";
import { seedDemoProject, ensureBotUsers } from "@/lib/demo/seed";

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

export async function getUserOrganizations(userId: string) {
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
    .where(eq(organizationMembers.userId, userId));
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
