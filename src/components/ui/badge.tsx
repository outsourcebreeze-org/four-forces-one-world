import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#1a1714] text-[#f6f1e6]",
        outline: "border-[#1a1714]/15 text-[#1a1714]",
        water: "border-transparent bg-[#d7ebfb] text-[#1d6fbf]",
        air: "border-transparent bg-[#ebe7f8] text-[#5b4d96]",
        land: "border-transparent bg-[#f8ead2] text-[#8d5c14]",
        fire: "border-transparent bg-[#fde2db] text-[#b33b28]",
        demo: "border-transparent bg-[#f3d27a] text-[#1a1714]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
