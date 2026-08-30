import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { projectMembers } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [existing] = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, user.id))
    .limit(1);
  if (existing) redirect("/dashboard");
  return children;
}
