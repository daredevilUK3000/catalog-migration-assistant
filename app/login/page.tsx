import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-10">
      <div className="mx-auto max-w-sm space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Sign in</h1>
          <p className="mt-1 text-neutral-600">Welcome back.</p>
        </div>
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
