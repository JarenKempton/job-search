import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../src/env";
import worker from "../src/worker";
import { call, data, signedInAs } from "./helpers";

const owner = signedInAs("jaren.kempton@gmail.com");
const send = vi.fn(async () => ({ messageId: "m1" }));
const groupEnv = {
  ...env,
  ACCESS_GROUP_ID: "group-1",
  ACCESS_GROUPS_TOKEN: "token",
  EMAIL: { send },
} as unknown as Env;

type Person = { email: string; member: boolean; lastSeen: string | null };
type Group = { name: string; include: unknown[] };

function cloudflareGroup(initial: string[]) {
  let group: Group = {
    name: "Job Search users",
    include: [
      { email_domain: { domain: "example.org" } },
      ...initial.map((email) => ({ email: { email } })),
    ],
  };
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (_input, init) => {
      if (init?.method === "PUT") group = JSON.parse(String(init.body));
      return Response.json({ success: true, result: group });
    });
  return { fetch, group: () => group };
}

function asOwner(path: string, init: RequestInit = {}) {
  return (
    worker.fetch as (
      r: Request,
      e: Env,
      c: ExecutionContext,
    ) => Promise<Response>
  )(new Request(`https://example.test${path}`, init), groupEnv, owner);
}

afterEach(() => {
  vi.restoreAllMocks();
  send.mockClear();
});

describe("people", () => {
  it("only lets admins manage people", async () => {
    expect(await data(await call("/api/v1/me"))).toEqual({
      email: "jaren@example.test",
      admin: false,
    });
    expect((await call("/api/v1/people")).status).toBe(403);
    expect(await data(await call("/api/v1/me", {}, owner))).toMatchObject({
      admin: true,
    });
  });

  it("records who has signed in", async () => {
    await call("/api/v1/applications", {}, signedInAs("makayla@example.test"));
    const { configured, people } = await data<{
      configured: boolean;
      people: Person[];
    }>(await call("/api/v1/people", {}, owner));
    expect(configured).toBe(false);
    expect(people).toContainEqual(
      expect.objectContaining({
        email: "makayla@example.test",
        member: false,
        lastSeen: new Date().toISOString().slice(0, 10),
      }),
    );
  });

  it("adds and removes emails in the Access group, keeping other rules", async () => {
    const cloudflare = cloudflareGroup(["makayla@example.test"]);
    const added = await data<{ people: Person[] }>(
      await asOwner("/api/v1/people", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "New.Friend@Example.test" }),
      }),
    );
    expect(
      added.people.filter((person) => person.member).map((p) => p.email),
    ).toEqual(["makayla@example.test", "new.friend@example.test"]);
    expect(cloudflare.group().include).toEqual([
      { email_domain: { domain: "example.org" } },
      { email: { email: "makayla@example.test" } },
      { email: { email: "new.friend@example.test" } },
    ]);
    const [url, init] = cloudflare.fetch.mock.calls[1];
    expect(String(url)).toContain("/access/groups/group-1");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer token",
    );

    const removed = await data<{ signedOut: boolean }>(
      await asOwner("/api/v1/people/makayla%40example.test", {
        method: "DELETE",
      }),
    );
    expect(removed.signedOut).toBe(true);
    const revoke = cloudflare.fetch.mock.calls.at(-1)!;
    expect(String(revoke[0])).toContain("/access/organizations/revoke_user");
    expect(JSON.parse(String(revoke[1]?.body))).toEqual({
      email: "makayla@example.test",
    });
    expect(cloudflare.group().include).toEqual([
      { email_domain: { domain: "example.org" } },
      { email: { email: "new.friend@example.test" } },
    ]);

    expect(
      (
        await asOwner("/api/v1/people/jaren.kempton%40gmail.com", {
          method: "DELETE",
        })
      ).status,
    ).toBe(400);
  });

  it("emails an invite from jobs@jarenkempton.dev with replies going to the owner", async () => {
    cloudflareGroup([]);
    const added = await data<{ invited: boolean }>(
      await asOwner("/api/v1/people", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "friend@example.test" }),
      }),
    );
    expect(added.invited).toBe(true);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "friend@example.test",
        from: { email: "jobs@jarenkempton.dev", name: "Job Search" },
        replyTo: "jaren.kempton@gmail.com",
        subject: "You're invited to Job Search",
        text: expect.stringContaining(
          "Open https://example.test and sign in with friend@example.test",
        ),
      }),
    );

    send.mockRejectedValueOnce(
      Object.assign(new Error("not onboarded"), {
        code: "E_SENDER_DOMAIN_NOT_AVAILABLE",
      }),
    );
    const resent = await asOwner(
      "/api/v1/people/friend%40example.test/invite",
      {
        method: "POST",
      },
    );
    expect(resent.status).toBe(200);
    expect(await data(resent)).toMatchObject({ invited: false });
    expect(
      (
        await asOwner("/api/v1/people/stranger%40example.test/invite", {
          method: "POST",
        })
      ).status,
    ).toBe(404);
  });

  it("says when Cloudflare refuses the change", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json(
        { success: false, errors: [{ message: "Authentication error" }] },
        { status: 403 },
      ),
    );
    const response = await asOwner("/api/v1/people", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "someone@example.test" }),
    });
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: { message: expect.stringContaining("Authentication error") },
    });
  });
});
