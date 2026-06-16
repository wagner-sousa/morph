import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-morph-accent focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-morph-accent text-black shadow",
        secondary: "border-transparent bg-morph-panel text-morph-text",
        destructive: "border-transparent bg-red-600 text-white shadow",
        outline: "text-morph-text",
        success: "border-transparent bg-green-600/20 text-green-400",
        warning: "border-transparent bg-yellow-600/20 text-yellow-400",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
