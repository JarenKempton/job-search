import { useEffect, useState } from "react";
import { aiUsage, type AiUsage } from "@/web/api";
import { Button } from "@/web/components/ui/button";
import { Card, CardContent } from "@/web/components/ui/card";
import { Progress } from "@/web/components/ui/progress";

const dollars = (amount: number) =>
  amount > 0 && amount < 0.01 ? "under $0.01" : `$${amount.toFixed(2)}`;

export function AiUsageCard() {
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    aiUsage
      .get()
      .then(setUsage)
      .catch((cause: Error) => setError(cause.message));
  }, []);

  async function changeCeiling(current: number | null) {
    const answer = window.prompt(
      "Daily AI spending ceiling in dollars",
      String(current ?? 1),
    );
    if (answer === null) return;
    const ceiling = Number(answer);
    if (!Number.isFinite(ceiling)) return setError("Enter a dollar amount.");
    setBusy(true);
    setError(null);
    try {
      setUsage(await aiUsage.setCeiling(ceiling));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">AI usage today</h2>
          {usage?.configured && (
            <span className="text-xs text-muted-foreground tabular-nums">
              resets midnight UTC
            </span>
          )}
        </div>
        {usage?.configured ? (
          <>
            <Progress
              aria-label="Free tier used today"
              value={Math.min(100, (100 * usage.spentToday) / usage.freeToday)}
              className="h-1.5"
            />
            <p className="text-sm tabular-nums">
              {usage.spentToday <= usage.freeToday
                ? `Free tier: ${dollars(usage.spentToday)} of ${dollars(usage.freeToday)} used`
                : `Past the free tier: about ${dollars(usage.spentToday - usage.freeToday)} billed today`}
            </p>
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {usage.ceiling === null
                  ? "No daily ceiling"
                  : `Daily ceiling ${dollars(usage.ceiling)}: scoring stops for everyone past it`}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void changeCeiling(usage.ceiling)}
              >
                Change
              </Button>
            </div>
          </>
        ) : (
          usage && (
            <p className="text-xs text-muted-foreground">
              AI usage isn't set up yet.
            </p>
          )
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
