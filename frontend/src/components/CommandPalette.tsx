import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { useTheme } from "next-themes";
import { FileText, Image as ImageIcon, Library, Moon, Search, Settings, Sun, Upload } from "lucide-react";
import { useDocuments } from "@/api/documents";
import { fileKind, isImage } from "@/lib/utils";

const PaletteContext = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
export const paletteShortcut = isMac ? "⌘ K" : "Ctrl K";

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <PaletteContext.Provider value={{ open, setOpen }}>
      {children}
      <CommandPalette />
    </PaletteContext.Provider>
  );
}

export function usePalette() {
  const context = useContext(PaletteContext);
  if (!context) throw new Error("usePalette must be used within a PaletteProvider");
  return context;
}

const itemClass =
  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink data-[selected=true]:bg-sunken [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-3";

function CommandPalette() {
  const { open, setOpen } = usePalette();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const { data } = useDocuments({ limit: 100, sort: "newest" }, { enabled: open });

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const run = useCallback(
    (action: () => void) => {
      setOpen(false);
      action();
    },
    [setOpen],
  );

  const q = query.trim();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgb(20_18_14/0.35)] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 w-[580px] max-w-[calc(100vw-32px)] -translate-x-1/2 overflow-hidden rounded-[14px] border border-rule-strong bg-raised shadow-[0_24px_60px_rgb(20_15_5/0.25)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
        >
          <DialogPrimitive.Title className="sr-only">Search documents and actions</DialogPrimitive.Title>
          <Command label="Command palette" loop>
            <div className="flex items-center gap-2.5 border-b border-rule px-4">
              <Search className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search documents or jump to…"
                className="h-14 flex-1 bg-transparent font-serif text-lg text-ink outline-none placeholder:text-ink-3"
              />
              <kbd className="kbd">Esc</kbd>
            </div>
            <Command.List className="max-h-[min(400px,60vh)] overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:text-ink-3">
              <Command.Empty className="px-3 py-8 text-center text-sm text-ink-2">
                Nothing matches “{q}”.
              </Command.Empty>

              {q && (
                // The group needs forceMount too, or cmdk hides it when the filter matches nothing in it
                <Command.Group heading="Search" forceMount>
                  <Command.Item
                    forceMount
                    value={`__search ${q}`}
                    onSelect={() => run(() => navigate(`/search?q=${encodeURIComponent(q)}`))}
                    className={itemClass}
                  >
                    <Search />
                    <span>
                      Search every page for <span className="font-medium">“{q}”</span>
                    </span>
                  </Command.Item>
                </Command.Group>
              )}

              {data && data.documents.length > 0 && (
                <Command.Group heading="Documents">
                  {data.documents.map((doc) => (
                    <Command.Item
                      key={doc._id}
                      value={`${doc.title} ${doc._id}`}
                      onSelect={() => run(() => navigate(`/document/${doc._id}`))}
                      className={itemClass}
                    >
                      {isImage(doc) ? <ImageIcon /> : <FileText />}
                      <span className="truncate">{doc.title}</span>
                      <span className="ml-auto shrink-0 font-mono text-xs text-ink-3">
                        {fileKind(doc.mimeType)}
                        {doc.total_pages ? ` · ${doc.total_pages}p` : ""}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              <Command.Group heading="Go to">
                <Command.Item value="Library" onSelect={() => run(() => navigate("/library"))} className={itemClass}>
                  <Library />
                  Library
                </Command.Item>
                <Command.Item value="Upload files" onSelect={() => run(() => navigate("/upload"))} className={itemClass}>
                  <Upload />
                  Upload files
                </Command.Item>
                <Command.Item value="Search every page" onSelect={() => run(() => navigate("/search"))} className={itemClass}>
                  <Search />
                  Search every page
                </Command.Item>
                <Command.Item value="Settings" onSelect={() => run(() => navigate("/settings"))} className={itemClass}>
                  <Settings />
                  Settings
                </Command.Item>
                <Command.Item
                  value="Toggle night reading theme dark light"
                  onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
                  className={itemClass}
                >
                  {resolvedTheme === "dark" ? <Sun /> : <Moon />}
                  {resolvedTheme === "dark" ? "Switch to day reading" : "Switch to night reading"}
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
