import * as React from "react";

import { cn } from "@/lib/utils";

const fieldClasses =
  "flex h-9 w-full rounded-lg border border-input bg-raised px-3 text-sm text-ink placeholder:text-ink-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return <input type={type} className={cn(fieldClasses, className)} ref={ref} {...props} />;
  },
);
Input.displayName = "Input";

/** Native select styled to match Input — accessible and keyboard-friendly out of the box. */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, ...props }, ref) => {
    return <select className={cn(fieldClasses, "cursor-pointer pr-8", className)} ref={ref} {...props} />;
  },
);
NativeSelect.displayName = "NativeSelect";

export { Input, NativeSelect };
