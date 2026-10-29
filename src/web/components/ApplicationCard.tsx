import { ArrowRightIcon, CheckIcon, ClockIcon } from "lucide-react";
import type { Application } from "@/web/api";
import { daysWaiting, hasBenefits, nextAction, stageOf } from "@/web/board";
import { StatusBadge } from "@/web/components/StatusBadge";
import { salaryRange, shortDate } from "@/web/format";

export function ApplicationCard({
  row,
  today,
  onOpen,
}: {
  row: Application;
  today: string;
  onOpen: (id: string) => void;
}) {
  const next = nextAction(row, today);
  const waiting = daysWaiting(row, today);
  const benefits = hasBenefits(row);
  const showStatus = stageOf(row.status).statuses.length > 1;

  return (
    <button
      type="button"
      className={next?.due ? "card is-due" : "card"}
      onClick={() => onOpen(row.id)}
    >
      <span className="card-top">
        <strong className="card-company">{row.company}</strong>
        <span
          className={
            row.salaryMin == null && row.salaryMax == null
              ? "card-salary tabular is-empty"
              : "card-salary tabular"
          }
        >
          {salaryRange(row.salaryMin, row.salaryMax)}
        </span>
      </span>
      <span className="card-role">{row.role}</span>
      <span className="card-meta tabular">
        {showStatus && <StatusBadge status={row.status} />}
        <span className={row.fit == null ? "chip is-empty" : "chip"}>
          {row.fit == null ? "fit —" : `${row.fit}% fit`}
        </span>
        {waiting != null && (
          <span className="chip" title="Days waiting">
            <ClockIcon />
            {waiting}d
          </span>
        )}
        <span
          className={benefits ? "chip is-good" : "chip is-empty"}
          title={benefits ? "Benefits filled in" : "No benefits yet"}
        >
          {benefits && <CheckIcon />}
          benefits
        </span>
      </span>
      {next && (
        <span className="card-next">
          <ArrowRightIcon />
          {next.text}
          {next.on && ` ${shortDate(next.on)}`}
        </span>
      )}
    </button>
  );
}
