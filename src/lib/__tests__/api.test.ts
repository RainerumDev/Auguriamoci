import { afterEach, describe, expect, it, vi } from "vitest";
import { applyAuth, googleGet, GoogleApiError } from "../google/api";

describe("applyAuth", () => {
  it("uses a Bearer header for access tokens, URL untouched", () => {
    const req = applyAuth("https://api.example/v1/x?fields=a", {
      accessToken: "tok123",
    });
    expect(req.url).toBe("https://api.example/v1/x?fields=a");
    expect(req.headers).toEqual({ Authorization: "Bearer tok123" });
  });

  it("appends key= to a URL without query", () => {
    const req = applyAuth("https://api.example/v1/x", { apiKey: "AIza-k" });
    expect(req.url).toBe("https://api.example/v1/x?key=AIza-k");
    expect(req.headers).toEqual({});
  });

  it("appends key= preserving an existing query string", () => {
    const req = applyAuth("https://api.example/v1/x?fields=a&max=2", {
      apiKey: "AIza-k",
    });
    const url = new URL(req.url);
    expect(url.searchParams.get("fields")).toBe("a");
    expect(url.searchParams.get("max")).toBe("2");
    expect(url.searchParams.get("key")).toBe("AIza-k");
  });
});

describe("googleGet", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches with the API key in the URL and parses JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: 1 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const data = await googleGet<{ ok: number }>("https://api.example/x", {
      apiKey: "K",
    });
    expect(data).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledWith("https://api.example/x?key=K", {
      headers: {},
    });
  });

  it("maps 403 to GoogleApiError with isAuthError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { message: "The caller does not have permission" } }),
          { status: 403 },
        ),
      ),
    );
    const err = await googleGet("https://api.example/x", {
      apiKey: "K",
    }).catch((e) => e);
    expect(err).toBeInstanceOf(GoogleApiError);
    expect((err as GoogleApiError).isAuthError).toBe(true);
    expect((err as GoogleApiError).message).toContain("permission");
  });
});
