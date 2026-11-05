import { useState } from "react";
import { Link } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { FileText, FileUp, FileX, FolderOpen, Image as ImageIcon } from "lucide-react";
import { useDocumentsByIds } from "@/api/documents";
import { describeStatus, ProgressBar, progressOf, StatusLine } from "@/components/documents/StatusLine";
import { useBreadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUploadQueue, type UploadItem } from "@/contexts/UploadQueueContext";
import { ACCEPTED_TYPES, LANGUAGES, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { cn, formatBytes, pluralize } from "@/lib/utils";
import type { DocumentSummary } from "@/types";

const LANGUAGE_KEY = "upload-language";

export default function UploadPage() {
  useBreadcrumbs([{ label: "Library", to: "/library" }, { label: "Add documents" }]);
  const { items, addFiles, clearFinished } = useUploadQueue();
  const [language, setLanguage] = useState(() => localStorage.getItem(LANGUAGE_KEY) ?? "eng");

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: ACCEPTED_TYPES,
    maxSize: MAX_UPLOAD_BYTES,
    multiple: true,
    noClick: true,
    onDrop: (accepted, rejected) => addFiles(accepted, rejected, language),
  });

  const ids = items.flatMap((item) => (item.docId ? [item.docId] : []));
  const { data: serverDocs } = useDocumentsByIds(ids);
  const docsById = new Map((serverDocs ?? []).map((d) => [d._id, d]));
  const hasFinished = items.some((item) => item.status !== "uploading");

  return (
    <div className="max-w-[1180px] animate-fade-in px-[18px] py-8 md:px-8">
      <header className="mb-[22px]">
        <h1 className="text-[34px] leading-[1.1]">Add documents</h1>
        <p className="mt-1.5 text-ink-2">They're read in the background. You can keep working.</p>
      </header>

      <div
        {...getRootProps({
          onClick: open,
          className: cn(
            "cursor-pointer rounded-[14px] border-[1.5px] border-dashed border-rule-strong bg-raised px-6 py-[46px] text-center transition-colors hover:border-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isDragActive && "border-primary bg-primary-soft",
          ),
        })}
      >
        <input {...getInputProps()} />
        <span className="mx-auto mb-3.5 grid size-[52px] place-items-center rounded-xl bg-sunken text-ink-2">
          <FileUp className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mb-1.5 text-[22px]">{isDragActive ? "Drop to upload" : "Drop PDFs or images here"}</h2>
        <p className="mb-4 text-ink-2">PDF, PNG, JPEG or WebP · up to {MAX_UPLOAD_BYTES / 1024 / 1024} MB each</p>
        <Button variant="outline" type="button" onClick={(e) => {
            e.stopPropagation();
            open();
          }}>
          <FolderOpen />
          Choose files
        </Button>
      </div>

      <div className="mb-7 mt-[18px] grid max-w-sm gap-1.5">
        <Label htmlFor="language">Document language</Label>
        <NativeSelect
          id="language"
          value={language}
          onChange={(e) => {
            setLanguage(e.target.value);
            localStorage.setItem(LANGUAGE_KEY, e.target.value);
          }}
          aria-describedby="language-hint"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </NativeSelect>
        <p id="language-hint" className="text-xs text-ink-3">
          Used to read scans and photos. PDFs with a text layer don't need it.
        </p>
      </div>

      {items.length > 0 && (
        <section aria-labelledby="queue-title">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 id="queue-title" className="eyebrow font-sans">
              This session
            </h2>
            {hasFinished && (
              <Button variant="ghost" size="sm" onClick={clearFinished}>
                Clear finished
              </Button>
            )}
          </div>
          <ul className="rounded-xl border border-rule bg-raised">
            {items.map((item) => (
              <QueueRow key={item.id} item={item} doc={item.docId ? docsById.get(item.docId) : undefined} />
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-3">
            Uploads keep going if you leave this page.{" "}
            <Link to="/library" className="font-medium text-primary hover:underline">
              Go to your library
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}

function QueueRow({ item, doc }: { item: UploadItem; doc?: DocumentSummary }) {
  const { cancel, retry, remove } = useUploadQueue();
  const problem = item.status === "failed" || item.status === "rejected";
  const Icon = problem ? FileX : item.file.type.startsWith("image/") ? ImageIcon : FileText;
  const meta = [formatBytes(item.file.size), doc?.total_pages && pluralize(doc.total_pages, "page")].filter(Boolean).join(" · ");

  let status: React.ReactNode;
  let action: React.ReactNode;

  if (item.status === "uploading") {
    const percent = Math.round(item.progress * 100);
    status = (
      <div>
        <div className="text-xs text-ink-2">{percent < 100 ? `Uploading · ${percent}%` : "Saving…"}</div>
        <ProgressBar value={Math.max(0.04, item.progress)} className="mt-1.5" />
      </div>
    );
    action = (
      <Button variant="ghost" size="sm" onClick={() => cancel(item.id)}>
        Cancel
      </Button>
    );
  } else if (problem) {
    status = <div className="text-xs text-destructive">{item.error}</div>;
    action = (
      <div className="flex gap-1">
        {item.status === "failed" && (
          <Button variant="outline" size="sm" onClick={() => retry(item.id)}>
            Retry
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => remove(item.id)}>
          Remove
        </Button>
      </div>
    );
  } else if (!doc) {
    status = <div className="text-xs text-ink-2">Uploaded</div>;
  } else {
    const ready = doc.status === "completed";
    status =
      doc.status === "processing" ? (
        <div>
          <div className="text-xs text-ink-2">{describeStatus(doc).label}</div>
          <ProgressBar value={progressOf(doc)} className="mt-1.5" />
        </div>
      ) : (
        <StatusLine doc={doc} showBar={false} />
      );
    action = (
      <Button variant={ready ? "outline" : "ghost"} size="sm" asChild>
        <Link to={`/document/${doc._id}`}>Open</Link>
      </Button>
    );
  }

  return (
    <li className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2 border-t border-rule px-4 py-3 first:border-t-0 md:grid-cols-[34px_minmax(0,1fr)_220px_auto]">
      <span
        className={cn(
          "grid size-[34px] place-items-center rounded-lg",
          problem ? "bg-destructive-soft text-destructive" : "bg-sunken text-ink-2",
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="truncate font-medium">{item.file.name}</div>
        {meta && <div className="font-mono text-[11px] text-ink-3">{meta}</div>}
      </div>
      <div className="col-span-2 col-start-2 row-start-2 md:col-span-1 md:col-start-auto md:row-start-auto">{status}</div>
      <div className="col-start-3 row-start-1 justify-self-end md:col-start-auto md:row-start-auto">{action}</div>
    </li>
  );
}
