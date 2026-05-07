import { describe, expect, it } from "vitest";
import { isAuthorizedRequest } from "./middleware";

describe("isAuthorizedRequest", () => {
  it("allows access when INTERNAL_ACCESS_TOKEN is not configured", () => {
    const request = new Request("http://localhost:3000");
    expect(isAuthorizedRequest(request, undefined)).toBe(true);
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
