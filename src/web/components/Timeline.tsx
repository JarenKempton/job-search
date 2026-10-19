import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { EVENT_KINDS, type EventKind } from "@/applications/fields";
import { localToday, type ApplicationEvent } from "@/web/api";
import { Choice } from "@/web/components/fields";
import { Button } from "@/web/components/ui/button";
import { Input } from "@/web/components/ui/input";
import { label, shortDate } from "@/web/format";

const LOGGABLE = EVENT_KINDS.filter((kind) => kind !== "status");

export function Timeline({
  events,
  onAdd,
  onRemove,
}: {
  events: ApplicationEvent[];
  onAdd: (input: {
    kind: EventKind;
    occurredOn: string;
    note: string | null;
  }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [kind, setKind] = useState<EventKind>("note");
  const [occurredOn, setOccurredOn] = useState(localToday);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      await onAdd({ kind, occurredOn, note: note.trim() || null });
      setNote("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="timeline">
      <h3>Timeline</h3>
      <div className="timeline-add">
        <Choice
          id="event-kind"
          value={kind}
          options={LOGGABLE}
          blank={null}
          onChange={(value) => setKind(value ?? "note")}
        />
        <Input
          type="date"
          aria-label="Date"
          value={occurredOn}
          onChange={(event) => setOccurredOn(event.target.value)}
        />
        <Input
          placeholder="What happened? e.g. 30 min screen with recruiter"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void add()}
        />
        <Button
          size="sm"
          disabled={busy || !occurredOn}
          onClick={() => void add()}
        >
          Log
        </Button>
      </div>
      {events.length === 0 ? (
        <p className="muted">Nothing logged yet.</p>
      ) : (
        <ol>
          {events.map((event) => (
            <li key={event.id} className={`event event--${event.kind}`}>
              <time>{shortDate(event.occurredOn)}</time>
              <div>
                <strong>{label(event.kind)}</strong>
                {event.note && <p>{event.note}</p>}
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Delete entry"
                onClick={() => void onRemove(event.id)}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
