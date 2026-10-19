import type { Status } from "@/applications/fields";
import { label } from "@/web/format";

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`status status--${status}`}>{label(status)}</span>;
}
