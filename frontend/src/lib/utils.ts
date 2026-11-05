import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNowStrict } from "date-fns";
import type { DocumentSummary } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A case-insensitive pattern matching any word of the query, or null for an empty query. */
export function queryPattern(query: string): string | null {
  const words = query.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  return words.length ? words.join("|") : null;
}

export function formatBytes(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function timeAgo(date: string | Date) {
  const d = new Date(date);
  if (Date.now() - d.getTime() < 60_000) return "Just now";
  return `${formatDistanceToNowStrict(d)} ago`;
}

export function fileKind(mimeType: string) {
  if (mimeType === "application/pdf") return "PDF";
  return mimeType.replace("image/", "").toUpperCase();
}

export const isImage = (doc: Pick<DocumentSummary, "mimeType">) => doc.mimeType.startsWith("image/");

export const pluralize = (n: number, word: string, plural = `${word}s`) => `${n} ${n === 1 ? word : plural}`;

/** Message from an API error response, or a fallback. */
export function errorMessage(error: unknown, fallback = "Something went wrong. Try again.") {
  const e = error as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message || fallback;
}

/** Save a Blob as a file through a temporary link. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
