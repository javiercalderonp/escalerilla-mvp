export const AVAILABILITY_DAYS = [
  { key: "availMonday", short: "Lun", label: "Lunes" },
  { key: "availTuesday", short: "Mar", label: "Martes" },
  { key: "availWednesday", short: "Mié", label: "Miércoles" },
  { key: "availThursday", short: "Jue", label: "Jueves" },
  { key: "availFriday", short: "Vie", label: "Viernes" },
  { key: "availSaturday", short: "Sáb", label: "Sábado" },
  { key: "availSunday", short: "Dom", label: "Domingo" },
] as const;

export type AvailabilityDayKey = (typeof AVAILABILITY_DAYS)[number]["key"];
export type AvailabilitySlots = Record<AvailabilityDayKey, boolean[]>;
export type AvailabilityRange = [number, number];

export const START_HOUR = 8;
export const END_HOUR = 23;
export const SLOT_MINUTES = 30;
export const SLOT_COUNT = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;
export const MIN_MATCH_OVERLAP_SLOTS = 3;

const DEFAULT_RANGES: Record<AvailabilityDayKey, AvailabilityRange[]> = {
  availMonday: [
    [8, 10],
    [16, 20],
  ],
  availTuesday: [[18, 20]],
  availWednesday: [[18, 21]],
  availThursday: [[18, 20]],
  availFriday: [[17, 20]],
  availSaturday: [[10, 13]],
  availSunday: [[10, 12]],
};

export type AvailabilitySource = Partial<
  Record<AvailabilityDayKey, boolean | null>
> & {
  visibility?: { availabilitySlots?: unknown } | null;
};

export function emptySlots() {
  return Array.from({ length: SLOT_COUNT }, () => false);
}

export function hourToSlot(hour: number) {
  return (hour - START_HOUR) * (60 / SLOT_MINUTES);
}

export function buildSlots(day: AvailabilityDayKey, isAvailable: boolean) {
  const slots = emptySlots();

  if (!isAvailable) return slots;

  for (const [start, end] of DEFAULT_RANGES[day]) {
    for (let index = hourToSlot(start); index < hourToSlot(end); index += 1) {
      slots[index] = true;
    }
  }

  return slots;
}

export function normalizeAvailabilitySlots(
  value: unknown,
): AvailabilitySlots | null {
  if (!value || typeof value !== "object") return null;

  const source = value as Partial<Record<AvailabilityDayKey, unknown>>;
  const slots = {} as AvailabilitySlots;

  for (const { key } of AVAILABILITY_DAYS) {
    const daySlots = source[key];
    if (!Array.isArray(daySlots) || daySlots.length !== SLOT_COUNT) {
      return null;
    }
    slots[key] = daySlots.map(Boolean);
  }

  return slots;
}

export function buildAvailabilitySlots(
  source: AvailabilitySource | null | undefined,
) {
  const storedSlots = normalizeAvailabilitySlots(
    source?.visibility?.availabilitySlots,
  );

  if (storedSlots) return storedSlots;

  return AVAILABILITY_DAYS.reduce((acc, { key }) => {
    acc[key] = buildSlots(key, Boolean(source?.[key]));
    return acc;
  }, {} as AvailabilitySlots);
}

export function hasAnyAvailability(slots: AvailabilitySlots) {
  return AVAILABILITY_DAYS.some(({ key }) => slots[key].some(Boolean));
}

export function formatAvailabilityTime(slotIndex: number) {
  const totalMinutes = START_HOUR * 60 + slotIndex * SLOT_MINUTES;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function getDayRanges(slots: boolean[]) {
  const ranges: AvailabilityRange[] = [];
  let start: number | null = null;

  slots.forEach((isSelected, index) => {
    if (isSelected && start === null) {
      start = index;
    }

    if ((!isSelected || index === slots.length - 1) && start !== null) {
      const end = isSelected && index === slots.length - 1 ? index + 1 : index;
      ranges.push([start, end]);
      start = null;
    }
  });

  return ranges;
}

export function summarizeAvailabilityDay(slots: boolean[]) {
  return getDayRanges(slots)
    .map(
      ([start, end]) =>
        `${formatAvailabilityTime(start)}-${formatAvailabilityTime(end)}`,
    )
    .join(", ");
}

export function getSharedAvailabilityRanges(
  playerSlots: AvailabilitySlots,
  opponentSlots: AvailabilitySlots,
  minSlots = MIN_MATCH_OVERLAP_SLOTS,
) {
  return AVAILABILITY_DAYS.flatMap(({ key, label }) => {
    const sharedSlots = playerSlots[key].map(
      (isAvailable, index) => isAvailable && opponentSlots[key][index],
    );

    return getDayRanges(sharedSlots)
      .filter(([start, end]) => end - start >= minSlots)
      .map(([start, end]) => ({
        dayKey: key,
        dayLabel: label,
        start,
        end,
        label: `${label} ${formatAvailabilityTime(start)}-${formatAvailabilityTime(end)}`,
      }));
  });
}
