import { SignIn } from "@clerk/nextjs";

export default function AdminLoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-background px-6">
      <div className="text-center">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Restricted
        </p>
        <h1 className="font-heading text-lg font-semibold">Parabola Admin</h1>
      </div>
      <SignIn path="/admin/login" routing="path" fallbackRedirectUrl="/admin" />
    </div>
  );
}
