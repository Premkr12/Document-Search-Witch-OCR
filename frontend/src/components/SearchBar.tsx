import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
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
    <form onSubmit={handleSearch} className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search through your documents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit" disabled={isSearching || !query.trim()}>
          {isSearching ? "Searching..." : "Search"}
        </Button>
        {query && (
          <Button type="button" variant="outline" onClick={handleClear}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex gap-4 items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="filter-language">Language Filter</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger id="filter-language">
              <SelectValue placeholder="All languages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eng">English</SelectItem>
              <SelectItem value="spa">Spanish</SelectItem>
              <SelectItem value="fra">French</SelectItem>
              <SelectItem value="deu">German</SelectItem>
              <SelectItem value="ita">Italian</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 space-y-2">
          <Label htmlFor="filter-confidence">Min Confidence (%)</Label>
          <Input
            id="filter-confidence"
            type="number"
            min="0"
            max="100"
            value={minConfidence || ""}
            onChange={(e) => setMinConfidence(parseInt(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
      </div>
    </form>
  );
};
