export interface User {
  id: string;
  email: string;
  createdAt?: string;
}

export type DocStatus = "pending" | "processing" | "completed" | "error";

/** A document as returned by list endpoints (no extracted text). */
export interface DocumentSummary {
  _id: string;
  title: string;
  fileName: string;
  originalName?: string | null;
  mimeType: string;
  size?: number | null;
  language?: string;
  status: DocStatus;
  errorMessage?: string | null;
  /** "pdf-text" when every page had a text layer, otherwise the OCR engine used */
  engine?: string | null;
  average_confidence: number | null;
  total_pages: number | null;
  processed_pages: number | null;
  createdAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  textContent: string;
  pages: string[];
}

export interface DocumentPage {
  documents: DocumentSummary[];
  totalCount: number;
  page: number;
  totalPages: number;
}

export interface LibraryStats {
  total: number;
  completed: number;
  processing: number;
  pending: number;
  error: number;
  lowConfidence: number;
  attention: number;
}

export type LibraryFilter = "all" | "ready" | "progress" | "attention";
export type LibrarySort = "newest" | "oldest" | "title";

export interface SearchHit {
  page: number;
  count: number;
  snippet: string;
}

export interface SearchResult {
  document: DocumentSummary;
  matchCount: number;
  titleMatch: boolean;
  pagesWithMatches: number;
  hits: SearchHit[];
}

export interface SearchParams {
  query: string;
  type?: string;
  language?: string;
  since?: string;
  minConfidence?: string;
  page?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  totalMatches: number;
  page: number;
  totalPages: number;
}
