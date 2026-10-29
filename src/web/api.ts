import type { EventKind } from "@/applications/fields";
import type { BenefitsPatch } from "@/applications/benefits";
import type {
  Application as Row,
  ApplicationEvent as EventRow,
} from "@/db/schema";

type Json<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] };

export type Application = Json<Row>;
export type ApplicationEvent = Json<EventRow>;
export type ApplicationDetail = Application & { events: ApplicationEvent[] };
export type ApplicationInput = Omit<
  Application,
  "id" | "createdAt" | "updatedAt"
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
  addEvent: (
    id: string,
    input: { kind: EventKind; occurredOn: string; note: string | null },
  ) =>
    api<ApplicationEvent>(
      `/api/v1/applications/${id}/events`,
      send("POST", input),
    ),
  removeEvent: (id: string) =>
    api<{ id: string }>(`/api/v1/events/${id}`, { method: "DELETE" }),
};
