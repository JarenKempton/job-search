import {
  ArrowLeftRightIcon,
  CalendarIcon,
  ClipboardCheckIcon,
  FileCheckIcon,
  MessageSquareIcon,
  PhoneIcon,
  PlusIcon,
  SendIcon,
  StickyNoteIcon,
  Trash2Icon,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { EVENT_KINDS, type EventKind } from "@/applications/fields";
import { localToday, type ApplicationEvent } from "@/web/api";
import { Choice, Field } from "@/web/components/fields";
import { Button } from "@/web/components/ui/button";
import { Input } from "@/web/components/ui/input";
import { Textarea } from "@/web/components/ui/textarea";
import { label } from "@/web/format";

const LOGGABLE = EVENT_KINDS.filter((kind) => kind !== "status");
const ICONS = {
  note: StickyNoteIcon,
  status: ArrowLeftRightIcon,
  response: MessageSquareIcon,
  call: PhoneIcon,
  interview: CalendarIcon,
  assessment: ClipboardCheckIcon,
  follow_up: SendIcon,
  offer: FileCheckIcon,
};

const eventDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export function Timeline({
  events,
  applicationNote,
  onClearNote,
  onAdd,
  onRemove,
}: {
  events: ApplicationEvent[];
  applicationNote: string | null;
  onClearNote: () => Promise<void>;
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
  const [draftNote, setDraftNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ordered = [...events].sort(
    (a, b) =>
      b.occurredOn.localeCompare(a.occurredOn) ||
      b.createdAt.localeCompare(a.createdAt),
  );

  async function add(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onAdd({ kind, occurredOn, note: note.trim() || null });
      setNote("");
      setExpanded(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function addNote(event: FormEvent) {
    event.preventDefault();
    if (!draftNote.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd({
        kind: "note",
        occurredOn: localToday(),
        note: draftNote.trim(),
      });
      setDraftNote("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string | null) {
    setBusy(true);
    setError(null);
    try {
      if (id === null) await onClearNote();
      else await onRemove(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="timeline" aria-label="Timeline">
      <div className="timeline-heading">
        <h3>Notes & activity</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={expanded}
          aria-controls="log-activity"
          onClick={() => setExpanded((current) => !current)}
        >
          <PlusIcon /> Log activity
        </Button>
      </div>
      <form className="grid gap-2" aria-label="Add note" onSubmit={addNote}>
        <Textarea
          aria-label="Note"
          placeholder="Add a note…"
          rows={2}
          value={draftNote}
          onChange={(event) => setDraftNote(event.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          className="justify-self-end"
          disabled={busy || !draftNote.trim()}
        >
          Add note
        </Button>
      </form>
      {ordered.length === 0 && !applicationNote ? (
        <p className="muted">No activity recorded.</p>
      ) : (
        <ol>
          {ordered.map((event) => {
            const Icon = ICONS[event.kind] ?? StickyNoteIcon;
            return (
              <li key={event.id} className="event">
                <span className="event-icon">
                  <Icon aria-hidden="true" />
                </span>
                <div className="event-body">
                  <div className="event-heading">
                    <strong>{label(event.kind)}</strong>
                    <time dateTime={event.occurredOn}>
                      {eventDate(event.occurredOn)}
                    </time>
                  </div>
                  {event.note && <p>{event.note}</p>}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Delete ${label(event.kind)} entry`}
                  disabled={busy}
                  onClick={() => void remove(event.id)}
                >
                  <Trash2Icon />
                </Button>
              </li>
            );
          })}
          {applicationNote && (
            <li className="event">
              <span className="event-icon">
                <StickyNoteIcon aria-hidden="true" />
              </span>
              <div className="event-body">
                <div className="event-heading">
                  <strong>Note</strong>
                </div>
                <p>{applicationNote}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Delete application note"
                disabled={busy}
                onClick={() => void remove(null)}
              >
                <Trash2Icon />
              </Button>
            </li>
          )}
        </ol>
      )}
      {expanded && (
        <form id="log-activity" className="timeline-add" onSubmit={add}>
          <Field id="event-kind" title="Activity">
            <Choice
              id="event-kind"
              value={kind}
              options={LOGGABLE}
              blank={null}
              onChange={(value) => setKind(value ?? "note")}
            />
          </Field>
          <Field id="event-date" title="Date">
            <Input
              id="event-date"
              type="date"
              required
              value={occurredOn}
              onChange={(event) => setOccurredOn(event.target.value)}
            />
          </Field>
          <Field id="event-note" title="Details" className="span-2">
            <Textarea
              id="event-note"
              placeholder="What happened?"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <div className="timeline-actions">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy || !occurredOn}>
              Save activity
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
