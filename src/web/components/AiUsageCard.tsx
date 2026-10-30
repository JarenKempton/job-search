import { useEffect, useState } from "react";
import { aiUsage, type AiUsage } from "@/web/api";
import { Button } from "@/web/components/ui/button";
import { Card, CardContent } from "@/web/components/ui/card";
import { Progress } from "@/web/components/ui/progress";
import { resetTime } from "@/web/format";

const dollars = (amount: number) =>
  amount > 0 && amount < 0.01 ? "under $0.01" : `$${amount.toFixed(2)}`;

type Usage = Extract<AiUsage, { configured: true }>;

function LimitLine({ usage }: { usage: Usage }) {
  if (usage.ceiling === null) return <>No daily spending limit</>;
  if (usage.raisedToday && usage.standardCeiling !== null)
    return (
      <>
        Limit raised to {dollars(usage.ceiling)} for today, back to{" "}
        {dollars(usage.standardCeiling)} at {resetTime()}
      </>
    );
  return <>Daily spending limit: {dollars(usage.ceiling)}</>;
}

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

  async function change(scope: "today" | "default", suggested: number) {
    const answer = window.prompt(
      scope === "today"
        ? "Spending limit for today only, in dollars"
        : "Default daily spending limit, in dollars",
      String(suggested),
    );
    if (answer === null) return;
    const ceiling = Number(answer.replace("$", ""));
    if (!Number.isFinite(ceiling)) return setError("Enter a dollar amount.");
    setBusy(true);
    setError(null);
    try {
      setUsage(await aiUsage.setCeiling(ceiling, scope));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  const ready = usage?.configured ? usage : null;
  const over = ready ? ready.spentToday - ready.freeToday : 0;

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">AI spending today</h2>
          <span className="text-xs text-muted-foreground">
            Resets at {resetTime()}
          </span>
        </div>
        {ready ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-2xl font-semibold tabular-nums">
                {dollars(ready.spentToday)}
              </p>
              <p className="text-xs text-muted-foreground">
                Free up to {dollars(ready.freeToday)} a day
              </p>
            </div>
            <Progress
              aria-label="Free daily allowance used"
              value={Math.min(100, (100 * ready.spentToday) / ready.freeToday)}
              className="h-1.5"
            />
            <p className="text-sm">
              {over > 0
                ? `${dollars(over)} over the free allowance, billed to your Cloudflare account.`
                : "Still within the free daily allowance."}
            </p>
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm tabular-nums">
                <LimitLine usage={ready} />
              </p>
              <p className="text-xs text-muted-foreground">
                If spending reaches the limit, match scoring pauses for everyone
                until it resets.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void change("today", Math.max(2, (ready.ceiling ?? 1) * 2))
                  }
                >
                  Raise for today
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void change(
                      "default",
                      ready.standardCeiling ?? ready.ceiling ?? 1,
                    )
                  }
                >
                  Change default
                </Button>
              </div>
            </div>
          </>
        ) : (
          usage && (
            <p className="text-xs text-muted-foreground">
              AI spending isn't set up yet.
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
