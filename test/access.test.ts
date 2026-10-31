import { env } from "cloudflare:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { call, data, rpc, signedInAs } from "./helpers";

const noBinding = {} as ExecutionContext;

const keys = generateKeyPair("RS256");

async function accessJwt(claims: Record<string, unknown>) {
  const { publicKey, privateKey } = await keys;
  const jwk = { ...(await exportJWK(publicKey)), kid: "test", alg: "RS256" };
  const fetch = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) =>
    String(input).endsWith("/cdn-cgi/access/certs")
      ? Promise.resolve(Response.json({ keys: [jwk] }))
      : fetch(input, init),
  );
  return new SignJWT({ type: "app", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuer(env.ACCESS_TEAM_DOMAIN!)
    .setAudience(env.ACCESS_AUD!)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

afterEach(() => vi.restoreAllMocks());

describe("access", () => {
  it("rejects requests without a Cloudflare Access identity", async () => {
    const response = await call("/api/v1/applications", {}, noBinding);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "access_required" },
    });
  });

  it("refuses a service token, which carries no email", async () => {
    const token = await accessJwt({ common_name: "test-client.access" });
    const response = await call(
      "/api/v1/applications",
      { headers: { "cf-access-jwt-assertion": token } },
      noBinding,
    );
    expect(response.status).toBe(401);
  });

  it("serves /mcp tools to the person named in the verified JWT", async () => {
    const token = await accessJwt({ email: "Alice@Example.Test" });
    const response = await call(
      "/mcp",
      {
        method: "POST",
        headers: {
          "cf-access-jwt-assertion": token,
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "add_application",
            arguments: { company: "Acme", role: "Engineer" },
          },
        }),
      },
      noBinding,
    );
    expect(response.status).toBe(200);
    const rows = await data<Array<{ company: string }>>(
      await call("/api/v1/applications", {}, signedInAs("alice@example.test")),
    );
    expect(rows.map((row) => row.company)).toEqual(["Acme"]);
    expect(
      await rpc("tools/call", { name: "list_applications", arguments: {} }),
    ).toMatchObject({ content: [{ text: "[]" }] });
  });
});
