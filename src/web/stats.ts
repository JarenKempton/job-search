import { CLOSED_STATUSES, RESPONDED_STATUSES } from "@/applications/fields";
import type { Application } from "./api";
import { daysBetween } from "./format";

export const STALE_AFTER_DAYS = 14;

const responded = (row: Application) =>
  row.heardBackOn != null || RESPONDED_STATUSES.includes(row.status);

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

type Extreme = { value: number; row: Application } | null;

function extreme(
  rows: Application[],
  value: (row: Application) => number | null,
  better: (a: number, b: number) => boolean,
): Extreme {
  let best: Extreme = null;
  for (const row of rows) {
    const amount = value(row);
    if (amount != null && (!best || better(amount, best.value)))
      best = { value: amount, row };
  }
  return best;
}

export function summarize(rows: Application[], today: string) {
  const applied = rows.filter((row) => row.status !== "saved");
  const paid = rows.filter(
    (row) =>
      !CLOSED_STATUSES.includes(row.status) &&
      (row.salaryMin != null || row.salaryMax != null),
  );
  const midpoints = paid.map(
    (row) =>
      ((row.salaryMin ?? row.salaryMax!) + (row.salaryMax ?? row.salaryMin!)) /
      2,
  );

  return {
    total: rows.length,
    salaryCount: paid.length,
    averageSalary: midpoints.length
      ? midpoints.reduce((a, b) => a + b, 0) / midpoints.length
      : null,
    highestSalary: extreme(
      paid,
      (row) => row.salaryMax ?? row.salaryMin,
      (a, b) => a > b,
    ),
    lowestSalary: extreme(
      paid,
      (row) => row.salaryMin ?? row.salaryMax,
      (a, b) => a < b,
    ),
    responseRate: rate(applied.filter(responded).length, applied.length),
    rejectionRate: rate(
      applied.filter((row) => row.status === "rejected").length,
      applied.length,
    ),
    followUpsDue: rows.filter((row) => needsFollowUp(row, today)).length,
  };
}

export type Summary = ReturnType<typeof summarize>;
