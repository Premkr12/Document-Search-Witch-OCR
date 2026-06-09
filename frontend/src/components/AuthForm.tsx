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
import { FileSearch, Loader2, ArrowLeft, KeyRound, Mail } from "lucide-react";
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
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background via-secondary/30 to-background">
      <Card className="w-full max-w-md shadow-xl transition-all duration-300">
        
        {/* VIEW: AUTHENTICATION (SIGN IN & SIGN UP) */}
        {view === "auth" && (
          <>
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                  <FileSearch className="h-6 w-6 text-primary-foreground" />
                </div>
              </div>
              <CardTitle className="text-2xl">DocuSearch OCR</CardTitle>
              <CardDescription>Sign in to manage your documents</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        name="signin-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="signin-password">Password</Label>
                        <Button
                          type="button"
                          variant="link"
                          className="px-0 h-auto text-xs text-muted-foreground hover:text-primary"
                          onClick={() => setView("forgot")}
                        >
                          Forgot password?
                        </Button>
                      </div>
                      <Input
                        id="signin-password"
                        name="signin-password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="Your password"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSigningIn}>
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

                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        name="signup-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        name="signup-password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        required
                        minLength={8}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSigningUp}>
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
                className="w-fit pl-0 mb-2 hover:bg-transparent text-muted-foreground hover:text-foreground"
                onClick={() => setView("auth")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sign In
              </Button>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary mb-3">
                <Mail className="h-5 w-5 text-secondary-foreground" />
              </div>
              <CardTitle className="text-xl">Reset password</CardTitle>
              <CardDescription>
                Enter your email address and we'll send you a recovery link.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="forgot-email">Email Address</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSendingForgot}>
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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary mb-3">
                <KeyRound className="h-5 w-5 text-secondary-foreground" />
              </div>
              <CardTitle className="text-xl">Set new password</CardTitle>
              <CardDescription>
                Create a secure new password for your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isResetting}>
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
                  className="w-full hover:bg-transparent text-muted-foreground hover:text-foreground mt-2"
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
  );
};
