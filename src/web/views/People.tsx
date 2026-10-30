import { MailIcon, UserPlusIcon } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { people as api, type PeopleList, type Person } from "@/web/api";
import { Button } from "@/web/components/ui/button";
import { Card, CardContent } from "@/web/components/ui/card";
import { Input } from "@/web/components/ui/input";
import { shortDate } from "@/web/format";

function seen(person: Person) {
  if (!person.lastSeen) return "Hasn't signed in yet";
  return `Last signed in ${shortDate(person.lastSeen)}`;
}

export function People() {
  const [list, setList] = useState<PeopleList | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api
      .list()
      .then(setList)
      .catch((cause: Error) => setError(cause.message));
  }, []);

  async function run(action: () => Promise<PeopleList>, email?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await action();
      setList(next);
      if (email && next.invited !== undefined)
        setNotice(
          next.invited
            ? `Invite sent to ${email}.`
            : `${email} can sign in, but the invite email didn't send.`,
        );
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (await run(() => api.add(address), address)) setEmail("");
  };

  const remove = (person: Person) => {
    if (window.confirm(`Remove ${person.email}? Their saved jobs stay.`))
      void run(() => api.remove(person.email));
  };

  return (
    <div className="home max-w-3xl">
      <header className="page-heading">
        <h1>People</h1>
      </header>

      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            People you add get an invite email and can sign in with that address
            to get their own private tracker.
          </p>
          <form onSubmit={add} className="flex gap-2">
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
              className="h-9 shrink-0"
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
                  <p className="truncate text-sm font-medium">{person.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {seen(person)}
                    {!person.member && " · not in the group"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {person.member && !person.lastSeen && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(() => api.invite(person.email), person.email)
                      }
                    >
                      <MailIcon />
                      Resend invite
                    </Button>
                  )}
                  {person.member && list.configured && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => remove(person)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
