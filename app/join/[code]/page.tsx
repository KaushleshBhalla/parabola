import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db/client";
import { organizations } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/rbac";
import { joinOrganizationById } from "@/lib/organizations";
import { logActivity } from "@/lib/activity";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.inviteCode, code))
    .limit(1);

  if (!org) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-lg">Invite not found</CardTitle>
            <CardDescription>
              This invite link is invalid or has expired.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-lg">Join {org.name}</CardTitle>
            <CardDescription>
              Sign up or sign in to join this organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button
              nativeButton={false}
              render={<a href={`/sign-up?redirect_url=/join/${code}`} />}
            >
              Sign up
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={`/login?redirect_url=/join/${code}`} />}
            >
              I already have an account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const user = await requireUser();
  await joinOrganizationById(user.id, org.id);
  await logActivity({
    actorId: user.id,
    action: "organization.joined_via_link",
    entityType: "organization",
    entityId: org.id,
    searchText: `${user.name} joined "${org.name}" via invite link`,
  });

  redirect("/dashboard");
}
