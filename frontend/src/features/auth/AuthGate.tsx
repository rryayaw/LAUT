"use client";

// Session gate.
//
// Every `/v1` route on the backend requires a Supabase access token, so the app
// shell renders nothing until a session exists. Sign-in happens against Supabase
// directly; the resulting token is what `src/api/client` attaches to each request.

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "@/api/supabase";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Production data is scoped to your account. Every request carries your Supabase token.</p>
        <label className="mt-6 block text-xs font-medium text-[var(--ink)]" htmlFor="auth-email">Email</label>
        <input autoComplete="username" className="mt-1.5 w-full border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]" id="auth-email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
        <label className="mt-4 block text-xs font-medium text-[var(--ink)]" htmlFor="auth-password">Password</label>
        <input autoComplete="current-password" className="mt-1.5 w-full border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]" id="auth-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
        {error ? <p className="mt-4 border border-[var(--risk-line)] bg-[var(--risk-soft)] px-3 py-2 text-xs leading-5 text-[var(--ink)]" role="alert">{error}</p> : null}
        <button className="mt-6 w-full bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-60" disabled={isSubmitting} type="submit">{isSubmitting ? "Signing in…" : "Sign in"}</button>
        <div className="mt-4 border-t border-[var(--line)] pt-4 text-center"><p className="text-xs text-[var(--muted)]">New to LAUT?</p><SignUpDialog /></div>
      </form>
    </main>
  );
}

function SignUpDialog() {
  const [open, setOpen] = useState(false); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState(""); const [error, setError] = useState<string>(); const [success, setSuccess] = useState<string>(); const [isSubmitting, setIsSubmitting] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (password.length < 8) { setError("Use a password with at least 8 characters."); return; } if (password !== confirmPassword) { setError("Passwords do not match."); return; } const supabase = getSupabaseClient(); if (!supabase) return; setIsSubmitting(true); setError(undefined); setSuccess(undefined); const { data, error: signUpError } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } }); if (signUpError) setError(signUpError.message); else if (data.session) setSuccess("Your account is ready. Signing you in…"); else setSuccess("Check your email to confirm your account, then return here to sign in."); setIsSubmitting(false); }
  return <Dialog onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) { setError(undefined); setSuccess(undefined); } }} open={open}><DialogTrigger asChild><Button className="mt-2 h-auto rounded-none px-3 py-1.5 text-xs" type="button" variant="outline">Create an account</Button></DialogTrigger><DialogContent className="gap-0 rounded-none border-[var(--line-strong)] bg-[var(--surface)] p-0 sm:max-w-md"><DialogHeader className="border-b border-[var(--line)] px-6 py-5 text-left"><p className="text-xs font-medium text-[var(--brand)]">LAUT account</p><DialogTitle className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">Create an account</DialogTitle><DialogDescription className="mt-2 text-sm leading-6 text-[var(--muted)]">Use your work email. You will confirm the address before accessing production data.</DialogDescription></DialogHeader><form onSubmit={submit}><div className="space-y-4 px-6 py-5"><AuthField autoComplete="email" id="signup-email" label="Work email" onChange={setEmail} type="email" value={email} /><AuthField autoComplete="new-password" id="signup-password" label="Password" onChange={setPassword} type="password" value={password} /><AuthField autoComplete="new-password" id="signup-password-confirmation" label="Confirm password" onChange={setConfirmPassword} type="password" value={confirmPassword} />{error ? <p className="border border-[var(--risk-line)] bg-[var(--risk-soft)] px-3 py-2 text-xs leading-5 text-[var(--ink)]" role="alert">{error}</p> : null}{success ? <p className="border border-[var(--line)] bg-[var(--brand-soft)] px-3 py-2 text-xs leading-5 text-[var(--ink)]" role="status">{success}</p> : null}</div><DialogFooter className="border-t border-[var(--line)] px-6 py-4"><Button className="rounded-none bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)]" disabled={isSubmitting} type="submit">{isSubmitting ? "Creating account…" : "Create account"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function AuthField({ autoComplete, id, label, onChange, type, value }: Readonly<{ autoComplete: string; id: string; label: string; onChange: (value: string) => void; type: "email" | "password"; value: string }>) {
  return <div><label className="block text-xs font-medium text-[var(--ink)]" htmlFor={id}>{label}</label><input autoComplete={autoComplete} className="mt-1.5 w-full border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]" id={id} onChange={(event) => onChange(event.target.value)} required type={type} value={value} /></div>;
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
