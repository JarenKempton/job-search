import { describe, expect, it, vi } from "vitest";
import { call, data, rpc, signedInAs } from "./helpers";

const alice = signedInAs("alice@example.test");
const bob = signedInAs("bob@example.test");
const CHANGED = '{"type":"changed"}';

async function openTab(ctx: ExecutionContext) {
  const response = await call(
    "/api/v1/live",
    { headers: { upgrade: "websocket" } },
    ctx,
  );
  expect(response.status).toBe(101);
  const socket = response.webSocket!;
  socket.accept();
  const messages: unknown[] = [];
  socket.addEventListener("message", (event) => {
    messages.push(event.data);
  });
  return messages;
}

describe("live updates", () => {
  it("tells every open tab of the signed-in person about REST and MCP changes, and nobody else", async () => {
    const [first, second, other] = await Promise.all([
      openTab(alice),
      openTab(alice),
      openTab(bob),
    ]);

    const created = await data<{ id: string }>(
      await call(
        "/api/v1/applications",
        { method: "POST", json: { company: "Acme", role: "Engineer" } },
        alice,
      ),
    );
    await vi.waitFor(() => {
      expect(first).toEqual([CHANGED]);
      expect(second).toEqual([CHANGED]);
    });

    await rpc(
      "tools/call",
      {
        name: "log_event",
        arguments: { id: created.id, kind: "note", note: "Called" },
      },
      alice,
    );
    await rpc(
      "tools/call",
      { name: "delete_application", arguments: { id: created.id } },
      alice,
    );
    await vi.waitFor(() => expect(first).toEqual([CHANGED, CHANGED, CHANGED]));
    expect(other).toEqual([]);
  });

  it("refuses a plain request and a cross-site origin", async () => {
    expect((await call("/api/v1/live", {}, alice)).status).toBe(426);
    expect(
      (
        await call(
          "/api/v1/live",
          { headers: { upgrade: "websocket", origin: "https://evil.test" } },
          alice,
        )
      ).status,
    ).toBe(403);
  });
});
