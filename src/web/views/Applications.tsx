import {
  ArrowDownWideNarrowIcon,
  DownloadIcon,
  SearchIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { jobs, localToday, type Application } from "@/web/api";
import { byUrgency, stageOf, STAGES, type StageKey } from "@/web/board";
import { ApplicationRow } from "@/web/components/ApplicationRow";
import { StatsStrip } from "@/web/components/StatsStrip";
import { Button } from "@/web/components/ui/button";
import { Card, CardContent } from "@/web/components/ui/card";
import { Input } from "@/web/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/web/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/web/components/ui/select";
import { summarize } from "@/web/stats";
import type { ApplicationsData } from "@/web/use-applications";

type Sort = "next" | "updated" | "company" | "salary" | "fit" | "interest";

const SORTS: Record<
  Exclude<Sort, "next">,
  (a: Application, b: Application) => number
> = {
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  company: (a, b) => a.company.localeCompare(b.company),
  salary: (a, b) =>
    (b.salaryMax ?? b.salaryMin ?? -1) - (a.salaryMax ?? a.salaryMin ?? -1),
  fit: (a, b) => (b.fit ?? -1) - (a.fit ?? -1),
  interest: (a, b) => (b.interest ?? 0) - (a.interest ?? 0),
};

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
  const [sort, setSort] = useState<Sort>("next");
  const today = localToday();
  const stats = useMemo(
    () => summarize(data.applications, today),
    [data.applications, today],
  );
  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data.applications.filter(
      (row) =>
        !needle ||
        [row.company, row.role, row.location, row.notes, row.contactName].some(
          (value) => value?.toLowerCase().includes(needle),
        ),
    );
  }, [data.applications, search]);
  const rows = useMemo(
    () =>
      matches
        .filter((row) => !stage || stageOf(row.status).key === stage)
        .sort(sort === "next" ? byUrgency(today) : SORTS[sort]),
    [matches, stage, sort, today],
  );

  async function updateInterest(id: string, interest: number | null) {
    try {
      await jobs.update(id, { interest });
      await data.refresh();
    } catch (cause) {
      data.setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

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
      <header className="page-heading">
        <h1>Applications</h1>
        <Button variant="ghost" size="sm" asChild className="export-button">
          <a href="/api/v1/applications.csv" download>
            <DownloadIcon /> CSV
          </a>
        </Button>
      </header>
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
        <Select
          value={stage ?? "all"}
          onValueChange={(value) =>
            setStage(value === "all" ? null : (value as StageKey))
          }
        >
          <SelectTrigger
            aria-label="Filter by status"
            className="status-filter w-full min-w-0"
          >
            <SelectValue className="min-w-0 flex-1 truncate text-left" />
          </SelectTrigger>
          <SelectContent position="popper" align="start">
            <SelectItem value="all">All statuses</SelectItem>
            {STAGES.map((item) => (
              <SelectItem key={item.key} value={item.key}>
                {item.title} (
                {
                  matches.filter((row) => stageOf(row.status).key === item.key)
                    .length
                }
                )
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(value) => setSort(value as Sort)}>
          <SelectTrigger aria-label="Sort" className="sort-control">
            <ArrowDownWideNarrowIcon className="hidden text-muted-foreground sm:block" />
            <SelectValue className="min-w-0 flex-1 truncate text-left" />
          </SelectTrigger>
          <SelectContent position="popper" align="end">
            <SelectItem value="next">Follow-ups first</SelectItem>
            <SelectItem value="updated">Recently updated</SelectItem>
            <SelectItem value="company">Company A–Z</SelectItem>
            <SelectItem value="salary">Highest salary</SelectItem>
            <SelectItem value="fit">Resume match</SelectItem>
            <SelectItem value="interest">Most interested</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="applications-list gap-0 py-0" aria-label="Applications">
        <CardContent className="p-0">
          <Table className="table-fixed" aria-label="Applications">
            <TableHeader>
              <TableRow>
                <TableHead className="px-4 text-muted-foreground lg:w-[28%]">
                  Company / role
                </TableHead>
                <TableHead className="w-28 px-4 text-muted-foreground lg:w-[12%]">
                  Status
                </TableHead>
                <TableHead className="hidden w-36 px-4 text-muted-foreground sm:table-cell lg:w-[16%]">
                  Interest
                </TableHead>
                <TableHead className="hidden w-40 px-4 text-muted-foreground md:table-cell lg:w-[16%]">
                  Salary
                </TableHead>
                <TableHead className="hidden w-36 px-4 text-muted-foreground md:table-cell lg:w-[12%]">
                  Resume match
                </TableHead>
                <TableHead className="hidden px-4 text-muted-foreground lg:table-cell lg:w-[16%]">
                  Next step
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <ApplicationRow
                  key={row.id}
                  row={row}
                  today={today}
                  onOpen={onOpen}
                  onInterest={updateInterest}
                />
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    <span role="status">No matching applications.</span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
