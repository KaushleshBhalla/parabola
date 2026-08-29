import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { joinOrganizationById } from "@/lib/organizations";

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
        await joinOrganizationById(userId, invitedOrgId);
      }
    }
  }

  return new Response("OK", { status: 200 });
}
