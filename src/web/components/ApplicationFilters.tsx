import { ChevronDownIcon, ListFilterIcon, StarIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { CLOSED_STATUSES, STATUSES, type Status } from "@/applications/fields";
import type { Application } from "@/web/api";
import { label } from "@/web/format";
import { Button } from "@/web/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/web/components/ui/dropdown-menu";

type Filters = { statuses: Status[]; starredOnly: boolean };
const ALL: Filters = { statuses: [...STATUSES], starredOnly: false };
const ACTIVE = STATUSES.filter((status) => !CLOSED_STATUSES.includes(status));

export function useApplicationFilters() {
  const [filters, setFilters] = useState<Filters>(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("applications.filters") ?? "null",
      );
      if (
        saved &&
        Array.isArray(saved.statuses) &&
        saved.statuses.every((status: Status) => STATUSES.includes(status)) &&
        typeof saved.starredOnly === "boolean"
      )
        return {
          statuses: [...new Set<Status>(saved.statuses)],
          starredOnly: saved.starredOnly,
        };
    } catch {}
    return ALL;
  });
  useEffect(() => {
    localStorage.setItem("applications.filters", JSON.stringify(filters));
  }, [filters]);
  return [filters, setFilters] as const;
}

export function ApplicationFilters({
  filters,
  onChange,
  applications,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  applications: Application[];
}) {
  const all = filters.statuses.length === STATUSES.length;
  const active =
    filters.statuses.length === ACTIVE.length &&
    ACTIVE.every((status) => filters.statuses.includes(status));
  const summary = all
    ? "All applications"
    : active
      ? "Active"
      : filters.statuses.length === 1
        ? label(filters.statuses[0])
        : `${filters.statuses.length} statuses`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-10 min-w-0 w-full justify-start gap-2 px-3"
          aria-label="Filter applications"
        >
          <ListFilterIcon className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-left">
            {summary}
            {filters.starredOnly ? " · Starred" : ""}
          </span>
          <ChevronDownIcon className="shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-2">
        <DropdownMenuLabel>Filter applications</DropdownMenuLabel>
        <DropdownMenuItem className="py-2" onSelect={() => onChange(ALL)}>
          Reset filters
        </DropdownMenuItem>
        <DropdownMenuItem
          className="py-2"
          onSelect={() => onChange({ ...filters, statuses: [...ACTIVE] })}
        >
          Active applications
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          className="py-2"
          checked={filters.starredOnly}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={(starredOnly) =>
            onChange({ ...filters, starredOnly })
          }
        >
          <StarIcon
            className={
              filters.starredOnly
                ? "fill-current text-amber-300"
                : "text-muted-foreground"
            }
          />{" "}
          Starred only
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Include statuses
        </DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          className="py-2"
          checked={all}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={() =>
            onChange({ ...filters, statuses: all ? [] : [...STATUSES] })
          }
        >
          All statuses
        </DropdownMenuCheckboxItem>
        {STATUSES.map((status) => (
          <DropdownMenuCheckboxItem
            key={status}
            className="py-2"
            checked={filters.statuses.includes(status)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) =>
              onChange({
                ...filters,
                statuses: checked
                  ? [...filters.statuses, status]
                  : filters.statuses.filter((value) => value !== status),
              })
            }
          >
            {label(status)}
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              {
                applications.filter(
                  (row) =>
                    row.status === status &&
                    (!filters.starredOnly || row.starred),
                ).length
              }
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
