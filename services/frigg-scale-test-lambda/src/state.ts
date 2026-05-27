import { NativeAttributeValue } from "@aws-sdk/lib-dynamodb";

export type EntityKind = "contact" | "activity";
export type MutationOp = "create" | "update" | "delete";

export interface HybridConfig {
  pageSizeDefault: number;
  pageSizeMax: number;
  rpsLimit: number;
  latencyMs: number;
  jitterMs: number;
  errorRatePct: number;
  throttleRatePct: number;
  supportsDelta: boolean;
  bulkMaxCount: number;
  features: string[];
  version?: number;
}

export const DEFAULT_CONFIG: HybridConfig = {
  pageSizeDefault: 100,
  pageSizeMax: 1000,
  rpsLimit: 10,
  latencyMs: 0,
  jitterMs: 0,
  errorRatePct: 0,
  throttleRatePct: 0,
  supportsDelta: true,
  bulkMaxCount: 1_000_000,
  features: []
};

export interface MutationRecord {
  id: string;
  accountId: string;
  entity: EntityKind;
  op: MutationOp;
  refId: string;
  at: string;
  payload?: Record<string, NativeAttributeValue>;
}

export interface MutationCursorPayload {
  index: number;
}

export interface ListMutationsParams {
  accountId: string;
  since?: string;
  cursor?: string;
  limit?: number;
}

export interface ListMutationsResult {
  items: MutationRecord[];
  nextCursor: string | null;
}

export interface ExportJob {
  jobId: string;
  accountId: string;
  entity: EntityKind | "contacts" | "activities";
  format: "ndjson" | "csv";
  status: "PENDING" | "RUNNING" | "COMPLETE" | "FAILED";
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
  downloadUrl?: string | null;
}

export interface CreateExportJobInput {
  accountId: string;
  entity: "contacts" | "activities";
  format: "ndjson" | "csv";
}

export interface StateAdapter {
  getConfig(accountId: string): Promise<HybridConfig>;
  putConfig(accountId: string, config: HybridConfig): Promise<HybridConfig>;
  recordMutation(mutation: Omit<MutationRecord, "id">): Promise<MutationRecord>;
  listMutations(params: ListMutationsParams): Promise<ListMutationsResult>;
  getLatestMutations(accountId: string, entity: EntityKind): Promise<MutationRecord[]>;
  createExportJob(input: CreateExportJobInput): Promise<ExportJob>;
  updateExportJob(jobId: string, patch: Partial<ExportJob>): Promise<ExportJob | null>;
  getExportJob(jobId: string): Promise<ExportJob | null>;
}

export function mergeConfig(partial?: Partial<HybridConfig>): HybridConfig {
  return { ...DEFAULT_CONFIG, ...(partial || {}) };
}
