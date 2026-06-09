import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api from "@/api/api";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  Loader2,
  Search,
  Copy,
  CheckCheck,
  ImageIcon,
  FileType,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DocData {
  _id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  status: string;
  textContent: string;
  createdAt: string;
  metadata?: any;
}

/** Highlights all occurrences of `query` inside `text` with a <mark> element */
const HighlightedText = ({ text, query }: { text: string; query: string }) => {
  if (!query.trim() || !text) {
    return <span className="whitespace-pre-wrap text-sm leading-relaxed">{text}</span>;
  }

  const words = query.trim().split(/\s+/).filter(Boolean);
  const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  // Use a NON-global regex for .test() to avoid lastIndex issues; use global for .split()
  const splitRegex = new RegExp(`(${pattern})`, "gi");

  const parts = text.split(splitRegex);
  const testRegex = new RegExp(`^(?:${pattern})$`, "i");

  return (
    <span className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((part, i) =>
        testRegex.test(part) ? (
          <mark
            key={i}
            className="bg-yellow-300 text-yellow-900 rounded-sm px-0.5 font-medium"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

const DocumentViewer = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { token } = useAuth();

  // ?q= carries the search term from the dashboard
  const urlQuery = searchParams.get("q") || "";

  const [doc, setDoc] = useState<DocData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [localQuery, setLocalQuery] = useState(urlQuery);
  const [activeQuery, setActiveQuery] = useState(urlQuery);
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "text">("preview");

  useEffect(() => {
    if (documentId && token) {
      fetchDocument();
    }
  }, [documentId, token]);

  // Update local highlight state when URL query changes
  useEffect(() => {
    setLocalQuery(urlQuery);
    setActiveQuery(urlQuery);
  }, [urlQuery]);

  const fetchDocument = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get(`/documents/${documentId}`);
      setDoc(data);
    } catch (error: any) {
      toast({
        title: "Error loading document",
        description: error?.response?.data?.message || error.message,
        variant: "destructive",
      });
      navigate("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const matchCount = useMemo(() => {
    if (!activeQuery.trim() || !doc?.textContent) return 0;
    const words = activeQuery.trim().split(/\s+/).filter(Boolean);
    const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const regex = new RegExp(pattern, "gi");
    return (doc.textContent.match(regex) || []).length;
  }, [activeQuery, doc?.textContent]);

  const handleCopyText = () => {
    if (!doc?.textContent) return;
    navigator.clipboard.writeText(doc.textContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isImage = doc?.mimeType?.startsWith("image/");
  const isPdf = doc?.mimeType === "application/pdf";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading document…</p>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background">
        <Card className="p-8 text-center max-w-sm">
          <FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-semibold">Document not found</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            This document doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-3 gap-4">
          {/* Left: back + title */}
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <div className="min-w-0">
              <h1 className="text-base font-bold truncate">{doc.title}</h1>
              <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
            </div>
          </div>
          {/* Right: status badges */}
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant={
                doc.status === "completed"
                  ? "default"
                  : doc.status === "processing"
                  ? "secondary"
                  : doc.status === "error"
                  ? "destructive"
                  : "outline"
              }
              className="capitalize"
            >
              {doc.status}
            </Badge>
            {doc.mimeType && (
              <Badge variant="outline" className="hidden sm:flex">
                {isImage ? "Image" : isPdf ? "PDF" : doc.mimeType}
              </Badge>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Main Layout ── */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          {/* ── LEFT: Preview Panel ── */}
          <div className="space-y-4">
            {/* Tab switcher */}
            <div className="flex gap-2">
              <Button
                variant={activeTab === "preview" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("preview")}
              >
                {isImage ? (
                  <ImageIcon className="mr-2 h-4 w-4" />
                ) : (
                  <FileType className="mr-2 h-4 w-4" />
                )}
                Preview
              </Button>
              <Button
                variant={activeTab === "text" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("text")}
              >
                <FileText className="mr-2 h-4 w-4" />
                OCR Text
                {doc.textContent && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                    {doc.textContent.split(/\s+/).filter(Boolean).length}w
                  </Badge>
                )}
              </Button>
            </div>

            {/* ── Preview Tab ── */}
            {activeTab === "preview" && (
              <Card className="overflow-hidden">
                {/* Zoom controls */}
                <div className="flex items-center gap-2 border-b px-4 py-2 bg-muted/30">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setZoom((z) => Math.max(z - 25, 25))}
                    disabled={zoom <= 25}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-mono w-12 text-center">{zoom}%</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setZoom((z) => Math.min(z + 25, 300))}
                    disabled={zoom >= 300}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setZoom(100)}
                    title="Reset zoom"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                  <div className="ml-auto text-xs text-muted-foreground">
                    Use Ctrl + scroll to zoom in browser
                  </div>
                </div>

                {/* Image/PDF area */}
                <div className="flex items-start justify-center bg-muted/40 min-h-[500px] overflow-auto p-6">
                  {isImage && !imgError ? (
                    <img
                      src={doc.fileUrl}
                      alt={doc.title}
                      style={{ width: `${zoom}%` }}
                      className="rounded shadow-lg transition-all duration-200 max-w-none"
                      onError={() => setImgError(true)}
                    />
                  ) : isPdf ? (
                    <div className="w-full" style={{ height: "70vh" }}>
                      <iframe
                        src={doc.fileUrl}
                        className="w-full h-full rounded border"
                        title={doc.title}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground py-20">
                      <FileText className="h-20 w-20 opacity-40" />
                      <p className="text-sm">No preview available for this file type.</p>
                      <Button variant="outline" size="sm" asChild>
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                          Open file
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* ── OCR Text Tab (mobile/tablet) ── */}
            {activeTab === "text" && (
              <OcrTextPanel
                text={doc.textContent}
                query={activeQuery}
                matchCount={matchCount}
                localQuery={localQuery}
                setLocalQuery={setLocalQuery}
                setActiveQuery={setActiveQuery}
                onCopy={handleCopyText}
                copied={copied}
              />
            )}
          </div>

          {/* ── RIGHT: OCR Text Panel (desktop sidebar) ── */}
          <div className="hidden xl:block space-y-4">
            {/* Document info card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Document Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <InfoRow label="File" value={doc.fileName} />
                <InfoRow
                  label="Type"
                  value={isImage ? "Image" : isPdf ? "PDF" : doc.mimeType}
                />
                <InfoRow
                  label="Uploaded"
                  value={new Date(doc.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                />
                {doc.metadata?.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {doc.metadata.tags.map((t: string) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <OcrTextPanel
              text={doc.textContent}
              query={activeQuery}
              matchCount={matchCount}
              localQuery={localQuery}
              setLocalQuery={setLocalQuery}
              setActiveQuery={setActiveQuery}
              onCopy={handleCopyText}
              copied={copied}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

/* ── Helper: single info row ── */
const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-2">
    <span className="text-muted-foreground shrink-0">{label}</span>
    <span className="font-medium text-right truncate">{value}</span>
  </div>
);

/* ── Reusable OCR text panel with search + highlight ── */
interface OcrTextPanelProps {
  text: string;
  query: string;
  matchCount: number;
  localQuery: string;
  setLocalQuery: (v: string) => void;
  setActiveQuery: (v: string) => void;
  onCopy: () => void;
  copied: boolean;
}

const OcrTextPanel = ({
  text,
  query,
  matchCount,
  localQuery,
  setLocalQuery,
  setActiveQuery,
  onCopy,
  copied,
}: OcrTextPanelProps) => (
  <Card className="flex flex-col h-full">
    <CardHeader className="pb-2 shrink-0">
      <div className="flex items-center justify-between gap-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Extracted OCR Text
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onCopy}
          disabled={!text}
        >
          {copied ? (
            <>
              <CheckCheck className="h-3.5 w-3.5 text-green-500" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </Button>
      </div>

      {/* Inline search bar */}
      <div className="flex items-center gap-2 mt-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Highlight text..."
            value={localQuery}
            onChange={(e) => {
              setLocalQuery(e.target.value);
              setActiveQuery(e.target.value);
            }}
          />
        </div>
        {query.trim() && (
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            {matchCount} match{matchCount !== 1 ? "es" : ""}
          </span>
        )}
      </div>
    </CardHeader>

    <CardContent className="flex-1 overflow-hidden p-0">
      <div className="h-[500px] overflow-y-auto px-4 pb-4 pt-2 xl:h-[calc(100vh-22rem)]">
        {text ? (
          <HighlightedText text={text} query={query} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <FileText className="h-12 w-12 opacity-30" />
            <p className="text-sm text-center">
              No OCR text yet.
              <br />
              <span className="text-xs opacity-70">
                Click "Process OCR" on the document to extract text.
              </span>
            </p>
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);

export default DocumentViewer;
