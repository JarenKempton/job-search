import { DownloadIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { localToday } from "@/web/api";
import { byUrgency, stageOf, STAGES, type StageKey } from "@/web/board";
import { ApplicationCard } from "@/web/components/ApplicationCard";
import { StatsStrip } from "@/web/components/StatsStrip";
import { Button } from "@/web/components/ui/button";
import { Input } from "@/web/components/ui/input";
import { summarize } from "@/web/stats";
import type { ApplicationsData } from "@/web/use-applications";

export function Applications({
  data,
  onOpen,
  onNew,
}: {
  data: ApplicationsData;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<StageKey | null>(null);
  const today = localToday();
  const stats = useMemo(
    () => summarize(data.applications, today),
    [data.applications, today],
  );

  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = data.applications
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
      .sort(byUrgency(today));
    return STAGES.map((item) => ({
      ...item,
      rows: rows.filter((row) => stageOf(row.status).key === item.key),
    }));
  }, [data.applications, search, today]);

  if (data.loading) return null;
  if (stats.total === 0)
    return (
      <div className="empty-panel">
        <strong>No applications yet</strong>
        <span>Ask your AI tool to add one, or add it here.</span>
        <button type="button" className="link" onClick={onNew}>
          Add your first job
        </button>
      </div>
    );

  return (
    <div className="home">
      <StatsStrip stats={stats} />

      <div className="toolbar">
        <label className="search">
          <SearchIcon />
          <Input
            type="search"
            aria-label="Search"
            placeholder="Search company, role, notes…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <Button variant="outline" asChild>
          <a href="/api/v1/applications.csv" download>
            <DownloadIcon /> CSV
          </a>
        </Button>
      </div>

      <nav className="stage-filter" aria-label="Filter by status">
        <button
          type="button"
          aria-pressed={stage === null}
          onClick={() => setStage(null)}
        >
          All <span>{groups.reduce((sum, g) => sum + g.rows.length, 0)}</span>
        </button>
        {groups.map((group) => (
          <button
            key={group.key}
            type="button"
            aria-pressed={stage === group.key}
            onClick={() => setStage(group.key)}
          >
            {group.title} <span>{group.rows.length}</span>
          </button>
        ))}
      </nav>

      <div className="board" data-filter={stage ?? "all"}>
        {groups.map((group) => (
          <section
            key={group.key}
            className={`column column--${group.key}`}
            data-filtered={stage !== null && stage !== group.key}
            data-empty={group.rows.length === 0}
          >
            <h2>
              {group.title}
              <span className="tabular">{group.rows.length}</span>
            </h2>
            {group.rows.length === 0 ? (
              <p className="column-empty">Nothing here</p>
            ) : (
              group.rows.map((row) => (
                <ApplicationCard
                  key={row.id}
                  row={row}
                  today={today}
                  onOpen={onOpen}
                />
              ))
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
