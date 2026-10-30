import { useEffect, useState } from "react";
import { jev, type JevStatus } from "@/web/api";
import { Card, CardContent } from "@/web/components/ui/card";
import { Label } from "@/web/components/ui/label";
import { Switch } from "@/web/components/ui/switch";

export function MatchScoresCard() {
  const [status, setStatus] = useState<JevStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    jev
      .get()
      .then(setStatus)
      .catch((cause: Error) => setError(cause.message));
  }, []);

  if (!status) return null;

  async function toggle(enabled: boolean) {
    setError(null);
    try {
      setStatus(await jev.set(enabled));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="match-scores">
            Send my resume to TypeSafe for match scores
          </Label>
          <Switch
            id="match-scores"
            checked={status.enabled}
            onCheckedChange={(enabled) => void toggle(enabled)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Contact details are removed first. {status.usedToday} of{" "}
          {status.dailyLimit} used today.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
