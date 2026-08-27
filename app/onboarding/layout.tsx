import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/rbac";
import { getUserOrganizations, createDemoOrganizationForUser } from "@/lib/organizations";
import { logActivity } from "@/lib/activity";

export default async function OnboardingLayout(_props: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const userOrgs = await getUserOrganizations(user.id);
  if (userOrgs.length > 0) redirect("/dashboard");

  const org = await createDemoOrganizationForUser(user.id, user.name);
  await logActivity({
    actorId: user.id,
    action: "organization.created",
    entityType: "organization",
    entityId: org.id,
    after: { name: org.name, slug: org.slug, isDemo: true },
    searchText: `Auto-created demo workspace "${org.name}"`,
  });
  redirect("/dashboard");
}
