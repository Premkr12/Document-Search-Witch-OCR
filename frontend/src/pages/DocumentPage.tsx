import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  FileQuestion,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { downloadOriginal, useDocument, useDocumentFile, useReprocessDocument } from "@/api/documents";
import { DeleteDialog, RenameDialog } from "@/components/documents/DocumentDialogs";
import { ProgressBar, describeStatus, progressOf } from "@/components/documents/StatusLine";
import { EmptyState } from "@/components/EmptyState";
import { isMac } from "@/components/CommandPalette";
import { useBreadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LANGUAGES, LOW_CONFIDENCE, languageLabel } from "@/lib/constants";
import { cn, formatBytes, isImage, pluralize, queryPattern, saveBlob, timeAgo } from "@/lib/utils";
import type { DocumentDetail } from "@/types";

const ENGINE_LABELS: Record<string, string> = {
  "pdf-text": "PDF text layer",
  easyocr: "EasyOCR",
  tesseract: "Tesseract",
  // Some pages were kept from a second reading by the other engine
  mixed: "EasyOCR + Tesseract",
};

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

type Part = string | { text: string; index: number };

/** Split every page into plain text and numbered matches, counting matches across the whole document. */
function findMatches(pages: string[], query: string) {
  const pattern = queryPattern(query);
  const matchPages: number[] = [];
  if (!pattern) return { parts: pages.map((text) => [text] as Part[]), matchPages };

  const regex = new RegExp(pattern, "gi");
  const parts = pages.map((text, pageIndex) => {
    const out: Part[] = [];
    let last = 0;
    for (const m of text.matchAll(regex)) {
      out.push(text.slice(last, m.index));
      out.push({ text: m[0], index: matchPages.length });
      matchPages.push(pageIndex + 1);
      last = m.index! + m[0].length;
    }
    out.push(text.slice(last));
    return out;
  });
  return { parts, matchPages };
}

function documentKind(doc: DocumentDetail) {
  if (isImage(doc)) return "Image";
  if (doc.engine === "pdf-text") return "PDF with text";
  if (doc.status === "completed") return "Scanned PDF";
  return "PDF";
}

export default function DocumentPage() {
  const { documentId } = useParams();
  const { data: doc, isPending, isError } = useDocument(documentId);

  useBreadcrumbs([{ label: "Library", to: "/library" }, { label: doc?.title ?? (isError ? "Not found" : "Document") }]);

  if (isPending) {
    return (
      <div className="flex h-[60vh] items-center justify-center" role="status">
        <Loader2 className="size-6 animate-spin text-ink-3" />
        <span className="sr-only">Loading document</span>
      </div>
    );
  }

  if (isError || !doc) {
    return (
      <div className="px-[18px] py-8 md:px-8">
        <EmptyState
          icon={FileQuestion}
          title="This document isn't here"
          action={
            <Button asChild variant="outline">
              <Link to="/library">Back to your library</Link>
            </Button>
          }
        >
          It may have been deleted, or the link is wrong.
        </EmptyState>
      </div>
    );
  }

  return <DocumentView key={doc._id} doc={doc} />;
}

function DocumentView({ doc }: { doc: DocumentDetail }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const reprocess = useReprocessDocument();
  const file = useDocumentFile(doc._id);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const pages = useMemo(() => (doc.status === "completed" ? doc.pages ?? [] : []), [doc.status, doc.pages]);
  const pageCount = Math.max(doc.total_pages ?? 0, pages.length, 1);
  const multiPage = pageCount > 1;
  const busy = doc.status === "processing" || doc.status === "pending";

  // ── Find in document ──
  const [find, setFind] = useState(() => params.get("q") ?? "");
  const [current, setCurrent] = useState(0);
  const [page, setPage] = useState(() => Math.min(Math.max(1, Number(params.get("page")) || 1), pageCount));
  const { parts, matchPages } = useMemo(() => findMatches(pages, find), [pages, find]);
  const total = matchPages.length;

  const findInput = useRef<HTMLInputElement>(null);
  const readingRef = useRef<HTMLDivElement>(null);
  const firstJump = useRef(true);

  // A new query starts at its first match (on the requested page, the first time)
  useEffect(() => {
    if (firstJump.current) {
      firstJump.current = false;
      const requested = Number(params.get("page"));
      const onPage = matchPages.indexOf(requested);
      setCurrent(onPage >= 0 ? onPage : 0);
      return;
    }
    setCurrent(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [find, pages]);

  // Show the current match: its page in the preview, and the mark in the text
  useEffect(() => {
    if (!total) return;
    setPage(matchPages[current]);
    const container = readingRef.current;
    const mark = container?.querySelector<HTMLElement>(`[data-match="${current}"]`);
    if (!container || !mark) return;
    if (container.scrollHeight > container.clientHeight + 4) {
      const top = mark.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({ top: top - container.clientHeight / 3, behavior: "smooth" });
    } else {
      mark.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [current, total, matchPages]);

  // Keep ?q= in the URL so the view can be shared or reloaded
  useEffect(() => {
    const id = setTimeout(() => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (find.trim()) next.set("q", find.trim());
          else next.delete("q");
          next.delete("page");
          return next;
        },
        { replace: true },
      );
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [find]);

  // Ctrl/⌘+F finds in this document's text
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "f" && pages.length) {
        e.preventDefault();
        findInput.current?.focus();
        findInput.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages.length]);

  const step = (delta: number) => total && setCurrent((c) => (c + delta + total) % total);

  const jumpToPage = (p: number) => {
    setPage(p);
    const target = readingRef.current?.querySelector<HTMLElement>(`[data-page="${p}"]`);
    const container = readingRef.current;
    if (!target || !container) return;
    if (container.scrollHeight > container.clientHeight + 4) {
      container.scrollTo({ top: target.offsetTop - 8, behavior: "smooth" });
    }
  };

  // ── Actions ──
  const fullText = pages.map((t, i) => (multiPage ? `--- Page ${i + 1} ---\n${t}` : t)).join("\n\n");
  const downloadText = () => saveBlob(new Blob([fullText], { type: "text/plain;charset=utf-8" }), `${doc.title}.txt`);
  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(pages.join("\n\n"));
      toast("Text copied");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.");
    }
  };

  const words = useMemo(() => pages.join(" ").split(/\s+/).filter(Boolean).length, [pages]);
  const meta = [
    doc.originalName,
    documentKind(doc),
    doc.total_pages ? pluralize(doc.total_pages, "page") : null,
    formatBytes(doc.size),
    `uploaded ${timeAgo(doc.createdAt).toLowerCase()}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const lowConfidence =
    doc.status === "completed" &&
    doc.engine !== "pdf-text" &&
    doc.average_confidence != null &&
    doc.average_confidence < LOW_CONFIDENCE;

  return (
    <div className="flex animate-fade-in flex-col xl:h-[calc(100vh-57px)]">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-rule px-[18px] py-4 md:px-8">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <h1 className="truncate text-2xl">{doc.title}</h1>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="size-7 shrink-0 text-ink-3" onClick={() => setRenaming(true)} aria-label="Rename">
                  <Pencil className="!size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rename</TooltipContent>
            </Tooltip>
          </div>
          <p className="truncate font-mono text-xs text-ink-3">{meta}</p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={busy || reprocess.isPending}>
                <RefreshCw className={cn(reprocess.isPending && "animate-spin")} />
                Re-read
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs font-normal text-ink-3">Read again as…</DropdownMenuLabel>
              {LANGUAGES.map((l) => (
                <DropdownMenuItem key={l.code} onSelect={() => reprocess.mutate({ id: doc._id, language: l.code })}>
                  <Check className={cn(l.code === (doc.language ?? "eng") ? "opacity-100" : "opacity-0")} />
                  {l.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={downloadText} disabled={!pages.length}>
            <Download />
            Text
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => downloadOriginal(doc)}>
                <Download className="text-ink-3" />
                Download original
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={copyText} disabled={!pages.length}>
                <Copy className="text-ink-3" />
                Copy all text
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setRenaming(true)}>
                <Pencil className="text-ink-3" />
                Rename…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setDeleting(true)}
                className="text-destructive focus:bg-destructive-soft focus:text-destructive"
              >
                <Trash2 />
                Delete…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]">
        {/* Preview */}
        <Preview
          doc={doc}
          url={file.url}
          fileError={file.isError}
          page={page}
          pageCount={pageCount}
          onPage={jumpToPage}
          matchPages={matchPages}
        />

        {/* Text */}
        <section aria-label="Extracted text" className="flex min-h-0 min-w-0 flex-col bg-raised">
          {doc.status === "completed" && pages.some((p) => p.trim()) ? (
            <>
              <div className="flex shrink-0 items-center gap-1.5 border-b border-rule px-3.5 py-2.5">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
                  <Input
                    ref={findInput}
                    value={find}
                    onChange={(e) => setFind(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        step(e.shiftKey ? -1 : 1);
                      } else if (e.key === "Escape" && find) {
                        e.preventDefault();
                        setFind("");
                      }
                    }}
                    placeholder="Find in this document"
                    aria-label="Find in this document"
                    className="h-8 pl-8 pr-8"
                  />
                  {find && (
                    <button
                      type="button"
                      onClick={() => {
                        setFind("");
                        findInput.current?.focus();
                      }}
                      aria-label="Clear"
                      className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-ink-3 hover:text-ink"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                <span className="min-w-[60px] text-center font-mono text-xs text-ink-2" aria-live="polite">
                  {find.trim() ? (total ? `${Math.min(current, total - 1) + 1} of ${total}` : "0 found") : ""}
                </span>
                <Button variant="ghost" size="icon-sm" onClick={() => step(-1)} disabled={!total} aria-label="Previous match">
                  <ChevronUp />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => step(1)} disabled={!total} aria-label="Next match">
                  <ChevronDown />
                </Button>
              </div>

              {lowConfidence && (
                <div className="flex shrink-0 gap-2.5 border-b border-rule bg-warning-soft px-4 py-2.5 text-xs text-ink">
                  <AlertTriangle className="mt-px size-4 shrink-0 text-warning" aria-hidden="true" />
                  <p>
                    Read with {doc.average_confidence}% confidence, so some words may be wrong. Try{" "}
                    <strong className="font-medium">Re-read</strong> in another language, or upload a sharper scan.
                  </p>
                </div>
              )}

              <div
                ref={readingRef}
                className="reading-text relative min-h-0 flex-1 overflow-auto px-[26px] pb-8 pt-2 text-base leading-[1.75] text-ink"
              >
                {parts.map((pageParts, i) => (
                  <div key={i} data-page={i + 1}>
                    {multiPage && (
                      <div className="mb-3.5 mt-[22px] flex items-center gap-2.5 font-mono text-[11px] font-medium tracking-[0.04em] text-ink-3 after:h-px after:flex-1 after:bg-rule">
                        PAGE {i + 1}
                      </div>
                    )}
                    {pages[i].trim() ? (
                      <div className="whitespace-pre-wrap break-words">
                        {pageParts.map((part, j) =>
                          typeof part === "string" ? (
                            <Fragment key={j}>{part}</Fragment>
                          ) : (
                            <mark
                              key={j}
                              data-match={part.index}
                              className={cn("hl", part.index === current && "hl-current")}
                            >
                              {part.text}
                            </mark>
                          ),
                        )}
                      </div>
                    ) : (
                      <p className="font-sans text-sm italic text-ink-3">No text on this page.</p>
                    )}
                  </div>
                ))}
              </div>

              <TextFooter doc={doc} words={words} />
            </>
          ) : (
            <TextState doc={doc} onReread={() => reprocess.mutate({ id: doc._id })} rereading={reprocess.isPending} />
          )}
        </section>
      </div>

      <RenameDialog doc={doc} open={renaming} onOpenChange={setRenaming} />
      <DeleteDialog doc={doc} open={deleting} onOpenChange={setDeleting} onDeleted={() => navigate("/library")} />
    </div>
  );
}

// ── Preview of the original file ─────────────────────────────────────────────

function Preview({
  doc,
  url,
  fileError,
  page,
  pageCount,
  onPage,
  matchPages,
}: {
  doc: DocumentDetail;
  url: string | null;
  fileError: boolean;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  matchPages: number[];
}) {
  const image = isImage(doc);
  const [zoom, setZoom] = useState(1);
  const pagesWithMatches = useMemo(() => new Set(matchPages), [matchPages]);
  const zoomIndex = ZOOM_STEPS.indexOf(zoom);

  return (
    <section
      aria-label="Original file"
      className="flex min-h-0 min-w-0 flex-col border-b border-rule bg-sunken xl:border-b-0 xl:border-r"
    >
      <div className="flex h-[49px] shrink-0 items-center gap-1.5 border-b border-rule bg-paper px-4">
        {image ? (
          <>
            <span className="text-xs text-ink-2">Original image</span>
            <span className="flex-1" />
            <Button variant="ghost" size="icon-sm" aria-label="Zoom out" disabled={zoomIndex <= 0} onClick={() => setZoom(ZOOM_STEPS[zoomIndex - 1])}>
              <ZoomOut />
            </Button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="w-12 rounded text-center font-mono text-xs text-ink-2 hover:text-ink"
              aria-label="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom in"
              disabled={zoomIndex >= ZOOM_STEPS.length - 1}
              onClick={() => setZoom(ZOOM_STEPS[zoomIndex + 1])}
            >
              <ZoomIn />
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
              <ChevronLeft />
            </Button>
            <span className="font-mono text-xs text-ink-2">
              Page {page} of {pageCount}
            </span>
            <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
              <ChevronRight />
            </Button>
          </>
        )}
      </div>

      <div className="relative flex min-h-[420px] flex-1 justify-center overflow-auto p-4 md:p-7">
        {fileError ? (
          <p className="self-center text-sm text-ink-3">The original file couldn't be loaded.</p>
        ) : !url ? (
          <Loader2 className="size-5 animate-spin self-center text-ink-3" aria-label="Loading preview" />
        ) : image ? (
          <img
            src={url}
            alt={`Original image of ${doc.title}`}
            style={{ width: `${zoom * 100}%` }}
            className="h-fit max-w-none self-start rounded-sm shadow-[var(--sheet-shadow)] dark:brightness-[.88]"
          />
        ) : (
          // Remount on page change so the browser's PDF viewer jumps to it
          <iframe
            key={page}
            src={`${url}#page=${page}&navpanes=0&view=FitH`}
            title={`${doc.title}, page ${page}`}
            className="h-[70vh] w-full rounded-sm bg-white shadow-[var(--sheet-shadow)] xl:h-full"
          />
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-rule bg-paper px-4 py-2.5" role="group" aria-label="Pages">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              aria-current={p === page ? "page" : undefined}
              aria-label={`Page ${p}${pagesWithMatches.has(p) ? ", has matches" : ""}`}
              className={cn(
                "relative grid h-[49px] w-[38px] shrink-0 place-items-end justify-center rounded-sm border border-rule-strong bg-raised pb-0.5 font-mono text-[10px] text-ink-3 hover:border-ink-3",
                p === page && "text-ink outline outline-2 outline-offset-1 outline-primary",
              )}
            >
              {pagesWithMatches.has(p) && (
                <span className="absolute right-1 top-1 size-1.5 rounded-full bg-highlight-strong" aria-hidden="true" />
              )}
              {p}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Text panel states ────────────────────────────────────────────────────────

function TextFooter({ doc, words }: { doc: DocumentDetail; words: number }) {
  const textLayer = doc.engine === "pdf-text";
  const low = doc.average_confidence != null && doc.average_confidence < LOW_CONFIDENCE;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3.5 gap-y-1 border-t border-rule px-4 py-[11px] text-xs text-ink-3">
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn("size-[7px] rounded-full", textLayer || !low ? "bg-success" : "bg-warning")}
        />
        {textLayer
          ? "Exact text"
          : doc.average_confidence != null
            ? `${doc.average_confidence}% confidence`
            : "Searchable"}
      </span>
      {!textLayer && <span>{languageLabel(doc.language)}</span>}
      {doc.engine && <span>{ENGINE_LABELS[doc.engine] ?? doc.engine}</span>}
      <span className="ml-auto">{pluralize(words, "word")}</span>
    </div>
  );
}

function TextState({ doc, onReread, rereading }: { doc: DocumentDetail; onReread: () => void; rereading: boolean }) {
  if (doc.status === "processing" || doc.status === "pending") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
        <h2 className="text-xl">{describeStatus(doc).label}</h2>
        {doc.status === "processing" && <ProgressBar value={progressOf(doc)} className="w-56" />}
        <p className="max-w-xs text-sm text-ink-2">
          The text appears here when reading finishes. You can leave this page; it keeps going.
        </p>
      </div>
    );
  }

  const failed = doc.status === "error";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      <span className={cn("grid size-12 place-items-center rounded-xl", failed ? "bg-destructive-soft text-destructive" : "bg-sunken text-ink-2")}>
        {failed ? <AlertTriangle className="size-[22px]" /> : <FileQuestion className="size-[22px]" />}
      </span>
      <h2 className="text-xl">{failed ? "Couldn't read this document" : "No text found"}</h2>
      <p className="max-w-sm text-sm text-ink-2">
        {failed
          ? doc.errorMessage || "Something went wrong while reading it."
          : "Nothing readable was found on these pages. If it's a photo, try a sharper image, or re-read it in another language."}
      </p>
      <Button variant="outline" onClick={onReread} disabled={rereading}>
        <RefreshCw className={cn(rereading && "animate-spin")} />
        Read again
      </Button>
    </div>
  );
}
