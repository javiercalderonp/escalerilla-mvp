import { deleteStalePendingMatches } from "@/lib/matches/delete-stale-pending";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isDevRun = !cronSecret && process.env.NODE_ENV !== "production";

  if (!isVercelCron && !isDevRun) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await deleteStalePendingMatches();

  return Response.json({ ok: true, ...result });
}
