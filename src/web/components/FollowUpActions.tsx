import { useState, type FormEvent } from "react";
import { CHANNELS, type Channel } from "@/applications/fields";
import { localToday, type NewEvent } from "@/web/api";
import { Choice } from "@/web/components/fields";
import { Button } from "@/web/components/ui/button";
import { Input } from "@/web/components/ui/input";
import { Label } from "@/web/components/ui/label";
import { Textarea } from "@/web/components/ui/textarea";

export type FollowUp = Omit<NewEvent, "kind">;

export function FollowUpActions({
  onFollowedUp,
  onSkip,
}: {
  onFollowedUp: (followUp: FollowUp) => Promise<void>;
  onSkip: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [occurredOn, setOccurredOn] = useState(localToday);
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState<Channel | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await onFollowedUp({ occurredOn, note: note.trim() || null, channel });
      setOpen(false);
      setNote("");
      setChannel(null);
    });
  };

  if (!open)
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setOpen(true)}
        >
          I followed up
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void run(onSkip)}
        >
          Skip
        </Button>
        {error && (
          <p className="form-error w-full" role="alert">
            {error}
          </p>
        )}
      </div>
    );

  return (
    <form
      onSubmit={save}
      className="grid gap-3 rounded-lg border border-border p-3"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="follow-up-message">Message you sent (optional)</Label>
        <Textarea
          id="follow-up-message"
          rows={4}
          placeholder="Paste the message, or who you contacted"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="follow-up-date">Sent on</Label>
          <Input
            id="follow-up-date"
            type="date"
            required
            value={occurredOn}
            onChange={(event) => setOccurredOn(event.target.value)}
          />
        </div>
        <div className="grid min-w-36 gap-1.5">
          <Label htmlFor="follow-up-channel">How</Label>
          <Choice
            id="follow-up-channel"
            value={channel}
            options={CHANNELS}
            onChange={setChannel}
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={busy || !occurredOn}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
