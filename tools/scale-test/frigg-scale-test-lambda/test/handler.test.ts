import { handler } from "../src/handler";
import { APIGatewayProxyEventV2 } from "aws-lambda";

describe("frigg-scale-test lambda", () => {
  const baseEvent: Partial<APIGatewayProxyEventV2> = {
    version: "2.0",
    routeKey: "$default",
    headers: {},
    isBase64Encoded: false,
    requestContext: {
      accountId: "test",
      apiId: "test",
      domainName: "localhost",
      domainPrefix: "",
      requestId: "test",
      routeKey: "$default",
      stage: "$default",
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
      http: {
        method: "GET",
        path: "/",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "jest"
      }
    } as any
  };

  function buildEvent(method: string, path: string, options: { query?: Record<string, string>; body?: any } = {}): APIGatewayProxyEventV2 {
    const query = options.query || {};
    const rawQueryString = Object.keys(query)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
      .join("&");
    return {
      ...baseEvent,
      rawPath: path,
      rawQueryString,
      queryStringParameters: Object.keys(query).length ? query : null,
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers: { "content-type": "application/json" },
      requestContext: {
        ...(baseEvent.requestContext as any),
        http: {
          ...(baseEvent.requestContext as any).http,
          method,
          path
        }
      }
    } as APIGatewayProxyEventV2;
  }

  function ensureResult(output: Awaited<ReturnType<typeof handler>>) {
    if (typeof output === "string") {
      throw new Error("Expected structured result");
    }
    return output;
  }

  it("returns health ok", async () => {
    const res = ensureResult(await handler(buildEvent("GET", "/health")));
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeDefined();
    expect(JSON.parse(res.body || "{}")).toEqual({ ok: true });
  });

  it("lists contacts with pagination", async () => {
    const res = ensureResult(await handler(buildEvent("GET", "/contacts", { query: { accountId: "demo", limit: "5" } })));
    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body || "{}");
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.items.length).toBeLessThanOrEqual(5);
    expect(json.nextCursor).toBeDefined();
  });

  it("filters activities by type and persists new activity", async () => {
    const list = ensureResult(
      await handler(buildEvent("GET", "/activities", { query: { accountId: "demo", limit: "5", type: "email" } }))
    );
    expect(list.statusCode).toBe(200);
    const listed = JSON.parse(list.body || "{}");
    expect(listed.items.every((item: any) => item.type === "email")).toBe(true);

    const since = new Date(Date.now() - 1000).toISOString();
    const createdRes = ensureResult(
      await handler(
        buildEvent("POST", "/activities", {
          body: { accountId: "demo", contactId: "contact-1", type: "sms", subject: "Ping", body: "Hello" }
        })
      )
    );
    expect(createdRes.statusCode).toBe(200);
    const created = JSON.parse(createdRes.body || "{}");
    expect(created.id).toBeTruthy();

    const after = ensureResult(
      await handler(
        buildEvent("GET", "/activities", {
          query: { accountId: "demo", updatedSince: since }
        })
      )
    );
    expect(after.statusCode).toBe(200);
    const afterJson = JSON.parse(after.body || "{}");
    expect(afterJson.items.some((item: any) => item.id === created.id)).toBe(true);
  });

  it("creates bulk export job and returns presigned url", async () => {
    const jobRes = ensureResult(
      await handler(buildEvent("POST", "/bulk/exports/contacts", { body: { accountId: "demo", format: "ndjson" } }))
    );
    expect(jobRes.statusCode).toBe(202);
    const job = JSON.parse(jobRes.body || "{}");
    expect(job.jobId).toBeTruthy();
    const getRes = ensureResult(await handler(buildEvent("GET", `/bulk/exports/${job.jobId}`)));
    expect(getRes.statusCode).toBe(200);
    const jobDetails = JSON.parse(getRes.body || "{}");
    expect(jobDetails.status).toBe("COMPLETE");
    expect(jobDetails.downloadUrl).toBeTruthy();
  });
});
