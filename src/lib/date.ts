export function getTodayInSantiago(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getClosestMondayInSantiago(date = new Date()) {
  const today = getTodayInSantiago(date);
  const [year, month, day] = today.split("-").map(Number);
  const todayDate = new Date(Date.UTC(year, month - 1, day));
  const jsDay = todayDate.getUTCDay();

  if (jsDay === 1) return today;

  const daysSinceMonday = jsDay === 0 ? 6 : jsDay - 1;
  const daysUntilMonday = jsDay === 0 ? 1 : 8 - jsDay;

  return daysSinceMonday <= daysUntilMonday
    ? addDays(today, -daysSinceMonday)
    : addDays(today, daysUntilMonday);
}
