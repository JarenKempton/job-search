import { LABELS } from "@/applications/fields";

export const label = (value: string | null | undefined) =>
  value ? (LABELS[value] ?? value) : "—";

const compact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function salaryRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return "—";
  if (min == null) return `≤ ${compact.format(max!)}`;
  if (max == null || max === min) return compact.format(min);
  return `${compact.format(min)}–${compact.format(max)}`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

export function shortDate(day: string | null): string {
  if (!day) return "—";
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export const percent = (value: number | null) =>
  value == null ? "—" : `${Math.round(value * 100)}%`;
