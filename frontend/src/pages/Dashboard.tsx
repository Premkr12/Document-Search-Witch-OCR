import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentUpload } from "@/components/DocumentUpload";
import { DocumentList } from "@/components/DocumentList";
import { SearchBar } from "@/components/SearchBar";
import { SearchResults, SearchResult } from "@/components/SearchResults";
import { LogOut, FileSearch, Upload, Search as SearchIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import api from "@/api/api";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout, token } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lastQuery, setLastQuery] = useState("");

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  const handleSignOut = () => {
    logout();
    navigate("/auth");
  };

  const handleSearch = async (query: string) => {
    setLastQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await api.post('/documents/search', { query });

      // Handle paginated response shape: { documents, totalCount, page, totalPages }
      const docs = response.data.documents || response.data || [];

      // Build a context-aware snippet: find first match + 150 chars either side
      const buildSnippet = (text: string, q: string) => {
        if (!text) return "No text extracted yet";
        if (!q.trim()) return text.substring(0, 300);
        const idx = text.toLowerCase().indexOf(q.toLowerCase().split(/\s+/)[0]);
        if (idx === -1) return text.substring(0, 300);
        const start = Math.max(0, idx - 120);
        const end = Math.min(text.length, idx + 180);
        return (start > 0 ? "…" : "") + text.substring(start, end) + (end < text.length ? "…" : "");
      };

      const results: SearchResult[] = (docs).map((item: any) => ({
        document_id: item._id,
        document_title: item.title,
        page_number: 1,
        text_snippet: buildSnippet(item.textContent || "", query),
        confidence_score: 1.0,
        thumbnail_url: "",
      }));

      setSearchResults(results);
      toast({
        title: "Search complete",
        description: `Found ${results.length} result${results.length !== 1 ? 's' : ''}`,
      });
    } catch (error: any) {
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };


  const handleViewDocument = (documentId: string, pageNumber: number = 1, query?: string) => {
    const q = query || "";
    navigate(`/document/${documentId}?page=${pageNumber}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/30 to-background">
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <FileSearch className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">DocuSearch OCR</h1>
              <p className="text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="documents" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="documents">
              <FileSearch className="mr-2 h-4 w-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="search">
              <SearchIcon className="mr-2 h-4 w-4" />
              Search
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-6">
            <div>
              <h2 className="mb-2 text-2xl font-bold">Your Documents</h2>
              <p className="text-muted-foreground">
                Manage and view all your uploaded documents
              </p>
            </div>
            <DocumentList
              refreshTrigger={refreshTrigger}
              onDocumentSelect={handleViewDocument}
            />
          </TabsContent>

          <TabsContent value="upload" className="space-y-6">
            <div>
              <h2 className="mb-2 text-2xl font-bold">Upload Documents</h2>
              <p className="text-muted-foreground">
                Upload PDFs or images for OCR processing
              </p>
            </div>
            <DocumentUpload
              onUploadComplete={() => setRefreshTrigger(prev => prev + 1)}
            />
          </TabsContent>

          <TabsContent value="search" className="space-y-6">
            <div>
              <h2 className="mb-2 text-2xl font-bold">Search Documents</h2>
              <p className="text-muted-foreground">
                Search through all your processed documents
              </p>
            </div>
            <SearchBar onSearch={handleSearch} isSearching={isSearching} />
            <SearchResults
              results={searchResults}
              query={lastQuery}
              onViewDocument={(id, page) => handleViewDocument(id, page, lastQuery)}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
