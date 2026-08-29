"use server";

import { db } from "@/lib/db/client";
import { accessRequests } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";
import { getPrimaryOrganization } from "@/lib/organizations";
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

  const org = await getPrimaryOrganization(user.id);

  await db.insert(accessRequests).values({
    organizationId: org?.id ?? null,
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
    searchText: `${name} (${email}) requested Pro access`,
  });

  return { success: true };
}
