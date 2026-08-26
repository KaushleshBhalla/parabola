import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6">
      <SignIn fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
