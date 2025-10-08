"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FriggScaleTestAPI = void 0;
class FriggScaleTestAPI {
    constructor(opts = {}) {
        this.opts = opts;
    }
    get base() {
        return (this.opts.baseUrl ||
            process.env.FRIGG_SCALE_TEST_BASE_URL ||
            "http://localhost:4000");
    }
    headers() {
        const apiKey = this.opts.apiKey || process.env.FRIGG_SCALE_TEST_API_KEY;
        return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
    }
    async health() {
        const r = await fetch(new URL("/health", this.base));
        if (!r.ok)
            throw new Error(`health ${r.status}`);
        return r.json();
    }
    async getConfig(accountId) {
        const r = await fetch(new URL(`/config/${encodeURIComponent(accountId)}`, this.base), {
            headers: this.headers()
        });
        if (!r.ok)
            throw new Error(`getConfig ${r.status}`);
        return r.json();
    }
    async putConfig(accountId, cfg) {
        const headers = {
            "content-type": "application/json",
            ...this.headers()
        };
        const r = await fetch(new URL(`/config/${encodeURIComponent(accountId)}`, this.base), {
            method: "PUT",
            headers,
            body: JSON.stringify(cfg)
        });
        if (!r.ok)
            throw new Error(`putConfig ${r.status}`);
        return r.json();
    }
    async listContacts(params) {
        const url = new URL(`/contacts`, this.base);
        url.searchParams.set("accountId", params.accountId);
        if (params.limit)
            url.searchParams.set("limit", String(params.limit));
        if (params.cursor)
            url.searchParams.set("cursor", params.cursor);
        if (params.updatedSince)
            url.searchParams.set("updatedSince", params.updatedSince);
        const r = await fetch(url, { headers: this.headers() });
        if (!r.ok)
            throw new Error(`listContacts ${r.status}`);
        return r.json();
    }
    async listActivities(params) {
        const url = new URL(`/activities`, this.base);
        url.searchParams.set("accountId", params.accountId);
        if (params.limit)
            url.searchParams.set("limit", String(params.limit));
        if (params.cursor)
            url.searchParams.set("cursor", params.cursor);
        if (params.updatedSince)
            url.searchParams.set("updatedSince", params.updatedSince);
        if (params.type)
            url.searchParams.set("type", params.type);
        if (params.contactId)
            url.searchParams.set("contactId", params.contactId);
        const r = await fetch(url, { headers: this.headers() });
        if (!r.ok)
            throw new Error(`listActivities ${r.status}`);
        return r.json();
    }
    async createActivity(body) {
        const headers = {
            "content-type": "application/json",
            ...this.headers()
        };
        const r = await fetch(new URL(`/activities`, this.base), {
            method: "POST",
            headers,
            body: JSON.stringify(body)
        });
        if (!r.ok)
            throw new Error(`createActivity ${r.status}`);
        return r.json();
    }
    async requestContactsExport(body) {
        const headers = {
            "content-type": "application/json",
            ...this.headers()
        };
        const r = await fetch(new URL(`/bulk/exports/contacts`, this.base), {
            method: "POST",
            headers,
            body: JSON.stringify(body)
        });
        if (r.status !== 202 && r.status !== 200)
            throw new Error(`requestContactsExport ${r.status}`);
        return r.json();
    }
    async requestActivitiesExport(body) {
        const headers = {
            "content-type": "application/json",
            ...this.headers()
        };
        const r = await fetch(new URL(`/bulk/exports/activities`, this.base), {
            method: "POST",
            headers,
            body: JSON.stringify(body)
        });
        if (r.status !== 202 && r.status !== 200)
            throw new Error(`requestActivitiesExport ${r.status}`);
        return r.json();
    }
    async getExportJob(jobId) {
        const r = await fetch(new URL(`/bulk/exports/${encodeURIComponent(jobId)}`, this.base), {
            headers: this.headers()
        });
        if (!r.ok)
            throw new Error(`getExportJob ${r.status}`);
        return r.json();
    }
}
exports.FriggScaleTestAPI = FriggScaleTestAPI;
