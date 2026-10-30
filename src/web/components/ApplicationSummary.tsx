import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { localToday, type Application } from "@/web/api";
import { daysWaiting, nextAction } from "@/web/board";
import { StatusBadge } from "@/web/components/StatusBadge";
import { BenefitsSummary } from "@/web/components/BenefitsSummary";
import { MatchBreakdown } from "@/web/components/MatchBreakdown";
import { Badge } from "@/web/components/ui/badge";
import { Button } from "@/web/components/ui/button";
import { daysBetween, label, salaryRange, shortDate } from "@/web/format";
import { STALE_AFTER_DAYS } from "@/web/stats";

function Fact({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <dt>{title}</dt>
      <dd className="tabular">{children}</dd>
    </div>
  );
}

export function ApplicationSummary({
  row,
  onEdit,
}: {
  row: Application;
  onEdit: () => void;
}) {
  const today = localToday();
  const next = nextAction(row, today);
  const waiting = daysWaiting(row, today);
  const overdue = next?.on ? Math.max(0, daysBetween(next.on, today)) : 0;
  const where = [row.location, label(row.workMode), label(row.employmentType)]
    .filter((part) => part && part !== "—")
    .join(" · ");

  return (
    <div className="summary">
      <header className="summary-head">
        <p className="summary-company">{row.company}</p>
        <h2>{row.role}</h2>
        {where && <p className="muted">{where}</p>}
        <div className="summary-actions">
          <StatusBadge status={row.status} />
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Edit details
          </Button>
          {row.jobUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={row.jobUrl} target="_blank" rel="noreferrer">
                Posting <ExternalLinkIcon />
              </a>
            </Button>
          )}
        </div>
      </header>

      {next && (
        <div
          className="next-action"
          role="status"
          title={
            !row.followUpOn && row.status === "applied"
              ? `Suggested after ${STALE_AFTER_DAYS} days without a reply`
              : undefined
          }
        >
          <div>
            <p>
              {next.text}
              {next.on && ` · ${shortDate(next.on)}`}
            </p>
          </div>
          {next.due && (
            <Badge
              variant="secondary"
              className="rounded-md border-0 bg-amber-400/15 text-amber-300"
            >
              {overdue > 0 ? `${overdue}d overdue` : "Due today"}
            </Badge>
          )}
        </div>
      )}

      <dl className="facts">
        {(row.salaryMin != null || row.salaryMax != null) && (
          <Fact title="Salary">
            {salaryRange(row.salaryMin, row.salaryMax)}
          </Fact>
        )}
        {row.interest != null && <Fact title="Interest">{row.interest}/5</Fact>}
        {waiting != null &&
          row.status !== "saved" &&
          (row.appliedOn || row.heardBackOn) && (
            <Fact title="Waiting">{waiting}d</Fact>
          )}
        {row.appliedOn && (
          <Fact title="Applied">{shortDate(row.appliedOn)}</Fact>
        )}
        {row.heardBackOn && (
          <Fact title="Heard back">{shortDate(row.heardBackOn)}</Fact>
        )}
        {row.followUpOn && (
          <Fact title="Follow up">{shortDate(row.followUpOn)}</Fact>
        )}
        {row.source && <Fact title="Source">{label(row.source)}</Fact>}
      </dl>
      {row.fit != null && (
        <MatchBreakdown fit={row.fit} details={row.fitDetails} />
      )}

      {(row.contactName || row.contactEmail) && (
        <p className="summary-line">
          <span>Contact</span>
          {row.contactName}
          {row.contactEmail && (
            <a href={`mailto:${row.contactEmail}`}>{row.contactEmail}</a>
          )}
        </p>
      )}

      <BenefitsSummary row={row} />
    </div>
  );
}
