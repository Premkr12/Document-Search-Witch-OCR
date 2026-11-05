import { cn } from "@/lib/utils";

/** A page with a highlighted line — the DocuSearch mark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block h-8 w-7 shrink-0 rounded-[3px_8px_3px_3px] border-[1.5px] border-ink bg-raised",
        className,
      )}
    >
      <span className="absolute inset-x-1 top-[7px] h-0.5 rounded-full bg-ink-3" />
      <span className="absolute left-[3px] right-1.5 top-[12px] h-1.5 rounded-sm bg-highlight-strong" />
      <span className="absolute inset-x-1 top-[21px] h-0.5 rounded-full bg-ink-3" />
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("font-serif text-[19px] font-medium tracking-[-0.02em]", className)}>DocuSearch</span>;
}
