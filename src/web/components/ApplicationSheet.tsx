import { useEffect, useState, type FormEvent } from "react";
import { jobs, type ApplicationDetail } from "@/web/api";
import { ApplicationSummary } from "@/web/components/ApplicationSummary";
import { EditSections } from "@/web/components/EditSections";
import { toForm, toInput, useFormState } from "@/web/components/form-state";
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
  const { form, set, setForm } = formApi;
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const save = (event: FormEvent) => {
    event.preventDefault();
    return run(async () => {
      await jobs.update(id, toInput(form));
      setForm(toForm(await reload()));
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sheet">
        <DialogTitle className="sr-only">
          {detail ? `${detail.company} — ${detail.role}` : "Application"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Summary, edit sections and timeline for this application.
        </DialogDescription>
        {!detail ? (
          <p className="muted">{error ?? "Loading…"}</p>
        ) : (
          <div className="sheet-body">
            <ApplicationSummary
              row={detail}
              status={form.status}
              onStatus={(status) => set("status", status)}
            />
            <Timeline
              events={detail.events}
              onAdd={async (input) => {
                await jobs.addEvent(id, input);
                await reload();
              }}
              onRemove={async (eventId) => {
                await jobs.removeEvent(eventId);
                await reload();
              }}
            />
            <form id="sheet-form" onSubmit={save}>
              <h3 className="section-label">Edit</h3>
              <EditSections {...formApi} />
            </form>
            <Button
              type="button"
              variant="ghost"
              className="delete-button"
              onClick={() => void remove()}
            >
              Delete application
            </Button>
            {(dirty || error) && (
              <div className="save-bar">
                <span>{error ?? "Unsaved changes"}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm(toForm(detail))}
                >
                  Discard
                </Button>
                <Button
                  type="submit"
                  form="sheet-form"
                  size="sm"
                  disabled={busy || !dirty}
                >
                  Save
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
