import { cn, fileKind, isImage } from "@/lib/utils";
import type { DocumentSummary } from "@/types";

const LINE_WIDTHS = [88, 94, 76, 90, 64, 85, 92, 70, 80, 74, 96, 68];

/** A drawn page standing in for a thumbnail; images get a tilted "photo". */
export function DocThumb({ doc, className }: { doc: DocumentSummary; className?: string }) {
  const photo = isImage(doc);
  // Vary the lines per document so the grid doesn't look stamped
  const offset = parseInt(doc._id.slice(-4), 16) % LINE_WIDTHS.length || 0;
  const lines = [...LINE_WIDTHS.slice(offset), ...LINE_WIDTHS.slice(0, offset)].slice(0, photo ? 6 : 9);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex h-[148px] items-end justify-center overflow-hidden border-b border-rule bg-sunken",
        className,
      )}
    >
      <span className="absolute left-2.5 top-2.5 rounded border border-rule bg-raised px-1.5 font-mono text-[10px] font-medium leading-4 text-ink-2">
        {fileKind(doc.mimeType)}
      </span>
      <div
        className={cn(
          "flex h-32 w-[58%] flex-col gap-[5px] rounded-t-[3px] border border-b-0 border-rule-strong bg-raised px-3 py-3.5",
          photo && "translate-y-1.5 -rotate-3",
        )}
      >
        <i className="mb-1 block h-1.5 w-[48%] rounded-sm bg-ink-3" />
        {lines.map((width, i) => (
          <i key={i} className="block h-[3px] rounded-sm bg-rule-strong" style={{ width: `${width}%` }} />
        ))}
      </div>
    </div>
  );
}
