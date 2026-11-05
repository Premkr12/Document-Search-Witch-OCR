import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Library, LogOut, Search, Settings, Upload, type LucideIcon } from "lucide-react";
import { useStats } from "@/api/documents";
import { useAuth } from "@/contexts/AuthContext";
import { LogoMark, Wordmark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/library", label: "Library", icon: Library },
  { to: "/search", label: "Search", icon: Search },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const { data: stats } = useStats();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const name = user?.email.split("@")[0] ?? "";

  const handleSignOut = () => {
    logout();
    navigate("/auth");
  };

  return (
    <aside className="sticky top-0 flex h-screen flex-col gap-0.5 border-r border-rule bg-paper px-2 py-[18px] md:px-3">
      <Link
        to="/library"
        aria-label="DocuSearch library"
        className="mb-4 flex items-center justify-center gap-2.5 rounded-lg md:justify-start md:px-2"
      >
        <LogoMark />
        <Wordmark className="hidden md:inline" />
      </Link>

      {NAV.map(({ to, label, icon: Icon }) => {
        const active = pathname.startsWith(to) || (to === "/library" && pathname.startsWith("/document"));
        return (
          <Tooltip key={to}>
            <TooltipTrigger asChild>
              <NavLink
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[34px] items-center justify-center gap-2.5 rounded-lg text-[13px] font-medium text-ink-2 transition-colors hover:bg-sunken hover:text-ink md:justify-start md:px-2.5",
                  active && "bg-raised text-ink shadow-[inset_0_0_0_1px_hsl(var(--rule))] hover:bg-raised",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="hidden md:inline">{label}</span>
                {to === "/library" && stats ? (
                  <span className="ml-auto hidden font-mono text-[11px] text-ink-3 md:inline">{stats.total}</span>
                ) : null}
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right" className="md:hidden">
              {label}
            </TooltipContent>
          </Tooltip>
        );
      })}

      <div className="mt-auto flex flex-col items-center gap-1.5 border-t border-rule pt-3 md:flex-row md:gap-2">
        <span
          aria-hidden="true"
          className="grid size-[30px] shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold uppercase text-primary"
        >
          {name.slice(0, 2)}
        </span>
        <div className="hidden min-w-0 flex-1 md:block">
          <div className="truncate text-[13px] font-medium">{name}</div>
          <div className="truncate text-[11px] text-ink-3">{user?.email}</div>
        </div>
        <ThemeToggle />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Sign out" onClick={handleSignOut}>
              <LogOut />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sign out</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
