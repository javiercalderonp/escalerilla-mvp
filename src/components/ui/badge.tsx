import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
  {
    variants: {
      variant: {
        default: "bg-muted text-foreground",
        court: "bg-court text-court-foreground",
        grass: "bg-grass text-grass-foreground",
        clay: "bg-clay text-clay-foreground",
        gold: "bg-gold text-foreground",
        outline: "border border-border text-foreground",
        success: "border border-grass/30 bg-grass/15 text-grass",
        warning: "border border-clay/30 bg-clay/15 text-clay",
        muted: "bg-muted text-muted-foreground",
      },
      size: {
        sm: "px-1.5 py-0 text-[10px]",
        md: "px-2 py-0.5 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

function Badge({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
