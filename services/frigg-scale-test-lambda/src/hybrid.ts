import { createHash, createHmac, randomUUID } from "crypto";
import { StateAdapter, HybridConfig, DEFAULT_CONFIG, mergeConfig, MutationRecord } from "./state";

const CONTACT_SEED_COUNT = Number(process.env.CONTACTS_SEED_COUNT || 10000);
const ACTIVITIES_PER_CONTACT = 4;
const CURSOR_SECRET = process.env.CURSOR_SECRET || "frigg-scale-test-secret";
const CURSOR_TTL_MS = 24 * 60 * 60 * 1000;
const CONTACT_BASE_TIME = Date.parse("2024-01-01T00:00:00Z");
const ACTIVITY_BASE_TIME = Date.parse("2024-01-15T00:00:00Z");

export interface CursorPayload {
  offset: number;
  limit: number;
  cfgVersion: number;
  exp: number;
  sig: string;
}

export interface ListResponse<T> {
  items: T[];
  nextCursor: string | null;
  config: HybridConfig;
}

export interface ListContactsParams {
  accountId: string;
  limit?: number;
  cursor?: string;
  updatedSince?: string;
}

export interface ListActivitiesParams extends ListContactsParams {
  type?: "phone_call" | "email" | "sms";
  contactId?: string;
}

interface CursorData {
  offset: number;
  limit: number;
}

const FIRST_NAMES = ["Avery", "Jordan", "Taylor", "Dakota", "Harper", "Rowan", "Riley", "Peyton", "Morgan", "Shawn"];
const LAST_NAMES = ["Rivera", "Nguyen", "Patel", "Wong", "Johnson", "Fernandez", "Osei", "Kim", "Leclerc", "Okafor"];
const COMPANIES = ["Globex", "Initech", "Soylent", "Umbra", "Wayne Enterprises", "Stark Industries", "Wonka", "Nakatomi", "Tyrell", "Hooli"];
const ACTIVITY_TYPES: Array<"phone_call" | "email" | "sms"> = ["phone_call", "email", "sms", "email"];
const ACTIVITY_DIRECTIONS: Array<"inbound" | "outbound"> = ["outbound", "inbound"];
const ACTIVITY_STATUS: Array<"queued" | "sent" | "delivered" | "failed" | "completed"> = ["completed", "sent", "delivered", "queued", "failed"];

function hashToNumber(input: string): number {
  const hash = createHash("sha256").update(input).digest();
  return hash.readUInt32BE(0);
}

function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seededPick<T>(arr: T[], seed: string): T {
  const rng = mulberry32(hashToNumber(seed));
  const index = Math.floor(rng() * arr.length);
  return arr[index % arr.length];
}

function cursorSignature(data: { offset: number; limit: number; cfgVersion: number; exp: number }): string {
  const { offset, limit, cfgVersion, exp } = data;
  const hmac = createHmac("sha256", CURSOR_SECRET);
  hmac.update(`${offset}|${limit}|${cfgVersion}|${exp}`);
  return hmac.digest("base64url");
}

function encodeCursor(data: { offset: number; limit: number; cfgVersion: number }): string {
  const exp = Date.now() + CURSOR_TTL_MS;
  const payload = { ...data, exp };
  const sig = cursorSignature(payload);
  const value: CursorPayload = { ...payload, sig };
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeCursor(cursor: string, expectedVersion?: number): CursorData | null {
  try {
    const payload = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as CursorPayload;
    if (payload.exp && payload.exp < Date.now()) return null;
    if (expectedVersion && payload.cfgVersion !== expectedVersion) return null;
    const expectedSig = cursorSignature({ offset: payload.offset, limit: payload.limit, cfgVersion: payload.cfgVersion, exp: payload.exp });
    if (expectedSig !== payload.sig) return null;
    return { offset: payload.offset, limit: payload.limit };
  } catch {
    return null;
  }
}

export function generateContact(accountId: string, index: number) {
  const id = `contact-${index + 1}`;
  const firstName = seededPick(FIRST_NAMES, `${accountId}:fn:${index}`);
  const lastName = seededPick(LAST_NAMES, `${accountId}:ln:${index}`);
  const company = seededPick(COMPANIES, `${accountId}:co:${index}`);
  const rng = mulberry32(hashToNumber(`${accountId}:contact:${index}`));
  const phone = `+1${Math.floor(2000000000 + rng() * 799999999)}`;
  const updatedAt = new Date(CONTACT_BASE_TIME + (index % 365) * 86_400_000 + Math.floor(rng() * 86_400_000)).toISOString();
  return {
    id,
    email: `${firstName}.${lastName}.${index}@${accountId}.mockcrm.test`.toLowerCase(),
    phone,
    firstName,
    lastName,
    company,
    address: `${Math.floor(rng() * 900) + 100} Mockingbird Lane`,
    city: seededPick(["Metropolis", "Gotham", "Star City", "Central City", "Coast City"], `${accountId}:city:${index}`),
    region: seededPick(["CA", "NY", "WA", "TX", "ON"], `${accountId}:region:${index}`),
    country: "US",
    postalCode: `${Math.floor(rng() * 90000) + 10000}`,
    updatedAt,
    payload: {
      source: "synthetic",
      accountId
    }
  };
}

export function generateActivity(accountId: string, contactIndex: number, sequence: number) {
  const type = ACTIVITY_TYPES[sequence % ACTIVITY_TYPES.length];
  const direction = ACTIVITY_DIRECTIONS[(contactIndex + sequence) % ACTIVITY_DIRECTIONS.length];
  const id = `activity-${contactIndex + 1}-${sequence + 1}`;
  const rng = mulberry32(hashToNumber(`${accountId}:activity:${contactIndex}:${sequence}`));
  const subject = `${type.replace("_", " ")}: ${contactIndex + 1}-${sequence + 1}`;
  const updatedAt = new Date(
    ACTIVITY_BASE_TIME + (contactIndex % 180) * 43_200_000 + sequence * 9_000_000 + Math.floor(rng() * 3_600_000)
  ).toISOString();
  const contactId = `contact-${contactIndex + 1}`;
  return {
    id,
    type,
    contactId,
    direction,
    subject,
    body: `Automated ${type} for ${contactId}`,
    from: `${type}@${accountId}.mockcrm.test`,
    to: `${contactId}@mockcrm.test`,
    status: ACTIVITY_STATUS[(contactIndex + sequence) % ACTIVITY_STATUS.length],
    durationSec: type === "phone_call" ? Math.floor(rng() * 300) : undefined,
    sentAt: type === "phone_call" ? undefined : updatedAt,
    updatedAt,
    payload: {
      source: "synthetic",
      accountId
    }
  };
}

function computeLimit(requested: number | undefined, config: HybridConfig): number {
  const base = requested ?? config.pageSizeDefault ?? DEFAULT_CONFIG.pageSizeDefault;
  return Math.max(1, Math.min(base, config.pageSizeMax ?? DEFAULT_CONFIG.pageSizeMax));
}

function overlayRecord<T extends { id: string; updatedAt: string }>(base: T | undefined, mutation: MutationRecord | undefined) {
  if (!mutation) {
    return base ? { record: base, deleted: false } : null;
  }
  const payload = (mutation.payload as any) || {};
  if (mutation.op === "delete") {
    return {
      record: {
        ...(base || { id: mutation.refId, updatedAt: mutation.at }),
        id: mutation.refId,
        updatedAt: mutation.at,
        deleted: true
      } as T & { deleted: boolean },
      deleted: true
    };
  }
  const record = {
    ...(base || { id: mutation.refId, updatedAt: mutation.at }),
    ...payload,
    id: payload.id || mutation.refId,
    updatedAt: payload.updatedAt || mutation.at
  } as T;
  return { record, deleted: false };
}

function parseUpdatedSince(value?: string) {
  if (!value) return undefined;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return undefined;
  return ts;
}

function parseContactIndex(contactId?: string): number | undefined {
  if (!contactId) return undefined;
  const match = /contact-(\d+)/.exec(contactId);
  if (!match) return undefined;
  const num = Number(match[1]);
  if (!Number.isFinite(num) || num < 1) return undefined;
  return num - 1;
}

export async function listContacts(state: StateAdapter, params: ListContactsParams): Promise<ListResponse<any>> {
  const rawConfig = await state.getConfig(params.accountId);
  const config = mergeConfig(rawConfig);
  const cursorData = params.cursor ? decodeCursor(params.cursor, rawConfig.version ?? 1) : null;
  const limit = computeLimit(cursorData?.limit ?? params.limit, config);
  let offset = cursorData?.offset ?? 0;
  const since = parseUpdatedSince(params.updatedSince);
  const mutations = await state.getLatestMutations(params.accountId, "contact");
  const mutationMap = new Map<string, MutationRecord>();
  const created: any[] = [];
  for (const mutation of mutations) {
    mutationMap.set(mutation.refId, mutation);
    if (mutation.op === "create") {
      const overlay = overlayRecord<any>(undefined, mutation);
      if (overlay && !overlay.deleted) {
        if (!since || Date.parse(overlay.record.updatedAt) > since) {
          created.push(overlay.record);
        }
      }
    }
  }
  created.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const items: any[] = [];
  let scanned = offset;
  while (items.length < limit && scanned < CONTACT_SEED_COUNT) {
    const base = generateContact(params.accountId, scanned);
    const overlay = overlayRecord(base, mutationMap.get(base.id));
    scanned += 1;
    if (!overlay || overlay.deleted) {
      continue;
    }
    if (since && Date.parse(overlay.record.updatedAt) <= since) {
      continue;
    }
    items.push(overlay.record);
  }
  for (const record of created) {
    if (items.length >= limit) break;
    items.push(record);
  }
  const nextCursor = scanned < CONTACT_SEED_COUNT ? encodeCursor({ offset: scanned, limit, cfgVersion: rawConfig.version ?? 1 }) : null;
  return { items, nextCursor, config };
}

export async function listActivities(state: StateAdapter, params: ListActivitiesParams): Promise<ListResponse<any>> {
  const rawConfig = await state.getConfig(params.accountId);
  const config = mergeConfig(rawConfig);
  const cursorData = params.cursor ? decodeCursor(params.cursor, rawConfig.version ?? 1) : null;
  const limit = computeLimit(cursorData?.limit ?? params.limit, config);
  let offset = cursorData?.offset ?? 0;
  const since = parseUpdatedSince(params.updatedSince);
  const contactIndexFilter = parseContactIndex(params.contactId);
  const typeFilter = params.type;
  const totalBase = contactIndexFilter !== undefined ? ACTIVITIES_PER_CONTACT : CONTACT_SEED_COUNT * ACTIVITIES_PER_CONTACT;
  const mutations = await state.getLatestMutations(params.accountId, "activity");
  const mutationMap = new Map<string, MutationRecord>();
  const created: any[] = [];
  for (const mutation of mutations) {
    mutationMap.set(mutation.refId, mutation);
    if (mutation.op === "create") {
      const overlay = overlayRecord<any>(undefined, mutation);
      if (overlay && !overlay.deleted) {
        if (contactIndexFilter !== undefined) {
          if (parseContactIndex(overlay.record.contactId) !== contactIndexFilter) continue;
        }
        if (typeFilter && overlay.record.type !== typeFilter) continue;
        if (!since || Date.parse(overlay.record.updatedAt) > since) {
          created.push(overlay.record);
        }
      }
    }
  }
  created.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const items: any[] = [];
  let scanned = offset;
  while (items.length < limit && scanned < totalBase) {
    let contactIndex: number;
    let sequence: number;
    if (contactIndexFilter !== undefined) {
      contactIndex = contactIndexFilter;
      sequence = scanned;
      if (sequence >= ACTIVITIES_PER_CONTACT) break;
    } else {
      contactIndex = Math.floor(scanned / ACTIVITIES_PER_CONTACT);
      sequence = scanned % ACTIVITIES_PER_CONTACT;
      if (contactIndex >= CONTACT_SEED_COUNT) break;
    }
    const base = generateActivity(params.accountId, contactIndex, sequence);
    scanned += 1;
    if (typeFilter && base.type !== typeFilter) {
      continue;
    }
    if (contactIndexFilter !== undefined && base.contactId !== params.contactId) {
      continue;
    }
    const overlay = overlayRecord(base, mutationMap.get(base.id));
    if (!overlay || overlay.deleted) {
      continue;
    }
    if (since && Date.parse(overlay.record.updatedAt) <= since) {
      continue;
    }
    items.push(overlay.record);
  }
  for (const record of created) {
    if (items.length >= limit) break;
    items.push(record);
  }
  const nextCursor = scanned < totalBase ? encodeCursor({ offset: scanned, limit, cfgVersion: rawConfig.version ?? 1 }) : null;
  return { items, nextCursor, config };
}

export function createActivityFromWrite(input: any) {
  const now = new Date().toISOString();
  return {
    id: input.id || `activity-${randomUUID()}`,
    accountId: input.accountId,
    contactId: input.contactId,
    type: input.type,
    direction: input.direction || "outbound",
    subject: input.subject,
    body: input.body || "",
    from: input.from || `${input.type}@${input.accountId}.mockcrm.test`,
    to: input.to || `${input.contactId}@mockcrm.test`,
    status: input.status || "sent",
    durationSec: input.durationSec,
    sentAt: input.sentAt,
    updatedAt: input.updatedAt || now,
    payload: input.payload || { source: "mutation" }
  };
}

export function buildRateLimitHeaders(config: HybridConfig) {
  return {
    "X-RateLimit-Limit": String(config.rpsLimit ?? DEFAULT_CONFIG.rpsLimit),
    "X-RateLimit-Remaining": String(Math.max(0, (config.rpsLimit ?? DEFAULT_CONFIG.rpsLimit) - 1))
  };
}
