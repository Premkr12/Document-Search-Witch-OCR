import { useState } from "react";
import { Download, MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { downloadOriginal, useReprocessDocument } from "@/api/documents";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { DocumentSummary } from "@/types";
import { DeleteDialog, RenameDialog } from "./DocumentDialogs";

/** The "⋯" menu on a library card or row. */
export function DocumentMenu({ doc, className }: { doc: DocumentSummary; className?: string }) {
  const reprocess = useReprocessDocument();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const busy = doc.status === "processing" || doc.status === "pending";

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`More actions for ${doc.title}`}
            className={cn("relative z-10 size-7 text-ink-3", className)}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <Pencil className="text-ink-3" />
            Rename…
          </DropdownMenuItem>
          <DropdownMenuItem disabled={busy} onSelect={() => reprocess.mutate({ id: doc._id })}>
            <RefreshCw className="text-ink-3" />
            Read again
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => downloadOriginal(doc)}>
            <Download className="text-ink-3" />
            Download original
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDeleting(true)}
            className="text-destructive focus:bg-destructive-soft focus:text-destructive"
          >
            <Trash2 />
            Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameDialog doc={doc} open={renaming} onOpenChange={setRenaming} />
      <DeleteDialog doc={doc} open={deleting} onOpenChange={setDeleting} />
    </>
  );
}
