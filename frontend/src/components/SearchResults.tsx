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

/** Highlights all query words inside text with a yellow <mark> */
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
          <mark key={i} className="bg-yellow-300 text-yellow-900 rounded-[2px] px-0.5 font-semibold not-italic">
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
      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <FileText className="mb-4 h-16 w-16 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold">No results found</h3>
        <p className="text-sm text-muted-foreground">
          Try adjusting your search query or filters
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Found {results.length} result{results.length !== 1 ? "s" : ""}{" "}
        {query.trim() && (
          <span className="font-medium text-foreground">
            for &ldquo;{query}&rdquo;
          </span>
        )}
      </p>
      {results.map((result, index) => (
        <Card key={index} className="overflow-hidden transition-shadow hover:shadow-md">
          <div className="flex gap-4 p-4">
            {result.thumbnail_url && (
              <img
                src={result.thumbnail_url}
                alt={`Page ${result.page_number}`}
                className="h-32 w-24 rounded border object-cover shrink-0"
              />
            )}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">
                    <HighlightSnippet text={result.document_title} query={query} />
                  </h3>
                  <p className="text-xs text-muted-foreground">Page {result.page_number}</p>
                </div>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {Math.round(result.confidence_score * 100)}% match
                </Badge>
              </div>

              {/* Snippet with highlighted terms */}
              <p className="text-sm leading-relaxed text-foreground bg-muted/40 rounded-md px-3 py-2 border-l-2 border-primary/40">
                <HighlightSnippet text={result.text_snippet} query={query} />
              </p>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDocument(result.document_id, result.page_number)}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Document
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
