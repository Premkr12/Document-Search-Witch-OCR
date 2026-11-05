import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useDeleteDocument, useRenameDocument } from "@/api/documents";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DocumentSummary } from "@/types";

interface DialogProps {
  doc: DocumentSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameDialog({ doc, open, onOpenChange }: DialogProps) {
  const rename = useRenameDocument();
  const [title, setTitle] = useState(doc.title);

  useEffect(() => {
    if (open) setTitle(doc.title);
  }, [open, doc.title]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = title.trim();
    if (!next || next === doc.title) return onOpenChange(false);
    rename.mutate({ id: doc._id, title: next }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
            <DialogDescription>The original file name stays the same.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="rename-title">Title</Label>
            <Input
              id="rename-title"
              value={title}
              maxLength={200}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || rename.isPending}>
              {rename.isPending && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteDialog({ doc, open, onOpenChange, onDeleted }: DialogProps & { onDeleted?: () => void }) {
  const remove = useDeleteDocument();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete “{doc.title}”?</DialogTitle>
          <DialogDescription>
            The file and its extracted text are removed for good. This can't be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(doc._id, {
                onSuccess: () => {
                  onOpenChange(false);
                  onDeleted?.();
                },
              })
            }
          >
            {remove.isPending && <Loader2 className="animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
