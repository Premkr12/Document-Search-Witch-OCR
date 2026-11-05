import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "./api";
import { POLL_INTERVAL_MS } from "@/lib/constants";
import { errorMessage, saveBlob } from "@/lib/utils";
import type {
  DocumentDetail,
  DocumentPage,
  DocumentSummary,
  LibraryFilter,
  LibrarySort,
  LibraryStats,
  SearchParams,
  SearchResponse,
} from "@/types";

export interface ListParams {
  status?: LibraryFilter;
  sort?: LibrarySort;
  page?: number;
  limit?: number;
  q?: string;
}

export const documentKeys = {
  all: ["documents"] as const,
  list: (params: ListParams) => ["documents", "list", params] as const,
  ids: (ids: string[]) => ["documents", "ids", ids] as const,
  stats: ["documents", "stats"] as const,
  detail: (id?: string) => ["documents", "detail", id] as const,
  search: (params: SearchParams) => ["documents", "search", params] as const,
  // Kept outside "documents" so refreshing lists doesn't re-download files
  file: (id?: string) => ["document-file", id] as const,
};

const inProgress = (d: Pick<DocumentSummary, "status">) => d.status === "processing" || d.status === "pending";
const poll = (active: boolean | undefined) => (active ? POLL_INTERVAL_MS : false);

// ── Queries ──────────────────────────────────────────────────────────────────

export function useDocuments(params: ListParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: documentKeys.list(params),
    queryFn: async () => (await api.get<DocumentPage>("/documents", { params })).data,
    placeholderData: keepPreviousData,
    refetchInterval: (q) => poll(q.state.data?.documents.some(inProgress)),
    enabled: options.enabled,
  });
}

export function useDocumentsByIds(ids: string[]) {
  return useQuery({
    queryKey: documentKeys.ids(ids),
    queryFn: async () =>
      (await api.get<DocumentPage>("/documents", { params: { ids: ids.join(","), limit: 100 } })).data.documents,
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
    refetchInterval: (q) => poll(q.state.data?.some(inProgress)),
  });
}

export function useStats() {
  return useQuery({
    queryKey: documentKeys.stats,
    queryFn: async () => (await api.get<LibraryStats>("/documents/stats")).data,
    refetchInterval: (q) => poll(q.state.data && q.state.data.processing + q.state.data.pending > 0),
  });
}

export function useDocument(id?: string) {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: async () => (await api.get<DocumentDetail>(`/documents/${id}`)).data,
    enabled: !!id,
    refetchInterval: (q) => poll(q.state.data && inProgress(q.state.data)),
  });
}

/** The original file as an object URL (fetched with the user's token). */
export function useDocumentFile(id?: string) {
  const query = useQuery({
    queryKey: documentKeys.file(id),
    queryFn: async () => (await api.get<Blob>(`/documents/${id}/file`, { responseType: "blob" })).data,
    enabled: !!id,
    staleTime: 5 * 60_000,
    gcTime: 60_000,
  });

  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!query.data) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(query.data);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [query.data]);

  return { ...query, url };
}

export function useSearch(params: SearchParams) {
  return useQuery({
    queryKey: documentKeys.search(params),
    queryFn: async () => (await api.post<SearchResponse>("/documents/search", params)).data,
    enabled: params.query.trim().length > 0,
    placeholderData: keepPreviousData,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

function useInvalidateDocuments() {
  const queryClient = useQueryClient();
  return (except?: string) =>
    queryClient.invalidateQueries({
      queryKey: documentKeys.all,
      // Don't re-fetch a document that no longer exists
      predicate: (q) => !(except && q.queryKey[1] === "detail" && q.queryKey[2] === except),
    });
}

export function useReprocessDocument() {
  const invalidate = useInvalidateDocuments();
  return useMutation({
    mutationFn: async ({ id, language }: { id: string; language?: string }) =>
      (await api.post<DocumentSummary>(`/documents/${id}/process-ocr`, { language })).data,
    onSuccess: () => {
      toast("Reading again", { description: "The text will update when it's done." });
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't start reading this document.")),
  });
}

export function useDeleteDocument() {
  const invalidate = useInvalidateDocuments();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/documents/${id}`)).data,
    onSuccess: (_data, id) => {
      toast("Document deleted");
      invalidate(id);
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't delete this document.")),
  });
}

export function useRenameDocument() {
  const invalidate = useInvalidateDocuments();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) =>
      (await api.patch<DocumentSummary>(`/documents/${id}`, { title })).data,
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(errorMessage(error, "Couldn't rename this document.")),
  });
}

export async function uploadDocument(
  file: File,
  options: { language: string; signal?: AbortSignal; onProgress?: (fraction: number) => void },
) {
  const form = new FormData();
  form.append("file", file);
  form.append("language", options.language);
  const { data } = await api.post<DocumentSummary>("/documents/upload", form, {
    signal: options.signal,
    onUploadProgress: (e) => options.onProgress?.(e.total ? e.loaded / e.total : 0),
  });
  return data;
}

/** Download the original upload under its original file name. */
export async function downloadOriginal(doc: Pick<DocumentSummary, "_id" | "title" | "originalName">) {
  try {
    const { data } = await api.get<Blob>(`/documents/${doc._id}/file`, { responseType: "blob" });
    saveBlob(data, doc.originalName || doc.title);
  } catch (error) {
    toast.error(errorMessage(error, "Couldn't download the original file."));
  }
}
