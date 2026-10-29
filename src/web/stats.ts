import {
  CLOSED_STATUSES,
  RESPONDED_STATUSES,
  STATUSES,
  type Source,
  type Status,
} from "@/applications/fields";
import type { Application } from "./api";
import { daysBetween } from "./format";

export const STALE_AFTER_DAYS = 14;

const responded = (row: Application) =>
  row.heardBackOn != null || RESPONDED_STATUSES.includes(row.status);

const reachedInterview = (row: Application) =>
  ["interviewing", "offer", "accepted"].includes(row.status);

export function needsFollowUp(row: Application, today: string): boolean {
  if (CLOSED_STATUSES.includes(row.status) || row.status === "saved")
    return false;
  if (row.followUpOn) return row.followUpOn <= today;
  return (
    row.status === "applied" &&
    !row.heardBackOn &&
    row.appliedOn != null &&
    daysBetween(row.appliedOn, today) >= STALE_AFTER_DAYS
  );
}

function rate(part: number, whole: number): number | null {
  return whole ? part / whole : null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarize(rows: Application[], today: string) {
  const applied = rows.filter((row) => row.status !== "saved");
  const byStatus = Object.fromEntries(
    STATUSES.map((status) => [status, 0]),
  ) as Record<Status, number>;
  for (const row of rows) byStatus[row.status] += 1;

  const sources = new Map<
    Source | null,
    { applied: number; responses: number; interviews: number }
  >();
  for (const row of applied) {
    const entry = sources.get(row.source) ?? {
      applied: 0,
      responses: 0,
      interviews: 0,
    };
    entry.applied += 1;
    if (responded(row)) entry.responses += 1;
    if (reachedInterview(row)) entry.interviews += 1;
    sources.set(row.source, entry);
  }

  const responseDays = applied
    .filter((row) => row.appliedOn && row.heardBackOn)
    .map((row) => daysBetween(row.appliedOn!, row.heardBackOn!));

  const fits = applied.filter((row) => row.fit != null).map((row) => row.fit!);

  return {
    total: rows.length,
    applied: applied.length,
    byStatus,
    responseRate: rate(applied.filter(responded).length, applied.length),
    interviewRate: rate(
      applied.filter(reachedInterview).length,
      applied.length,
    ),
    medianDaysToResponse: median(responseDays),
    averageFit: fits.length
      ? fits.reduce((a, b) => a + b, 0) / fits.length
      : null,
    appliedThisWeek: applied.filter(
      (row) => row.appliedOn && daysBetween(row.appliedOn, today) < 7,
    ).length,
    sources: [...sources.entries()]
      .map(([source, counts]) => ({
        source,
        ...counts,
        rate: rate(counts.responses, counts.applied),
      }))
      .sort((a, b) => b.applied - a.applied),
    followUps: rows.filter((row) => needsFollowUp(row, today)),
    shortlist: rows
      .filter((row) => row.status === "saved")
      .sort((a, b) => (b.fit ?? -1) - (a.fit ?? -1))
      .slice(0, 6),
  };
}
