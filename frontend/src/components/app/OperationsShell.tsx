"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  ClipboardCheck,
  History,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  ScanLine,
  Settings2
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import lautTitle from "@/assets/laut-title.png";
import { useAsyncData } from "@/hooks/useAsyncData";
import { AuthGate, useSessionEmail, useSignOut } from "@/features/auth/AuthGate";
import { listProductionSites } from "@/features/production-sites/api/production-sites.api";
import { listInvestigations } from "@/features/investigations/api/investigations.api";

type NavigationItem = {
  /** Omitted for areas that are on the map but not built yet. */
  href?: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
  /** Shown as a tooltip when the area is not navigable. */
  plannedNote?: string;
};

export function OperationsShell({ children }: Readonly<{ children: ReactNode }>) {
  // The shell owns the viewport and never scrolls. Only the content pane scrolls,
  // so the sidebar stays put without relying on sticky positioning.
  return (
    <AuthGate>
      <div className="grid h-[100dvh] grid-cols-[14.5rem_minmax(0,1fr)] overflow-hidden bg-[var(--canvas)] text-[var(--ink)]">
        <OperationsSidebar />
        <section className="min-w-0 overflow-auto border-l border-[var(--line)]">
          {/* Keeps the desktop layout intact on narrow windows by scrolling the
              content pane horizontally, rather than the document. */}
          <div className="min-w-[59rem]">
            <OperationsTopBar />
            {children}
          </div>
        </section>
      </div>
    </AuthGate>
  );
}

function OperationsTopBar() {
  const { data: sites } = useAsyncData(() => listProductionSites(), []);
  const primarySite = sites?.[0];

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[var(--line)] bg-[var(--canvas)] px-7">
      <div className="flex items-center gap-3">
        <span className="flex h-2 w-2 bg-[var(--brand)]" />
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">{primarySite?.name ?? "Loading site…"}</p>
          <p className="text-[11px] text-[var(--muted)]">{primarySite?.location ?? ""}</p>
        </div>
      </div>
      <SessionControl />
    </header>
  );
}

function SessionControl() {
  const email = useSessionEmail();
  const signOut = useSignOut();

  return (
    <div className="flex items-center gap-3 border-l border-[var(--line)] pl-5">
      <span className="max-w-[14rem] truncate text-xs text-[var(--muted)]">{email ?? "Signed in"}</span>
      <button
        className="flex items-center gap-1.5 text-xs text-[var(--muted)] transition-colors duration-150 hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        onClick={() => void signOut()}
        type="button"
      >
        <LogOut aria-hidden="true" size={14} strokeWidth={1.75} />
        Sign out
      </button>
    </div>
  );
}

function OperationsSidebar() {
  const pathname = usePathname();
  const { data: investigations } = useAsyncData(() => listInvestigations(), []);

  const openInvestigations = investigations?.filter(
    (investigation) => investigation.status !== "resolved" && investigation.status !== "dismissed"
  ).length;

  const primaryNavigation: NavigationItem[] = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/batches", icon: ClipboardCheck, label: "Batches" },
    { href: "/whatsapp", icon: MessageCircle, label: "WhatsApp" },
    { href: "/analysis", icon: BarChart3, label: "Analysis" },
    { href: "/investigations", icon: ScanLine, label: "Investigations", badge: openInvestigations },
    { href: "/production-sites", icon: Building2, label: "Production sites" }
  ];

  const secondaryNavigation: NavigationItem[] = [
    { href: "/configuration", icon: Settings2, label: "Configuration" },
    { href: "/audit-trail", icon: History, label: "Audit trail" }
  ];

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-y-auto bg-[var(--sidebar)] px-3 py-4 text-[var(--sidebar-text)]">
      <div className="px-2 py-2">
        <div
          className="px-2 py-2"
          style={{ backgroundColor: "#ffffff", borderRadius: "0.5rem", boxShadow: "0 8px 18px -12px rgb(0 0 0 / 70%)" }}
        >
          <Image alt="LAUT" className="h-auto w-44 object-contain" priority src={lautTitle} />
        </div>
        <p className="mt-2 px-1 text-[11px] font-medium text-[var(--sidebar-text)]">Make every batch count</p>
      </div>

      <nav aria-label="Primary navigation" className="mt-7 space-y-1">
        {primaryNavigation.map((item) => (
          <SidebarItem item={item} key={item.label} pathname={pathname} />
        ))}
      </nav>

      <div className="my-5 border-t border-[var(--sidebar-line)]" />

      <nav aria-label="Workspace navigation" className="space-y-1">
        {secondaryNavigation.map((item) => (
          <SidebarItem item={item} key={item.label} pathname={pathname} />
        ))}
      </nav>

    </aside>
  );
}

function SidebarItem({ item, pathname }: Readonly<{ item: NavigationItem; pathname: string }>) {
  const Icon = item.icon;
  const baseClass =
    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]";

  if (!item.href) {
    return (
      <span
        aria-disabled="true"
        className={`${baseClass} cursor-not-allowed text-[var(--sidebar-muted)] opacity-60`}
        title={item.plannedNote ?? "Planned area"}
      >
        <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
        <span className="flex-1">{item.label}</span>
        <span className="text-[10px] uppercase tracking-wide">Planned</span>
      </span>
    );
  }

  const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={`${baseClass} ${
        isActive
          ? "bg-[var(--surface)] font-semibold text-[var(--ink)]"
          : "text-[var(--sidebar-muted)] hover:bg-white/10 hover:text-[var(--sidebar-text)]"
      }`}
      href={item.href}
    >
      <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
      <span className="flex-1">{item.label}</span>
      {item.badge ? <span className="font-mono text-xs">{item.badge}</span> : null}
      {isActive ? <span aria-hidden="true" className="h-1.5 w-1.5 bg-[var(--brand)]" /> : null}
    </Link>
  );
}
