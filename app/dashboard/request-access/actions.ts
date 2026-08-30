"use server";

import { db } from "@/lib/db/client";
import { accessRequests } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";
import { logActivity } from "@/lib/activity";

export type RequestAccessState = { error: string } | { success: true } | null;

export async function submitAccessRequest(
  _prevState: RequestAccessState,
  formData: FormData
): Promise<RequestAccessState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const company = String(formData.get("company") ?? "").trim();
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const teamSize = String(formData.get("teamSize") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const howHeard = String(formData.get("howHeard") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !email) return { error: "Name and email are required." };

  await db.insert(accessRequests).values({
    userId: user.id,
    name,
    email,
    company: company || null,
    jobTitle: jobTitle || null,
    phone: phone || null,
    teamSize: teamSize || null,
    website: website || null,
    howHeard: howHeard || null,
    message: message || null,
  });

  await logActivity({
    actorId: user.id,
    action: "access_request.submitted",
    entityType: "access_request",
    searchText: `${name} (${email}) requested project access`,
  });

  return { success: true };
}
