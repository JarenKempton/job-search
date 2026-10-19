import { describe, expect, it } from "vitest";
import { mayAccess } from "../src/lib/cloudflare-access";

const env = { ACCESS_SERVICE_CLIENT_ID: "mcp.access" };
const service = (clientId: string) => ({ kind: "service" as const, clientId });

describe("mayAccess", () => {
  it("lets a signed-in person reach the app and API", () => {
    expect(mayAccess({ kind: "user" }, env, "/")).toBe(true);
    expect(mayAccess({ kind: "user" }, env, "/api/v1/applications")).toBe(true);
  });

  it("lets only the configured service token reach the API", () => {
    expect(mayAccess(service("mcp.access"), env, "/api/v1/applications")).toBe(
      true,
    );
    expect(mayAccess(service("mcp.access"), env, "/")).toBe(false);
    expect(
      mayAccess(service("other.access"), env, "/api/v1/applications"),
    ).toBe(false);
  });

  it("refuses every service token when none is configured", () => {
    expect(
      mayAccess(
        service(""),
        { ACCESS_SERVICE_CLIENT_ID: "" },
        "/api/v1/applications",
      ),
    ).toBe(false);
  });
});
