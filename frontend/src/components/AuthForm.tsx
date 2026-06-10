import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/api/api";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { FileSearch, Loader2, ArrowLeft, KeyRound, Mail, Sparkles, Cpu, Layers } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const authSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email" }).max(255),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }).max(128),
});

export const AuthForm = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { login } = useAuth();

  // Search parameters for reset mode
  const modeParam = searchParams.get("mode");
  const tokenParam = searchParams.get("token");

  // Determine initial view based on search params
  const [view, setView] = useState<"auth" | "forgot" | "reset">("auth");

  useEffect(() => {
    if (modeParam === "reset" && tokenParam) {
      setView("reset");
    } else {
      setView("auth");
    }
  }, [modeParam, tokenParam]);

  // Sign In / Sign Up states
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);

  // Forgot password states
  const [forgotEmail, setForgotEmail] = useState("");
  const [isSendingForgot, setIsSendingForgot] = useState(false);

  // Reset password states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const result = authSchema.safeParse({ email: signInEmail, password: signInPassword });
    if (!result.success) {
      toast({
        title: "Validation error",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setIsSigningIn(true);
    try {
      const res = await api.post("/auth/login", {
        email: signInEmail.trim(),
        password: signInPassword,
      });
      const { token, refreshToken, user } = res.data;
      login(token, refreshToken, user);
      toast({ title: "Login successful", description: "Welcome back!" });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error?.response?.data?.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const result = authSchema.safeParse({ email: signUpEmail, password: signUpPassword });
    if (!result.success) {
      toast({
        title: "Validation error",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setIsSigningUp(true);
    try {
      const res = await api.post("/auth/register", {
        email: signUpEmail.trim(),
        password: signUpPassword,
      });
      const { token, refreshToken, user } = res.data;
      login(token, refreshToken, user);
      toast({
        title: "Account created!",
        description: "Welcome! You're now signed in.",
      });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: error?.response?.data?.message || "An error occurred during registration",
        variant: "destructive",
      });
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingForgot(true);

    try {
      const res = await api.post("/auth/forgot-password", { email: forgotEmail.trim() });
      toast({
        title: "Reset link sent",
        description: res.data.message || "A password reset link has been sent to your email address.",
      });
      setView("auth");
    } catch (error: any) {
      toast({
        title: "Request failed",
        description: error?.response?.data?.message || "Could not process password reset request.",
        variant: "destructive",
      });
    } finally {
      setIsSendingForgot(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast({
        title: "Validation error",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Validation error",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    setIsResetting(true);
    try {
      const res = await api.post("/auth/reset-password", {
        token: tokenParam,
        password: newPassword,
      });
      toast({
        title: "Success",
        description: res.data.message || "Your password has been successfully reset.",
      });
      // Clear search parameters and go back to login
      setSearchParams({});
      setView("auth");
    } catch (error: any) {
      toast({
        title: "Reset failed",
        description: error?.response?.data?.message || "Password reset token is invalid or has expired.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 min-h-screen w-full bg-background relative overflow-hidden dot-pattern">
      {/* Glow Blobs for premium atmosphere */}
      <div className="glow-blob glow-blob-indigo top-[-5%] left-[-5%] opacity-20 dark:opacity-10" />
      <div className="glow-blob glow-blob-purple bottom-[-5%] right-[-5%] opacity-20 dark:opacity-10" />

      {/* LEFT PANEL: Branding & Product Showcase (Desktop Only) */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-indigo-900 via-indigo-950 to-purple-950 text-white relative overflow-hidden border-r border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-indigo-500/25 via-transparent to-transparent pointer-events-none" />
        
        {/* Top Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
            <FileSearch className="h-6 w-6 text-indigo-300" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
            DocuSearch OCR
          </span>
        </div>

        {/* Hero Features Area */}
        <div className="space-y-8 my-auto relative z-10">
          <div className="space-y-4">
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
              Analyze, Extract & Search Documents{" "}
              <span className="bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                Instantly
              </span>
            </h2>
            <p className="text-indigo-200/80 text-lg leading-relaxed max-w-md font-light">
              Our state-of-the-art AI-powered OCR scanner extracts high-accuracy text content from PDFs, TIFFs, and images. Search across your entire catalog in seconds.
            </p>
          </div>

          {/* Feature List */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm font-medium text-indigo-100 bg-white/5 border border-white/10 rounded-xl p-3.5 backdrop-blur-sm">
              <Sparkles className="h-5 w-5 text-indigo-400 shrink-0" />
              <span>Multi-language OCR Support (English, Spanish, Chinese, & more)</span>
            </div>
            <div className="flex items-center gap-3 text-sm font-medium text-indigo-100 bg-white/5 border border-white/10 rounded-xl p-3.5 backdrop-blur-sm">
              <Cpu className="h-5 w-5 text-indigo-400 shrink-0" />
              <span>Automatic text segment detection & highlighting</span>
            </div>
            <div className="flex items-center gap-3 text-sm font-medium text-indigo-100 bg-white/5 border border-white/10 rounded-xl p-3.5 backdrop-blur-sm">
              <Layers className="h-5 w-5 text-indigo-400 shrink-0" />
              <span>Dynamic split-screen preview and text viewer</span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-6">
            <div>
              <div className="text-3xl font-extrabold text-white">99.8%</div>
              <div className="text-xs text-indigo-300 font-medium">Average Accuracy</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-white">&lt; 3.0s</div>
              <div className="text-xs text-indigo-300 font-medium">Average Processing Time</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-indigo-400 font-medium relative z-10">
          © 2026 DocuSearch OCR. Powered by advanced Tesseract.js intelligence.
        </div>
      </div>

      {/* RIGHT PANEL: Form Container */}
      <div className="flex flex-col items-center justify-center p-6 lg:p-12 relative z-10 w-full">
        {/* Mobile branding */}
        <div className="flex lg:hidden items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/30">
            <FileSearch className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">DocuSearch OCR</span>
        </div>

        <Card className="w-full max-w-md shadow-xl glass-card transition-all duration-300 border border-white/60 dark:border-zinc-800/60">
          
          {/* VIEW: AUTHENTICATION (SIGN IN & SIGN UP) */}
          {view === "auth" && (
            <>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl font-bold tracking-tight">Welcome Back</CardTitle>
                <CardDescription className="text-sm">Sign in to manage and scan your documents</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <Tabs defaultValue="signin" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary/50 p-1 rounded-xl">
                    <TabsTrigger value="signin" className="rounded-lg py-2 transition-all">Sign In</TabsTrigger>
                    <TabsTrigger value="signup" className="rounded-lg py-2 transition-all">Sign Up</TabsTrigger>
                  </TabsList>

                  <TabsContent value="signin" className="space-y-4">
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="signin-email">Email Address</Label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="signin-email"
                            name="signin-email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            value={signInEmail}
                            onChange={(e) => setSignInEmail(e.target.value)}
                            className="pl-10 h-10.5 rounded-lg border-muted-foreground/20 focus-visible:ring-primary/50"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <Label htmlFor="signin-password">Password</Label>
                          <Button
                            type="button"
                            variant="link"
                            className="px-0 h-auto text-xs text-muted-foreground hover:text-primary transition-colors"
                            onClick={() => setView("forgot")}
                          >
                            Forgot password?
                          </Button>
                        </div>
                        <div className="relative">
                          <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="signin-password"
                            name="signin-password"
                            type="password"
                            autoComplete="current-password"
                            placeholder="••••••••"
                            value={signInPassword}
                            onChange={(e) => setSignInPassword(e.target.value)}
                            className="pl-10 h-10.5 rounded-lg border-muted-foreground/20 focus-visible:ring-primary/50"
                            required
                          />
                        </div>
                      </div>
                      <Button type="submit" className="w-full h-10.5 rounded-lg font-medium shadow-md shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-[1.01] active:scale-[0.99] bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95 text-white" disabled={isSigningIn}>
                        {isSigningIn ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing in...
                          </>
                        ) : (
                          "Sign In"
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup" className="space-y-4">
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="signup-email">Email Address</Label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="signup-email"
                            name="signup-email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            value={signUpEmail}
                            onChange={(e) => setSignUpEmail(e.target.value)}
                            className="pl-10 h-10.5 rounded-lg border-muted-foreground/20 focus-visible:ring-primary/50"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="signup-password">Password</Label>
                        <div className="relative">
                          <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="signup-password"
                            name="signup-password"
                            type="password"
                            autoComplete="new-password"
                            placeholder="Min. 8 characters"
                            value={signUpPassword}
                            onChange={(e) => setSignUpPassword(e.target.value)}
                            className="pl-10 h-10.5 rounded-lg border-muted-foreground/20 focus-visible:ring-primary/50"
                            required
                            minLength={8}
                          />
                        </div>
                      </div>
                      <Button type="submit" className="w-full h-10.5 rounded-lg font-medium shadow-md shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-[1.01] active:scale-[0.99] bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95 text-white" disabled={isSigningUp}>
                        {isSigningUp ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating account...
                          </>
                        ) : (
                          "Create Account"
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          )}

          {/* VIEW: FORGOT PASSWORD */}
          {view === "forgot" && (
            <>
              <CardHeader className="pb-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-fit pl-0 mb-2 hover:bg-transparent text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setView("auth")}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Sign In
                </Button>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground mb-3 shadow-inner">
                  <Mail className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl font-bold">Reset password</CardTitle>
                <CardDescription>
                  Enter your email address and we'll send you a recovery link.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <form onSubmit={handleForgot} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="you@example.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="pl-10 h-10.5 rounded-lg border-muted-foreground/20 focus-visible:ring-primary/50"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-10.5 rounded-lg font-medium shadow-md shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-[1.01] active:scale-[0.99] bg-gradient-to-r from-primary to-indigo-600 text-white" disabled={isSendingForgot}>
                    {isSendingForgot ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending reset link...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          )}

          {/* VIEW: RESET PASSWORD */}
          {view === "reset" && (
            <>
              <CardHeader className="pb-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground mb-3 shadow-inner">
                  <KeyRound className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl font-bold">Set new password</CardTitle>
                <CardDescription>
                  Create a secure new password for your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <form onSubmit={handleReset} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="At least 8 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-10 h-10.5 rounded-lg border-muted-foreground/20 focus-visible:ring-primary/50"
                        required
                        minLength={8}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 h-10.5 rounded-lg border-muted-foreground/20 focus-visible:ring-primary/50"
                        required
                        minLength={8}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-10.5 rounded-lg font-medium shadow-md shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-[1.01] active:scale-[0.99] bg-gradient-to-r from-primary to-indigo-600 text-white" disabled={isResetting}>
                    {isResetting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving password...
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full hover:bg-transparent text-muted-foreground hover:text-foreground mt-2 text-xs"
                    onClick={() => {
                      setSearchParams({});
                      setView("auth");
                    }}
                  >
                    Cancel and Back to Sign In
                  </Button>
                </form>
              </CardContent>
            </>
          )}

        </Card>
      </div>
    </div>
  );
};

