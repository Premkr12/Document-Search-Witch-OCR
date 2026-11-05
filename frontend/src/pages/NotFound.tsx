import { useEffect } from "react";
import { Link } from "react-router-dom";
import { LogoMark, Wordmark } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  useEffect(() => {
    document.title = "Page not found · DocuSearch";
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
      <Link to="/library" className="mb-12 flex items-center gap-2.5" aria-label="DocuSearch">
        <LogoMark />
        <Wordmark />
      </Link>
      <p className="font-mono text-xs font-medium tracking-[0.04em] text-ink-3">PAGE 404</p>
      <h1 className="mb-2 mt-2 text-[34px] leading-tight">
        This page isn't in your <mark className="hl">library</mark>.
      </h1>
      <p className="mb-7 max-w-sm text-ink-2">The link may be old, or the address has a typo.</p>
      <Button asChild>
        <Link to="/library">Back to your library</Link>
      </Button>
    </main>
  );
}
