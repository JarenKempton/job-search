import { DownloadIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  SOURCES,
  STATUSES,
  type Source,
  type Status,
} from "@/applications/fields";
import { localToday, type Application } from "@/web/api";
import { Choice } from "@/web/components/fields";
import { StatusBadge } from "@/web/components/StatusBadge";
import { Button } from "@/web/components/ui/button";
import { Input } from "@/web/components/ui/input";
import { daysBetween, label, salaryRange, shortDate } from "@/web/format";
import { needsFollowUp } from "@/web/stats";
import type { ApplicationsData } from "@/web/use-applications";

type Sort = "updated" | "applied" | "fit" | "salary" | "company";

const SORTS: Record<Sort, (a: Application, b: Application) => number> = {
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  applied: (a, b) => (b.appliedOn ?? "").localeCompare(a.appliedOn ?? ""),
  fit: (a, b) => (b.fit ?? -1) - (a.fit ?? -1),
  salary: (a, b) =>
    (b.salaryMax ?? b.salaryMin ?? -1) - (a.salaryMax ?? a.salaryMin ?? -1),
  company: (a, b) => a.company.localeCompare(b.company),
};

function replyCell(row: Application, today: string): string {
  if (row.heardBackOn && row.appliedOn)
    return `${daysBetween(row.appliedOn, row.heardBackOn)}d`;
  if (row.heardBackOn) return "yes";
  if (row.appliedOn && row.status === "applied")
    return `waiting ${daysBetween(row.appliedOn, today)}d`;
  return "—";
}

export function Applications({
  data,
  onOpen,
}: {
  data: ApplicationsData;
  onOpen: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [sort, setSort] = useState<Sort>("updated");
  const today = localToday();

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data.applications
      .filter((row) => !status || row.status === status)
      .filter((row) => !source || row.source === source)
      .filter(
        (row) =>
          !needle ||
          [
            row.company,
            row.role,
            row.location,
            row.notes,
            row.contactName,
          ].some((value) => value?.toLowerCase().includes(needle)),
      )
      .sort(SORTS[sort]);
  }, [data.applications, search, status, source, sort]);

  return (
    <div className="applications">
      <div className="filters">
        <label className="search">
          <SearchIcon />
          <Input
            placeholder="Search company, role, notes…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <Choice
          id="filter-status"
          value={status}
          options={STATUSES}
          blank="All statuses"
          onChange={setStatus}
        />
        <Choice
          id="filter-source"
          value={source}
          options={SOURCES}
          blank="All sources"
          onChange={setSource}
        />
        <select
          className="native-select"
          aria-label="Sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as Sort)}
        >
          <option value="updated">Recently updated</option>
          <option value="applied">Applied date</option>
          <option value="fit">Best fit</option>
          <option value="salary">Highest salary</option>
          <option value="company">Company A–Z</option>
        </select>
        <Button variant="outline" asChild>
          <a href="/api/v1/applications.csv" download>
            <DownloadIcon /> CSV
          </a>
        </Button>
      </div>

      <div className="table-wrap">
        <table className="apps-table">
          <thead>
            <tr>
              <th>Company / role</th>
              <th>Status</th>
              <th>Source</th>
              <th>Salary</th>
              <th>Fit</th>
              <th>Applied</th>
              <th>Reply</th>
              <th>They ask for</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                tabIndex={0}
                className={needsFollowUp(row, today) ? "is-due" : undefined}
                onClick={() => onOpen(row.id)}
                onKeyDown={(event) => event.key === "Enter" && onOpen(row.id)}
              >
                <td>
                  <strong>{row.company}</strong>
                  <span>
                    {row.role}
                    {row.workMode && ` · ${label(row.workMode)}`}
                  </span>
                </td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>{label(row.source)}</td>
                <td className="tabular">
                  {salaryRange(row.salaryMin, row.salaryMax)}
                </td>
                <td className="tabular">
                  {row.fit == null ? "—" : `${row.fit}%`}
                </td>
                <td className="tabular">{shortDate(row.appliedOn)}</td>
                <td className="tabular">{replyCell(row, today)}</td>
                <td className="asks">
                  {row.requirements.map(label).join(", ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.loading && rows.length === 0 && (
          <p className="empty">No matching applications.</p>
        )}
      </div>
    </div>
  );
}
