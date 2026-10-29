import type { Summary } from "@/web/stats";
import { money, percent } from "@/web/format";

export function StatsStrip({ stats }: { stats: Summary }) {
  const tiles = [
    {
      title: "Avg salary",
      value: money(stats.averageSalary),
      note: `${stats.salaryCount} open with pay`,
    },
    {
      title: "Highest",
      value: money(stats.highestSalary?.value ?? null),
      note: stats.highestSalary?.row.company ?? "—",
    },
    {
      title: "Lowest",
      value: money(stats.lowestSalary?.value ?? null),
      note: stats.lowestSalary?.row.company ?? "—",
    },
    {
      title: "Response",
      value: percent(stats.responseRate),
      note: "any reply",
    },
    {
      title: "Rejection",
      value: percent(stats.rejectionRate),
      note: "of applied",
    },
    {
      title: "Follow-ups",
      value: stats.followUpsDue.toString(),
      note: stats.followUpsDue ? "due now" : "all caught up",
      due: stats.followUpsDue > 0,
    },
  ];

  return (
    <section className="stats" aria-label="At a glance">
      {tiles.map((tile) => (
        <div key={tile.title} className={tile.due ? "stat is-due" : "stat"}>
          <span>{tile.title}</span>
          <strong className="tabular">{tile.value}</strong>
          <small>{tile.note}</small>
        </div>
      ))}
    </section>
  );
}
