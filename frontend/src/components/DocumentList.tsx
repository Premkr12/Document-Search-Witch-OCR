import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { File, Trash2, Eye, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import api from "@/api/api";
import { useAuth } from "@/contexts/AuthContext";

interface Document {
  _id: string;  // MongoDB uses _id
  title: string;
  file_name?: string;
  fileName?: string;
  file_path?: string;
  fileUrl?: string;
  file_type?: string;
  mimeType?: string;
  status: string;
  total_pages: number | null;
  processed_pages: number | null;
  average_confidence: number | null;
  createdAt: string;
  language: string;
  tags: string[] | null;
  metadata?: any;
}

interface DocumentListProps {
  refreshTrigger: number;
  onDocumentSelect: (id: string, pageNumber?: number) => void;
  onDocumentsChange?: (documents: Document[]) => void;
}

export const DocumentList = ({ refreshTrigger, onDocumentSelect, onDocumentsChange }: DocumentListProps) => {
  const { toast } = useToast();
  const { token } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");

  useEffect(() => {
    fetchDocuments();

    // Polling mechanism since we removed realtime sockets
    const interval = setInterval(() => {
      fetchDocuments(false); // fetch without a hard loading spinner
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [refreshTrigger, token]); // Re-fetch on trigger or token change

  const fetchDocuments = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const { data } = await api.get('/documents');
      // Handle paginated response shape: { documents, totalCount, page, totalPages }
      const docs = data.documents || data || [];
      setDocuments(docs);
      if (onDocumentsChange) {
        onDocumentsChange(docs);
      }
    } catch (error: any) {
      console.error(error);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, filePath: string) => {
    try {
      await api.delete(`/documents/${id}`);

      toast({
        title: "Document deleted",
        description: "The document has been permanently removed.",
      });
      fetchDocuments();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        );
      case 'processing':
        return (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        );
      case 'failed':
        return (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
            <XCircle className="h-4 w-4" />
          </div>
        );
      default:
        return (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400">
            <Clock className="h-4 w-4" />
          </div>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/10",
      processing: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20 hover:bg-indigo-500/10",
      failed: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20 hover:bg-red-500/10",
      queued: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 hover:bg-amber-500/10",
    };
    return <Badge className={`${classes[status] || "bg-secondary text-secondary-foreground hover:bg-secondary"} rounded-lg font-medium text-xs py-0.5 px-2 border`} variant="outline">{status}</Badge>;
  };

  // Client-side local filtering
  const filteredDocs = documents.filter(doc => {
    const query = filterQuery.toLowerCase();
    const titleMatch = doc.title.toLowerCase().includes(query);
    const nameMatch = (doc.file_name || doc.fileName || "").toLowerCase().includes(query);
    const langMatch = (doc.language || "").toLowerCase().includes(query);
    const tagsArray = doc.tags || [];
    const metaTags = doc.metadata?.tags || [];
    const tagMatch = tagsArray.some(t => t.toLowerCase().includes(query)) ||
                     metaTags.some((t: string) => t.toLowerCase().includes(query));
    return titleMatch || nameMatch || langMatch || tagMatch;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-16 text-center glass-card border border-white/60 dark:border-zinc-800/60 rounded-2xl shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/5 text-indigo-500 mb-4 border border-indigo-500/10">
          <File className="h-8 w-8" />
        </div>
        <h3 className="mb-2 text-lg font-bold tracking-tight">No Documents Yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          Upload your first PDF or image document in the "Upload" tab to start text scanning & search.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Filter Input */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card/40 backdrop-blur-sm border p-3 rounded-xl">
        <div className="relative w-full sm:max-w-xs">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            placeholder="Quick filter catalog..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="pl-9 h-9 text-xs rounded-lg border-muted-foreground/20 focus-visible:ring-primary/40 bg-background/80"
          />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">
          Showing {filteredDocs.length} of {documents.length} files
        </span>
      </div>

      {filteredDocs.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center glass-card border border-white/60 dark:border-zinc-800/60 rounded-2xl shadow-sm">
          <p className="text-sm text-muted-foreground">No documents matching your search filter.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDocs.map((doc) => (
            <Card key={doc._id} className="overflow-hidden glass-card hover:shadow-indigo-100 hover:border-primary/20 dark:hover:shadow-none dark:hover:border-zinc-700/60 hover:-translate-y-0.5 transition-all duration-300 rounded-xl border border-white/60 dark:border-zinc-800/60 shadow-sm flex flex-col justify-between">
              <div className="p-5 space-y-4 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-primary shrink-0">
                      <File className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm truncate tracking-tight text-foreground">{doc.title}</h3>
                      <p className="text-[10px] text-muted-foreground truncate">{doc.file_name || doc.fileName}</p>
                    </div>
                  </div>
                  {getStatusIcon(doc.status)}
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {getStatusBadge(doc.status)}
                  {doc.language && (
                    <Badge variant="outline" className="uppercase rounded-lg font-medium text-[10px] py-0.5 border border-muted-foreground/15 text-muted-foreground bg-transparent hover:bg-transparent">
                      {doc.language}
                    </Badge>
                  )}
                  {doc.tags && doc.tags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] rounded-lg bg-muted text-muted-foreground border-none px-1.5 py-0.5">
                      {tag}
                    </Badge>
                  ))}
                  {doc.metadata?.tags && doc.metadata.tags.map((tag: string, i: number) => (
                    <Badge key={`meta-${i}`} variant="secondary" className="text-[10px] rounded-lg bg-muted text-muted-foreground border-none px-1.5 py-0.5">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {doc.status === 'processing' && doc.total_pages && doc.processed_pages !== null && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                      <span>Extracting text...</span>
                      <span>{doc.processed_pages}/{doc.total_pages} pgs</span>
                    </div>
                    <Progress 
                      value={(doc.processed_pages / doc.total_pages) * 100} 
                      className="h-1.5 bg-secondary overflow-hidden rounded-full [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-indigo-500"
                    />
                  </div>
                )}

                {doc.status === 'completed' && doc.average_confidence && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                      <span>OCR Accuracy</span>
                      <span>{doc.average_confidence}%</span>
                    </div>
                    <Progress value={doc.average_confidence} className="h-1.5 bg-secondary overflow-hidden rounded-full [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-teal-500" />
                  </div>
                )}
              </div>

              {/* Card actions */}
              <div className="px-5 pb-5 pt-1 flex gap-2 border-t border-muted/20 bg-muted/10 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs font-semibold rounded-lg hover:bg-accent border-muted-foreground/15"
                  onClick={() => onDocumentSelect(doc._id, 1)}
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  View & Search
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 border-muted-foreground/15 transition-all"
                  onClick={() => handleDelete(doc._id, doc.file_path || doc.fileUrl || "")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
