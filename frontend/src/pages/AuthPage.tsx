import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Bookmark, Loader2, Lock, ScanText, type LucideIcon } from "lucide-react";
import api from "@/api/api";
import { LogoMark, Wordmark } from "@/components/Logo";
import { PasswordInput } from "@/components/PasswordInput";
import { FullPageLoader } from "@/components/RequireAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { cn, errorMessage } from "@/lib/utils";

type Mode = "signin" | "signup" | "forgot" | "reset";

const MIN_PASSWORD = 8;

const FACTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ScanText,
    title: "Reads scanned pages and photos",
    body: "PDFs with a text layer are ready at once. Everything else is read with OCR.",
  },
  {
    icon: Bookmark,
    title: "Finds the page, not only the file",
    body: "Every match shows its page and the sentence around it.",
  },
  {
    icon: Lock,
    title: "Private to your account",
    body: "Files are only served to you while you're signed in.",
  },
];

const HEADINGS: Record<Mode, { title: string; sub: string }> = {
  signin: { title: "Welcome back", sub: "Sign in to your library." },
  signup: { title: "Create your library", sub: "It takes a few seconds." },
  forgot: { title: "Reset your password", sub: "We'll email you a link to choose a new one." },
  reset: { title: "Choose a new password", sub: "Then sign in with it." },
};

export default function AuthPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const resetToken = params.get("mode") === "reset" ? params.get("token") : null;

  const [mode, setMode] = useState<Mode>(resetToken ? "reset" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = `${HEADINGS[mode].title} · DocuSearch`;
  }, [mode]);

  const from = (location.state as { from?: { pathname: string; search?: string } } | null)?.from;
  const destination = from ? `${from.pathname}${from.search ?? ""}` : "/library";

  if (loading) return <FullPageLoader />;
  if (user && mode !== "reset") return <Navigate to={destination} replace />;

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
    setPassword("");
    if (resetToken && next !== "reset") setParams({}, { replace: true });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const trimmedEmail = email.trim();
    if (mode !== "reset" && !/^\S+@\S+\.\S+$/.test(trimmedEmail)) return setError("Enter a valid email address.");
    if ((mode === "signup" || mode === "reset") && password.length < MIN_PASSWORD) {
      return setError(`Use at least ${MIN_PASSWORD} characters for your password.`);
    }
    if (mode === "signin" && !password) return setError("Enter your password.");

    setSubmitting(true);
    try {
      if (mode === "forgot") {
        await api.post("/auth/forgot-password", { email: trimmedEmail });
        setNotice("If an account exists for that email, a reset link is on its way. It works for one hour.");
      } else if (mode === "reset") {
        await api.post("/auth/reset-password", { token: resetToken, password });
        switchMode("signin");
        setNotice("Password updated. Sign in with your new password.");
      } else {
        const { data } = await api.post(mode === "signin" ? "/auth/login" : "/auth/register", {
          email: trimmedEmail,
          password,
        });
        login(data.token, data.refreshToken, data.user);
        navigate(destination, { replace: true });
      }
    } catch (err) {
      const message = errorMessage(err, "Something went wrong. Check your connection and try again.");
      setError(
        message === "Invalid credentials"
          ? "That email and password don't match."
          : message === "User already exists"
            ? "There's already an account with that email. Sign in instead."
            : message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const heading = HEADINGS[mode];
  const showPassword = mode !== "forgot";
  const showEmail = mode !== "reset";

  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[1.05fr_1fr]">
      {/* Story */}
      <aside className="hidden flex-col border-r border-rule bg-sunken px-14 py-11 lg:flex">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <Wordmark />
        </div>
        <h1 className="mt-auto max-w-[480px] text-[46px] leading-[1.08] [font-variation-settings:'opsz'_144]">
          Every page you own, <mark className="hl">searchable</mark>.
        </h1>
        <p className="reading-text mb-8 mt-4 max-w-[440px] text-lg leading-[1.6] text-ink-2">
          Upload scans, PDFs and photos. DocuSearch reads them and takes you to the exact page where your words appear.
        </p>
        <ul className="mb-auto grid max-w-[440px] gap-3.5">
          {FACTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-rule bg-raised">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span>
                <b className="block font-medium">{title}</b>
                <span className="text-[13px] text-ink-2">{body}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="relative mt-7 h-[150px]" aria-hidden="true">
          <PaperSheet className="left-10 top-1 rotate-[5deg]">
            <i className="w-2/5" />
            <i />
            <i />
            <i className="w-[70%]" />
          </PaperSheet>
          <PaperSheet className="left-0 top-2.5 -rotate-3">
            <i className="!h-1.5 w-[46%] !bg-ink-3" />
            <i />
            <i className="!h-1.5 w-[84%] !bg-highlight-strong" />
            <i />
            <i className="w-3/5" />
          </PaperSheet>
        </div>
      </aside>

      {/* Form */}
      <main className="relative flex items-center justify-center px-6 py-10">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <form onSubmit={submit} noValidate className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LogoMark />
            <Wordmark />
          </div>

          <h2 className="mb-1.5 text-[28px] leading-tight">{heading.title}</h2>
          <p className="text-ink-2">{heading.sub}</p>

          {(mode === "signin" || mode === "signup") && (
            <div role="tablist" aria-label="Account" className="mb-5 mt-[22px] grid grid-cols-2 rounded-[9px] bg-sunken p-[3px]">
              {(
                [
                  ["signin", "Sign in"],
                  ["signup", "Create account"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => switchMode(value)}
                  className={cn(
                    "h-8 rounded-[7px] text-[13px] font-medium text-ink-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    mode === value && "bg-raised text-ink shadow-[0_0_0_1px_hsl(var(--rule))]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {(mode === "forgot" || mode === "reset") && <div className="h-6" />}

          {notice && (
            <p role="status" className="mb-4 rounded-lg border border-success/30 bg-success-soft px-3 py-2.5 text-[13px] text-ink">
              {notice}
            </p>
          )}

          {showEmail && (
            <div className="mb-3.5 grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-describedby={error ? "auth-error" : undefined}
                autoFocus
                required
              />
            </div>
          )}

          {showPassword && (
            <div className="mb-3.5 grid gap-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="password">{mode === "reset" ? "New password" : "Password"}</Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="text-xs text-ink-3 underline-offset-2 hover:text-ink hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <PasswordInput
                id="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder={mode === "signin" ? "" : `At least ${MIN_PASSWORD} characters`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus={mode === "reset"}
                aria-describedby={error ? "auth-error" : undefined}
                required
              />
            </div>
          )}

          {error && (
            <p id="auth-error" role="alert" className="mb-3.5 text-[13px] text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="mt-1.5 w-full" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            {mode === "signin"
              ? "Sign in"
              : mode === "signup"
                ? "Create account"
                : mode === "forgot"
                  ? "Send reset link"
                  : "Save password"}
          </Button>

          {(mode === "forgot" || mode === "reset") && (
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="mt-4 w-full text-center text-[13px] text-ink-2 hover:text-ink hover:underline"
            >
              Back to sign in
            </button>
          )}

          {mode === "signup" && (
            <p className="mt-[18px] text-center text-xs text-ink-3">
              Your files are only visible to you.
            </p>
          )}
        </form>
      </main>
    </div>
  );
}

function PaperSheet({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "absolute flex h-[140px] w-[230px] flex-col gap-[7px] rounded border border-rule-strong bg-raised p-4 [&>i]:block [&>i]:h-1 [&>i]:rounded-sm [&>i]:bg-rule-strong",
        className,
      )}
    >
      {children}
    </div>
  );
}
