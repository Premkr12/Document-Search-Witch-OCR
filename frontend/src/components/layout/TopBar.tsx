import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useStats } from "@/api/documents";
import { paletteShortcut, usePalette } from "@/components/CommandPalette";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/utils";
import { Breadcrumbs } from "./Breadcrumbs";

export function TopBar() {
  const { setOpen } = usePalette();
  const { data: stats } = useStats();
  const reading = stats ? stats.processing + stats.pending : 0;

  return (
    <header className="sticky top-0 z-20 flex h-[57px] items-center gap-2.5 border-b border-rule bg-paper px-4 md:px-8">
      <Breadcrumbs />
      <span className="flex-1" />

      {reading > 0 && (
        <Link
          to="/library?status=progress"
          aria-label={`Reading ${pluralize(reading, "file")}. View progress`}
          className="inline-flex h-[30px] shrink-0 items-center gap-2 rounded-full bg-primary-soft px-2.5 text-xs font-medium text-primary hover:outline hover:outline-1 hover:outline-primary md:px-3"
        >
          <span
            aria-hidden="true"
            className="size-[11px] animate-spin rounded-full border-2 border-current border-r-transparent"
          />
          <span className="hidden md:inline">Reading {pluralize(reading, "file")}</span>
        </Link>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search your documents"
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center gap-2 rounded-lg border border-rule-strong bg-raised text-[13px] text-ink-3 transition-colors hover:border-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-[300px] md:justify-start md:pl-[11px] md:pr-2"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="hidden flex-1 truncate text-left md:block">Search your documents</span>
        <kbd className="kbd hidden md:inline">{paletteShortcut}</kbd>
      </button>

      <span aria-hidden="true" className="mx-0.5 hidden h-[22px] w-px bg-rule md:block" />

      <Button asChild className="shrink-0">
        <Link to="/upload">
          <Plus />
          <span className="hidden sm:inline">Upload</span>
        </Link>
      </Button>
    </header>
  );
}
