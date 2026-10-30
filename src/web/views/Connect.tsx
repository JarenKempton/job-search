import { useState } from "react";
import { CopyField } from "@/web/components/CopyField";
import { Button } from "@/web/components/ui/button";
import { Card, CardContent } from "@/web/components/ui/card";

const SYNC_PROMPT = `Every day at 8 AM, update my Job Search tracker:
1. Search my Gmail, including archived mail, for application confirmations, recruiter replies, interview invitations, assessments, offers and rejections since the last run.
2. Match each email to an application with list_applications. Update its status and dates with update_application, and log_event with the email's date and a one-line summary. Add an application only when none matches.
3. For new applications, read the job posting and record the salary, work mode and benefits it states. Leave anything unstated blank; never guess.
4. If you can't verify a date, clear it with null.
5. Reply with a short list of what changed.`;

const CLIENTS = ["ChatGPT", "Claude", "Claude Code"] as const;
type Client = (typeof CLIENTS)[number];

const STEPS: Record<Exclude<Client, "Claude Code">, string[]> = {
  ChatGPT: [
    "Settings → Apps & Connectors → Advanced → turn on Developer mode",
    "Create → paste the URL → OAuth → sign in",
  ],
  Claude: [
    "Settings → Connectors → Add custom connector",
    "Paste the URL → Connect → sign in",
  ],
};

export function Connect() {
  const url = `${window.location.origin}/mcp`;
  const [client, setClient] = useState<Client>("ChatGPT");

  return (
    <div className="home max-w-3xl">
      <header className="page-heading">
        <h1>Connect</h1>
      </header>

      <Card>
        <CardContent className="space-y-5">
          <CopyField label="MCP server URL" value={url} />

          <div
            role="group"
            aria-label="AI tool"
            className="flex flex-wrap gap-1"
          >
            {CLIENTS.map((name) => (
              <Button
                key={name}
                type="button"
                size="sm"
                variant={client === name ? "secondary" : "ghost"}
                aria-pressed={client === name}
                onClick={() => setClient(name)}
              >
                {name}
              </Button>
            ))}
          </div>

          {client === "Claude Code" ? (
            <CopyField
              label="Claude Code command"
              value={`claude mcp add --transport http job-search ${url}`}
            />
          ) : (
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              {STEPS[client].map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Daily email sync</p>
            <p className="text-xs text-muted-foreground">
              Schedule this prompt in your AI tool.
            </p>
          </div>
          <CopyPrompt />
        </CardContent>
      </Card>
    </div>
  );
}

function CopyPrompt() {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label="Copy daily sync prompt"
      title={SYNC_PROMPT}
      onClick={async () => {
        await navigator.clipboard.writeText(SYNC_PROMPT);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : "Copy prompt"}
    </Button>
  );
}
