import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, ChevronLeft, ChevronRight, Loader2, Search, SearchX, X } from "lucide-react";
import { useSearch, useStats } from "@/api/documents";
import { EmptyState } from "@/components/EmptyState";
import { Highlight } from "@/components/Highlight";
import { useBreadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { LANGUAGES } from "@/lib/constants";
import { cn, fileKind, pluralize } from "@/lib/utils";
import type { SearchResult } from "@/types";

const FILTERS = [
  {
    key: "type",
    label: "Type",
    options: [
      ["", "Any type"],
      ["pdf", "PDF"],
      ["image", "Image"],
    ],
  },
  {
    key: "lang",
    label: "Language",
    options: [["", "Any language"], ...LANGUAGES.map((l) => [l.code, l.label])],
  },
  {
    key: "since",
    label: "Uploaded",
    options: [
      ["", "Any time"],
      ["7", "Past week"],
      ["30", "Past month"],
      ["365", "Past year"],
    ],
  },
  {
    key: "min",
    label: "Confidence",
    options: [
      ["", "Any confidence"],
      ["80", "80% and above"],
      ["60", "60% and above"],
    ],
  },
] as const;

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [text, setText] = useState(q);
  const inputRef = useRef<HTMLInputElement>(null);

  useBreadcrumbs(q.trim() ? [{ label: "Search", to: "/search" }, { label: `“${q.trim()}”` }] : [{ label: "Search" }]);

  // The palette can change ?q= while this page is open
  useEffect(() => {
    if (q !== text.trim()) setText(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const update = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (!("page" in patch)) next.delete("page");
        return next;
      },
      { replace: !("page" in patch) },
    );

  // Search as you type, after a short pause
  useEffect(() => {
    const value = text.trim();
    if (value === q.trim()) return;
    const id = setTimeout(() => update({ q: value || null }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const { data: stats } = useStats();
  const { data, isFetching, isError, refetch } = useSearch({
    query: q,
    type: params.get("type") ?? undefined,
    language: params.get("lang") ?? undefined,
    since: params.get("since") ?? undefined,
    minConfidence: params.get("min") ?? undefined,
    page,
  });

  const filtersActive = FILTERS.some((f) => params.get(f.key));
  const reading = stats ? stats.processing + stats.pending : 0;
  const hint = data && q.trim() ? `${pluralize(data.totalMatches, "match", "matches")} · ${pluralize(data.totalCount, "document")}` : "";

  return (
    <div className="max-w-[920px] animate-fade-in px-[18px] py-8 md:px-8">
      <h1 className="sr-only">Search</h1>
      <form
        role="search"
        className="relative mb-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: text.trim() || null });
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <Input
          ref={inputRef}
          autoFocus
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search every page"
          aria-label="Search every page"
          className="h-[54px] rounded-xl pl-12 pr-12 font-serif text-xl [font-variation-settings:'opsz'_24] md:pr-52 [&::-webkit-search-cancel-button]:hidden"
        />
        <span className="absolute right-3.5 top-1/2 flex -translate-y-1/2 items-center gap-2 text-xs text-ink-3">
          {isFetching && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
          <span className="hidden md:inline" aria-live="polite">
            {hint}
          </span>
          {text && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setText("");
                update({ q: null });
                inputRef.current?.focus();
              }}
              className="grid size-7 place-items-center rounded-md hover:bg-sunken hover:text-ink"
            >
              <X className="size-4" />
            </button>
          )}
        </span>
      </form>

      <div className="mb-[26px] flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <NativeSelect
            key={f.key}
            aria-label={f.label}
            value={params.get(f.key) ?? ""}
            onChange={(e) => update({ [f.key]: e.target.value || null })}
            className={cn("h-8 w-auto text-xs", params.get(f.key) && "border-primary text-primary")}
          >
            {f.options.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        ))}
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={() => update({ type: null, lang: null, since: null, min: null })}>
            Clear filters
          </Button>
        )}
      </div>

      {hint && <p className="mb-3 text-xs text-ink-3 md:hidden">{hint}</p>}

      {!q.trim() ? (
        <EmptyState icon={Search} title="Search every page">
          Type a word or phrase. You'll see each page it appears on, with the sentence around it. Documents match if they
          contain any of your words; the ones with the most matches come first.
        </EmptyState>
      ) : isError ? (
        <EmptyState
          title="Search isn't working right now"
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          }
        >
          Check that the server is running, then try again.
        </EmptyState>
      ) : !data ? (
        <ResultsSkeleton />
      ) : data.results.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={`No matches for “${q.trim()}”`}
          action={
            filtersActive && (
              <Button variant="outline" onClick={() => update({ type: null, lang: null, since: null, min: null })}>
                Clear filters
              </Button>
            )
          }
        >
          Check the spelling or try fewer words.
          {filtersActive && " Filters may be hiding results."}
        </EmptyState>
      ) : (
        <div className={cn("space-y-3.5 transition-opacity", isFetching && "opacity-70")}>
          {data.results.map((result) => (
            <ResultCard key={result.document._id} result={result} query={q} />
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && q.trim() && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
            <ChevronLeft />
            Previous
          </Button>
          <span className="font-mono text-xs text-ink-2">
            Page {page} of {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => update({ page: String(page + 1) })}
          >
            Next
            <ChevronRight />
          </Button>
        </nav>
      )}

      {q.trim() && reading > 0 && (
        <p className="mt-6 text-center text-xs text-ink-3">
          {pluralize(reading, "document")} still being read {reading === 1 ? "isn't" : "aren't"} included yet.
        </p>
      )}
    </div>
  );
}

function ResultCard({ result, query }: { result: SearchResult; query: string }) {
  const { document: doc, hits, matchCount, pagesWithMatches } = result;
  const docLink = (page?: number) =>
    `/document/${doc._id}?${new URLSearchParams({ q: query.trim(), ...(page ? { page: String(page) } : {}) })}`;
  const morePages = pagesWithMatches - hits.length;

  return (
    <article className="overflow-hidden rounded-xl border border-rule bg-raised">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pb-2.5 pt-3.5">
        <h2 className="min-w-0 text-lg [font-variation-settings:'opsz'_24]">
          <Link to={docLink()} className="rounded-sm hover:underline hover:decoration-rule-strong hover:underline-offset-4">
            <Highlight text={doc.title} query={query} />
          </Link>
        </h2>
        <span className="font-mono text-[11px] text-ink-3">
          {fileKind(doc.mimeType)}
          {doc.total_pages ? ` · ${pluralize(doc.total_pages, "page")}` : ""}
          {matchCount > 0 && ` · ${pluralize(matchCount, "match", "matches")}`}
          {pagesWithMatches > 1 && ` on ${pagesWithMatches} pages`}
        </span>
      </header>

      {hits.length === 0 ? (
        <Link
          to={docLink()}
          className="group flex items-center gap-3 border-t border-dashed border-rule px-4 py-2.5 text-sm text-ink-2 hover:bg-paper"
        >
          Matched by its title
          <ArrowRight className="ml-auto size-4 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
        </Link>
      ) : (
        hits.map((hit) => (
          <Link
            key={hit.page}
            to={docLink(hit.page)}
            className="group grid grid-cols-[56px_minmax(0,1fr)_auto] items-baseline gap-3 border-t border-dashed border-rule px-4 py-2.5 hover:bg-paper focus-visible:bg-paper focus-visible:outline-none"
          >
            <span className="font-mono text-[11px] font-medium text-ink-3">PAGE {hit.page}</span>
            <span className="reading-text text-[15px] leading-[1.6] text-ink">
              <Highlight text={hit.snippet} query={query} />
            </span>
            <span className="flex items-center gap-2">
              {hit.count > 1 && <span className="font-mono text-[11px] text-ink-3">×{hit.count}</span>}
              <ArrowRight
                className="size-4 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                aria-hidden="true"
              />
            </span>
          </Link>
        ))
      )}

      {morePages > 0 && (
        <Link
          to={docLink()}
          className="block border-t border-dashed border-rule px-4 py-2 text-xs font-medium text-primary hover:bg-paper"
        >
          {pluralize(morePages, "more page")} with matches
        </Link>
      )}
    </article>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-3.5" aria-busy="true" aria-label="Searching">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-rule bg-raised p-4">
          <div className="h-4 w-1/3 animate-pulse rounded bg-sunken" />
          <div className="h-3 w-full animate-pulse rounded bg-sunken" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-sunken" />
        </div>
      ))}
    </div>
  );
}
