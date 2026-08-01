"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/rbac";
import { hashPassword, encryptReversible } from "@/lib/auth/password";

const ASSIGNABLE_ROLES = ["admin", "member", "viewer"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

function isAssignableRole(value: string): value is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

export async function createUser(formData: FormData) {
  await requireRole("admin");
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

  await db.insert(users).values({
    name,
    email: login,
    passwordHash: await hashPassword(password),
    passwordEncrypted: encryptReversible(password),
    role,
  });

  revalidatePath("/dashboard/team");
}

export async function updateUserRole(userId: string, role: string) {
  const actor = await requireRole("admin");
  if (!isAssignableRole(role)) return;
  if (role === "admin" && actor.role !== "owner") return;

  await db.update(users).set({ role }).where(eq(users.id, userId));
  revalidatePath("/dashboard/team");
}

export async function setUserActive(userId: string, isActive: boolean) {
  await requireRole("admin");
  await db.update(users).set({ isActive }).where(eq(users.id, userId));
  revalidatePath("/dashboard/team");
}
