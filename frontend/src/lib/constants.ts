// Keep upload rules in sync with backend/middleware/upload.js
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
};

// Keep in sync with LANGUAGES in backend/services/ocr.js
export const LANGUAGES = [
  { code: "eng", label: "English" },
  { code: "hin", label: "Hindi" },
  { code: "spa", label: "Spanish" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
];

export const languageLabel = (code?: string) =>
  LANGUAGES.find((l) => l.code === code)?.label ?? "English";

// Completed OCR results below this average confidence need attention (matches the backend)
export const LOW_CONFIDENCE = 70;

// How often to re-check documents that are still being read
export const POLL_INTERVAL_MS = 4000;
