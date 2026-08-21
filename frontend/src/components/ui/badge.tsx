import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/utils";

const badgeVariants = cva("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border px-2 py-1 text-[11px] font-medium", {
  variants: {
    tone: {
      neutral: "border-[var(--line-strong)] bg-[var(--surface-subtle)] text-[var(--muted)]",
      brand: "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--brand)]",
      risk: "border-[var(--risk-line)] bg-[var(--risk-soft)] text-[var(--risk)]",
      soft: "border-[var(--line-strong)] bg-[var(--brand-soft)] text-[var(--ink)]",
      solid: "border-[var(--brand)] bg-[var(--brand)] text-white"
    }
  },
  defaultVariants: { tone: "neutral" }
});

export type BadgeProps = VariantProps<typeof badgeVariants> & {
  children: ReactNode;
  className?: string;
  title?: string;
};

export function Badge({ children, className, title, tone }: Readonly<BadgeProps>) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} title={title}>
      {children}
    </span>
  );
}
