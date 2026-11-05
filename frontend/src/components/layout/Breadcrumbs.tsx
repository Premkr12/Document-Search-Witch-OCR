import { createContext, useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";

export interface Crumb {
  label: string;
  to?: string;
}

const BreadcrumbContext = createContext<{ crumbs: Crumb[]; setCrumbs: (crumbs: Crumb[]) => void } | null>(null);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  return <BreadcrumbContext.Provider value={{ crumbs, setCrumbs }}>{children}</BreadcrumbContext.Provider>;
}

/** Set the top bar's breadcrumb trail (and the tab title) for the current page. */
export function useBreadcrumbs(crumbs: Crumb[]) {
  const context = useContext(BreadcrumbContext);
  const key = JSON.stringify(crumbs);

  useEffect(() => {
    const trail: Crumb[] = JSON.parse(key);
    context?.setCrumbs(trail);
    const last = trail[trail.length - 1];
    document.title = last ? `${last.label} · DocuSearch` : "DocuSearch";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export function Breadcrumbs() {
  const crumbs = useContext(BreadcrumbContext)?.crumbs ?? [];

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13px]">
      {crumbs.map((crumb, i) =>
        i < crumbs.length - 1 && crumb.to ? (
          <span key={i} className="flex shrink-0 items-center gap-2">
            <Link
              to={crumb.to}
              className="whitespace-nowrap rounded text-ink-3 underline-offset-[3px] hover:text-ink hover:underline"
            >
              {crumb.label}
            </Link>
            <span aria-hidden="true" className="text-rule-strong">
              /
            </span>
          </span>
        ) : (
          <span key={i} aria-current="page" className="truncate font-medium text-ink">
            {crumb.label}
          </span>
        ),
      )}
    </nav>
  );
}
