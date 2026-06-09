import { AuthForm } from "@/components/AuthForm";
import { ThemeToggle } from "@/components/ThemeToggle";

const Auth = () => {
  return (
    <div className="relative">
      <div className="absolute right-4 top-4 z-50">
        <ThemeToggle />
      </div>
      <AuthForm />
    </div>
  );
};

export default Auth;
