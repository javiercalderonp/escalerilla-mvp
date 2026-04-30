import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full bg-court font-bold tracking-tight text-court-foreground",
  {
    variants: {
      size: {
        xs: "size-6 text-[10px]",
        sm: "size-8 text-xs",
        md: "size-10 text-sm",
        lg: "size-14 text-base",
        xl: "size-24 text-2xl",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

function getInitials(firstName?: string, lastName?: string) {
  const first = firstName?.trim()?.[0];
  const last = lastName?.trim()?.[0];

  if (first && last) {
    return `${first}${last}`.toUpperCase();
  }

  if (first) {
    return first.toUpperCase();
  }

  if (last) {
    return last.toUpperCase();
  }

  return "?";
}

function Avatar({
  firstName,
  lastName,
  size,
  className,
}: {
  firstName?: string;
  lastName?: string;
  className?: string;
} & VariantProps<typeof avatarVariants>) {
  return (
    <span className={cn(avatarVariants({ size }), className)}>
      {getInitials(firstName, lastName)}
    </span>
  );
}

export { Avatar };
