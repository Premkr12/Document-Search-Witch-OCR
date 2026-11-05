import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper" role="status">
      <Loader2 className="size-6 animate-spin text-ink-3" />
      <span className="sr-only">Loading</span>
    </div>
  );
}

/** Wait for the session check, then show the page or send the user to sign in. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/auth" replace state={{ from: location }} />;
  return <Outlet />;
}
