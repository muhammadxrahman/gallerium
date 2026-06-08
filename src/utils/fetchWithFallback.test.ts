import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithFallback } from "./fetchWithFallback";

function ok(body = "data"): Response {
  return new Response(body, { status: 200 });
}
function fail(status = 500): Response {
  return new Response("err", { status });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchWithFallback", () => {
  it("returns the first URL's response and does not call later URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithFallback(["a", "b"], { retries: 0 });
    expect(await res.text()).toBe("data");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("a");
  });

  it("falls through to the next URL when the first rejects", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(ok("from-b"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithFallback(["a", "b"], { retries: 0 });
    expect(await res.text()).toBe("from-b");
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
  });

  it("falls through on a non-ok HTTP status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fail(503))
      .mockResolvedValueOnce(ok("recovered"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchWithFallback(["a", "b"], { retries: 0 });
    expect(res.ok).toBe(true);
    expect(await res.text()).toBe("recovered");
  });

  it("retries the same URL before moving on", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("blip"))
      .mockResolvedValueOnce(ok("second-try"));
    vi.stubGlobal("fetch", fetchMock);

    // retries:1 → up to 2 attempts on URL "a"; should succeed on attempt 2.
    const res = await fetchWithFallback(["a"], { retries: 1 });
    expect(await res.text()).toBe("second-try");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every((c) => c[0] === "a")).toBe(true);
  });

  it("throws the last error when every URL and retry fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("all dead"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchWithFallback(["a", "b"], { retries: 1 })).rejects.toThrow("all dead");
    // 2 URLs × (1 + 1 retry) = 4 attempts
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("passes an abort signal so a hung request can time out", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);

    await fetchWithFallback(["a"], { retries: 0, timeoutMs: 5000 });
    const init = fetchMock.mock.calls[0][1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
