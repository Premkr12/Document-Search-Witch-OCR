import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentUpload } from "@/components/DocumentUpload";
import { DocumentList } from "@/components/DocumentList";
import { SearchBar } from "@/components/SearchBar";
import { SearchResults, SearchResult } from "@/components/SearchResults";
import { LogOut, FileSearch, Upload, Search as SearchIcon, Sparkles, Files, CheckCircle2, Clock, TrendingUp } from "lucide-react";
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
  
  // Dashboard statistics state
  const [stats, setStats] = useState({
    total: 0,
    processed: 0,
    processing: 0,
    avgConfidence: 0,
  });

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  // Load stats dynamically from documents
  const fetchStats = async () => {
    try {
      const { data } = await api.get('/documents');
      const docs = data.documents || data || [];
      const total = docs.length;
      const processed = docs.filter((d: any) => d.status === 'completed').length;
      const processing = docs.filter((d: any) => d.status === 'processing' || d.status === 'queued').length;
      
      const completedDocs = docs.filter((d: any) => d.status === 'completed' && d.average_confidence);
      const avgConfidence = completedDocs.length 
        ? Math.round(completedDocs.reduce((acc: number, d: any) => acc + d.average_confidence, 0) / completedDocs.length)
        : 0;

      setStats({ total, processed, processing, avgConfidence });
    } catch (error) {
      console.error("Failed to load dashboard stats", error);
    }
  };

  // Calculate and update stats dynamically when documents list changes
  const handleDocumentsChange = (docs: any[]) => {
    const total = docs.length;
    const processed = docs.filter((d: any) => d.status === 'completed').length;
    const processing = docs.filter((d: any) => d.status === 'processing' || d.status === 'queued').length;
    
    const completedDocs = docs.filter((d: any) => d.status === 'completed' && d.average_confidence);
    const avgConfidence = completedDocs.length 
      ? Math.round(completedDocs.reduce((acc: number, d: any) => acc + d.average_confidence, 0) / completedDocs.length)
      : 0;

    setStats({ total, processed, processing, avgConfidence });
  };

  useEffect(() => {
    if (token) {
      fetchStats();
    }
  }, [refreshTrigger, token]);

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
    <div className="min-h-screen bg-background relative overflow-hidden dot-pattern pb-12">
      {/* Background blobs for premium depth */}
      <div className="glow-blob glow-blob-indigo top-[10%] right-[-10%] opacity-15 dark:opacity-10" />
      <div className="glow-blob glow-blob-teal bottom-[20%] left-[-10%] opacity-10 dark:opacity-5" />

      {/* Sticky Premium Navbar */}
      <header className="sticky top-0 z-50 glass-navbar shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 shadow-md shadow-primary/20">
              <FileSearch className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-primary bg-clip-text text-transparent">DocuSearch OCR</h1>
              <p className="text-xs text-muted-foreground font-medium truncate max-w-[150px] sm:max-w-none">
                {user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={handleSignOut} className="rounded-lg h-9 border-muted-foreground/20 hover:bg-destructive/10 hover:text-destructive transition-colors">
              <LogOut className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="container mx-auto px-4 py-8 relative z-10 max-w-6xl">
        
        {/* Welcome Greeting Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/10 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm mb-8">
          <div className="space-y-1.5 z-10">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Welcome Back, <span className="bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">{user.email.split('@')[0]}</span>
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Upload documents to extract text via OCR, manage files, and search terms within scanned papers instantly.
            </p>
          </div>
          <div className="flex items-center gap-2 z-10 shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 rounded-full px-3 py-1">System Active</span>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-card rounded-xl p-5 border shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Files className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight">{stats.total}</div>
              <p className="text-xs text-muted-foreground font-medium">Total Documents</p>
            </div>
          </div>

          <div className="bg-card rounded-xl p-5 border shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight">{stats.processed}</div>
              <p className="text-xs text-muted-foreground font-medium">Completed Scans</p>
            </div>
          </div>

          <div className="bg-card rounded-xl p-5 border shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight">{stats.processing}</div>
              <p className="text-xs text-muted-foreground font-medium">In Queue / Process</p>
            </div>
          </div>

          <div className="bg-card rounded-xl p-5 border shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight">{stats.avgConfidence}%</div>
              <p className="text-xs text-muted-foreground font-medium">Avg OCR Accuracy</p>
            </div>
          </div>
        </div>

        {/* Tab content area */}
        <Tabs defaultValue="documents" className="space-y-6">
          <div className="flex justify-center sm:justify-start">
            <TabsList className="grid w-full max-w-md grid-cols-3 bg-muted/60 p-1 rounded-xl">
              <TabsTrigger value="documents" className="rounded-lg py-2 transition-all">
                <Files className="mr-2 h-4 w-4" />
                Documents
              </TabsTrigger>
              <TabsTrigger value="upload" className="rounded-lg py-2 transition-all">
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="search" className="rounded-lg py-2 transition-all">
                <SearchIcon className="mr-2 h-4 w-4" />
                Search
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="documents" className="space-y-4 focus-visible:outline-none">
            <div className="border-b pb-2 flex justify-between items-end">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Your Document Catalog</h2>
                <p className="text-xs text-muted-foreground">
                  Manage and view all your OCR processed papers and files
                </p>
              </div>
            </div>
            <DocumentList
              refreshTrigger={refreshTrigger}
              onDocumentSelect={handleViewDocument}
              onDocumentsChange={handleDocumentsChange}
            />
          </TabsContent>

          <TabsContent value="upload" className="space-y-4 focus-visible:outline-none">
            <div className="border-b pb-2">
              <h2 className="text-xl font-bold tracking-tight">Upload Documents</h2>
              <p className="text-xs text-muted-foreground">
                Upload images or PDF documents to perform automated OCR text extraction
              </p>
            </div>
            <DocumentUpload
              onUploadComplete={() => {
                setRefreshTrigger(prev => prev + 1);
                fetchStats();
              }}
            />
          </TabsContent>

          <TabsContent value="search" className="space-y-4 focus-visible:outline-none">
            <div className="border-b pb-2">
              <h2 className="text-xl font-bold tracking-tight">Global Content Search</h2>
              <p className="text-xs text-muted-foreground">
                Search exact matching query keywords inside all your processed files
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

