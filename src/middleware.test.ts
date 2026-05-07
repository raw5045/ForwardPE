import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthorizedRequest } from "./middleware";

describe("isAuthorizedRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows access when INTERNAL_ACCESS_TOKEN is not configured", () => {
    const request = new Request("http://localhost:3000");
    expect(isAuthorizedRequest(request, undefined)).toBe(true);
  });

  it("blocks access when missing tokens are not allowed", () => {
    const request = new Request("http://localhost:3000");
    expect(
      isAuthorizedRequest(request, undefined, { allowMissingToken: false })
    ).toBe(false);
  });

  it("blocks access when INTERNAL_ACCESS_TOKEN is not configured in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    const request = new Request("http://localhost:3000");
    expect(isAuthorizedRequest(request, undefined)).toBe(false);
  });

  it("blocks access when a strict token is blank", () => {
    const request = new Request("http://localhost:3000");
    expect(isAuthorizedRequest(request, "   ", { allowMissingToken: false })).toBe(
      false
    );
  });

  it("allows access when bearer token matches", () => {
    const request = new Request("http://localhost:3000", {
      headers: { authorization: "Bearer secret" }
    });
    expect(isAuthorizedRequest(request, "secret")).toBe(true);
  });

  it("blocks access when bearer token is missing", () => {
    const request = new Request("http://localhost:3000");
    expect(isAuthorizedRequest(request, "secret")).toBe(false);
  });
});
