import { useState, type FormEvent } from "react";
import { STATUSES } from "@/applications/fields";
import { jobs } from "@/web/api";
import { Choice, Field } from "@/web/components/fields";
import { toInput, useFormState } from "@/web/components/form-state";
import { Button } from "@/web/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/web/components/ui/dialog";
import { Input } from "@/web/components/ui/input";

export function NewApplication({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const { form, set, text } = useFormState();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await jobs.create(toInput(form));
      await onCreated(created.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="new-dialog">
        <DialogHeader>
          <DialogTitle>Add a job</DialogTitle>
        </DialogHeader>
        <form id="new-application" className="new-form" onSubmit={submit}>
          <Field id="company" title="Company">
            <Input required autoFocus {...text("company")} />
          </Field>
          <Field id="role" title="Role">
            <Input required {...text("role")} />
          </Field>
          <Field id="jobUrl" title="Posting URL">
            <Input type="url" placeholder="https://" {...text("jobUrl")} />
          </Field>
          <Field id="status" title="Status">
            <Choice
              id="status"
              value={form.status}
              options={STATUSES}
              blank={null}
              onChange={(value) => set("status", value ?? "saved")}
            />
          </Field>
        </form>
        {error && <p className="form-error">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-application" disabled={busy}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
