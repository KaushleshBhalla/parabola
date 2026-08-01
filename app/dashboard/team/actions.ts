"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { hashPassword, encryptReversible } from "@/lib/auth/password";
import { logActivity } from "@/lib/activity";

const ASSIGNABLE_ROLES = ["admin", "member", "viewer"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

function isAssignableRole(value: string): value is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

export async function createUser(formData: FormData) {
  const actor = await requireRole("admin");
  const name = String(formData.get("name") ?? "").trim();
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const roleInput = String(formData.get("role") ?? "member");
  const role: AssignableRole = isAssignableRole(roleInput) ? roleInput : "member";

  if (!name || !login || !password) return;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, login))
    .limit(1);
  if (existing) return;

  const [newUser] = await db
    .insert(users)
    .values({
      name,
      email: login,
      passwordHash: await hashPassword(password),
      passwordEncrypted: encryptReversible(password),
      role,
    })
    .returning();

  await logActivity({
    actorId: actor.id,
    action: "user.created",
    entityType: "user",
    entityId: newUser.id,
    after: { name, login, role },
    searchText: `Created user "${name}" (${login}) as ${role}`,
  });

  revalidatePath("/dashboard/team");
}

export async function updateUserRole(userId: string, role: string) {
  const actor = await requireRole("admin");
  if (!isAssignableRole(role)) return;
  if (role === "admin" && actor.role !== "owner") return;

  const [target] = await db
    .select({ name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) return;

  await db.update(users).set({ role }).where(eq(users.id, userId));

  await logActivity({
    actorId: actor.id,
    action: "user.role_changed",
    entityType: "user",
    entityId: userId,
    before: { role: target.role },
    after: { role },
    searchText: `Changed ${target.name}'s role to ${role}`,
  });

  revalidatePath("/dashboard/team");
}

export async function setUserActive(userId: string, isActive: boolean) {
  const actor = await requireRole("admin");

  const [target] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) return;

  await db.update(users).set({ isActive }).where(eq(users.id, userId));

  await logActivity({
    actorId: actor.id,
    action: isActive ? "user.activated" : "user.deactivated",
    entityType: "user",
    entityId: userId,
    searchText: `${isActive ? "Activated" : "Deactivated"} ${target.name}`,
  });

  revalidatePath("/dashboard/team");
}
