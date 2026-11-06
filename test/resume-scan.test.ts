import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it, vi } from "vite-plus/test";
import { MATCH_GATEWAY } from "../src/match";
import { DAILY_SCANS, SCAN_MODEL } from "../src/resume-scan";
import { call, data, rpc } from "./helpers";

const RESUME = `Alex Rivera
Austin, TX | alex.rivera@example.com | (512) 555-0142 | linkedin.com/in/alexrivera
EXPERIENCE
Acme Corp
Product Engineer | Jan 2021 – Present
Built billing in TypeScript and React.
OPEN SOURCE
widgets: a React component kit.`;

const EXTRACTED = {
  jobs: [
    {
      company: "Acme Corp",
      title: "Product Engineer",
      start: "Jan 2021",
      end: "Present",
    },
    { company: "Globex", title: "Wizard", start: "2019", end: "2020" },
  ],
  education: [],
  skills: ["TypeScript", "React", "Kubernetes"],
};

const tracker = () =>
  env.TRACKER.get(env.TRACKER.idFromName("jaren@example.test"));

async function aiReturns(answer: () => unknown) {
  const run = vi.fn(async () => answer());
  await runInDurableObject(tracker(), (instance) => {
    const self = instance as unknown as { env: Record<string, unknown> };
    self.env = { ...self.env, AI: { run } };
  });
  return run;
}

const saveResume = (json: Record<string, unknown> = { text: RESUME }) =>
  call("/api/v1/resume", { method: "PUT", json });
const scan = () => call("/api/v1/resume/scan", { method: "POST" });

type Status = {
  scan: {
    contact: Record<string, unknown>;
    jobs: unknown[];
    skills: string[];
    sections: string[];
    findings: Array<{ severity: string; title: string }>;
  } | null;
  layout: unknown[] | null;
  usedToday: number;
  dailyLimit: number;
};

describe("resume scan", () => {
  it("reads contact without AI, keeps only what the resume says, and flags gaps", async () => {
    const run = await aiReturns(() => ({ response: EXTRACTED }));
    await saveResume();

    const result = await data<Status>(await scan());

    const [model, input, options] = run.mock.calls[0] as unknown as [
      string,
      { messages: Array<{ content: string }> },
      unknown,
    ];
    expect(model).toBe(SCAN_MODEL);
    expect(options).toEqual({ gateway: { id: MATCH_GATEWAY } });
    const sent = input.messages[1].content;
    expect(sent).not.toMatch(/Alex|Rivera|alex\.rivera|555-0142|linkedin/);
    expect(result.scan?.contact).toEqual({
      name: "Alex Rivera",
      email: "alex.rivera@example.com",
      phone: "(512) 555-0142",
      location: "Austin, TX",
      links: ["linkedin.com/in/alexrivera"],
    });
    expect(result.scan?.jobs).toEqual([EXTRACTED.jobs[0]]);
    expect(result.scan?.skills).toEqual(["TypeScript", "React"]);
    expect(result.scan?.sections).toEqual(["EXPERIENCE"]);
    expect(result.scan?.findings.map((finding) => finding.title)).toEqual([
      "No education read",
      "Only 2 skills read",
      'Unusual section heading "OPEN SOURCE"',
    ]);
    expect(result).toMatchObject({ usedToday: 1, dailyLimit: DAILY_SCANS });
  });

  it("returns the saved scan for unchanged text without using a scan", async () => {
    const run = await aiReturns(() => ({
      response: JSON.stringify(EXTRACTED),
    }));
    await saveResume();
    await scan();

    const again = await data<Status>(await scan());
    expect(run).toHaveBeenCalledTimes(1);
    expect(again.usedToday).toBe(1);
    expect(
      (await data<Status>(await call("/api/v1/resume/scan"))).scan?.jobs,
    ).toHaveLength(1);

    await saveResume({ text: `${RESUME}\nSKILLS\nGo` });
    expect(
      (await data<Status>(await call("/api/v1/resume/scan"))).scan,
    ).toBeNull();
  });

  it("stops at the daily limit and gives a failed scan back", async () => {
    let fail = true;
    await aiReturns(() => {
      if (fail) throw new Error("upstream timeout");
      return { response: EXTRACTED };
    });
    await saveResume();
    const failed = await scan();
    expect(failed.status).toBe(502);
    expect(
      (await data<Status>(await call("/api/v1/resume/scan"))).usedToday,
    ).toBe(0);

    fail = false;
    for (let index = 0; index < DAILY_SCANS; index++) {
      await saveResume({ text: `${RESUME}\nversion ${index}` });
      expect((await scan()).status).toBe(200);
    }
    await saveResume({ text: `${RESUME}\nversion next` });
    const limited = await scan();
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({
      error: { code: "resume_scan_daily_limit" },
    });
  });

  it("needs a saved resume", async () => {
    expect((await scan()).status).toBe(409);
  });

  it("keeps PDF layout findings with the resume until it's replaced as text", async () => {
    const layout = [
      {
        severity: "fix",
        title: "Two-column layout",
        detail: "Use a single column.",
        example: null,
      },
    ];
    await saveResume({ text: RESUME, fileName: "cv.pdf", layout });
    expect(await data(await call("/api/v1/resume/scan"))).toMatchObject({
      layout,
      scan: null,
    });

    await saveResume({ text: RESUME });
    expect(
      (await data<Status>(await call("/api/v1/resume/scan"))).layout,
    ).toBeNull();
    expect(
      (await saveResume({ text: RESUME, layout: [{ severity: "bad" }] }))
        .status,
    ).toBe(422);
  });

  it("is available over MCP", async () => {
    await aiReturns(() => ({ response: EXTRACTED }));
    await saveResume();
    const result = (await rpc("tools/call", {
      name: "scan_resume",
      arguments: {},
    })) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).not.toBe(true);
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      usedToday: 1,
      scan: { jobs: [EXTRACTED.jobs[0]] },
    });
  });
});
