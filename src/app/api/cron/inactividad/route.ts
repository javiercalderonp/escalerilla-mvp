function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Allow: Vercel cron bearer token, or admin manual trigger (no secret configured in dev)
  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isDevRun = !cronSecret && process.env.NODE_ENV !== "production";

  if (!isVercelCron && !isDevRun) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    ok: true,
    date: today(),
    disabled: true,
    message: "Penalizacion por inactividad pausada temporalmente.",
    applied: [],
    skipped: [],
    inactivityWarnings: { sent: 0, skipped: 0, failed: 0, totalTargets: 0 },
    totalPlayers: 0,
  });
}
