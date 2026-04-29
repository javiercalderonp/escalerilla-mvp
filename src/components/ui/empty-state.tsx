import { cn } from "@/lib/utils"

function EmptyState({
  title,
  description,
  className,
  children,
}: React.ComponentProps<"div"> & {
  title: string
  description?: string
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center",
        className
      )}
    >
      <div className="mx-auto max-w-md space-y-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
        {children ? <div className="pt-2">{children}</div> : null}
      </div>
    </div>
  )
}

export { EmptyState }
