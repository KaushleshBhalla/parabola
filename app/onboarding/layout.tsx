import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/rbac";
import { getUserOrganizations } from "@/lib/organizations";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const userOrgs = await getUserOrganizations(user.id);
  if (userOrgs.length > 0) redirect("/dashboard");
  return children;
}
