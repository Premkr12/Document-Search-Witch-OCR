import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink } from "lucide-react";

export interface SearchResult {
  document_id: string;
  document_title: string;
  page_number: number;
  text_snippet: string;
  confidence_score: number;
  thumbnail_url: string | null;
}

interface SearchResultsProps {
  results: SearchResult[];
  query: string; // ← the current search query for highlighting
  onViewDocument: (documentId: string, pageNumber: number) => void;
}

/** Highlights all query words inside text with a warm amber <mark> */
const HighlightSnippet = ({ text, query }: { text: string; query: string }) => {
  if (!query.trim() || !text) return <>{text}</>;

  const words = query.trim().split(/\s+/).filter(Boolean);
  const pattern = words
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  const splitRegex = new RegExp(`(${pattern})`, "gi");
  const testRegex = new RegExp(`^(?:${pattern})$`, "i");
  const parts = text.split(splitRegex);

  return (
    <>
      {parts.map((part, i) =>
        testRegex.test(part) ? (
          <mark 
            key={i} 
            className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-b-2 border-amber-500 font-semibold px-0.5 rounded-sm not-italic"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

export const SearchResults = ({ results, query, onViewDocument }: SearchResultsProps) => {
  if (results.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-12 text-center glass-card border border-white/60 dark:border-zinc-800/60 rounded-2xl shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/5 text-indigo-500 mb-4 border border-indigo-500/10">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="mb-2 text-lg font-bold tracking-tight">No Results Found</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          We couldn't find matches for that search. Try adjusting your query or filters.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
        Found {results.length} result{results.length !== 1 ? "s" : ""}{" "}
        {query.trim() && (
          <span className="font-semibold text-foreground">
            for &ldquo;{query}&rdquo;
          </span>
        )}
      </p>
      {results.map((result, index) => (
        <Card key={index} className="overflow-hidden glass-card border border-white/60 dark:border-zinc-800/60 shadow-sm hover:shadow-indigo-100 hover:border-primary/20 dark:hover:shadow-none dark:hover:border-zinc-700/60 hover:-translate-y-0.5 transition-all duration-300 rounded-xl">
          <div className="flex gap-4 p-5">
            {result.thumbnail_url && (
              <img
                src={result.thumbnail_url}
                alt={`Page ${result.page_number}`}
                className="h-32 w-24 rounded border object-cover shrink-0"
              />
            )}
            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/5 text-primary border border-indigo-500/10 shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm truncate text-foreground tracking-tight">
                      <HighlightSnippet text={result.document_title} query={query} />
                    </h3>
                    <p className="text-[10px] text-muted-foreground font-semibold">Page {result.page_number}</p>
                  </div>
                </div>
                <Badge className="shrink-0 text-[10px] bg-primary/10 text-primary border-primary/15 rounded-lg font-bold" variant="outline">
                  {Math.round(result.confidence_score * 100)}% match
                </Badge>
              </div>

              {/* Snippet with highlighted terms */}
              <p className="text-xs leading-relaxed text-foreground bg-muted/30 dark:bg-zinc-900/20 rounded-xl px-4 py-3 border-l-3 border-primary shadow-inner">
                <HighlightSnippet text={result.text_snippet} query={query} />
              </p>

              <div className="pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold rounded-lg hover:bg-accent border-muted-foreground/15"
                  onClick={() => onViewDocument(result.document_id, result.page_number)}
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Jump to Match
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
