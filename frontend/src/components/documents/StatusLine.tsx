import { useReprocessDocument } from "@/api/documents";
import { LOW_CONFIDENCE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { DocumentSummary } from "@/types";

type Tone = "ok" | "warn" | "bad" | "busy" | "idle";

const DOT: Record<Tone, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  bad: "bg-destructive",
  busy: "bg-primary",
  idle: "bg-ink-3",
};

export function describeStatus(doc: DocumentSummary): { tone: Tone; label: string; detail?: string } {
  switch (doc.status) {
    case "processing": {
      if (!doc.total_pages) return { tone: "busy", label: "Getting ready…" };
      const current = Math.min((doc.processed_pages ?? 0) + 1, doc.total_pages);
      return { tone: "busy", label: `Reading page ${current} of ${doc.total_pages}` };
    }
    case "pending":
      return { tone: "idle", label: "Waiting to start" };
    case "error":
      return { tone: "bad", label: "Couldn't read" };
    default:
      if (doc.engine === "pdf-text") return { tone: "ok", label: "Searchable", detail: "text layer" };
      if (doc.average_confidence == null) return { tone: "ok", label: "Searchable" };
      if (doc.average_confidence < LOW_CONFIDENCE)
        return { tone: "warn", label: "Low confidence", detail: `${doc.average_confidence}%` };
      return { tone: "ok", label: "Searchable", detail: `${doc.average_confidence}%` };
  }
}

export function progressOf(doc: DocumentSummary) {
  if (!doc.total_pages) return 0.04;
  return Math.max(0.04, (doc.processed_pages ?? 0) / doc.total_pages);
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className={cn("h-1 overflow-hidden rounded-full bg-sunken", className)}
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${value * 100}%` }} />
    </div>
  );
}

/** One line describing where a document is: searchable, being read, or needing attention. */
export function StatusLine({ doc, showBar = true, className }: { doc: DocumentSummary; showBar?: boolean; className?: string }) {
  const reprocess = useReprocessDocument();
  const { tone, label, detail } = describeStatus(doc);

  return (
    <div className={className}>
      <div className="flex items-center gap-[7px] text-xs">
        <span aria-hidden="true" className={cn("size-[7px] shrink-0 rounded-full", DOT[tone])} />
        <span className="text-ink-2">{label}</span>
        {detail && <span className="ml-auto font-mono text-ink-3">{detail}</span>}
        {doc.status === "error" && (
          <button
            type="button"
            onClick={() => reprocess.mutate({ id: doc._id })}
            disabled={reprocess.isPending}
            className="relative z-10 ml-auto font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
          >
            Retry
          </button>
        )}
      </div>
      {showBar && doc.status === "processing" && <ProgressBar value={progressOf(doc)} className="mt-1.5" />}
    </div>
  );
}
