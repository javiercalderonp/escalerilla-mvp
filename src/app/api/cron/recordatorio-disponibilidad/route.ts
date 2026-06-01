import { sendAvailabilityReminders } from "@/lib/email/availability-reminder";

function getHourInSantiago() {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Santiago",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isDevRun = !cronSecret && process.env.NODE_ENV !== "production";

  if (!isVercelCron && !isDevRun) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isVercelCron && getHourInSantiago() !== 14) {
    return Response.json({
      ok: true,
      skipped: true,
      reason: "outside_santiago_delivery_hour",
    });
  }

  const result = await sendAvailabilityReminders();

  return Response.json({ ok: true, ...result });
}
