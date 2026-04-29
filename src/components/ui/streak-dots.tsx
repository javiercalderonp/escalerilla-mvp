import { cn } from "@/lib/utils"

type StreakDotsProps = {
  total?: number
  active?: number
  className?: string
}

function StreakDots({ total = 5, active = 0, className }: StreakDotsProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {Array.from({ length: total }).map((_, index) => {
        const isActive = index < active

        return (
          <span
            key={index}
            className={cn(
              "size-2 rounded-full bg-muted",
              isActive && "bg-court"
            )}
          />
        )
      })}
    </div>
  )
}

export { StreakDots }
