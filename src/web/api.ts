import type { Channel, EventKind } from "@/applications/fields";
import type { BenefitsPatch } from "@/applications/benefits";
import type {
  Application as Row,
  ApplicationEvent as EventRow,
  Resume as ResumeRow,
} from "@/db/schema";

type Json<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] };

export type Application = Json<Row>;
export type ApplicationEvent = Json<EventRow>;
export type Resume = Json<ResumeRow>;
export type ApplicationDetail = Application & { events: ApplicationEvent[] };
export type NewEvent = {
  kind: EventKind;
  occurredOn: string;
  note: string | null;
  channel: Channel | null;
};
export type ApplicationInput = Omit<
  Application,
  "id" | "createdAt" | "updatedAt" | "fitDetails"
>;
export type ApplicationUpdate = Partial<Omit<ApplicationInput, "benefits">> & {
  benefits?: BenefitsPatch | null;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers });
  const body = (await response.json().catch(() => ({}))) as {
    data: T;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(
      body.error?.message ?? `Request failed (${response.status}).`,
    );
  return body.data;
}

export function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

const send = (method: string, body: unknown) => ({
  method,
  body: JSON.stringify(body),
});

export const jobs = {
  list: () => api<Application[]>("/api/v1/applications"),
  get: (id: string) => api<ApplicationDetail>(`/api/v1/applications/${id}`),
  create: (input: Partial<ApplicationInput>) =>
    api<Application>(
      "/api/v1/applications",
      send("POST", { ...input, today: localToday() }),
    ),
  update: (id: string, input: ApplicationUpdate) =>
    api<Application>(
      `/api/v1/applications/${id}`,
      send("PATCH", { ...input, today: localToday() }),
    ),
  remove: (id: string) =>
    api<{ id: string }>(`/api/v1/applications/${id}`, { method: "DELETE" }),
  addEvent: (id: string, input: NewEvent) =>
    api<ApplicationEvent>(
      `/api/v1/applications/${id}/events`,
      send("POST", input),
    ),
  removeEvent: (id: string) =>
    api<{ id: string }>(`/api/v1/events/${id}`, { method: "DELETE" }),
};

export const resume = {
  get: () => api<Resume | null>("/api/v1/resume"),
  save: (input: { text: string; fileName: string | null }) =>
    api<Resume>("/api/v1/resume", send("PUT", input)),
  remove: () =>
    api<{ removed: boolean }>("/api/v1/resume", { method: "DELETE" }),
};

export type Person = {
  email: string;
  name: string | null;
  scores: MatchScoreStatus | null;
  member: boolean;
  firstSeen: string | null;
  lastSeen: string | null;
};
export type PeopleList = {
  configured: boolean;
  people: Person[];
  invited?: boolean;
  signedOut?: boolean;
};

export const me = () => api<{ email: string; admin: boolean }>("/api/v1/me");

export const people = {
  list: () => api<PeopleList>("/api/v1/people"),
  add: (email: string, name: string | null) =>
    api<PeopleList>("/api/v1/people", send("POST", { email, name })),
  rename: (email: string, name: string | null) =>
    api<PeopleList>(
      `/api/v1/people/${encodeURIComponent(email)}`,
      send("PATCH", { name }),
    ),
  resetScores: (email: string) =>
    api<PeopleList>(
      `/api/v1/people/${encodeURIComponent(email)}/reset`,
      send("POST", {}),
    ),
  allowExtra: (email: string, scores: number) =>
    api<PeopleList>(
      `/api/v1/people/${encodeURIComponent(email)}/extra`,
      send("POST", { scores }),
    ),
  invite: (email: string) =>
    api<PeopleList>(
      `/api/v1/people/${encodeURIComponent(email)}/invite`,
      send("POST", {}),
    ),
  remove: (email: string) =>
    api<PeopleList>(`/api/v1/people/${encodeURIComponent(email)}`, {
      method: "DELETE",
    }),
};

export type AiUsage =
  | { configured: false }
  | {
      configured: true;
      spentToday: number;
      freeToday: number;
      ceiling: number | null;
      standardCeiling: number | null;
      raisedToday: boolean;
    };

export const aiUsage = {
  get: () => api<AiUsage>("/api/v1/ai-usage"),
  setCeiling: (ceiling: number, scope: "today" | "default") =>
    api<AiUsage>("/api/v1/ai-usage", send("PUT", { ceiling, scope })),
};

export type MatchScoreStatus = {
  enabled: boolean;
  usedToday: number;
  dailyLimit: number;
};

export const matchScores = {
  get: () => api<MatchScoreStatus>("/api/v1/match-scores/settings"),
  set: (enabled: boolean) =>
    api<MatchScoreStatus>(
      "/api/v1/match-scores/settings",
      send("PUT", { enabled }),
    ),
};
