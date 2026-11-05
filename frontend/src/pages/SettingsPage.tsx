import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { format } from "date-fns";
import { Laptop, Loader2, LogOut, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import api from "@/api/api";
import { useStats } from "@/api/documents";
import { useBreadcrumbs } from "@/components/layout/Breadcrumbs";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { cn, errorMessage, pluralize } from "@/lib/utils";

const MIN_PASSWORD = 8;

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-rule py-7 first:border-t-0 first:pt-0 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
      <div>
        <h2 className="text-lg">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-ink-2">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  useBreadcrumbs([{ label: "Settings" }]);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: stats } = useStats();

  const signOut = () => {
    logout();
    navigate("/auth");
  };

  return (
    <div className="max-w-[880px] animate-fade-in px-[18px] py-8 md:px-8">
      <header className="mb-8">
        <h1 className="text-[34px] leading-[1.1]">Settings</h1>
      </header>

      <Section title="Account">
        <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-y-2.5 text-sm">
          <dt className="text-ink-3">Email</dt>
          <dd className="truncate font-medium">{user?.email}</dd>
          {user?.createdAt && (
            <>
              <dt className="text-ink-3">Member since</dt>
              <dd>{format(new Date(user.createdAt), "d MMMM yyyy")}</dd>
            </>
          )}
          <dt className="text-ink-3">Library</dt>
          <dd>{stats ? pluralize(stats.total, "document") : "…"}</dd>
        </dl>
        <Button variant="outline" className="mt-5" onClick={signOut}>
          <LogOut />
          Sign out
        </Button>
      </Section>

      <Section title="Appearance" description="Night reading is easier on the eyes in the dark.">
        <ThemePicker />
      </Section>

      <Section title="Password">
        <ChangePasswordForm />
      </Section>

      <Section title="Delete account" description="Removes your account, every document and its text.">
        <DeleteAccount />
      </Section>
    </div>
  );
}

function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: "light", label: "Day", icon: Sun },
    { value: "dark", label: "Night", icon: Moon },
    { value: "system", label: "Match system", icon: Laptop },
  ];

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-grid grid-cols-3 rounded-[9px] bg-sunken p-[3px]">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            "flex h-8 items-center justify-center gap-2 rounded-[7px] px-3.5 text-[13px] font-medium text-ink-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            theme === value && "bg-raised text-ink shadow-[0_0_0_1px_hsl(var(--rule))]",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < MIN_PASSWORD) return setError(`Your new password must be at least ${MIN_PASSWORD} characters.`);
    if (next === current) return setError("Choose a password that's different from your current one.");

    setSaving(true);
    try {
      await api.post("/auth/change-password", { currentPassword: current, newPassword: next });
      toast("Password changed");
      setCurrent("");
      setNext("");
    } catch (err) {
      setError(errorMessage(err, "Couldn't change your password. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid max-w-sm gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="current-password">Current password</Label>
        <PasswordInput
          id="current-password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="new-password">New password</Label>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder={`At least ${MIN_PASSWORD} characters`}
          aria-invalid={!!error}
          aria-describedby={error ? "password-error" : undefined}
          required
        />
      </div>
      {error && (
        <p id="password-error" role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={saving || !current || !next}>
          {saving && <Loader2 className="animate-spin" />}
          Change password
        </Button>
      </div>
    </form>
  );
}

function DeleteAccount() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDeleting(true);
    try {
      await api.delete("/auth/me", { data: { password } });
      logout();
      navigate("/auth", { replace: true });
      toast("Your account was deleted");
    } catch (err) {
      setError(errorMessage(err, "Couldn't delete your account. Try again."));
      setDeleting(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="border-destructive/50 text-destructive hover:bg-destructive-soft hover:text-destructive"
        onClick={() => {
          setPassword("");
          setError(null);
          setOpen(true);
        }}
      >
        Delete account…
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={submit} className="grid gap-5">
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                Every document, its file and its text will be removed for good. Enter your password to confirm.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="delete-password">Password</Label>
              <PasswordInput
                id="delete-password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={error ? "delete-error" : undefined}
                autoFocus
              />
              {error && (
                <p id="delete-error" role="alert" className="text-[13px] text-destructive">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={!password || deleting}>
                {deleting && <Loader2 className="animate-spin" />}
                Delete account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
