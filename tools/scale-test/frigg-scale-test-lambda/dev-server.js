const { createServer } = require("http");
const { handler } = require("./dist/handler");

const PORT = 4000;

function buildEvent(req, body) {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers[key] = value;
    if (Array.isArray(value)) headers[key] = value.join(",");
  }
  const query = {};
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
      requestId: `req-${Date.now()}`,
      routeKey: "$default",
      stage: "$default",
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
      http: {
        method: req.method || "GET",
        path: url.pathname,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: req.headers["user-agent"] || "dev-server",
      },
    },
    isBase64Encoded: false,
    body: body || undefined,
    pathParameters: null,
    stageVariables: null,
    cookies: [],
  };
}

function ensureStructured(result) {
  if (typeof result === "string") {
    return { statusCode: 200, headers: {}, body: result };
  }
  return result;
}

const server = createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", async () => {
    const body = Buffer.concat(chunks).toString();
    try {
      const event = buildEvent(req, body);
      const result = ensureStructured(await handler(event));
      res.statusCode = result.statusCode || 200;
      for (const [key, value] of Object.entries(result.headers || {})) {
        if (value !== undefined) {
          res.setHeader(key, value);
        }
      }
      res.end(result.body || "");
    } catch (err) {
      console.error("Handler error:", err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err?.message || "error" }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Scale Test API server running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});
