import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { requireUser } from "@/lib/auth/rbac";
import { requestToJoinProject } from "@/lib/project-access";
import { logActivity } from "@/lib/activity";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-lg">Join a project</CardTitle>
            <CardDescription>Sign up or sign in to use this invite.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button nativeButton={false} render={<a href={`/sign-up?redirect_url=/join/${code}`} />}>
              Sign up
            </Button>
            <Button variant="outline" nativeButton={false} render={<a href={`/login?redirect_url=/join/${code}`} />}>
              I already have an account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const user = await requireUser();
  const result = await requestToJoinProject(user.id, code);

  if ("error" in result) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-lg">Invite not found</CardTitle>
            <CardDescription>{result.error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (result.status === "already_member") {
    redirect(`/dashboard/${result.project.slug}/work-items`);
  }

  if (result.status === "approved") {
    await logActivity({
      actorId: user.id,
      projectId: result.project.id,
      action: "project_member.joined_via_link",
      entityType: "project",
      entityId: result.project.id,
      searchText: `${user.name} joined "${result.project.name}" via invite link`,
    });
    redirect(`/dashboard/${result.project.slug}/work-items`);
  }

  // status === "pending"
  await logActivity({
    actorId: user.id,
    projectId: result.project.id,
    action: "project_join_request.submitted",
    entityType: "project",
    entityId: result.project.id,
    searchText: `${user.name} requested to join "${result.project.name}" via invite link`,
  });

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Request sent</CardTitle>
          <CardDescription>
            {result.project.name} requires admin approval to join. You&apos;ll get access as soon as someone
            on the project approves your request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button nativeButton={false} render={<Link href="/dashboard" />}>
            Back to dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
