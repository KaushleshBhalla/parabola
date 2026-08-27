import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  organizations,
  roles,
  rolePermissions,
  organizationMembers,
  memberRoles,
} from "@/lib/db/schema";
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";
import { isRazorpayConfigured } from "@/lib/payments/razorpay";

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
    })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id)
    )
    .where(eq(organizationMembers.userId, userId));
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
