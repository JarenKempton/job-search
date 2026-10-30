import { EllipsisIcon, UserPlusIcon } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { people as api, type PeopleList, type Person } from "@/web/api";
import { AiUsageCard } from "@/web/components/AiUsageCard";
import { Button } from "@/web/components/ui/button";
import { Card, CardContent } from "@/web/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/web/components/ui/dropdown-menu";
import { Input } from "@/web/components/ui/input";
import { shortDate } from "@/web/format";

const EXTRA_SCORES = 25;

function details(person: Person) {
  const parts = [
    person.lastSeen
      ? `Last signed in ${shortDate(person.lastSeen)}`
      : "Hasn't signed in yet",
  ];
  if (person.scores)
    parts.unshift(
      `${person.scores.usedToday} of ${person.scores.dailyLimit} scores today`,
    );
  if (!person.member) parts.push("not in the group");
  return parts.join(" · ");
}

export function People() {
  const [list, setList] = useState<PeopleList | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api
      .list()
      .then(setList)
      .catch((cause: Error) => setError(cause.message));
  }, []);

  async function run(action: () => Promise<PeopleList>, done?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await action();
      setList(next);
      setNotice(done ?? null);
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return null;
    } finally {
      setBusy(false);
    }
  }

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    const next = await run(() => api.add(address, name.trim() || null));
    if (!next) return;
    setNotice(
      next.invited
        ? `Invite sent to ${address}.`
        : `${address} can sign in, but the invite email didn't send.`,
    );
    setEmail("");
    setName("");
  };

  const rename = (person: Person) => {
    const answer = window.prompt(`Name for ${person.email}`, person.name ?? "");
    if (answer !== null)
      void run(() => api.rename(person.email, answer.trim() || null));
  };

  const resend = async (person: Person) => {
    const next = await run(() => api.invite(person.email));
    if (next)
      setNotice(
        next.invited
          ? `Invite sent to ${person.email}.`
          : `The invite email to ${person.email} didn't send.`,
      );
  };

  const remove = async (person: Person) => {
    if (!window.confirm(`Remove ${person.email}? Their saved jobs stay.`))
      return;
    const next = await run(() => api.remove(person.email));
    if (next)
      setNotice(
        next.signedOut
          ? `Removed ${person.email} and signed them out.`
          : `Removed ${person.email}. They couldn't be signed out, so they lose access within a day.`,
      );
  };

  return (
    <div className="home max-w-3xl">
      <header className="page-heading">
        <h1>People</h1>
      </header>

      <AiUsageCard />

      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            People you add get an invite email and can sign in with that address
            to get their own private tracker.
          </p>
          <form
            onSubmit={add}
            className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
          >
            <Input
              aria-label="Name"
              placeholder="Name"
              value={name}
              maxLength={80}
              disabled={!list?.configured}
              onChange={(event) => setName(event.target.value)}
            />
            <Input
              type="email"
              required
              aria-label="Email"
              placeholder="name@example.com"
              value={email}
              disabled={!list?.configured}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button
              type="submit"
              size="sm"
              className="h-9"
              disabled={busy || !list?.configured || !email.trim()}
            >
              <UserPlusIcon />
              Add
            </Button>
          </form>
          {list && !list.configured && (
            <p className="text-xs text-muted-foreground">
              Adding people isn't set up yet.
            </p>
          )}
          {notice && (
            <p className="text-sm" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {list && list.people.length > 0 && (
        <Card className="py-0">
          <CardContent className="divide-y px-0">
            {list.people.map((person) => (
              <div
                key={person.email}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {person.name ?? person.email}
                  </p>
                  {person.name && (
                    <p className="truncate text-xs text-muted-foreground">
                      {person.email}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {details(person)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Actions for ${person.name ?? person.email}`}
                      disabled={busy}
                    >
                      <EllipsisIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => rename(person)}>
                      {person.name ? "Rename" : "Add a name"}
                    </DropdownMenuItem>
                    {person.scores && (
                      <>
                        <DropdownMenuItem
                          onSelect={() =>
                            void run(
                              () => api.resetScores(person.email),
                              `Reset today's scores for ${person.name ?? person.email}.`,
                            )
                          }
                        >
                          Reset today's scores
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            void run(
                              () => api.allowExtra(person.email, EXTRA_SCORES),
                              `${person.name ?? person.email} can score ${EXTRA_SCORES} more today.`,
                            )
                          }
                        >
                          Allow {EXTRA_SCORES} more today
                        </DropdownMenuItem>
                      </>
                    )}
                    {person.member && list.configured && (
                      <>
                        {!person.lastSeen && (
                          <DropdownMenuItem
                            onSelect={() => void resend(person)}
                          >
                            Resend invite
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => void remove(person)}
                        >
                          Remove
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
