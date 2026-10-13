import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-full border border-[#1a1714]/15 bg-white/70 px-3 text-sm text-[#1a1714] outline-none placeholder:text-[#1a1714]/40 focus-visible:ring-2 focus-visible:ring-[#8d5c14]",
        className,
      )}
      {...props}
    />
  );
}
