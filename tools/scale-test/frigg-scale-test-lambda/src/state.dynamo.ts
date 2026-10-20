import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { CreateExportJobInput, ExportJob, HybridConfig, ListMutationsParams, ListMutationsResult, MutationRecord, StateAdapter, EntityKind, mergeConfig } from "./state";

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var required for Dynamo state adapter`);
  return value;
}

function buildClient() {
  const baseClient = new DynamoDBClient({ region: REGION });
  return DynamoDBDocumentClient.from(baseClient, {
    marshallOptions: { removeUndefinedValues: true }
  });
}

const client = buildClient();

export class DynamoState implements StateAdapter {
  private readonly configTable = requireEnv("CONFIG_TABLE");
  private readonly changelogTable = requireEnv("CHANGELOG_TABLE");
  private readonly jobsTable = requireEnv("JOBS_TABLE");

  async getConfig(accountId: string): Promise<HybridConfig> {
    const res = await client.send(new GetCommand({
      TableName: this.configTable,
      Key: { accountId }
    }));
    if (!res.Item) {
      const base = mergeConfig();
      return { ...base, version: 1 };
    }
    const { config, version } = res.Item as any;
    return { ...mergeConfig(config), version: version ?? 1 };
  }

  async putConfig(accountId: string, config: HybridConfig): Promise<HybridConfig> {
    const current = await this.getConfig(accountId);
    const version = (current.version ?? 0) + 1;
    const merged = mergeConfig(config);
    await client.send(new PutCommand({
      TableName: this.configTable,
      Item: { accountId, config: merged, version }
    }));
    return { ...merged, version };
  }

  async recordMutation(mutation: Omit<MutationRecord, "id">): Promise<MutationRecord> {
    const record: MutationRecord = { ...mutation, id: randomUUID() };
    const sk = `${record.at}#${record.id}`;
    await client.send(new PutCommand({
      TableName: this.changelogTable,
      Item: { ...record, sk }
    }));
    return record;
  }

  async listMutations(params: ListMutationsParams): Promise<ListMutationsResult> {
    const limit = Math.min(params.limit ?? 100, 1000);
    const expressionNames: Record<string, string> = { "#pk": "accountId" };
    const expressionValues: Record<string, any> = { ":pk": params.accountId };
    let keyCondition = "#pk = :pk";
    if (params.since) {
      expressionNames["#sk"] = "sk";
      expressionValues[":since"] = params.since;
      keyCondition += " AND #sk > :since";
    }
    let exclusiveStartKey: Record<string, any> | undefined;
    if (params.cursor) {
      exclusiveStartKey = JSON.parse(Buffer.from(params.cursor, "base64url").toString("utf8"));
    }
    const res = await client.send(new QueryCommand({
      TableName: this.changelogTable,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      ExclusiveStartKey: exclusiveStartKey,
      Limit: limit
    }));
    const items: MutationRecord[] = (res.Items || []).map((item) => ({
      id: item.id,
      accountId: item.accountId,
      entity: item.entity,
      op: item.op,
      refId: item.refId,
      at: item.at,
      payload: item.payload
    }));
    const nextCursor = res.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(res.LastEvaluatedKey)).toString("base64url")
      : null;
    return { items, nextCursor };
  }

  async getLatestMutations(accountId: string, entity: EntityKind): Promise<MutationRecord[]> {
    const res = await client.send(new QueryCommand({
      TableName: this.changelogTable,
      KeyConditionExpression: "#pk = :pk",
      ExpressionAttributeNames: { "#pk": "accountId" },
      ExpressionAttributeValues: { ":pk": accountId }
    }));
    const latest = new Map<string, MutationRecord>();
    for (const item of res.Items || []) {
      if (item.entity !== entity) continue;
      const record: MutationRecord = {
        id: item.id,
        accountId: item.accountId,
        entity: item.entity,
        op: item.op,
        refId: item.refId,
        at: item.at,
        payload: item.payload
      };
      latest.set(record.refId, record);
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
    await client.send(new PutCommand({
      TableName: this.jobsTable,
      Item: job
    }));
    return job;
  }

  async updateExportJob(jobId: string, patch: Partial<ExportJob>): Promise<ExportJob | null> {
    const now = new Date().toISOString();
    const updateExpressions: string[] = [];
    const attributeNames: Record<string, string> = {};
    const attributeValues: Record<string, any> = { ":updatedAt": now };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      attributeNames[`#${key}`] = key;
      attributeValues[":" + key] = value;
      updateExpressions.push(`#${key} = :${key}`);
    }
    updateExpressions.push(`#updatedAt = :updatedAt`);
    const expression = `SET ${updateExpressions.join(", ")}`;
    const res = await client.send(new UpdateCommand({
      TableName: this.jobsTable,
      Key: { jobId },
      UpdateExpression: expression,
      ExpressionAttributeNames: attributeNames,
      ExpressionAttributeValues: attributeValues,
      ReturnValues: "ALL_NEW"
    }));
    return (res.Attributes as ExportJob) ?? null;
  }

  async getExportJob(jobId: string): Promise<ExportJob | null> {
    const res = await client.send(new GetCommand({
      TableName: this.jobsTable,
      Key: { jobId }
    }));
    return (res.Item as ExportJob) ?? null;
  }
}

export function createDynamoState(): StateAdapter {
  return new DynamoState();
}
