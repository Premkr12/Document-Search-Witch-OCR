import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-raised group-[.toaster]:text-ink group-[.toaster]:border-rule-strong group-[.toaster]:shadow-[0_8px_24px_rgb(20_15_5/0.12)] group-[.toaster]:font-sans",
          description: "group-[.toast]:text-ink-2",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-sunken group-[.toast]:text-ink-2",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
