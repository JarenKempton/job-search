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

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}
