import { describe, expect, it } from "vitest";
import { call, data, rpc, signedInAs } from "./helpers";

const alice = signedInAs("Alice@Example.Test");
const bob = signedInAs("bob@example.test");

type Row = Record<string, unknown> & { id: string };

async function seedAlice() {
  const application = await data<Row>(
    await call(
      "/api/v1/applications",
      { method: "POST", json: { company: "Acme", role: "Engineer" } },
      alice,
    ),
  );
  const event = await data<Row>(
    await call(
      `/api/v1/applications/${application.id}/events`,
      {
        method: "POST",
        json: { kind: "interview", occurredOn: "2026-10-12" },
      },
      alice,
    ),
  );
  return { application, event };
}

async function tool(
  name: string,
  args: Record<string, unknown>,
  ctx: ExecutionContext,
) {
  const result = (await rpc("tools/call", { name, arguments: args }, ctx)) as {
    isError?: boolean;
    content: Array<{ text: string }>;
  };
  return { isError: Boolean(result.isError), text: result.content[0].text };
}

async function aliceUnchanged(id: string) {
  const detail = await data<Row & { events: Row[] }>(
    await call(`/api/v1/applications/${id}`, {}, alice),
  );
  expect(detail).toMatchObject({ company: "Acme", status: "saved" });
  expect(detail.events.map((event) => event.kind).sort()).toEqual([
    "interview",
    "status",
  ]);
}

describe("isolation between people", () => {
  it("keeps one person's applications and events out of another's REST calls", async () => {
    const { application, event } = await seedAlice();
    const path = `/api/v1/applications/${application.id}`;

    expect(await data(await call("/api/v1/applications", {}, bob))).toEqual([]);
    expect(
      await (await call("/api/v1/applications.csv", {}, bob)).text(),
    ).not.toContain("Acme");
    expect((await call(path, {}, bob)).status).toBe(404);
    expect(
      (await call(path, { method: "PATCH", json: { status: "offer" } }, bob))
        .status,
    ).toBe(404);
    expect(
      (
        await call(
          `${path}/events`,
          { method: "POST", json: { kind: "note", occurredOn: "2026-10-13" } },
          bob,
        )
      ).status,
    ).toBe(404);
    expect(
      (await call(`/api/v1/events/${event.id}`, { method: "DELETE" }, bob))
        .status,
    ).toBe(404);
    expect((await call(path, { method: "DELETE" }, bob)).status).toBe(404);

    await aliceUnchanged(application.id);
  });

  it("keeps one person's applications out of another's /mcp tools", async () => {
    const { application } = await seedAlice();
    const id = application.id;

    expect(await tool("list_applications", {}, bob)).toEqual({
      isError: false,
      text: "[]",
    });
    for (const [name, args] of [
      ["get_application", { id }],
      ["update_application", { id, status: "offer" }],
      ["log_event", { id, kind: "note" }],
      ["delete_application", { id }],
    ] as const)
      expect(await tool(name, args, bob)).toEqual({
        isError: true,
        text: "Application not found.",
      });

    await aliceUnchanged(id);
  });

  it("chooses the person by lowercased email", async () => {
    const { application } = await seedAlice();
    const rows = await data<Row[]>(
      await call("/api/v1/applications", {}, signedInAs("alice@example.test")),
    );
    expect(rows.map((row) => row.id)).toEqual([application.id]);
  });
});
