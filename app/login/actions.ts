"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export type LoginState = { error: string } | null;

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!login || !password) {
    return { error: "Enter a login ID and password." };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, login))
    .limit(1);

  if (!user || !user.isActive) {
    return { error: "Invalid login ID or password." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid login ID or password." };
  }

  await createSession(user.id);
  redirect("/dashboard");
}
