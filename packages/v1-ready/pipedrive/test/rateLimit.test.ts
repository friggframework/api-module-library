import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Api } from "../src/api";

type FakeResponse = {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
};

function throttledFetch(responses: FakeResponse[]) {
  const queue = [...responses];
  return vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error("unexpected fetch call");
    const body = next.body ?? {};
    return {
      status: next.status,
      bodyUsed: false,
      headers: new Map(
        Object.entries({ "Content-Type": "application/json", ...next.headers })
      ),
      json: async () => body,
      text: vi.fn(async () => JSON.stringify(body)),
    };
  });
}

const ok: FakeResponse = { status: 200, body: { success: true, data: [] } };
const limited = (headers?: Record<string, string>): FakeResponse => ({
  status: 429,
  headers,
});

const recordedBurstHeaders = {
  "x-ratelimit-limit": "10",
  "x-ratelimit-remaining": "0",
  "x-ratelimit-reset": "10",
  "Retry-After": "10",
};

describe("Pipedrive rate limits", () => {
  let delays: Array<number | undefined>;

  beforeEach(() => {
    delays = [];
    const realSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      fn: () => void,
      delay?: number,
      ...args: unknown[]
    ) => {
      delays.push(delay);
      return realSetTimeout(fn, 0, ...args);
    }) as typeof setTimeout);
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const makeApi = (fetch: ReturnType<typeof throttledFetch>) =>
    new Api({
      companyDomain: "https://acme.pipedrive.com",
      fetch,
      requestTimeoutMs: 0,
    } as any);

  it("waits as long as x-ratelimit-reset says, then retries", async () => {
    const fetch = throttledFetch([
      limited({
        "x-ratelimit-limit": "80",
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": "2",
      }),
      ok,
    ]);

    const result = await makeApi(fetch).listDeals();

    expect(result).toEqual({ success: true, data: [] });
    expect(delays).toEqual([2_000]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("waits the 10 seconds of a recorded 429 that carries Retry-After and x-ratelimit-reset", async () => {
    const fetch = throttledFetch([limited(recordedBurstHeaders), ok]);

    await makeApi(fetch).listDeals();

    expect(delays).toEqual([10_000]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps the fixed backoff ladder for a 429 with no headers, as for an exhausted daily budget", async () => {
    const fetch = throttledFetch([limited(), ok]);

    await makeApi(fetch).listDeals();

    expect(delays).toEqual([1_000]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("declares the lowest documented OAuth burst allowance", () => {
    expect(Api.rateLimit).toMatchObject({
      scope: "entity",
      windows: [{ name: "burst", limit: 80, perMs: 2_000 }],
      parsers: ["retryAfter", "resetHeaders"],
    });
  });
});
