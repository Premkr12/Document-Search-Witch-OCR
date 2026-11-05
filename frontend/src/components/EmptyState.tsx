import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed border-rule-strong px-5 py-14 text-center text-ink-2",
        className,
      )}
    >
      {Icon && (
        <span className="mb-4 grid size-12 place-items-center rounded-xl bg-sunken text-ink-2">
          <Icon className="size-[22px]" aria-hidden="true" />
        </span>
      )}
      <h2 className="mb-1.5 text-xl text-ink">{title}</h2>
      {children && <div className="max-w-md text-sm">{children}</div>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
