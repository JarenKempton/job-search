import type { ReactNode } from "react";
import { CopyField } from "@/web/components/CopyField";
import { ResumeCard } from "@/web/components/ResumeCard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/web/components/ui/card";

const SYNC_PROMPT = `Every day at 8 AM, update my Job Search tracker:
1. Search my Gmail, including archived mail, for application confirmations, recruiter replies, interview invitations, assessments, offers and rejections since the last run.
2. Match each email to an application with list_applications. Update its status and dates with update_application, and log_event with the email's date and a one-line summary. Add an application only when none matches.
3. For new applications, read the job posting and record the salary, work mode and benefits it states. Leave anything unstated blank; never guess.
4. If you can't verify a date, clear it with null.
5. Reply with a short list of what changed.`;

function Client({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{name}</h3>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-muted-foreground">
        {children}
      </ol>
    </section>
  );
}

export function Setup() {
  const url = `${window.location.origin}/mcp`;

  return (
    <div className="home max-w-3xl">
      <header className="page-heading">
        <h1>Setup</h1>
      </header>

      <ResumeCard />

      <Card>
        <CardHeader>
          <CardTitle>Connect your AI</CardTitle>
          <CardDescription>
            Your AI tools add and update applications for you. Sign in with the
            email you were invited with; each person only sees their own
            tracker.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <CopyField label="MCP server URL" value={url} />

          <Client name="ChatGPT">
            <li>
              Settings → Apps &amp; Connectors → Advanced settings: turn on{" "}
              <span className="text-foreground">Developer mode</span>.
            </li>
            <li>
              Create a connector named{" "}
              <span className="text-foreground">Job Search</span>, paste the URL
              above, and choose <span className="text-foreground">OAuth</span>.
            </li>
            <li>Sign in when prompted, then enable it in a new chat.</li>
          </Client>

          <Client name="Claude">
            <li>
              Settings → Connectors →{" "}
              <span className="text-foreground">Add custom connector</span>.
            </li>
            <li>
              Name it <span className="text-foreground">Job Search</span>, paste
              the URL above, and leave the OAuth fields blank.
            </li>
            <li>Choose Connect and sign in.</li>
          </Client>

          <Client name="Claude Code">
            <li>
              Run the command below, then open{" "}
              <code className="text-foreground">/mcp</code> and authenticate.
            </li>
          </Client>
          <CopyField
            label="Claude Code command"
            value={`claude mcp add --transport http job-search ${url}`}
          />

          <p className="text-sm text-muted-foreground">
            When the app gains new features, refresh the connector in your AI
            tool so it picks up new actions.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily email sync</CardTitle>
          <CardDescription>
            Schedule this in your AI tool so the tracker stays current from your
            inbox.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CopyField label="Daily sync prompt" value={SYNC_PROMPT} multiline />
        </CardContent>
      </Card>
    </div>
  );
}
