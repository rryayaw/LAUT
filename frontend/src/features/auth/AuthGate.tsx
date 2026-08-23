"use client";

// Session gate.
//
// Every `/v1` route on the backend requires a Supabase access token, so the app
// shell renders nothing until a session exists. Sign-in happens against Supabase
// directly; the resulting token is what `src/api/client` attaches to each request.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "@/api/supabase";

export function AuthGate({ children }: Readonly<{ children: ReactNode }>) {
  const [session, setSession] = useState<Session | null>(null);
  const [isResolving, setIsResolving] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setIsResolving(false);
      return;
    }

    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setIsResolving(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured()) return <AuthNotice title="Supabase is not configured" body={MISSING_ENV} />;
  if (isResolving) return <AuthNotice title="Checking your session" body="Contacting Supabase…" />;
  if (!session) return <SignInView />;
  return <>{children}</>;
}

const MISSING_ENV =
  "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in frontend/.env.local, then restart the dev server.";

function AuthNotice({ title, body }: Readonly<{ title: string; body: string }>) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--canvas)] px-6">
      <div className="w-full max-w-md border border-[var(--line)] bg-[var(--surface)] px-6 py-6">
        <h1 className="text-lg font-semibold tracking-tight text-[var(--ink)]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
      </div>
    </main>
  );
}

function SignInView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const supabase = getSupabaseClient();
      if (!supabase) return;

      setIsSubmitting(true);
      setError(undefined);
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) setError(signInError.message);
      setIsSubmitting(false);
    },
    [email, password]
  );

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--canvas)] px-6">
      <form className="w-full max-w-sm border border-[var(--line)] bg-[var(--surface)] px-6 py-7" onSubmit={submit}>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">LAUT</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">Sign in</h1>
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
          Production data is scoped to your account. Every request carries your Supabase token.
        </p>

        <label className="mt-6 block text-xs font-medium text-[var(--ink)]" htmlFor="auth-email">
          Email
        </label>
        <input
          autoComplete="username"
          className="mt-1.5 w-full border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
          id="auth-email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />

        <label className="mt-4 block text-xs font-medium text-[var(--ink)]" htmlFor="auth-password">
          Password
        </label>
        <input
          autoComplete="current-password"
          className="mt-1.5 w-full border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
          id="auth-password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />

        {error ? (
          <p className="mt-4 border border-[var(--risk-line)] bg-[var(--risk-soft)] px-3 py-2 text-xs leading-5 text-[var(--ink)]" role="alert">
            {error}
          </p>
        ) : null}

        <button
          className="mt-6 w-full bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

export function useSignOut() {
  return useCallback(async () => {
    await getSupabaseClient()?.auth.signOut();
  }, []);
}

export function useSessionEmail(): string | undefined {
  const [email, setEmail] = useState<string>();

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setEmail(data.session?.user.email ?? undefined);
    });
    return () => {
      active = false;
    };
  }, []);

  return email;
}
