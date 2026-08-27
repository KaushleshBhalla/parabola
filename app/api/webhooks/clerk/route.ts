import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { eq, and } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { users, organizationMembers, roles, memberRoles } from "@/lib/db/schema";

async function joinOrganization(userId: string, organizationId: string) {
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
    .where(
      and(eq(roles.organizationId, organizationId), eq(roles.isDefault, true))
    )
    .limit(1);
  if (everyoneRole) {
    await db
      .insert(memberRoles)
      .values({ organizationMemberId: member.id, roleId: everyoneRole.id });
  }
}

export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  if (evt.type === "user.created") {
    const clerkUser = evt.data;
    const email = clerkUser.email_addresses
      .find((e) => e.id === clerkUser.primary_email_address_id)
      ?.email_address?.toLowerCase();
    const invitedOrgId =
      typeof clerkUser.public_metadata?.organizationId === "string"
        ? clerkUser.public_metadata.organizationId
        : null;

    if (email) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      let userId: string;
      if (existing) {
        await db
          .update(users)
          .set({ clerkUserId: clerkUser.id })
          .where(eq(users.id, existing.id));
        userId = existing.id;
      } else {
        const [created] = await db
          .insert(users)
          .values({
            clerkUserId: clerkUser.id,
            name:
              [clerkUser.first_name, clerkUser.last_name]
                .filter(Boolean)
                .join(" ") || email,
            email,
            role: "member",
          })
          .returning();
        userId = created.id;
      }

      if (invitedOrgId) {
        await joinOrganization(userId, invitedOrgId);
      }
    }
  }

  return new Response("OK", { status: 200 });
}
