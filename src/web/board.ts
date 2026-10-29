import {
  BENEFIT_FIELDS,
  CLOSED_STATUSES,
  type Status,
} from "@/applications/fields";
import type { Application } from "./api";
import { daysBetween } from "./format";
import { needsFollowUp, STALE_AFTER_DAYS } from "./stats";

export const STAGES = [
  { key: "saved", title: "Saved", statuses: ["saved"] },
  { key: "applied", title: "Applied", statuses: ["applied"] },
  { key: "heard", title: "Heard back", statuses: ["screening"] },
  { key: "interviewing", title: "Interviewing", statuses: ["interviewing"] },
  { key: "offer", title: "Offer", statuses: ["offer", "accepted"] },
  {
    key: "closed",
    title: "Closed",
    statuses: ["rejected", "ghosted", "withdrawn"],
  },
] as const satisfies ReadonlyArray<{
  key: string;
  title: string;
  statuses: readonly Status[];
}>;

export type Stage = (typeof STAGES)[number];
export type StageKey = Stage["key"];

export const stageOf = (status: Status): Stage =>
  STAGES.find((stage) =>
    (stage.statuses as readonly Status[]).includes(status),
  )!;

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function daysWaiting(row: Application, today: string): number | null {
  if (CLOSED_STATUSES.includes(row.status)) return null;
  const since = row.heardBackOn ?? row.appliedOn ?? row.createdAt.slice(0, 10);
  return Math.max(0, daysBetween(since, today));
}

export const hasBenefits = (row: Application) =>
  BENEFIT_FIELDS.some(({ key }) => row[key]?.trim());

export type NextAction = { text: string; on: string | null; due: boolean };

export function nextAction(row: Application, today: string): NextAction | null {
  if (CLOSED_STATUSES.includes(row.status)) return null;
  const due = needsFollowUp(row, today);
  if (row.followUpOn) return { text: "Follow up", on: row.followUpOn, due };
  if (due) return { text: "Follow up", on: null, due: true };
  switch (row.status) {
    case "saved":
      return { text: "Apply", on: null, due: false };
    case "applied":
      return row.appliedOn
        ? {
            text: "Follow up",
            on: addDays(row.appliedOn, STALE_AFTER_DAYS),
            due: false,
          }
        : { text: "Wait for a reply", on: null, due: false };
    case "screening":
      return { text: "Book the screen", on: null, due: false };
    case "interviewing":
      return { text: "Prep the next round", on: null, due: false };
    default:
      return { text: "Decide on the offer", on: null, due: false };
  }
}

export function byUrgency(today: string) {
  return (a: Application, b: Application) =>
    Number(needsFollowUp(b, today)) - Number(needsFollowUp(a, today)) ||
    b.updatedAt.localeCompare(a.updatedAt);
}
