import { randomUUID } from "crypto";
import { HybridConfig, mergeConfig, MutationRecord, StateAdapter, EntityKind, ListMutationsParams, ListMutationsResult, ExportJob, CreateExportJobInput } from "./state";

interface StoredConfig {
  config: HybridConfig;
  version: number;
}

const configs = new Map<string, StoredConfig>();
const mutations = new Map<string, MutationRecord[]>();
const jobs = new Map<string, ExportJob>();

function getMutationBucket(accountId: string): MutationRecord[] {
  let bucket = mutations.get(accountId);
  if (!bucket) {
    bucket = [];
    mutations.set(accountId, bucket);
  }
  return bucket;
}

export class InMemoryState implements StateAdapter {
  async getConfig(accountId: string): Promise<HybridConfig> {
    const stored = configs.get(accountId);
    if (!stored) {
      const base = mergeConfig();
      configs.set(accountId, { config: base, version: 1 });
      return { ...base, version: 1 };
    }
    return { ...stored.config, version: stored.version };
  }

  async putConfig(accountId: string, config: HybridConfig): Promise<HybridConfig> {
    const current = configs.get(accountId);
    const version = (current?.version || 0) + 1;
    const merged = mergeConfig(config);
    configs.set(accountId, { config: merged, version });
    return { ...merged, version };
  }

  async recordMutation(mutation: Omit<MutationRecord, "id">): Promise<MutationRecord> {
    const bucket = getMutationBucket(mutation.accountId);
    const record: MutationRecord = { ...mutation, id: randomUUID() };
    bucket.push(record);
    bucket.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return record;
  }

  async listMutations(params: ListMutationsParams): Promise<ListMutationsResult> {
    const bucket = getMutationBucket(params.accountId);
    const limit = Math.min(params.limit ?? 100, 1000);
    const sinceTs = params.since ? Date.parse(params.since) : undefined;
    let startIndex = 0;
    if (params.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(params.cursor, "base64url").toString("utf8"));
        if (typeof decoded.index === "number") {
          startIndex = decoded.index;
        }
      } catch {
        startIndex = 0;
      }
    }
    const filtered = sinceTs
      ? bucket.filter((m) => Date.parse(m.at) > sinceTs)
      : bucket;
    const slice = filtered.slice(startIndex, startIndex + limit);
    const nextIndex = startIndex + slice.length;
    const nextCursor = nextIndex < filtered.length ? Buffer.from(JSON.stringify({ index: nextIndex })).toString("base64url") : null;
    return { items: slice, nextCursor };
  }

  async getLatestMutations(accountId: string, entity: EntityKind): Promise<MutationRecord[]> {
    const bucket = getMutationBucket(accountId);
    const latest = new Map<string, MutationRecord>();
    for (const mutation of bucket) {
      if (mutation.entity !== entity) continue;
      latest.set(mutation.refId, mutation);
    }
    return Array.from(latest.values());
  }

  async createExportJob(input: CreateExportJobInput): Promise<ExportJob> {
    const now = new Date().toISOString();
    const job: ExportJob = {
      jobId: randomUUID(),
      accountId: input.accountId,
      entity: input.entity,
      format: input.format,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
      itemCount: 0,
      downloadUrl: null
    };
    jobs.set(job.jobId, job);
    return job;
  }

  async updateExportJob(jobId: string, patch: Partial<ExportJob>): Promise<ExportJob | null> {
    const job = jobs.get(jobId);
    if (!job) return null;
    const updated = { ...job, ...patch, updatedAt: patch.updatedAt || new Date().toISOString() };
    jobs.set(jobId, updated);
    return updated;
  }

  async getExportJob(jobId: string): Promise<ExportJob | null> {
    return jobs.get(jobId) ?? null;
  }
}

export const inMemoryState = new InMemoryState();
