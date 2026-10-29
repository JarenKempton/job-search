import type { Status } from "@/applications/fields";
import { Badge } from "@/web/components/ui/badge";
import { label } from "@/web/format";

const TONES: Record<Status, string> = {
  saved: "bg-zinc-400/15 text-zinc-300",
  applied: "bg-sky-400/15 text-sky-300",
  screening: "bg-indigo-400/15 text-indigo-300",
  interviewing: "bg-violet-400/15 text-violet-300",
  offer: "bg-emerald-400/15 text-emerald-300",
  accepted: "bg-emerald-400/15 text-emerald-300",
  rejected: "bg-red-400/15 text-red-300",
  ghosted: "bg-amber-400/15 text-amber-300",
  withdrawn: "bg-zinc-400/15 text-zinc-300",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge
      variant="secondary"
      className={`status rounded-md border-0 ${TONES[status]}`}
    >
      {label(status)}
    </Badge>
  );
}
