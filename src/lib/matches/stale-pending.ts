export const STALE_PENDING_MATCH_DAYS = 21;

export function getStalePendingMatchCutoff(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - STALE_PENDING_MATCH_DAYS);
  return cutoff;
}
