export type ListParams = {
  accountId: string;
  limit?: number;
  cursor?: string;
  updatedSince?: string;
};

export type ListActivitiesParams = ListParams & {
  type?: "phone_call" | "email" | "sms";
  contactId?: string;
};

export class FriggScaleTestAPI {
  constructor(readonly opts: { baseUrl?: string; apiKey?: string } = {}) {}

  private get base(): string {
    return (
      this.opts.baseUrl ||
      process.env.FRIGG_SCALE_TEST_BASE_URL ||
      "http://localhost:4000"
    );
  }

  private headers(): Record<string, string> {
    const apiKey = this.opts.apiKey || process.env.FRIGG_SCALE_TEST_API_KEY;
    return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
  }

  async health() {
    const r = await fetch(new URL("/health", this.base));
    if (!r.ok) throw new Error(`health ${r.status}`);
    return r.json();
  }

  async getConfig(accountId: string) {
    const r = await fetch(new URL(`/config/${encodeURIComponent(accountId)}`, this.base), {
      headers: this.headers()
    });
    if (!r.ok) throw new Error(`getConfig ${r.status}`);
    return r.json();
  }

  async putConfig(accountId: string, cfg: any) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...this.headers()
    };
    const r = await fetch(new URL(`/config/${encodeURIComponent(accountId)}`, this.base), {
      method: "PUT",
      headers,
      body: JSON.stringify(cfg)
    });
    if (!r.ok) throw new Error(`putConfig ${r.status}`);
    return r.json();
  }

  async listContacts(params: ListParams) {
    const url = new URL(`/contacts`, this.base);
    url.searchParams.set("accountId", params.accountId);
    if (params.limit) url.searchParams.set("limit", String(params.limit));
    if (params.cursor) url.searchParams.set("cursor", params.cursor);
    if (params.updatedSince) url.searchParams.set("updatedSince", params.updatedSince);
    const r = await fetch(url, { headers: this.headers() });
    if (!r.ok) throw new Error(`listContacts ${r.status}`);
    return r.json();
  }

  async listActivities(params: ListActivitiesParams) {
    const url = new URL(`/activities`, this.base);
    url.searchParams.set("accountId", params.accountId);
    if (params.limit) url.searchParams.set("limit", String(params.limit));
    if (params.cursor) url.searchParams.set("cursor", params.cursor);
    if (params.updatedSince) url.searchParams.set("updatedSince", params.updatedSince);
    if (params.type) url.searchParams.set("type", params.type);
    if (params.contactId) url.searchParams.set("contactId", params.contactId);
    const r = await fetch(url, { headers: this.headers() });
    if (!r.ok) throw new Error(`listActivities ${r.status}`);
    return r.json();
  }

  async createActivity(body: any) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...this.headers()
    };
    const r = await fetch(new URL(`/activities`, this.base), {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(`createActivity ${r.status}`);
    return r.json();
  }

  async requestContactsExport(body: {
    accountId: string;
    format?: "ndjson" | "csv";
    fields?: string[];
  }) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...this.headers()
    };
    const r = await fetch(new URL(`/bulk/exports/contacts`, this.base), {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    if (r.status !== 202 && r.status !== 200) throw new Error(`requestContactsExport ${r.status}`);
    return r.json();
  }

  async requestActivitiesExport(body: {
    accountId: string;
    format?: "ndjson" | "csv";
    fields?: string[];
  }) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...this.headers()
    };
    const r = await fetch(new URL(`/bulk/exports/activities`, this.base), {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    if (r.status !== 202 && r.status !== 200) throw new Error(`requestActivitiesExport ${r.status}`);
    return r.json();
  }

  async getExportJob(jobId: string) {
    const r = await fetch(new URL(`/bulk/exports/${encodeURIComponent(jobId)}`, this.base), {
      headers: this.headers()
    });
    if (!r.ok) throw new Error(`getExportJob ${r.status}`);
    return r.json();
  }
}
