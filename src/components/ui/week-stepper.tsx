import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type WeekStepperProps = {
  label: string
  previousHref?: string | null
  nextHref?: string | null
  className?: string
}

function StepperButton({
  href,
  label,
  direction,
}: {
  href?: string | null
  label: string
  direction: "prev" | "next"
}) {
  const icon = direction === "prev" ? <ChevronLeftIcon /> : <ChevronRightIcon />
  const classes = cn(buttonVariants({ variant: "outline", size: "icon-sm" }))

  if (!href) {
    return (
      <span
        aria-disabled="true"
        className={cn(classes, "pointer-events-none opacity-50")}
      >
        {icon}
        <span className="sr-only">{label}</span>
      </span>
    )
  }

  return (
    <Link aria-label={label} className={classes} href={href}>
      {icon}
    </Link>
  )
}

function WeekStepper({
  label,
  previousHref,
  nextHref,
  className,
}: WeekStepperProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3",
        className
      )}
    >
      <StepperButton
        direction="prev"
        href={previousHref}
        label="Semana anterior"
      />

      <div className="min-w-0 flex-1 text-center">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
      </div>

      <StepperButton
        direction="next"
        href={nextHref}
        label="Semana siguiente"
      />
    </div>
  )
}

export { WeekStepper }
