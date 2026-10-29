import { useState } from "react";
import type { Application } from "@/web/api";
import { InterestSelect } from "@/web/components/InterestSelect";
import {
  daysWaiting,
  hasBenefits,
  nextAction,
  type NextAction,
} from "@/web/board";
import { StatusBadge } from "@/web/components/StatusBadge";
import { Badge } from "@/web/components/ui/badge";
import { Button } from "@/web/components/ui/button";
import { TableCell, TableRow } from "@/web/components/ui/table";
import { daysBetween, label, salaryRange, shortDate } from "@/web/format";

function NextStep({ next, today }: { next: NextAction | null; today: string }) {
  if (!next) return <span className="text-muted-foreground">Closed</span>;
  if (next.due) {
    const overdue = next.on ? Math.max(0, daysBetween(next.on, today)) : 0;
    return (
      <div className="space-y-1">
        <Badge
          variant="secondary"
          className="rounded-md border-0 bg-amber-400/15 text-amber-300"
        >
          {overdue > 0 ? `${overdue}d overdue` : "Due today"}
        </Badge>
        <p className="text-xs text-muted-foreground">Follow up</p>
      </div>
    );
  }
  return (
    <div className="space-y-1 text-muted-foreground">
      <span>{next.text}</span>
      {next.on && <p className="text-xs">{shortDate(next.on)}</p>}
    </div>
  );
}

export function ApplicationRow({
  row,
  today,
  onOpen,
  onInterest,
}: {
  row: Application;
  today: string;
  onOpen: (id: string) => void;
  onInterest: (id: string, value: number | null) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const next = nextAction(row, today);
  const waiting = daysWaiting(row, today);
  const context = [
    row.workMode ? label(row.workMode) : row.location,
    waiting == null || row.status === "saved" ? null : `${waiting}d waiting`,
    hasBenefits(row) ? "Benefits added" : null,
  ].filter(Boolean);
  const salary = salaryRange(row.salaryMin, row.salaryMax);

  async function changeInterest(value: number | null) {
    setSaving(true);
    try {
      await onInterest(row.id, value);
    } finally {
      setSaving(false);
    }
  }
  const interest = (
    <InterestSelect
      value={row.interest}
      onChange={(value) => void changeInterest(value)}
      disabled={saving}
      label={`Interest in ${row.company}`}
    />
  );

  return (
    <TableRow
      className="application-row cursor-pointer"
      onClick={(event) => {
        const target = event.target;
        if (
          !(target instanceof Element) ||
          !event.currentTarget.contains(target)
        )
          return;
        if (
          target.closest(
            "button, a, input, textarea, select, [role='combobox']",
          )
        )
          return;
        onOpen(row.id);
      }}
    >
      <TableCell className="space-y-1 px-4 py-3 whitespace-normal align-top sm:align-middle">
        <Button
          type="button"
          onClick={() => onOpen(row.id)}
          variant="link"
          className="h-auto max-w-full justify-start whitespace-normal p-0 text-left font-semibold text-foreground hover:no-underline"
        >
          {row.company}
        </Button>
        <p className="break-words text-sm">{row.role}</p>
        {context.length > 0 && (
          <p className="text-xs text-muted-foreground">{context.join(" · ")}</p>
        )}
        <div className="space-y-2 pt-1 text-xs md:hidden">
          {(row.salaryMin != null || row.salaryMax != null) && (
            <p className="tabular-nums">{salary}</p>
          )}
          {row.fit != null && (
            <p className="text-muted-foreground">{row.fit}% resume match</p>
          )}
          <NextStep next={next} today={today} />
        </div>
        <div className="max-w-40 pt-2 sm:hidden">{interest}</div>
      </TableCell>
      <TableCell className="px-4 py-3 align-top sm:align-middle">
        <StatusBadge status={row.status} />
      </TableCell>
      <TableCell className="hidden px-4 py-3 sm:table-cell">
        {interest}
      </TableCell>
      <TableCell className="hidden space-y-1 px-4 py-3 md:table-cell">
        <p className="tabular-nums">{salary}</p>
        <div className="pt-1 text-xs lg:hidden">
          <NextStep next={next} today={today} />
        </div>
      </TableCell>
      <TableCell className="hidden px-4 py-3 tabular-nums md:table-cell">
        {row.fit == null ? (
          <span className="text-muted-foreground" aria-label="Fit not assessed">
            —
          </span>
        ) : (
          `${row.fit}%`
        )}
      </TableCell>
      <TableCell className="hidden px-4 py-3 text-sm lg:table-cell">
        <NextStep next={next} today={today} />
      </TableCell>
    </TableRow>
  );
}
