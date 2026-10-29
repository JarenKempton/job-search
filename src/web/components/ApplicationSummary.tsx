import { ArrowRightIcon, ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { BENEFIT_FIELDS, STATUSES, type Status } from "@/applications/fields";
import { localToday, type Application } from "@/web/api";
import { daysWaiting, nextAction } from "@/web/board";
import { Choice } from "@/web/components/fields";
import { Button } from "@/web/components/ui/button";
import { label, salaryRange, shortDate } from "@/web/format";

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
  status,
  onStatus,
}: {
  row: Application;
  status: Status;
  onStatus: (status: Status) => void;
}) {
  const today = localToday();
  const next = nextAction(row, today);
  const waiting = daysWaiting(row, today);
  const benefits = BENEFIT_FIELDS.filter(({ key }) => row[key]?.trim());
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
          <Choice
            id="summary-status"
            value={status}
            options={STATUSES}
            blank={null}
            onChange={(value) => onStatus(value ?? row.status)}
          />
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
        <p className={`next-action ${next.due ? "is-due" : ""}`}>
          <ArrowRightIcon />
          {next.text}
          {next.on && <span>{shortDate(next.on)}</span>}
        </p>
      )}

      <dl className="facts">
        <Fact title="Salary">{salaryRange(row.salaryMin, row.salaryMax)}</Fact>
        <Fact title="Fit">{row.fit == null ? "—" : `${row.fit}%`}</Fact>
        <Fact title="Interest">
          {row.interest == null ? "—" : `${row.interest}/5`}
        </Fact>
        <Fact title="Waiting">{waiting == null ? "—" : `${waiting}d`}</Fact>
        <Fact title="Applied">{shortDate(row.appliedOn)}</Fact>
        <Fact title="Heard back">{shortDate(row.heardBackOn)}</Fact>
        <Fact title="Follow up">{shortDate(row.followUpOn)}</Fact>
        <Fact title="Source">{label(row.source)}</Fact>
      </dl>

      {(row.contactName || row.contactEmail) && (
        <p className="summary-line">
          <span>Contact</span>
          {row.contactName}
          {row.contactEmail && (
            <a href={`mailto:${row.contactEmail}`}>{row.contactEmail}</a>
          )}
        </p>
      )}

      <section className="summary-block">
        <h3 className="section-label">Benefits</h3>
        {benefits.length === 0 ? (
          <p className="muted">Nothing recorded yet.</p>
        ) : (
          <dl className="benefits">
            {benefits.map(({ key, title }) => (
              <div key={key}>
                <dt>{title}</dt>
                <dd>{row[key]}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {row.notes && (
        <section className="summary-block">
          <h3 className="section-label">Notes</h3>
          <p className="prose">{row.notes}</p>
        </section>
      )}
    </div>
  );
}
