import { requireUser } from "@/lib/auth/rbac";
import { getUserAiKeyInfo } from "@/lib/ai/user-keys";
import { AiKeyForm } from "./ai-key-form";

export default async function SettingsPage() {
  const user = await requireUser();
  const currentKey = await getUserAiKeyInfo(user.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Signed in as {user.name}.</p>
      </div>

      <AiKeyForm current={currentKey} />
    </div>
  );
}
