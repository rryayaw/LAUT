"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, Check, ChevronRight, Fish, Menu, ThumbsUp, X } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/api/supabase";
import title from "@/assets/laut-title.png";
import logo from "@/assets/laut-logo.png";
import hero from "@/assets/laut-manufacturing-hero.png";
import { WHATSAPP_NUMBER_PROMPT_SESSION_KEY } from "@/components/app/WhatsAppNumberPrompt";

const scrollGuidePoints = Array.from({ length: 121 }, (_, index) => {
  const progress = index / 120;
  const x = 48 + 30 * Math.sin(progress * Math.PI * 6);
  const y = progress * 1000;
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}).join(" ");

export function AuthGate({ children }: Readonly<{ children: ReactNode }>) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) { setLoading(false); return; }

    void client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured()) {
    return <main className="grid min-h-[100dvh] place-items-center bg-[#f5faf9] p-6 text-[#133852]"><p className="max-w-md rounded-2xl border border-[#cfe1e2] bg-white p-6 text-sm leading-6 shadow-sm">Configure Supabase in <code className="font-mono text-[#246f76]">frontend/.env.local</code> to access LAUT.</p></main>;
  }
  if (loading) return <LoadingScreen />;
  return session ? <>{children}</> : <Landing />;
}

function LoadingScreen() {
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[#f5faf9] text-[#133852]">
      <div className="relative isolate min-h-[100dvh] animate-pulse overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#def0f1_0%,#f5faf9_48%,#cfe1e2_100%)]" />
        <div className="mx-4 mt-4 flex max-w-7xl items-center justify-between rounded-2xl border border-white/80 bg-white/90 px-5 py-4 shadow-xl shadow-[#133852]/10 sm:mx-8 sm:px-6 lg:mx-auto lg:px-8">
          <div className="h-7 w-24 rounded bg-[#afd5d6]" />
          <div className="hidden gap-5 md:flex"><div className="h-4 w-20 rounded bg-[#def0f1]" /><div className="h-4 w-20 rounded bg-[#def0f1]" /><div className="h-11 w-32 rounded-lg bg-[#afd5d6]" /></div>
        </div>
        <div className="mx-auto grid min-h-[calc(100dvh-84px)] max-w-7xl content-center px-5 pb-20 pt-14 sm:px-8 lg:px-10">
          <div className="max-w-4xl space-y-7"><div className="h-3 w-64 rounded bg-[#79aaae]" /><div className="space-y-3"><div className="h-16 max-w-3xl rounded-xl bg-[#afd5d6] sm:h-20" /><div className="h-16 max-w-2xl rounded-xl bg-[#afd5d6] sm:h-20" /></div><div className="space-y-3"><div className="h-5 max-w-xl rounded bg-[#cfe1e2]" /><div className="h-5 max-w-lg rounded bg-[#cfe1e2]" /></div><div className="flex gap-3"><div className="h-12 w-48 rounded-lg bg-[#246f76]/40" /><div className="hidden h-12 w-40 rounded-lg bg-white/70 sm:block" /></div></div>
        </div>
      </div>
    </main>
  );
}

function Landing() {
  const startRef = useRef<HTMLElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSignIn, setIsSignIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const scrollToStart = () => { setIsMenuOpen(false); startRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseClient();
    if (!client) return;
    if (!isSignIn && password !== confirmPassword) { setMessage("Passwords do not match. Please try again."); return; }
    setMessage(""); setIsBusy(true);
    const response = isSignIn
      ? await client.auth.signInWithPassword({ email, password })
      : await client.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setMessage(response.error?.message ?? (isSignIn ? "" : "Check your email to confirm your account, then sign in."));
    setIsBusy(false);
  }

  return (
    <main className="landing-page min-h-[100dvh] overflow-x-hidden bg-[#f5faf9] text-[#133852]">
      <a className="skip-link" href="#get-started">Skip to account setup</a>
      <ScrollGuide destinationRef={startRef} />
      <section className="relative isolate overflow-hidden border-b border-[#cfe1e2]">
        <img alt="Seafood processing facility production line" className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-35" src={hero.src} />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(245,250,249,0.83)_0%,rgba(245,250,249,0.77)_48%,rgba(245,250,249,0.41)_100%)]" />
        <header className="relative z-10 mx-4 mt-4 flex max-w-7xl items-center justify-between rounded-2xl border border-white/80 bg-white/90 px-5 py-4 shadow-xl shadow-[#133852]/15 backdrop-blur sm:mx-8 sm:px-6 lg:mx-auto lg:px-8">
          <img alt="LAUT" className="h-auto w-32 sm:w-36" src={title.src} />
          <nav aria-label="Primary navigation" className="hidden items-center gap-7 md:flex">
            <a className="text-sm text-[#4e6a79] transition hover:text-[#133852]" href="#how-it-works">How it works</a>
            <a className="text-sm text-[#4e6a79] transition hover:text-[#133852]" href="#get-started">Access LAUT</a>
            <button className="button-primary" onClick={scrollToStart} type="button">Get started <ArrowRight aria-hidden="true" className="h-4 w-4" /></button>
          </nav>
          <button aria-controls="mobile-navigation" aria-expanded={isMenuOpen} aria-label={isMenuOpen ? "Close navigation" : "Open navigation"} className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-[#afd5d6] bg-white/80 text-[#133852] transition hover:bg-white md:hidden" onClick={() => setIsMenuOpen((open) => !open)} type="button">
            {isMenuOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
        </header>
        {isMenuOpen && <nav aria-label="Mobile navigation" className="mx-5 mb-4 grid overflow-hidden rounded-xl border border-[#cfe1e2] bg-white p-2 shadow-xl shadow-[#133852]/10 md:hidden" id="mobile-navigation"><a className="rounded-lg px-4 py-3 text-sm hover:bg-[#eef7f7]" href="#how-it-works" onClick={() => setIsMenuOpen(false)}>How it works</a><button className="rounded-lg px-4 py-3 text-left text-sm hover:bg-[#eef7f7]" onClick={scrollToStart} type="button">Access LAUT</button></nav>}
        <div className="mx-auto grid min-h-[calc(100dvh-84px)] max-w-7xl content-center px-5 pb-20 pt-14 sm:px-8 sm:pb-24 sm:pt-16 lg:px-10">
          <div className="relative max-w-4xl"><p className="hero-reveal mb-6 font-mono text-xs font-medium uppercase tracking-[0.18em] text-[#246f76]">Production intelligence for seafood</p><h1 className="hero-reveal hero-reveal-delay-1 max-w-3xl text-6xl font-medium tracking-[-0.065em] text-[#133852] sm:text-7xl lg:text-8xl">Make <span className="relative inline-block"><span aria-hidden="true" className="absolute -inset-x-8 -inset-y-5 -z-10 rounded-full bg-[radial-gradient(ellipse,rgba(81,168,175,0.42)_0%,rgba(81,168,175,0.14)_48%,transparent_74%)] blur-xl" /><span className="font-bold text-[#51a8af]">every</span></span> batch count.</h1><p className="hero-reveal hero-reveal-delay-2 mt-7 max-w-xl text-base leading-7 text-[#4e6a79] sm:text-lg sm:leading-8">See every input, yield, and loss clearly—then make the next production decision with confidence.</p><div className="hero-reveal hero-reveal-delay-3 mt-9 flex flex-col gap-3 sm:flex-row"><button className="button-primary" onClick={scrollToStart} type="button">Build your workspace <ArrowRight aria-hidden="true" className="h-4 w-4" /></button><a className="button-ghost" href="#how-it-works">See how LAUT works <ChevronRight aria-hidden="true" className="h-4 w-4" /></a></div></div>
        </div>
      </section>
      <section className="bg-[#eef7f7]" id="how-it-works"><div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10"><div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-end"><div><p className="section-label flex items-center gap-2"><Fish aria-hidden="true" className="h-4 w-4" /> The problem</p><h2 className="mt-4 max-w-lg text-3xl font-semibold tracking-[-0.04em] text-[#133852] sm:text-4xl">Important production context is scattered when it should be working together.</h2></div><div className="grid gap-px overflow-hidden rounded-2xl border border-[#afd5d6] bg-[#afd5d6] sm:grid-cols-3">{[["01", "Yield without the why", "Totals arrive without the process conditions that explain them."], ["02", "Losses recorded too late", "Teams learn after the shift, when the corrective window has closed."], ["03", "Line context left behind", "Critical observations stay in notebooks, messages, and memory."]].map(([number, heading, detail]) => <article className="min-h-52 bg-white p-6" key={number}><p className="font-mono text-xs text-[#246f76]">{number}</p><h3 className="mt-10 text-lg font-medium text-[#133852]">{heading}</h3><p className="mt-3 text-sm leading-6 text-[#4e6a79]">{detail}</p></article>)}</div></div><div className="mt-16 grid gap-12 border-t border-[#afd5d6] pt-16 sm:mt-20 sm:pt-20 lg:grid-cols-2 lg:py-8"><div><p className="section-label flex items-center gap-2"><ThumbsUp aria-hidden="true" className="h-4 w-4" /> One source of truth</p><h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#133852] sm:text-4xl">One shared, trustworthy view of every batch.</h2><p className="mt-5 max-w-xl text-base leading-7 text-[#4e6a79]">LAUT connects production records to the sites, lines, and process details behind them—so teams can investigate, learn, and improve.</p></div><ul className="space-y-7" role="list">{["Capture the conditions behind each production result.", "Compare outcomes across sites, lines, and product configurations.", "Turn investigations into repeatable operational learning."].map((item) => <li className="flex gap-4 text-base leading-7 text-[#133852]" key={item}><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/70 text-[#246f76]"><Check aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} /></span>{item}</li>)}</ul></div></div></section>
      <section className="scroll-mt-6 border-t border-[#cfe1e2] bg-[#def0f1]" id="get-started" ref={startRef}><div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_minmax(26rem,0.85fr)] lg:gap-20 lg:px-10 lg:py-28"><div className="relative lg:pt-8"><p className="section-label">Get started</p><h2 className="mt-4 max-w-xl text-4xl font-medium tracking-[-0.055em] text-[#133852] sm:text-5xl lg:text-6xl">Bring your <span className="relative inline-block"><span aria-hidden="true" className="absolute -inset-x-7 -inset-y-4 -z-10 rounded-full bg-[radial-gradient(ellipse,rgba(81,168,175,0.42)_0%,rgba(81,168,175,0.14)_48%,transparent_74%)] blur-xl" /><span className="font-bold text-[#51a8af]">production</span></span> team into focus.</h2><p className="mt-6 max-w-md text-base leading-7 text-[#4e6a79]">Create your workspace to start keeping production context, decisions, and outcomes in one place.</p></div><form className="rounded-2xl border border-[#afd5d6] bg-white p-6 shadow-xl shadow-[#133852]/10 sm:p-8" onSubmit={handleSubmit}><h3 className="text-xl font-semibold text-[#133852]">{isSignIn ? "Welcome back" : "Create your account"}</h3><p className="mt-2 text-sm leading-6 text-[#4e6a79]">{isSignIn ? "Sign in to continue to your workspace." : "Use your work email to get started."}</p><div className="mt-7 space-y-5"><label className="grid gap-2 text-sm font-medium text-[#133852]">Work email<input autoComplete="email" className="auth-input" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label><label className="grid gap-2 text-sm font-medium text-[#133852]">Password<input autoComplete={isSignIn ? "current-password" : "new-password"} className="auth-input" minLength={6} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>{!isSignIn && <label className="grid gap-2 text-sm font-medium text-[#133852]">Confirm password<input autoComplete="new-password" className="auth-input" minLength={6} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} /></label>}</div>{message && <p aria-live="polite" className="mt-5 rounded-lg border border-[#afd5d6] bg-[#eef7f7] px-4 py-3 text-sm leading-6 text-[#133852]">{message}</p>}<button className="button-primary mt-7 w-full" disabled={isBusy} type="submit">{isBusy ? "Please wait…" : isSignIn ? "Sign in" : "Create account"}{!isBusy && <ArrowRight aria-hidden="true" className="h-4 w-4" />}</button><p className="mt-5 text-center text-sm text-[#4e6a79]">{isSignIn ? "New to LAUT?" : "Already have an account?"}{" "}<button className="font-medium text-[#246f76] underline decoration-[#246f76]/40 underline-offset-4 transition hover:text-[#1a5961]" onClick={() => { setIsSignIn((value) => !value); setMessage(""); }} type="button">{isSignIn ? "Create an account" : "Sign in instead"}</button></p></form></div></section>
    </main>
  );
}

function ScrollGuide({ destinationRef }: Readonly<{ destinationRef: RefObject<HTMLElement | null> }>) {
  const guideRef = useRef<HTMLElement | null>(null);
  const targetProgressRef = useRef(0);

  useEffect(() => {
    const renderGuide = (progress: number) => {
      const guide = guideRef.current;
      if (!guide) return;

      const travelDistance = Math.max(window.innerHeight - 144, 0);
      const wavePhase = progress * Math.PI * 6;
      const logoTop = 64 + progress * travelDistance;
      const horizontalOffset = Math.sin(wavePhase) * 30;
      const slope = (30 * Math.PI * 6) / Math.max(travelDistance, 1) * Math.cos(wavePhase);
      const rotation = 90 - (Math.atan(slope) * 180) / Math.PI;

      guide.style.setProperty("--guide-y", `${logoTop}px`);
      guide.style.setProperty("--guide-x", `${horizontalOffset}px`);
      guide.style.setProperty("--guide-rotation", `${rotation}deg`);
    };

    let displayedProgress = targetProgressRef.current;
    let animationFrame: number | undefined;

    const animate = () => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const targetProgress = targetProgressRef.current;
      displayedProgress = prefersReducedMotion
        ? targetProgress
        : displayedProgress + (targetProgress - displayedProgress) * 0.14;

      if (Math.abs(targetProgress - displayedProgress) < 0.0005) {
        displayedProgress = targetProgress;
      }

      renderGuide(displayedProgress);
      animationFrame = displayedProgress === targetProgress
        ? undefined
        : window.requestAnimationFrame(animate);
    };

    const startAnimation = () => {
      if (animationFrame === undefined) animationFrame = window.requestAnimationFrame(animate);
    };

    const updateTarget = () => {
      const destination = destinationRef.current;
      if (!destination) return;

      const distance = Math.max(destination.offsetTop - window.innerHeight * 0.5, 1);
      targetProgressRef.current = Math.min(Math.max(window.scrollY / distance, 0), 1);
      startAnimation();
    };

    updateTarget();
    renderGuide(targetProgressRef.current);
    window.addEventListener("scroll", updateTarget, { passive: true });
    window.addEventListener("resize", updateTarget);

    return () => {
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", updateTarget);
      window.removeEventListener("resize", updateTarget);
    };
  }, [destinationRef]);

  return (
    <aside
      aria-hidden="true"
      className="pointer-events-none fixed left-4 top-0 z-20 hidden h-[100dvh] w-24 xl:block"
      ref={guideRef}
    >
      <svg className="absolute left-0 top-[104px] h-[calc(100dvh-144px)] w-full" fill="none" viewBox="0 0 96 1000" preserveAspectRatio="none">
        <polyline
          points={scrollGuidePoints}
          stroke="#51a8af"
          strokeDasharray="2 10"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
      <div className="scroll-guide-logo absolute left-1/2 top-0 h-20 w-20">
        <img alt="" className="h-full w-full object-contain" src={logo.src} />
      </div>
    </aside>
  );
}

export function useSignOut() {
  return useCallback(async () => {
    window.sessionStorage.removeItem(WHATSAPP_NUMBER_PROMPT_SESSION_KEY);
    await getSupabaseClient()?.auth.signOut();
  }, []);
}

export function useSessionEmail() {
  const [email, setEmail] = useState<string>();
  useEffect(() => { void getSupabaseClient()?.auth.getSession().then(({ data }) => setEmail(data.session?.user.email)); }, []);
  return email;
}
