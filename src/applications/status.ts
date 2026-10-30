import type { Application } from "../db/schema";
import { LABELS, RESPONDED_STATUSES, type Status } from "./fields";

type Dates = Pick<Application, "appliedOn" | "heardBackOn">;

export function datesForStatus(
  status: Status,
  dates: Dates,
  today: string,
): Dates {
  return {
    appliedOn: dates.appliedOn ?? (status === "saved" ? null : today),
    heardBackOn:
      dates.heardBackOn ?? (RESPONDED_STATUSES.includes(status) ? today : null),
  };
}

export function statusNote(from: Status | null, to: Status): string {
  return from ? `${LABELS[from]} → ${LABELS[to]}` : LABELS[to];
}

export const FOLLOW_UP_AFTER_DAYS = 14;

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}
