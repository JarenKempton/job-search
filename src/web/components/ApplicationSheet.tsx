import { useEffect, useState, type FormEvent } from "react";
import { jobs, type ApplicationDetail } from "@/web/api";
import { ApplicationSummary } from "@/web/components/ApplicationSummary";
import { EditSections } from "@/web/components/EditSections";
import { toForm, toPatch, useFormState } from "@/web/components/form-state";
import { Timeline } from "@/web/components/Timeline";
import { Button } from "@/web/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/web/components/ui/dialog";

export function ApplicationSheet({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const formApi = useFormState();
  const { form, setForm } = formApi;
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    jobs
      .get(id)
      .then((row) => {
        setDetail(row);
        setForm(toForm(row));
      })
      .catch((cause: Error) => setError(cause.message));
  }, [id, setForm]);

  const dirty =
    detail != null && JSON.stringify(form) !== JSON.stringify(toForm(detail));

  async function reload() {
    const row = await jobs.get(id);
    setDetail(row);
    await onChanged();
    return row;
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  function cancelEditing() {
    if (detail) setForm(toForm(detail));
    setError(null);
    setEditing(false);
  }

  function close() {
    if (!dirty || window.confirm("Discard your unsaved changes?")) onClose();
  }

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!detail) return;
    return run(async () => {
      const patch = toPatch(form, detail);
      if (Object.keys(patch).length) await jobs.update(id, patch);
      setForm(toForm(await reload()));
      setEditing(false);
    });
  };

  const remove = () =>
    run(async () => {
      if (!window.confirm(`Delete ${detail?.company} – ${detail?.role}?`))
        return;
      await jobs.remove(id);
      await onChanged();
      onClose();
    });

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="sheet">
        <DialogTitle className="sr-only">
          {detail ? `${detail.company} — ${detail.role}` : "Application"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {editing
            ? "Edit this application's details, then save or cancel."
            : "Application summary and recorded activity."}
        </DialogDescription>
        {!detail ? (
          <p className="muted">{error ?? "Loading…"}</p>
        ) : (
          <div className="sheet-body">
            {editing ? (
              <>
                <header className="summary-head">
                  <p className="summary-company">{detail.company}</p>
                  <h2>Edit application</h2>
                  <p className="muted">
                    Changes are saved only when you choose Save changes.
                  </p>
                </header>
                <form id="sheet-form" onSubmit={save}>
                  <EditSections {...formApi} />
                </form>
                <Button
                  type="button"
                  variant="ghost"
                  className="delete-button"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  Delete application
                </Button>
                <div className="save-bar">
                  <span role={error ? "alert" : undefined}>
                    {error ?? (dirty ? "Unsaved changes" : "No changes yet")}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={cancelEditing}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    form="sheet-form"
                    size="sm"
                    disabled={busy || !dirty}
                  >
                    {busy ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </>
            ) : (
              <ApplicationSummary
                row={detail}
                onEdit={() => setEditing(true)}
                onFollowedUp={async (followUp) => {
                  await jobs.addEvent(id, { kind: "follow_up", ...followUp });
                  setForm(toForm(await reload()));
                }}
                onSkipFollowUp={async () => {
                  await jobs.update(id, {
                    skipFollowUp: true,
                    followUpOn: null,
                  });
                  setForm(toForm(await reload()));
                }}
                timeline={
                  <Timeline
                    events={detail.events}
                    applicationNote={detail.notes}
                    onClearNote={async () => {
                      await jobs.update(id, { notes: null });
                      setForm(toForm(await reload()));
                    }}
                    onAdd={async (input) => {
                      await jobs.addEvent(id, input);
                      await reload();
                    }}
                    onRemove={async (eventId) => {
                      await jobs.removeEvent(eventId);
                      await reload();
                    }}
                  />
                }
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
