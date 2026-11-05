import { createContext, useCallback, useContext, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { FileRejection } from "react-dropzone";
import { documentKeys, uploadDocument } from "@/api/documents";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { errorMessage } from "@/lib/utils";

export type UploadStatus = "uploading" | "uploaded" | "failed" | "rejected";

export interface UploadItem {
  id: string;
  file: File;
  language: string;
  status: UploadStatus;
  progress: number;
  docId?: string;
  error?: string;
}

interface UploadQueueContextType {
  items: UploadItem[];
  addFiles: (accepted: File[], rejected: FileRejection[], language: string) => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  remove: (id: string) => void;
  clearFinished: () => void;
}

const UploadQueueContext = createContext<UploadQueueContextType | undefined>(undefined);

const controllers = new Map<string, AbortController>();
let nextId = 0;

function rejectionMessage(rejection: FileRejection) {
  const code = rejection.errors[0]?.code;
  if (code === "file-too-large") return `Too large. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`;
  if (code === "file-invalid-type") return "Not supported. Use PDF, PNG, JPEG or WebP.";
  return rejection.errors[0]?.message ?? "This file can't be uploaded.";
}

/** Uploads live above the routes, so leaving the Upload page doesn't cancel them. */
export function UploadQueueProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);

  const update = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const start = useCallback(
    async (item: UploadItem) => {
      const controller = new AbortController();
      controllers.set(item.id, controller);
      update(item.id, { status: "uploading", progress: 0, error: undefined });
      try {
        const doc = await uploadDocument(item.file, {
          language: item.language,
          signal: controller.signal,
          onProgress: (progress) => update(item.id, { progress }),
        });
        update(item.id, { status: "uploaded", progress: 1, docId: doc._id });
        queryClient.invalidateQueries({ queryKey: documentKeys.all });
      } catch (error) {
        if (controller.signal.aborted) {
          setItems((prev) => prev.filter((i) => i.id !== item.id));
        } else {
          update(item.id, { status: "failed", error: errorMessage(error, "Upload failed. Check your connection and retry.") });
        }
      } finally {
        controllers.delete(item.id);
      }
    },
    [queryClient, update],
  );

  const addFiles = useCallback(
    (accepted: File[], rejected: FileRejection[], language: string) => {
      const newItems: UploadItem[] = [
        ...accepted.map((file) => ({ id: `u${nextId++}`, file, language, status: "uploading" as const, progress: 0 })),
        ...rejected.map((r) => ({
          id: `u${nextId++}`,
          file: r.file,
          language,
          status: "rejected" as const,
          progress: 0,
          error: rejectionMessage(r),
        })),
      ];
      setItems((prev) => [...newItems, ...prev]);
      newItems.filter((i) => i.status === "uploading").forEach(start);
    },
    [start],
  );

  const cancel = useCallback((id: string) => controllers.get(id)?.abort(), []);
  const remove = useCallback((id: string) => setItems((prev) => prev.filter((i) => i.id !== id)), []);
  const retry = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (item) start(item);
    },
    [items, start],
  );
  const clearFinished = useCallback(
    () => setItems((prev) => prev.filter((i) => i.status === "uploading")),
    [],
  );

  return (
    <UploadQueueContext.Provider value={{ items, addFiles, cancel, retry, remove, clearFinished }}>
      {children}
    </UploadQueueContext.Provider>
  );
}

export function useUploadQueue() {
  const context = useContext(UploadQueueContext);
  if (!context) throw new Error("useUploadQueue must be used within an UploadQueueProvider");
  return context;
}
