import { describe, expect, it } from "vite-plus/test";
import { call, data, rpc, signedInAs } from "./helpers";

const alice = signedInAs("alice@example.test");
const bob = signedInAs("bob@example.test");

type Resume = { text: string; fileName: string | null; updatedAt: string };

const save = (json: unknown, ctx = alice) =>
  call("/api/v1/resume", { method: "PUT", json }, ctx);

async function tool(name: string, args: Record<string, unknown>, ctx = alice) {
  const result = (await rpc("tools/call", { name, arguments: args }, ctx)) as {
    isError?: boolean;
    content: Array<{ text: string }>;
  };
  expect(result.isError).not.toBe(true);
  return JSON.parse(result.content[0].text) as Resume | null;
}

describe("resume", () => {
  it("saves, replaces and removes one resume per person", async () => {
    expect(await data(await call("/api/v1/resume", {}, alice))).toBeNull();

    const first = await data<Resume>(
      await save({ text: "  TypeScript, React  ", fileName: "resume.pdf" }),
    );
    expect(first).toMatchObject({
      text: "TypeScript, React",
      fileName: "resume.pdf",
    });

    await save({ text: "Go, Postgres" });
    expect(await data(await call("/api/v1/resume", {}, alice))).toMatchObject({
      text: "Go, Postgres",
      fileName: null,
    });

    const removed = await call("/api/v1/resume", { method: "DELETE" }, alice);
    expect(await data(removed)).toEqual({ removed: true });
    expect(await data(await call("/api/v1/resume", {}, alice))).toBeNull();
  });

  it("rejects empty and oversized resumes", async () => {
    expect((await save({ text: "   " })).status).toBe(422);
    expect((await save({ text: "x".repeat(50_001) })).status).toBe(422);
    expect(await data(await call("/api/v1/resume", {}, alice))).toBeNull();
  });

  it("keeps each person's resume private", async () => {
    await save({ text: "Alice's private resume" });
    expect(await data(await call("/api/v1/resume", {}, bob))).toBeNull();
    expect(await tool("get_resume", {}, bob)).toBeNull();

    await call("/api/v1/resume", { method: "DELETE" }, bob);
    expect(await data(await call("/api/v1/resume", {}, alice))).toMatchObject({
      text: "Alice's private resume",
    });
  });

  it("is readable and replaceable over MCP", async () => {
    expect(await tool("get_resume", {})).toBeNull();
    await tool("save_resume", { text: "Product engineer", fileName: "cv.txt" });
    expect(await tool("get_resume", {})).toMatchObject({
      text: "Product engineer",
      fileName: "cv.txt",
    });
  });
});
