import { CircleAlertIcon, CircleCheckIcon, InfoIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { Finding } from "@/applications/validation";
import { resume as api, type ResumeScanStatus } from "@/web/api";
import { Badge } from "@/web/components/ui/badge";
import { Button } from "@/web/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/web/components/ui/card";
import { resetTime } from "@/web/format";

type Scan = NonNullable<ResumeScanStatus["scan"]>;

function FindingList({ findings }: { findings: Finding[] }) {
  return (
    <ul className="space-y-3">
      {findings.map((finding, index) => {
        const Icon = finding.severity === "fix" ? CircleAlertIcon : InfoIcon;
        return (
          <li key={index} className="flex gap-2.5 text-sm">
            <Icon
              aria-label={finding.severity === "fix" ? "Fix" : "Consider"}
              className={
                finding.severity === "fix"
                  ? "mt-0.5 size-4 shrink-0 text-destructive"
                  : "mt-0.5 size-4 shrink-0 text-muted-foreground"
              }
            />
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium">{finding.title}</p>
              <p className="text-muted-foreground">{finding.detail}</p>
              {finding.example && (
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {finding.example}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const blank = <span className="text-destructive">not found</span>;
const or = (value: string | null | undefined) => value || blank;

function Read({ scan }: { scan: Scan }) {
  const { contact } = scan;
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-y-2 [&_dd]:min-w-0 [&_dd]:pb-2 sm:[&_dd]:pb-0">
      <dt className="text-muted-foreground">Name</dt>
      <dd>{or(contact.name)}</dd>
      <dt className="text-muted-foreground">Email</dt>
      <dd className="break-all">{or(contact.email)}</dd>
      <dt className="text-muted-foreground">Phone</dt>
      <dd>{or(contact.phone)}</dd>
      <dt className="text-muted-foreground">Location</dt>
      <dd>{or(contact.location)}</dd>
      <dt className="text-muted-foreground">Links</dt>
      <dd className="break-all">
        {contact.links.length ? contact.links.join(", ") : blank}
      </dd>
      <dt className="text-muted-foreground">Experience</dt>
      <dd>
        {scan.jobs.length ? (
          <ul className="space-y-1">
            {scan.jobs.map((job, index) => (
              <li key={index}>
                <span className="font-medium">{or(job.title)}</span>
                {" · "}
                {or(job.company)}
                <span className="block text-xs text-muted-foreground tabular">
                  {job.start || job.end
                    ? `${job.start || "?"} – ${job.end || "?"}`
                    : blank}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          blank
        )}
      </dd>
      <dt className="text-muted-foreground">Education</dt>
      <dd>
        {scan.education.length ? (
          <ul className="space-y-1">
            {scan.education.map((school, index) => (
              <li key={index}>
                {[school.degree, school.school, school.end]
                  .filter(Boolean)
                  .join(" · ")}
              </li>
            ))}
          </ul>
        ) : (
          blank
        )}
      </dd>
      <dt className="text-muted-foreground">Skills · {scan.skills.length}</dt>
      <dd className="flex flex-wrap gap-1.5">
        {scan.skills.length
          ? scan.skills.map((skill) => (
              <Badge
                key={skill}
                variant="secondary"
                className="h-auto font-normal whitespace-normal"
              >
                {skill}
              </Badge>
            ))
          : blank}
      </dd>
      <dt className="text-muted-foreground">Sections</dt>
      <dd>{scan.sections.length ? scan.sections.join(", ") : blank}</dd>
    </dl>
  );
}

export function AtsScanCard({ version }: { version: string | null }) {
  const [status, setStatus] = useState<ResumeScanStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!version) return setStatus(null);
    api
      .scan()
      .then(setStatus)
      .catch((cause: Error) => setError(cause.message));
  }, [version]);

  if (!version || !status) return null;

  async function scan() {
    setBusy(true);
    setError(null);
    try {
      setStatus(await api.runScan());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus(await api.scan().catch(() => status));
    } finally {
      setBusy(false);
    }
  }

  const layout = status.layout ?? [];
  const found = status.scan?.findings ?? [];
  const left = status.dailyLimit - status.usedToday;

  return (
    <Card>
      <CardHeader>
        <CardTitle>ATS check</CardTitle>
        <CardDescription>
          See what an applicant tracking system reads from your resume before
          you apply.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {layout.length > 0 && (
          <section aria-label="PDF layout" className="space-y-2">
            <h3 className="text-sm font-semibold">PDF layout</h3>
            <FindingList findings={layout} />
          </section>
        )}
        {status.layout && !layout.length && (
          <p className="flex items-center gap-2 text-sm">
            <CircleCheckIcon aria-hidden="true" className="size-4" />
            No PDF layout problems found.
          </p>
        )}
        {status.scan && (
          <>
            <section aria-label="Parser findings" className="space-y-2">
              <h3 className="text-sm font-semibold">Parser findings</h3>
              {found.length ? (
                <FindingList findings={found} />
              ) : (
                <p className="flex items-center gap-2 text-sm">
                  <CircleCheckIcon aria-hidden="true" className="size-4" />
                  Everything the parser looks for was found.
                </p>
              )}
            </section>
            <section aria-label="What the parser read" className="space-y-2">
              <h3 className="text-sm font-semibold">What the parser read</h3>
              <Read scan={status.scan} />
            </section>
          </>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={busy || Boolean(status.scan) || left <= 0}
            onClick={() => void scan()}
          >
            {busy
              ? "Scanning…"
              : status.scan
                ? "Scanned this version"
                : "Scan resume"}
          </Button>
          <span className="text-xs text-muted-foreground tabular">
            {status.usedToday} of {status.dailyLimit} scans today · resets{" "}
            {resetTime()}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Read by an AI parser like the ones newer ATSs use. Contact details are
          checked without AI and removed before the AI reads it.
          {!status.layout &&
            " Upload a PDF to also check its layout for older, rule-based parsers."}
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
