import { auth } from "@clerk/nextjs/server";
import { verifyLinkToken } from "@/lib/discord/link-token";
import { requireUser } from "@/lib/auth/rbac";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDiscordLinkForm } from "./confirm-form";

function InfoCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export default async function DiscordLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) return <InfoCard title="Missing link" description="This link is missing its token." />;

  const parsed = verifyLinkToken(token);
  if (!parsed) {
    return (
      <InfoCard
        title="Link expired"
        description="This link has expired or is invalid — run /link in Discord again to get a fresh one."
      />
    );
  }

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    const redirectTarget = `/discord/link?token=${encodeURIComponent(token)}`;
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-lg">Sign in to continue</CardTitle>
            <CardDescription>
              Sign in to your Parabola account to link @{parsed.discordUsername}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              nativeButton={false}
              render={<a href={`/login?redirect_url=${encodeURIComponent(redirectTarget)}`} />}
              className="w-full"
            >
              Sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const user = await requireUser();

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Link your Discord account</CardTitle>
          <CardDescription>
            Connect <strong>@{parsed.discordUsername}</strong> to your Parabola account ({user.email})?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfirmDiscordLinkForm token={token} />
        </CardContent>
      </Card>
    </div>
  );
}
