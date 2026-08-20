import type { ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  ClipboardCheck,
  Database,
  History,
  LayoutDashboard,
  MessageCircle,
  ScanLine,
  Search,
  Settings2,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type OperationsArea = "dashboard" | "batches";

type NavigationItem = {
  area?: OperationsArea;
  count?: number;
  href?: string;
  icon: LucideIcon;
  label: string;
};

const primaryNavigation: NavigationItem[] = [
  { area: "dashboard", href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { icon: ClipboardCheck, label: "Batches" },
  { count: 2, icon: MessageCircle, label: "WhatsApp review" },
  { icon: BarChart3, label: "Analysis" },
  { count: 3, icon: ScanLine, label: "Investigations" },
  { icon: Users, label: "Suppliers" }
];

const secondaryNavigation: NavigationItem[] = [
  { icon: Settings2, label: "Configuration" },
  { icon: History, label: "Audit trail" }
];

export function OperationsShell({ activeArea, children }: Readonly<{ activeArea: OperationsArea; children: ReactNode }>) {
  return (
    <div className="min-h-[100dvh] bg-[var(--canvas)] text-[var(--ink)]">
      <div className="grid min-h-[100dvh] grid-cols-[14.5rem_minmax(0,1fr)]">
        <OperationsSidebar activeArea={activeArea} />
        <section className="min-w-0 border-l border-[var(--line)]">
          <OperationsTopBar />
          {children}
        </section>
      </div>
    </div>
  );
}

function OperationsTopBar() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[var(--line)] bg-[var(--canvas)] px-7">
      <div className="flex items-center gap-3">
        <span className="flex h-2 w-2 bg-[var(--brand)]" />
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">Teluk Harum Fillet House</p>
          <p className="text-[11px] text-[var(--muted)]">Muara Baru, Jakarta</p>
        </div>
      </div>
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <MessageCircle aria-hidden="true" size={14} strokeWidth={1.75} />
          <span>Synced 4 min ago</span>
        </div>
        <Button className="h-auto cursor-not-allowed rounded-none border-[var(--line-strong)] bg-[var(--surface)] px-3 py-2 text-[var(--muted)] opacity-65 shadow-none" disabled title="Batch search is not included in this mockup" type="button" variant="outline">
          <Search aria-hidden="true" size={15} strokeWidth={1.75} />
          Find batch
        </Button>
      </div>
    </header>
  );
}

function OperationsSidebar({ activeArea }: Readonly<{ activeArea: OperationsArea }>) {
  return (
    <aside className="sticky top-0 flex h-[100dvh] flex-col bg-[var(--sidebar)] px-3 py-4 text-[var(--sidebar-text)]">
      <div className="flex items-center gap-3 px-2 py-2">
        <div>
          <p className="text-base font-semibold tracking-tight">LAUT</p>
          <p className="text-[11px] text-[var(--sidebar-muted)]">Production intelligence</p>
        </div>
      </div>

      <nav aria-label="Primary navigation" className="mt-7 space-y-1">
        {primaryNavigation.map((item) => <SidebarItem activeArea={activeArea} item={item} key={item.label} />)}
      </nav>

      <div className="my-5 border-t border-[var(--sidebar-line)]" />

      <nav aria-label="Workspace navigation" className="space-y-1">
        {secondaryNavigation.map((item) => <SidebarItem activeArea={activeArea} item={item} key={item.label} />)}
      </nav>

      <div className="mt-auto border-t border-[var(--sidebar-line)] px-2 pt-4">
        <div className="flex items-center gap-2 text-xs text-[var(--sidebar-muted)]">
          <Database aria-hidden="true" size={14} strokeWidth={1.75} />
          <span>Local demo snapshot</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-[var(--sidebar-muted)]">Prepared for a Supabase-backed production data layer.</p>
      </div>
    </aside>
  );
}

function SidebarItem({ activeArea, item }: Readonly<{ activeArea: OperationsArea; item: NavigationItem }>) {
  const Icon = item.icon;
  const commonClass = "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]";
  const isActive = item.area === activeArea;

  if (item.href) {
    return (
      <Link aria-current={isActive ? "page" : undefined} className={`${commonClass} ${isActive ? "bg-[var(--surface)] font-semibold text-[var(--ink)]" : "text-[var(--sidebar-muted)] hover:bg-white/10 hover:text-[var(--sidebar-text)]"}`} href={item.href}>
        <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
        <span className="flex-1">{item.label}</span>
        {isActive ? <span aria-hidden="true" className="h-1.5 w-1.5 bg-[var(--brand)]" /> : null}
      </Link>
    );
  }

  return (
    <Button aria-disabled="true" className={`${commonClass} h-auto cursor-not-allowed rounded-none text-[var(--sidebar-muted)] opacity-80`} disabled title="Planned dashboard area" type="button" variant="ghost">
      <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
      <span className="flex-1">{item.label}</span>
      {item.count ? <span className="font-mono text-xs text-[var(--sidebar-muted)]">{item.count}</span> : null}
    </Button>
  );
}
