import { env, runInDurableObject } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Env } from "../src/env";
import { DAILY_SCORES } from "../src/match";
import worker from "../src/worker";
import { call, data, signedInAs } from "./helpers";

const owner = signedInAs("jaren.kempton@gmail.com");
const send = vi.fn(async () => ({ messageId: "m1" }));
const groupEnv = {
  ...env,
  ACCESS_GROUP_ID: "group-1",
  ACCESS_GROUPS_TOKEN: "token",
  AI_GATEWAY_TOKEN: "ai-token",
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

describe("admin", () => {
  it("only lets admins manage people", async () => {
    expect(await data(await call("/api/v1/me"))).toEqual({
      email: "jaren@example.test",
      admin: false,
    });
    for (const [method, path] of [
      ["GET", "/api/v1/admin/people"],
      ["POST", "/api/v1/admin/people"],
      ["PATCH", "/api/v1/admin/people/avery%40example.test"],
      ["DELETE", "/api/v1/admin/people/avery%40example.test"],
      ["POST", "/api/v1/admin/people/avery%40example.test/invite"],
      ["POST", "/api/v1/admin/people/avery%40example.test/reset"],
      ["POST", "/api/v1/admin/people/avery%40example.test/extra"],
      ["GET", "/api/v1/admin/ai-usage"],
      ["PUT", "/api/v1/admin/ai-usage"],
      ["GET", "/api/v1/admin/anything-new"],
    ])
      expect(
        (await call(path, method === "GET" ? {} : { method, json: {} })).status,
        `${method} ${path}`,
      ).toBe(403);
    expect(await data(await call("/api/v1/me", {}, owner))).toMatchObject({
      admin: true,
    });
  });

  it("records who has signed in", async () => {
    await call("/api/v1/applications", {}, signedInAs("avery@example.test"));
    const { configured, people } = await data<{
      configured: boolean;
      people: Person[];
    }>(await call("/api/v1/admin/people", {}, owner));
    expect(configured).toBe(false);
    expect(people).toContainEqual(
      expect.objectContaining({
        email: "avery@example.test",
        member: false,
        lastSeen: new Date().toISOString().slice(0, 10),
      }),
    );
  });

  it("adds and removes emails in the Access group, keeping other rules", async () => {
    const cloudflare = cloudflareGroup(["avery@example.test"]);
    const added = await data<{ people: Person[] }>(
      await asOwner("/api/v1/admin/people", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "New.Friend@Example.test" }),
      }),
    );
    expect(
      added.people.filter((person) => person.member).map((p) => p.email),
    ).toEqual(["avery@example.test", "new.friend@example.test"]);
    expect(cloudflare.group().include).toEqual([
      { email_domain: { domain: "example.org" } },
      { email: { email: "avery@example.test" } },
      { email: { email: "new.friend@example.test" } },
    ]);
    const [url, init] = cloudflare.fetch.mock.calls[1];
    expect(String(url)).toContain("/access/groups/group-1");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer token",
    );

    const removed = await data<{ signedOut: boolean }>(
      await asOwner("/api/v1/admin/people/avery%40example.test", {
        method: "DELETE",
      }),
    );
    expect(removed.signedOut).toBe(true);
    const revoke = cloudflare.fetch.mock.calls.at(-1)!;
    expect(String(revoke[0])).toContain("/access/organizations/revoke_user");
    expect(JSON.parse(String(revoke[1]?.body))).toEqual({
      email: "avery@example.test",
    });
    expect(cloudflare.group().include).toEqual([
      { email_domain: { domain: "example.org" } },
      { email: { email: "new.friend@example.test" } },
    ]);

    expect(
      (
        await asOwner("/api/v1/admin/people/jaren.kempton%40gmail.com", {
          method: "DELETE",
        })
      ).status,
    ).toBe(400);
  });

  it("emails an invite from jobs@jarenkempton.dev with replies going to the owner", async () => {
    cloudflareGroup([]);
    const added = await data<{ invited: boolean }>(
      await asOwner("/api/v1/admin/people", {
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
      "/api/v1/admin/people/friend%40example.test/invite",
      {
        method: "POST",
      },
    );
    expect(resent.status).toBe(200);
    expect(await data(resent)).toMatchObject({ invited: false });
    expect(
      (
        await asOwner("/api/v1/admin/people/stranger%40example.test/invite", {
          method: "POST",
        })
      ).status,
    ).toBe(404);
  });

  it("keeps a name for each person and greets them by it", async () => {
    cloudflareGroup([]);
    await asOwner("/api/v1/admin/people", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "nick@example.test", name: "Nick Rivera" }),
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringMatching(/^Hi Nick,/) }),
    );
    const renamed = await data<{ people: (Person & { name: string })[] }>(
      await asOwner("/api/v1/admin/people/nick%40example.test", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Nicholas" }),
      }),
    );
    expect(
      renamed.people.find((person) => person.email === "nick@example.test")
        ?.name,
    ).toBe("Nicholas");
  });

  it("resets a person's scores or allows more for today", async () => {
    cloudflareGroup([]);
    const someone = signedInAs("scorer@example.test");
    await call("/api/v1/applications", {}, someone);
    await runInDurableObject(
      env.TRACKER.get(env.TRACKER.idFromName("scorer@example.test")),
      (_, state) =>
        state.storage.kv.put("matchScores", {
          enabled: true,
          day: new Date().toISOString().slice(0, 10),
          used: DAILY_SCORES,
        }),
    );
    const settings = async () =>
      data<{ usedToday: number; dailyLimit: number }>(
        await call("/api/v1/match-scores/settings", {}, someone),
      );
    await asOwner("/api/v1/admin/people/scorer%40example.test/extra", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scores: 25 }),
    });
    expect(await settings()).toMatchObject({
      usedToday: DAILY_SCORES,
      dailyLimit: DAILY_SCORES + 25,
    });
    const reset = await data<{
      people: { email: string; scores: { usedToday: number } | null }[];
    }>(
      await asOwner("/api/v1/admin/people/scorer%40example.test/reset", {
        method: "POST",
      }),
    );
    expect(
      reset.people.find((person) => person.email === "scorer@example.test")
        ?.scores?.usedToday,
    ).toBe(0);
    expect(await settings()).toMatchObject({ usedToday: 0 });
  });

  it("reports today's AI spend against the free tier and changes the ceiling", async () => {
    let gateway = {
      id: "job-search",
      created_at: "2026-10-30",
      collect_logs: false,
      spend_limits: {
        enabled: true,
        rules: [{ id: "r1", limit: 1, limitType: "cost", window: 86400 }],
      },
    };
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.endsWith("/graphql"))
          return Response.json({
            data: {
              viewer: {
                accounts: [
                  {
                    aiGatewayRequestsAdaptiveGroups: [
                      { sum: { cost: 0.05 } },
                      { sum: { cost: 0.1 } },
                    ],
                  },
                ],
              },
            },
            errors: null,
          });
        if (init?.method === "PUT")
          gateway = { ...gateway, ...JSON.parse(String(init.body)) };
        return Response.json({ success: true, result: gateway });
      });
    const usage = await data<{
      spentToday: number;
      freeToday: number;
      ceiling: number;
    }>(await asOwner("/api/v1/admin/ai-usage"));
    expect(usage.spentToday).toBeCloseTo(0.15);
    expect(usage.freeToday).toBeCloseTo(0.11);
    expect(usage.ceiling).toBe(1);
    expect((await call("/api/v1/admin/ai-usage")).status).toBe(403);

    const setCeiling = async (body: object) =>
      data<{ ceiling: number; standardCeiling: number; raisedToday: boolean }>(
        await asOwner("/api/v1/admin/ai-usage", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    expect(await setCeiling({ ceiling: 2 })).toMatchObject({
      ceiling: 2,
      standardCeiling: 1,
      raisedToday: true,
    });
    const put = fetch.mock.calls.find(([, init]) => init?.method === "PUT")!;
    const body = JSON.parse(String(put[1]?.body));
    expect(body).not.toHaveProperty("id");
    expect(body).toMatchObject({
      collect_logs: false,
      spend_limits: { rules: [{ id: "r1", limit: 2, window: 86400 }] },
    });

    expect(await setCeiling({ ceiling: 3, scope: "default" })).toMatchObject({
      ceiling: 3,
      standardCeiling: 3,
      raisedToday: false,
    });

    await setCeiling({ ceiling: 5 });
    await runInDurableObject(
      env.DIRECTORY.get(env.DIRECTORY.idFromName("all")),
      (_, state) =>
        state.storage.kv.put("ceiling", {
          standard: 3,
          raisedOn: "2000-01-01",
        }),
    );
    expect(await data(await asOwner("/api/v1/admin/ai-usage"))).toMatchObject({
      ceiling: 3,
      raisedToday: false,
    });
  });

  it("says when Cloudflare refuses the change", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      Response.json(
        { success: false, errors: [{ message: "Authentication error" }] },
        { status: 403 },
      ),
    );
    const response = await asOwner("/api/v1/admin/people", {
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
