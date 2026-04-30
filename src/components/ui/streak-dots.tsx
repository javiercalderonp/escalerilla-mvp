import { cn } from "@/lib/utils";

type StreakDotsProps = {
  total?: number;
  active?: number;
  className?: string;
};

function StreakDots({ total = 5, active = 0, className }: StreakDotsProps) {
  const dots = Array.from({ length: total }, (_, slot) => slot + 1);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {dots.map((slot) => {
        const isActive = slot <= active;

        return (
          <span
            key={`dot-${slot}`}
            className={cn(
              "size-2 rounded-full bg-muted",
              isActive && "bg-court",
            )}
          />
        );
      })}
    </div>
  );
}

export { StreakDots };
