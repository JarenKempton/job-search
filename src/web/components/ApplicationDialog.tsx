import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import {
  APPLY_METHODS,
  EMPLOYMENT_TYPES,
  REQUIREMENTS,
  SOURCES,
  STATUSES,
  WORK_MODES,
  type Requirement,
} from "@/applications/fields";
import { jobs, type ApplicationDetail } from "@/web/api";
import { Choice, Field } from "@/web/components/fields";
import {
  EMPTY,
  toForm,
  toInput,
  type FormState,
} from "@/web/components/form-state";
import { Timeline } from "@/web/components/Timeline";
import { Button } from "@/web/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/web/components/ui/dialog";
import { Input } from "@/web/components/ui/input";
import { Textarea } from "@/web/components/ui/textarea";
import { label } from "@/web/format";

export function ApplicationDialog({
  id,
  onClose,
  onChanged,
}: {
  id: string | "new";
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editing = id !== "new";

  useEffect(() => {
    if (!editing) return;
    jobs
      .get(id)
      .then((row) => {
        setDetail(row);
        setForm(toForm(row));
      })
      .catch((cause: Error) => setError(cause.message));
  }, [id, editing]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const text = (key: keyof FormState) => ({
    id: key,
    value: (form[key] as string | null) ?? "",
    onChange: (event: { target: { value: string } }) =>
      set(key, event.target.value as never),
  });
  const toggle = (requirement: Requirement) =>
    set(
      "requirements",
      form.requirements.includes(requirement)
        ? form.requirements.filter((item) => item !== requirement)
        : [...form.requirements, requirement],
    );

  async function reload() {
    if (editing) setDetail(await jobs.get(id));
    await onChanged();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (editing) await jobs.update(id, toInput(form));
      else await jobs.create(toInput(form));
      await onChanged();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${form.company} – ${form.role}?`)) return;
    await jobs.remove(id);
    await onChanged();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="application-dialog">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? `${form.company || "…"} — ${form.role}`
              : "New application"}
          </DialogTitle>
        </DialogHeader>
        <form
          id="application-form"
          className="application-form"
          onSubmit={submit}
        >
          <fieldset>
            <legend>The job</legend>
            <Field id="company" title="Company">
              <Input required autoFocus={!editing} {...text("company")} />
            </Field>
            <Field id="role" title="Role">
              <Input required {...text("role")} />
            </Field>
            <Field id="jobUrl" title="Posting URL" className="span-2">
              <div className="inline">
                <Input type="url" placeholder="https://" {...text("jobUrl")} />
                {form.jobUrl && (
                  <Button asChild variant="outline" size="icon">
                    <a
                      href={form.jobUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open posting"
                    >
                      <ExternalLinkIcon />
                    </a>
                  </Button>
                )}
              </div>
            </Field>
            <Field id="location" title="Location">
              <Input placeholder="City, or Remote (US)" {...text("location")} />
            </Field>
            <div className="pair">
              <Field id="workMode" title="Work mode">
                <Choice
                  id="workMode"
                  value={form.workMode}
                  options={WORK_MODES}
                  onChange={(v) => set("workMode", v)}
                />
              </Field>
              <Field id="employmentType" title="Type">
                <Choice
                  id="employmentType"
                  value={form.employmentType}
                  options={EMPLOYMENT_TYPES}
                  onChange={(v) => set("employmentType", v)}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend>Where & how</legend>
            <Field id="source" title="Found it on">
              <Choice
                id="source"
                value={form.source}
                options={SOURCES}
                onChange={(v) => set("source", v)}
              />
            </Field>
            <Field
              id="sourceDetail"
              title="Source detail"
              hint="Referrer, recruiter, or list name"
            >
              <Input {...text("sourceDetail")} />
            </Field>
            <Field id="applyMethod" title="Apply via">
              <Choice
                id="applyMethod"
                value={form.applyMethod}
                options={APPLY_METHODS}
                onChange={(v) => set("applyMethod", v)}
              />
            </Field>
            <Field
              id="resumeVersion"
              title="Resume version sent"
              hint="e.g. backend-v3.pdf"
            >
              <Input {...text("resumeVersion")} />
            </Field>
            <div className="span-2 field">
              <span className="field-title">They ask for</span>
              <div className="checks">
                {REQUIREMENTS.map((requirement) => (
                  <label key={requirement} className="check">
                    <input
                      type="checkbox"
                      checked={form.requirements.includes(requirement)}
                      onChange={() => toggle(requirement)}
                    />
                    {label(requirement)}
                  </label>
                ))}
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>Pay & fit</legend>
            <div className="pair">
              <Field
                id="salaryMin"
                title="Salary min"
                hint="USD/yr — 120k works"
              >
                <Input inputMode="numeric" {...text("salaryMin")} />
              </Field>
              <Field id="salaryMax" title="Salary max">
                <Input inputMode="numeric" {...text("salaryMax")} />
              </Field>
            </div>
            <Field id="yearsRequired" title="Years experience asked">
              <Input
                type="number"
                min={0}
                max={50}
                {...text("yearsRequired")}
              />
            </Field>
            <div className="pair">
              <Field id="fit" title="Fit %" hint="How well you match">
                <Input type="number" min={0} max={100} {...text("fit")} />
              </Field>
              <Field
                id="interest"
                title="Interest"
                hint="1–5, how much you want it"
              >
                <Input type="number" min={1} max={5} {...text("interest")} />
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend>Progress</legend>
            <Field
              id="status"
              title="Status"
              hint="Applied/heard-back dates fill in automatically"
            >
              <Choice
                id="status"
                value={form.status}
                options={STATUSES}
                blank={null}
                onChange={(v) => set("status", v ?? "saved")}
              />
            </Field>
            <Field id="appliedOn" title="Applied on">
              <Input type="date" {...text("appliedOn")} />
            </Field>
            <Field id="heardBackOn" title="Heard back on">
              <Input type="date" {...text("heardBackOn")} />
            </Field>
            <Field id="followUpOn" title="Follow up on">
              <Input type="date" {...text("followUpOn")} />
            </Field>
            <Field id="contactName" title="Contact">
              <Input
                placeholder="Recruiter / hiring manager"
                {...text("contactName")}
              />
            </Field>
            <Field id="contactEmail" title="Contact email">
              <Input type="email" {...text("contactEmail")} />
            </Field>
          </fieldset>

          <fieldset className="wide">
            <legend>Notes</legend>
            <Field id="notes" title="Notes" className="span-2">
              <Textarea rows={3} {...text("notes")} />
            </Field>
            <Field
              id="description"
              title="Job description"
              hint="Paste it — postings disappear"
              className="span-2"
            >
              <Textarea rows={5} {...text("description")} />
            </Field>
          </fieldset>
        </form>

        {detail && (
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
        )}

        {error && <p className="form-error">{error}</p>}
        <DialogFooter>
          {editing && (
            <Button
              variant="destructive"
              className="mr-auto"
              onClick={() => void remove()}
            >
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="application-form" disabled={busy}>
            {editing ? "Save" : "Add application"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
