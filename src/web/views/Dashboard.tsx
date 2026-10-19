import { STATUSES } from "@/applications/fields";
import { localToday } from "@/web/api";
import { StatusBadge } from "@/web/components/StatusBadge";
import {
  daysBetween,
  label,
  percent,
  salaryRange,
  shortDate,
} from "@/web/format";
import { summarize } from "@/web/stats";
import type { ApplicationsData } from "@/web/use-applications";

export function Dashboard({
  data,
  onOpen,
  onNew,
}: {
  data: ApplicationsData;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const today = localToday();
  const stats = summarize(data.applications, today);

  if (data.loading) return null;
  if (stats.total === 0)
    return (
      <div className="empty-panel">
        <strong>No applications yet</strong>
        <span>
          Save jobs you find, then move them to Applied as you send them.
        </span>
        <button type="button" className="link" onClick={onNew}>
          Add your first one
        </button>
      </div>
    );

  const tiles = [
    ["Applied", stats.applied.toString(), `${stats.appliedThisWeek} this week`],
    [
      "Response rate",
      percent(stats.responseRate),
      "any reply, incl. rejections",
    ],
    [
      "Interview rate",
      percent(stats.interviewRate),
      `${stats.byStatus.interviewing} interviewing now`,
    ],
    [
      "Offers",
      (stats.byStatus.offer + stats.byStatus.accepted).toString(),
      `${stats.byStatus.saved} saved to apply`,
    ],
    [
      "Median reply",
      stats.medianDaysToResponse == null
        ? "—"
        : `${Math.round(stats.medianDaysToResponse)}d`,
      "applied → heard back",
    ],
    [
      "Average fit",
      stats.averageFit == null ? "—" : `${Math.round(stats.averageFit)}%`,
      "of jobs applied to",
    ],
  ];
  const widest = Math.max(
    1,
    ...STATUSES.map((status) => stats.byStatus[status]),
  );

  return (
    <div className="dashboard">
      <section className="tiles">
        {tiles.map(([title, value, note]) => (
          <div key={title} className="tile">
            <span>{title}</span>
            <strong className="tabular">{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <h2>Pipeline</h2>
          <ul className="pipeline">
            {STATUSES.map((status) => (
              <li key={status}>
                <StatusBadge status={status} />
                <span className="bar">
                  <i
                    className={`fill--${status}`}
                    style={{
                      width: `${(stats.byStatus[status] / widest) * 100}%`,
                    }}
                  />
                </span>
                <strong className="tabular">{stats.byStatus[status]}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Follow up</h2>
          {stats.followUps.length === 0 ? (
            <p className="muted">
              Nothing due. Applications with no reply after two weeks show up
              here.
            </p>
          ) : (
            <ul className="rows">
              {stats.followUps.map((row) => (
                <li key={row.id}>
                  <button type="button" onClick={() => onOpen(row.id)}>
                    <span>
                      <strong>{row.company}</strong> {row.role}
                    </span>
                    <small>
                      {row.followUpOn
                        ? `due ${shortDate(row.followUpOn)}`
                        : `${daysBetween(row.appliedOn!, today)}d, no reply`}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>Which sources work</h2>
          <table className="mini-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Applied</th>
                <th>Replies</th>
                <th>Interviews</th>
              </tr>
            </thead>
            <tbody>
              {stats.sources.map((row) => (
                <tr key={row.source ?? "none"}>
                  <td>{label(row.source)}</td>
                  <td className="tabular">{row.applied}</td>
                  <td className="tabular">
                    {row.responses} <small>{percent(row.rate)}</small>
                  </td>
                  <td className="tabular">{row.interviews}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2>Best fits not applied yet</h2>
          {stats.shortlist.length === 0 ? (
            <p className="muted">Saved jobs land here, best fit first.</p>
          ) : (
            <ul className="rows">
              {stats.shortlist.map((row) => (
                <li key={row.id}>
                  <button type="button" onClick={() => onOpen(row.id)}>
                    <span>
                      <strong>{row.company}</strong> {row.role}
                    </span>
                    <small>
                      {row.fit == null ? "fit ?" : `${row.fit}% fit`} ·{" "}
                      {salaryRange(row.salaryMin, row.salaryMax)}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
