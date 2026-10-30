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

const FIND_PROMPT = `Find jobs that fit my resume, using my Job Search tracker:
1. Read my resume with get_resume, and list_applications so you skip jobs I already track.
2. Search the web for current postings that fit. Keep each posting's full text and link.
3. Score every posting with score_jobs, up to 10 at a time. Don't filter them yourself first.
4. Search for more jobs like the three highest scorers, using their titles and the skills that matched, and score those too.
5. Show me a table: company, role, score, why it fits, and the link. Don't add anything to my tracker yet.
6. Ask which ones I want. Add only those with add_application and their score as the resume match: status saved, or applied with today's date if I say I applied.`;

const PROMPTS = [
  {
    title: "Daily email sync",
    hint: "Schedule this prompt in your AI tool.",
    label: "daily sync prompt",
    text: SYNC_PROMPT,
  },
  {
    title: "Find jobs",
    hint: "Ask your AI to search and score jobs for you.",
    label: "find jobs prompt",
    text: FIND_PROMPT,
  },
];

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
        <CardContent className="divide-y">
          {PROMPTS.map((prompt) => (
            <div
              key={prompt.title}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{prompt.title}</p>
                <p className="text-xs text-muted-foreground">{prompt.hint}</p>
              </div>
              <CopyPrompt label={prompt.label} text={prompt.text} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function CopyPrompt({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0"
      aria-label={`Copy ${label}`}
      title={text}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : "Copy prompt"}
    </Button>
  );
}
