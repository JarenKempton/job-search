import { describe, expect, it } from "vitest";
import { rpc } from "./helpers";

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
      "delete_application",
    ]);
  });

  it("clears an unverified date with null", async () => {
    const added = await toolCall("add_application", {
      company: "Railway",
      role: "Software Engineer",
      status: "applied",
      appliedOn: "2026-10-01",
    });
    await toolCall("update_application", { id: added.id, appliedOn: null });
    const detail = await toolCall("get_application", { id: added.id });
    expect(detail.appliedOn).toBeNull();
    expect(detail.status).toBe("applied");
  });

  it("deletes a duplicate application", async () => {
    const keep = await toolCall("add_application", {
      company: "North",
      role: "Engineer",
    });
    const duplicate = await toolCall("add_application", {
      company: "North",
      role: "Engineer",
    });
    await toolCall("delete_application", { id: duplicate.id });
    const rows = await toolCall("list_applications", { search: "north" });
    expect(rows.map((row: { id: string }) => row.id)).toEqual([keep.id]);
  });

  it("adds an application that list_applications then finds", async () => {
    const added = await toolCall("add_application", {
      company: "Supabase",
      role: "Software Engineer - Branching",
      status: "applied",
      pto: "20 vacation days",
      healthcare: "Starts day one",
    });
    expect(added.status).toBe("applied");
    await toolCall("update_application", {
      id: added.id,
      retirement: "4% employer match",
      pto: null,
    });
    const detail = await toolCall("get_application", { id: added.id });
    expect(detail).toMatchObject({
      pto: null,
      healthcare: "Starts day one",
      retirement: "4% employer match",
    });
    const rows = await toolCall("list_applications", { search: "supa" });
    expect(rows.map((row: { id: string }) => row.id)).toEqual([added.id]);
  });
});
