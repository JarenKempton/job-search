import { useEffect, useState } from "react";
import { matchScores, type MatchScoreStatus } from "@/web/api";
import { Card, CardContent } from "@/web/components/ui/card";
import { Label } from "@/web/components/ui/label";
import { Progress } from "@/web/components/ui/progress";
import { Switch } from "@/web/components/ui/switch";

export function MatchScoresCard() {
  const [status, setStatus] = useState<MatchScoreStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      if (document.visibilityState !== "visible") return;
      matchScores
        .get()
        .then(setStatus)
        .catch((cause: Error) => setError(cause.message));
    };
    load();
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  if (!status)
    return error ? (
      <p className="form-error" role="alert">
        {error}
      </p>
    ) : null;

  async function toggle(enabled: boolean) {
    setError(null);
    try {
      setStatus(await matchScores.set(enabled));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="match-scores">Score jobs against my resume</Label>
          <Switch
            id="match-scores"
            checked={status.enabled}
            onCheckedChange={(enabled) => void toggle(enabled)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Scored by Cloudflare's Clef model, which keeps nothing. Your name,
          email, phone, links and street address are removed first.
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Progress
            aria-label="Match scores used today"
            value={(100 * status.usedToday) / status.dailyLimit}
            className="h-1.5"
          />
          <span className="shrink-0 tabular">
            {status.usedToday} of {status.dailyLimit} today
          </span>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
