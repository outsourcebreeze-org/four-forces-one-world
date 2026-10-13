import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-[#8d5c14] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f6f1e6]",
  {
    variants: {
      variant: {
        default: "bg-[#1a1714] text-[#f6f1e6] hover:bg-[#3a3128]",
        outline: "border border-[#1a1714]/15 bg-transparent text-[#1a1714] hover:bg-[#1a1714]/5",
        ghost: "text-[#1a1714] hover:bg-[#1a1714]/5",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 px-3 text-xs",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
