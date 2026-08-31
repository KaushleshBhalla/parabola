import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { hasRole, canAccessProject, type Role } from "./roles";

// Re-exported for every existing website import site — the Clerk-free
// pieces now live in lib/auth/roles.ts (see its header comment for why).
export { hasRole, canAccessProject, type Role };

// Cached per-request: layouts, nested pages, and actions in the same
// render/action all resolve the same user without re-querying the DB.
export const requireUser = cache(async function requireUser() {
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
  const email = clerkUser?.emailAddresses
    .find((e) => e.id === clerkUser.primaryEmailAddressId)
    ?.emailAddress?.toLowerCase();
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

  try {
    const [created] = await db
      .insert(users)
      .values({
        clerkUserId,
        name:
          [clerkUser.firstName, clerkUser.lastName]
            .filter(Boolean)
            .join(" ") || email,
        email,
        role: "member",
      })
      .returning();
    return created;
  } catch {
    // Concurrent first requests can both reach here for the same brand-new
    // user; the loser hits the unique email/clerk_user_id constraint. Fall
    // back to whichever row the winner created instead of erroring out.
    const [raceWinner] = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1);
    if (raceWinner) return raceWinner;
    throw new Error("Failed to create or find user account.");
  }
});

export async function requireRole(minRole: Role) {
  const user = await requireUser();
  if (!hasRole(user.role, minRole)) {
    redirect("/dashboard");
  }
  return user;
}

// Gates /admin — the site operator's own tooling (granting Pro, etc.), not
// tied to any organization's Discord-style "Owner" role or to the legacy
// owner/admin/member/viewer tier above.
export async function requirePlatformAdmin() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) {
    redirect("/dashboard");
  }
  return user;
}
