import { createServer, IncomingMessage, ServerResponse } from "http";
import { AddressInfo } from "net";
import { handler } from "services/frigg-scale-test-lambda/src/handler";
import FriggScaleTestAPI from "../src/api";
import { APIGatewayProxyEventV2 } from "aws-lambda";

let server: ReturnType<typeof createServer>;
let baseUrl: string;

function buildEvent(
  req: IncomingMessage,
  body: string
): APIGatewayProxyEventV2 {
  const url = new URL(req.url || "/", "http://localhost");
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers[key] = value;
    if (Array.isArray(value)) headers[key] = value.join(",");
  }
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  return {
    version: "2.0",
    routeKey: "$default",
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    headers,
    queryStringParameters: Object.keys(query).length ? query : null,
    requestContext: {
      accountId: "local",
      apiId: "local",
      domainName: "localhost",
      domainPrefix: "",
      requestId: "local",
      routeKey: "$default",
      stage: "$default",
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
      http: {
        method: req.method || "GET",
        path: url.pathname,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "jest",
      },
    },
    isBase64Encoded: false,
    body: body || undefined,
    pathParameters: null,
    stageVariables: null,
    cookies: [],
    multiValueQueryStringParameters: null,
  } as unknown as APIGatewayProxyEventV2;
}

function ensureStructured(result: Awaited<ReturnType<typeof handler>>) {
  if (typeof result === "string") {
    return { statusCode: 200, headers: {}, body: result } as const;
  }
  return result;
}

beforeAll(async () => {
  server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", async () => {
      const body = Buffer.concat(chunks).toString();
      try {
        const event = buildEvent(req, body);
        const result = ensureStructured(await handler(event));
        res.statusCode = result.statusCode || 200;
        for (const [key, value] of Object.entries(result.headers || {})) {
          if (value !== undefined) {
            res.setHeader(key, value as string);
          }
        }
        res.end(result.body || "");
      } catch (err: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err?.message || "error" }));
      }
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
  process.env.FRIGG_SCALE_TEST_BASE_URL = baseUrl;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const api = new FriggScaleTestAPI();

describe("Frigg Scale Test Mock CRM", () => {
  it("health", async () => {
    const health = await api.health();
    expect(health.ok).toBeTruthy();
  });

  it("contacts pagination", async () => {
    const page = await api.listContacts({ accountId: "demo", limit: 10 });
    expect(Array.isArray(page.items)).toBe(true);
    expect(page.items.length).toBeLessThanOrEqual(10);
  });

  it("activities list and create", async () => {
    const list = await api.listActivities({
      accountId: "demo",
      limit: 5,
      type: "email",
    });
    expect(Array.isArray(list.items)).toBe(true);
    const created = await api.createActivity({
      accountId: "demo",
      type: "sms",
      contactId: "contact-1",
      subject: "Ping",
    });
    expect(created.id).toBeTruthy();
  });
});
