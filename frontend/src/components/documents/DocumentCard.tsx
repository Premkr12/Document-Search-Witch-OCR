import { Link } from "react-router-dom";
import { FileText, Image as ImageIcon } from "lucide-react";
import { cn, fileKind, isImage, pluralize, timeAgo } from "@/lib/utils";
import type { DocumentSummary } from "@/types";
import { DocThumb } from "./DocThumb";
import { DocumentMenu } from "./DocumentMenu";
import { StatusLine } from "./StatusLine";

function metaLine(doc: DocumentSummary) {
  const parts = [doc.total_pages ? pluralize(doc.total_pages, "page") : fileKind(doc.mimeType), timeAgo(doc.createdAt)];
  return parts.join(" · ");
}

// The title link stretches over the whole card; the menu and Retry sit above it
const stretchedLink =
  "rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none";

export function DocumentCard({ doc }: { doc: DocumentSummary }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-rule bg-raised transition-[border-color,transform] duration-150 focus-within:border-primary hover:-translate-y-px hover:border-rule-strong">
      <DocThumb doc={doc} />
      <div className="flex flex-1 flex-col gap-1 px-3.5 pb-3.5 pt-[13px]">
        <div className="flex items-start gap-1.5">
          <h3 className="line-clamp-2 flex-1 break-words text-base leading-[1.3] [font-variation-settings:'opsz'_24]">
            <Link to={`/document/${doc._id}`} className={stretchedLink}>
              {doc.title}
            </Link>
          </h3>
          <DocumentMenu doc={doc} className="-mr-1.5 -mt-0.5" />
        </div>
        <p className="font-mono text-[11px] text-ink-3">{metaLine(doc)}</p>
        <StatusLine doc={doc} className="mt-auto pt-2.5" />
      </div>
    </article>
  );
}

export const LIST_COLUMNS = "md:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.4fr)_100px_28px]";

export function DocumentListHeader() {
  return (
    <div className={cn("eyebrow hidden gap-3.5 bg-paper px-4 py-2.5 md:grid", LIST_COLUMNS)} aria-hidden="true">
      <span>Name</span>
      <span>Type</span>
      <span>Status</span>
      <span>Added</span>
      <span />
    </div>
  );
}

export function DocumentRow({ doc }: { doc: DocumentSummary }) {
  const Icon = isImage(doc) ? ImageIcon : FileText;

  return (
    <div
      className={cn(
        "relative grid grid-cols-[minmax(0,1fr)_28px] items-center gap-x-3.5 gap-y-1.5 border-t border-rule px-4 max-md:[&:nth-child(2)]:border-t-0 py-[11px] transition-colors focus-within:bg-paper hover:bg-paper",
        LIST_COLUMNS,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sunken text-ink-2">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <Link to={`/document/${doc._id}`} className={cn(stretchedLink, "truncate font-medium text-ink")}>
          {doc.title}
        </Link>
      </div>
      <span className="hidden font-mono text-xs text-ink-3 md:block">
        {fileKind(doc.mimeType)}
        {doc.total_pages ? ` · ${pluralize(doc.total_pages, "page")}` : ""}
      </span>
      <StatusLine doc={doc} className="col-start-1 row-start-2 md:col-start-auto md:row-start-auto" />
      <span className="hidden text-xs text-ink-3 md:block">{timeAgo(doc.createdAt)}</span>
      <DocumentMenu doc={doc} className="col-start-2 row-span-2 row-start-1 md:col-start-auto md:row-span-1 md:row-start-auto" />
    </div>
  );
}
