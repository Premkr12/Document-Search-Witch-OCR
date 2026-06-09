import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
}

export const DocumentList = ({ refreshTrigger, onDocumentSelect }: DocumentListProps) => {
  const { toast } = useToast();
  const { token } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      setDocuments(data.documents || data || []);
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
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      processing: "secondary",
      failed: "destructive",
      queued: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <File className="mb-4 h-16 w-16 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold">No documents yet</h3>
        <p className="text-sm text-muted-foreground">
          Upload your first document to get started with OCR search
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {documents.map((doc) => (
        <Card key={doc._id} className="overflow-hidden">
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <File className="h-5 w-5 text-primary" />
                <h3 className="font-semibold truncate">{doc.title}</h3>
              </div>
              {getStatusIcon(doc.status)}
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="truncate">{doc.file_name || doc.fileName}</p>
              <p>{formatDistanceToNow(new Date(doc.createdAt || Date.now()), { addSuffix: true })}</p>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {getStatusBadge(doc.status)}
              {doc.language && (
                <Badge variant="outline" className="uppercase">
                  {doc.language}
                </Badge>
              )}
              {doc.tags && doc.tags.map((tag, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {doc.metadata?.tags && doc.metadata.tags.map((tag: string, i: number) => (
                <Badge key={`meta-${i}`} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>

            {doc.status === 'processing' && doc.total_pages && doc.processed_pages !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Processing...</span>
                  <span>{doc.processed_pages}/{doc.total_pages} pages</span>
                </div>
                <Progress 
                  value={(doc.processed_pages / doc.total_pages) * 100} 
                  className="h-2"
                />
              </div>
            )}

            {doc.status === 'completed' && doc.average_confidence && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>OCR Confidence</span>
                  <span>{doc.average_confidence}%</span>
                </div>
                <Progress value={doc.average_confidence} className="h-2" />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onDocumentSelect(doc._id, 1)}
              >
                <Eye className="mr-2 h-4 w-4" />
                View
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(doc._id, doc.file_path || doc.fileUrl || "")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};
