import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, FileUp, LayoutGrid, List, Loader2 } from "lucide-react";
import { useDocuments, useStats } from "@/api/documents";
import { DocumentCard, DocumentListHeader, DocumentRow } from "@/components/documents/DocumentCard";
import { EmptyState } from "@/components/EmptyState";
import { useBreadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { cn, pluralize } from "@/lib/utils";
import type { LibraryFilter, LibrarySort, LibraryStats } from "@/types";

const PAGE_SIZE = 24;

const FILTERS: { value: LibraryFilter; label: string; count: (s: LibraryStats) => number }[] = [
  { value: "all", label: "All", count: (s) => s.total },
  { value: "ready", label: "Searchable", count: (s) => s.completed },
  { value: "progress", label: "In progress", count: (s) => s.processing + s.pending },
  { value: "attention", label: "Needs attention", count: (s) => s.attention },
];

const SORTS: { value: LibrarySort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title", label: "Title A–Z" },
];

const EMPTY_FILTER: Record<Exclude<LibraryFilter, "all">, { title: string; body: string }> = {
  ready: { title: "Nothing searchable yet", body: "Documents show up here once they've been read." },
  progress: { title: "Nothing is being read", body: "New uploads appear here while their pages are read." },
  attention: { title: "Nothing needs attention", body: "Every document was read without problems." },
};

type Layout = "grid" | "list";
const LAYOUT_KEY = "library-layout";

function useLayout() {
  const [layout, setLayout] = useState<Layout>(() =>
    localStorage.getItem(LAYOUT_KEY) === "list" ? "list" : "grid",
  );
  const update = (next: Layout) => {
    localStorage.setItem(LAYOUT_KEY, next);
    setLayout(next);
  };
  return [layout, update] as const;
}

export default function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const filter = (FILTERS.find((f) => f.value === params.get("status"))?.value ?? "all") as LibraryFilter;
  const sort = (SORTS.find((s) => s.value === params.get("sort"))?.value ?? "newest") as LibrarySort;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [layout, setLayout] = useLayout();

  const { data: stats } = useStats();
  const { data, isPending, isError, refetch, isFetching } = useDocuments({ status: filter, sort, page, limit: PAGE_SIZE });

  const filterLabel = FILTERS.find((f) => f.value === filter)!.label;
  useBreadcrumbs([{ label: "Library", to: "/library" }, { label: filter === "all" ? "All documents" : filterLabel }]);

  const setParam = (key: string, value: string | null) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null) next.delete(key);
        else next.set(key, value);
        if (key !== "page") next.delete("page");
        return next;
      },
      { replace: key !== "page" },
    );
  };

  // Deleting the last document on the last page leaves you past the end
  useEffect(() => {
    if (data && data.totalPages > 0 && page > data.totalPages) setParam("page", String(data.totalPages));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, page]);

  const reading = stats ? stats.processing + stats.pending : 0;
  const summary = stats
    ? [
        pluralize(stats.total, "document"),
        `${stats.completed} searchable`,
        reading > 0 && `${reading} being read now`,
        stats.attention > 0 && `${stats.attention} need${stats.attention === 1 ? "s" : ""} attention`,
      ]
        .filter(Boolean)
        .join(" · ")
    : " ";

  const libraryEmpty = stats?.total === 0;

  return (
    <div className="max-w-[1180px] animate-fade-in px-[18px] py-8 md:px-8">
      <header className="mb-[22px]">
        <h1 className="text-[34px] leading-[1.1]">Your library</h1>
        <p className="mt-1.5 text-ink-2">{summary}</p>
      </header>

      {libraryEmpty ? (
        <EmptyState
          icon={FileUp}
          title="Your library is empty"
          action={
            <Button asChild>
              <Link to="/upload">
                <FileUp />
                Add documents
              </Link>
            </Button>
          }
        >
          Upload PDFs, scans or photos. They're read in the background, and then every page is searchable.
        </EmptyState>
      ) : (
        <>
          <div className="mb-[18px] flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Filter documents" className="flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const on = f.value === filter;
                return (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setParam("status", f.value === "all" ? null : f.value)}
                    className={cn(
                      "inline-flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on
                        ? "border-ink bg-ink text-paper"
                        : "border-rule-strong text-ink-2 hover:border-ink-3 hover:text-ink",
                    )}
                  >
                    {f.label}
                    {stats && <span className="font-mono text-[11px] opacity-70">{f.count(stats)}</span>}
                  </button>
                );
              })}
            </div>
            <span className="flex-1" />
            {isFetching && !isPending && <Loader2 className="size-4 animate-spin text-ink-3" aria-label="Updating" />}
            <NativeSelect
              aria-label="Sort documents"
              value={sort}
              onChange={(e) => setParam("sort", e.target.value === "newest" ? null : e.target.value)}
              className="h-[30px] w-auto text-xs"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
            <div role="group" aria-label="Layout" className="inline-flex overflow-hidden rounded-lg border border-rule-strong">
              {(
                [
                  ["grid", LayoutGrid, "Grid view"],
                  ["list", List, "List view"],
                ] as const
              ).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-label={label}
                  aria-pressed={layout === value}
                  onClick={() => setLayout(value)}
                  className={cn(
                    "grid h-[30px] w-[34px] place-items-center text-ink-3 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    layout === value && "bg-sunken text-ink",
                  )}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          </div>

          {isPending ? (
            <LibrarySkeleton layout={layout} />
          ) : isError ? (
            <EmptyState
              title="Couldn't load your library"
              action={
                <Button variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
              }
            >
              Check that the server is running, then try again.
            </EmptyState>
          ) : data.documents.length === 0 ? (
            <EmptyState title={filter === "all" ? "No documents" : EMPTY_FILTER[filter].title}>
              {filter === "all" ? "Upload something to get started." : EMPTY_FILTER[filter].body}{" "}
              {filter !== "all" && (
                <button type="button" className="font-medium text-primary hover:underline" onClick={() => setParam("status", null)}>
                  Show all documents
                </button>
              )}
            </EmptyState>
          ) : layout === "grid" ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-4">
              {data.documents.map((doc) => (
                <DocumentCard key={doc._id} doc={doc} />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-rule bg-raised">
              <DocumentListHeader />
              {data.documents.map((doc) => (
                <DocumentRow key={doc._id} doc={doc} />
              ))}
            </div>
          )}

          {data && data.totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setParam("page", String(page - 1))}
              >
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
                onClick={() => setParam("page", String(page + 1))}
              >
                Next
                <ChevronRight />
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function LibrarySkeleton({ layout }: { layout: Layout }) {
  if (layout === "list") {
    return (
      <div className="overflow-hidden rounded-xl border border-rule bg-raised" aria-busy="true" aria-label="Loading documents">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-rule px-4 py-[13px] first:border-t-0">
            <span className="size-8 animate-pulse rounded-lg bg-sunken" />
            <span className="h-3 w-1/3 animate-pulse rounded bg-sunken" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-4" aria-busy="true" aria-label="Loading documents">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-rule bg-raised">
          <div className="h-[148px] animate-pulse border-b border-rule bg-sunken" />
          <div className="space-y-2.5 p-3.5">
            <div className="h-4 w-3/4 animate-pulse rounded bg-sunken" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-sunken" />
          </div>
        </div>
      ))}
    </div>
  );
}
