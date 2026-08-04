"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";
type Status = "idle" | "submitting" | "error" | "check-email";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);

    const supabase = createClient();
    const { data, error: authError } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            // Must point at /auth/callback, not a plain page — the PKCE flow
            // (the @supabase/ssr default) hands back a one-time `code` that
            // only that route handler exchanges for a session; landing
            // anywhere else leaves the code unused and the visitor logged
            // out. Falls back to the project's dashboard "Site URL" if
            // omitted, or if this origin isn't in Auth > URL Configuration >
            // Redirect URLs — worth having explicit either way so a
            // misconfigured Site URL doesn't silently send confirmations to
            // the wrong deployment.
            options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
          });

    if (authError) {
      setStatus("error");
      setError(authError.message);
      return;
    }

    // Signup with email confirmation enabled returns no session until the
    // user clicks the confirmation link — can't assume they're logged in.
    if (mode === "signup" && !data.session) {
      setStatus("check-email");
      return;
    }

    router.push(mode === "signup" ? "/getting-started" : "/health");
    router.refresh();
  }

  if (status === "check-email") {
    return (
      <p className="text-sm text-neutral-700">
        Check your email to confirm your account, then{" "}
        <Link href="/login" className="underline text-neutral-900">
          sign in
        </Link>
        .
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-neutral-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "submitting"}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-neutral-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={status === "submitting"}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {status === "submitting"
          ? mode === "login"
            ? "Signing in…"
            : "Creating account…"
          : mode === "login"
            ? "Sign in"
            : "Create account"}
      </button>
      <p className="text-center text-sm text-neutral-500">
        {mode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="underline text-neutral-900">
              Create one
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="underline text-neutral-900">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
