import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

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

    if (email) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existing) {
        await db
          .update(users)
          .set({ clerkUserId: clerkUser.id })
          .where(eq(users.id, existing.id));
      } else {
        await db.insert(users).values({
          clerkUserId: clerkUser.id,
          name:
            [clerkUser.first_name, clerkUser.last_name]
              .filter(Boolean)
              .join(" ") || email,
          email,
          role: "member",
        });
      }
      // Project membership is granted directly by a project admin (by email,
      // from that project's Members page) — signup no longer auto-joins
      // anything via Clerk invite metadata.
    }
  }

  return new Response("OK", { status: 200 });
}
