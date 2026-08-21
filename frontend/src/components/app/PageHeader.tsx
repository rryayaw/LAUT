import type { ReactNode } from "react";

type PageHeaderProps = {
  breadcrumb: string;
  title: string;
  description: string;
  actions?: ReactNode;
  meta?: ReactNode;
};

/** The shared page masthead. Keeps every workspace visually consistent. */
export function PageHeader({ actions, breadcrumb, description, meta, title }: Readonly<PageHeaderProps>) {
  return (
    <header className="flex items-end justify-between gap-8 border-b border-[var(--line)] pb-5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--muted)]">{breadcrumb}</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-[var(--ink)]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>
      {actions || meta ? (
        <div className="flex shrink-0 items-end gap-3">
          {meta}
          {actions}
        </div>
      ) : null}
    </header>
  );
}
