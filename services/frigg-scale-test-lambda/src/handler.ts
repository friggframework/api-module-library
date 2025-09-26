import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { listContacts, listActivities, createActivityFromWrite, buildRateLimitHeaders, generateContact, generateActivity } from "./hybrid";
import { createDynamoState } from "./state.dynamo";
import { inMemoryState } from "./state.memory";
import { StateAdapter, mergeConfig, HybridConfig } from "./state";
import { getS3Adapter } from "./s3";

let cachedState: StateAdapter | null = null;

function getState(): StateAdapter {
  if (cachedState) return cachedState;
  if (process.env.CHANGELOG_TABLE && process.env.CONFIG_TABLE && process.env.JOBS_TABLE) {
    cachedState = createDynamoState();
  } else {
    cachedState = inMemoryState;
  }
  return cachedState;
}

const baseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*"
};

function response(statusCode: number, body?: any, headers?: Record<string, string>): APIGatewayProxyResultV2 {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...baseHeaders,
      ...(headers || {})
    },
    body: payload
  };
}

function parseJson(body?: string | null) {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function evaluateKnobs(config: HybridConfig) {
  const latency = Math.max(0, config.latencyMs ?? 0);
  const jitter = Math.max(0, config.jitterMs ?? 0);
  const delay = latency + Math.floor(Math.random() * (jitter + 1));
  const throttle = Math.random() * 100 < (config.throttleRatePct ?? 0);
  const error = Math.random() * 100 < (config.errorRatePct ?? 0);
  return { delay, throttle, error };
}

async function applyLatency(delay: number) {
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function finalizeExport(jobId: string, entity: "contacts" | "activities", format: "ndjson" | "csv", accountId: string) {
  const state = getState();
  const adapter = getS3Adapter();
  const bucket = process.env.EXPORT_BUCKET || "frigg-scale-test-exports";
  const key = `exports/${jobId}.${format === "csv" ? "csv" : "ndjson"}`;
  const sampleCount = Math.min(25, entity === "contacts" ? 50 : 75);
  let lines: string[] = [];
  if (entity === "contacts") {
    for (let i = 0; i < Math.min(sampleCount, 50); i += 1) {
      lines.push(JSON.stringify(generateContact(accountId, i)));
    }
  } else {
    const perContact = 3;
    let generated = 0;
    for (let c = 0; generated < sampleCount && c < 25; c += 1) {
      for (let s = 0; s < perContact && generated < sampleCount; s += 1) {
        const activity = generateActivity(accountId, c, s);
        lines.push(JSON.stringify(activity));
        generated += 1;
      }
    }
  }
  let body: string;
  if (format === "csv") {
    const records = lines.map((line) => JSON.parse(line));
    const keys = entity === "contacts"
      ? ["id", "email", "firstName", "lastName", "company", "updatedAt"]
      : ["id", "type", "contactId", "subject", "status", "updatedAt"];
    const header = keys.join(",");
    const rows = records.map((record: any) => keys.map((k) => JSON.stringify(record[k] ?? "")).join(","));
    body = [header, ...rows].join("\n");
  } else {
    body = lines.join("\n");
  }
  await adapter.putObject(bucket, key, body, format === "csv" ? "text/csv" : "application/x-ndjson");
  const url = await adapter.getPresignedUrl(bucket, key);
  await state.updateExportJob(jobId, { status: "COMPLETE", downloadUrl: url, itemCount: lines.length });
}

async function handleListContacts(state: StateAdapter, event: APIGatewayProxyEventV2) {
  const query = event.queryStringParameters || {};
  const limit = query.limit ? Number(query.limit) : undefined;
  const accountId = query.accountId;
  if (!accountId) {
    return response(400, { error: "missing_account", message: "accountId is required" });
  }
  const result = await listContacts(state, {
    accountId,
    limit,
    cursor: query.cursor || undefined,
    updatedSince: query.updatedSince || undefined
  });
  const knobs = evaluateKnobs(result.config);
  await applyLatency(knobs.delay);
  if (knobs.error) {
    return response(500, { error: "server_error", message: "Injected error" });
  }
  if (knobs.throttle) {
    return response(429, { error: "throttled", message: "Rate limited" }, {
      ...buildRateLimitHeaders(result.config),
      "Retry-After": "1"
    });
  }
  return response(200, { items: result.items, nextCursor: result.nextCursor }, buildRateLimitHeaders(result.config));
}

async function handleListActivities(state: StateAdapter, event: APIGatewayProxyEventV2) {
  const query = event.queryStringParameters || {};
  const limit = query.limit ? Number(query.limit) : undefined;
  const accountId = query.accountId;
  if (!accountId) {
    return response(400, { error: "missing_account", message: "accountId is required" });
  }
  const result = await listActivities(state, {
    accountId,
    limit,
    cursor: query.cursor || undefined,
    updatedSince: query.updatedSince || undefined,
    type: (query.type as any) || undefined,
    contactId: query.contactId || undefined
  });
  const knobs = evaluateKnobs(result.config);
  await applyLatency(knobs.delay);
  if (knobs.error) {
    return response(500, { error: "server_error", message: "Injected error" });
  }
  if (knobs.throttle) {
    return response(429, { error: "throttled", message: "Rate limited" }, {
      ...buildRateLimitHeaders(result.config),
      "Retry-After": "1"
    });
  }
  return response(200, { items: result.items, nextCursor: result.nextCursor }, buildRateLimitHeaders(result.config));
}

async function handleCreateActivity(state: StateAdapter, event: APIGatewayProxyEventV2) {
  const body = parseJson(event.body);
  if (!body.accountId || !body.contactId || !body.type || !body.subject) {
    return response(400, { error: "invalid_request", message: "accountId, contactId, type and subject are required" });
  }
  const record = createActivityFromWrite(body);
  await state.recordMutation({
    accountId: body.accountId,
    entity: "activity",
    op: "create",
    refId: record.id,
    at: record.updatedAt,
    payload: record
  });
  return response(200, record);
}

async function handleConfig(state: StateAdapter, event: APIGatewayProxyEventV2, method: string) {
  const match = /^\/config\/(.+)$/.exec(event.rawPath || "");
  if (!match) return response(404, { error: "not_found", message: "Unknown config path" });
  const accountId = decodeURIComponent(match[1]);
  if (method === "GET") {
    const config = await state.getConfig(accountId);
    return response(200, config);
  }
  const body = parseJson(event.body);
  const merged = mergeConfig(body);
  const saved = await state.putConfig(accountId, merged);
  return response(200, saved);
}

async function handleBulk(state: StateAdapter, event: APIGatewayProxyEventV2, entity: "contacts" | "activities") {
  const body = parseJson(event.body);
  if (!body.accountId) {
    return response(400, { error: "invalid_request", message: "accountId is required" });
  }
  const format: "ndjson" | "csv" = body.format === "csv" ? "csv" : "ndjson";
  const job = await state.createExportJob({ accountId: body.accountId, entity, format });
  await state.updateExportJob(job.jobId, { status: "RUNNING" });
  await finalizeExport(job.jobId, entity, format, body.accountId);
  return response(202, { jobId: job.jobId, status: "PENDING", format });
}

async function handleGetJob(state: StateAdapter, event: APIGatewayProxyEventV2) {
  const match = /^\/bulk\/exports\/([^/]+)$/.exec(event.rawPath || "");
  if (!match) return response(404, { error: "not_found", message: "Unknown job" });
  const job = await state.getExportJob(decodeURIComponent(match[1]));
  if (!job) return response(404, { error: "not_found", message: "Job not found" });
  return response(200, job);
}

async function handleMutations(state: StateAdapter, event: APIGatewayProxyEventV2) {
  const query = event.queryStringParameters || {};
  const accountId = query.accountId;
  if (!accountId) return response(400, { error: "invalid_request", message: "accountId is required" });
  const result = await state.listMutations({
    accountId,
    since: query.since || undefined,
    cursor: query.cursor || undefined,
    limit: query.limit ? Number(query.limit) : undefined
  });
  return response(200, result);
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return response(200, { ok: true });
  }
  const state = getState();
  const method = event.requestContext?.http?.method || "GET";
  const path = event.rawPath || "/";
  try {
    if (method === "GET" && path === "/health") {
      return response(200, { ok: true });
    }
    if ((method === "GET" || method === "PUT") && path.startsWith("/config/")) {
      return handleConfig(state, event, method);
    }
    if (method === "GET" && path === "/contacts") {
      return handleListContacts(state, event);
    }
    if (method === "GET" && path === "/activities") {
      return handleListActivities(state, event);
    }
    if (method === "POST" && path === "/activities") {
      return handleCreateActivity(state, event);
    }
    if (method === "POST" && path === "/bulk/exports/contacts") {
      return handleBulk(state, event, "contacts");
    }
    if (method === "POST" && path === "/bulk/exports/activities") {
      return handleBulk(state, event, "activities");
    }
    if (method === "GET" && path.startsWith("/bulk/exports/")) {
      return handleGetJob(state, event);
    }
    if (method === "GET" && path === "/state/mutations") {
      return handleMutations(state, event);
    }
    return response(404, { error: "not_found", message: "Route not found" });
  } catch (err: any) {
    console.error("Handler error", err);
    return response(500, { error: "internal_error", message: err?.message || "Unexpected error" });
  }
}
