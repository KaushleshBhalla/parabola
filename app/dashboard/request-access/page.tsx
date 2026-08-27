import { requireUser } from "@/lib/auth/rbac";
import { RequestAccessForm } from "./request-access-form";

export default async function RequestAccessPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <RequestAccessForm defaultName={user.name} defaultEmail={user.email} />
    </div>
  );
}
