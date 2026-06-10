import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isSearching: boolean;
}

export interface SearchFilters {
  query: string;
  language?: string;
  minConfidence?: number;
}

export const SearchBar = ({ onSearch, isSearching }: SearchBarProps) => {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<string>("");
  const [minConfidence, setMinConfidence] = useState<number>(0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  const handleClear = () => {
    setQuery("");
    setLanguage("");
    setMinConfidence(0);
    onSearch("");
  };

  return (
    <form onSubmit={handleSearch} className="glass-card border border-white/60 dark:border-zinc-800/60 p-5 md:p-6 rounded-2xl shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Type keywords to search inside extracted document texts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11 h-11.5 text-sm rounded-lg border-muted-foreground/20 focus-visible:ring-primary/40 bg-background/50"
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <Button 
            type="submit" 
            disabled={isSearching || !query.trim()}
            className="h-11.5 px-6 rounded-lg font-semibold shadow-md shadow-primary/20 bg-gradient-to-r from-primary to-indigo-600 text-white"
          >
            {isSearching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              "Search"
            )}
          </Button>
          {query && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClear}
              className="h-11.5 w-11.5 p-0 rounded-lg border-muted-foreground/20"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-muted/30">
        <div className="space-y-1.5">
          <Label htmlFor="filter-language" className="text-xs font-bold tracking-tight text-muted-foreground">Language Filter</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger id="filter-language" className="h-10.5 rounded-lg border-muted-foreground/15">
              <SelectValue placeholder="All languages" />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="eng">English</SelectItem>
              <SelectItem value="spa">Spanish</SelectItem>
              <SelectItem value="fra">French</SelectItem>
              <SelectItem value="deu">German</SelectItem>
              <SelectItem value="ita">Italian</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-confidence" className="text-xs font-bold tracking-tight text-muted-foreground">Min OCR Accuracy Confidence (%)</Label>
          <Input
            id="filter-confidence"
            type="number"
            min="0"
            max="100"
            value={minConfidence || ""}
            onChange={(e) => setMinConfidence(parseInt(e.target.value) || 0)}
            placeholder="0"
            className="h-10.5 rounded-lg border-muted-foreground/15"
          />
        </div>
      </div>
    </form>
  );
};
