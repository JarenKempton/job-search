import { describe, expect, it } from "vitest";
import { call } from "./helpers";

async function rpc(method: string, params: Record<string, unknown> = {}) {
  const response = await call("/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { result: Record<string, unknown> })
    .result;
}

function toolCall(name: string, args: Record<string, unknown>) {
  return rpc("tools/call", { name, arguments: args }).then((result) =>
    JSON.parse((result.content as Array<{ text: string }>)[0].text),
  );
}

describe("remote MCP", () => {
  it("lists the job-search tools", async () => {
    const { tools } = (await rpc("tools/list")) as {
      tools: Array<{ name: string }>;
    };
    expect(tools.map((tool) => tool.name)).toEqual([
      "list_applications",
      "get_application",
      "add_application",
      "update_application",
      "log_event",
    ]);
  });

  it("adds an application that list_applications then finds", async () => {
    const added = await toolCall("add_application", {
      company: "Supabase",
      role: "Software Engineer - Branching",
      status: "applied",
    });
    expect(added.status).toBe("applied");
    const rows = await toolCall("list_applications", { search: "supa" });
    expect(rows.map((row: { id: string }) => row.id)).toEqual([added.id]);
  });
});
