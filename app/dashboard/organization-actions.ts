"use server";

import { revalidatePath } from "next/cache";
import { requireUser, hasPermission } from "@/lib/auth/rbac";
import { renameOrganization, getOrCreateInviteCode } from "@/lib/organizations";
import { logActivity } from "@/lib/activity";

export async function renameOrganizationAction(
  organizationId: string,
  name: string
): Promise<{ error: string } | undefined> {
  const user = await requireUser();
  if (!(await hasPermission(user.id, organizationId, "role.manage"))) {
    return { error: "You don't have permission to rename this organization." };
  }
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };

  await renameOrganization(organizationId, trimmed);
  await logActivity({
    actorId: user.id,
    action: "organization.renamed",
    entityType: "organization",
    entityId: organizationId,
    after: { name: trimmed },
    searchText: `Renamed organization to "${trimmed}"`,
  });

  revalidatePath("/dashboard");
}

export async function getInviteLink(organizationId: string): Promise<string> {
  const code = await getOrCreateInviteCode(organizationId);
  return `/join/${code}`;
}
