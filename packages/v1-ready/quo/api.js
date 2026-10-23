const { get, ApiKeyRequester } = require('@friggframework/core');

/**
 * Quo (formerly OpenPhone) API client.
 *
 * Auth: API key sent RAW in the `Authorization` header (no `Bearer` prefix).
 *   Authorization: <api-key>
 *
 * Base URL: https://api.openphone.com/v1
 * Docs: https://www.quo.com/docs/api-reference/authentication
 */
const crypto = require('crypto');

// ---- webhook signature helpers (used by verifyWebhookSignature) ------------
function whHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return undefined;
    const want = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === want) {
            const v = headers[key];
            return Array.isArray(v) ? v[0] : v;
        }
    }
    return undefined;
}

/** The bytes the vendor signed: rawBody when given, else the body (JSON-stringified if parsed). */
function whPayload(rawBody, body) {
    if (rawBody !== undefined && rawBody !== null) {
        return Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
    }
    if (body === undefined || body === null) return Buffer.alloc(0);
    if (Buffer.isBuffer(body)) return body;
    if (typeof body === 'string') return Buffer.from(body, 'utf8');
    return Buffer.from(JSON.stringify(body), 'utf8');
}

/** Constant-time string comparison; false (not a throw) when the lengths differ. */
function whSafeEqual(a, b) {
    const x = Buffer.from(String(a), 'utf8');
    const y = Buffer.from(String(b), 'utf8');
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function whNowMs(now) {
    if (now instanceof Date) return now.getTime();
    return typeof now === 'number' ? now : Date.now();
}

function whHmac(key, parts, encoding) {
    const h = crypto.createHmac('sha256', key);
    for (const p of parts) h.update(p);
    return h.digest(encoding);
}

class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);
        this.webhookSecret = (params && params.webhookSecret) || null;

        // Quo/OpenPhone uses the Authorization header with the raw key.
        this.api_key_name = 'Authorization';

        // Accept either `api_key` or `access_token` (Frigg credential persistence
        // uses access_token for API-key modules by convention).
        const apiKey =
            get(params, 'api_key', null) ||
            get(params, 'access_token', null) ||
            process.env.QUO_API_KEY ||
            null;
        if (apiKey) {
            this.setApiKey(apiKey);
        }

        this.baseUrl = get(params, 'baseUrl', null) ||
            process.env.QUO_BASE_URL ||
            'https://api.openphone.com/v1';

        this.URLs = {
            // Calls
            calls: '/calls',
            callById: (id) => `/calls/${id}`,
            callRecordings: (callId) => `/call-recordings/${callId}`,
            callTranscript: (callId) => `/call-transcripts/${callId}`,
            callSummary: (callId) => `/call-summaries/${callId}`,
            // Messages
            messages: '/messages',
            messageById: (id) => `/messages/${id}`,
            // Contacts
            contacts: '/contacts',
            contactById: (id) => `/contacts/${id}`,
            // Phone numbers
            phoneNumbers: '/phone-numbers',
            phoneNumberById: (id) => `/phone-numbers/${id}`,
            // Users
            users: '/users',
            userById: (id) => `/users/${id}`,
            // Webhooks
            webhooks: '/webhooks',
            webhookById: (id) => `/webhooks/${id}`,
            webhookCalls: '/webhooks/calls',
            webhookMessages: '/webhooks/messages',
            webhookCallSummaries: '/webhooks/call-summaries',
            webhookCallTranscripts: '/webhooks/call-transcripts',
        };
    }

    // ---- Phone numbers / users (used for auth test + resolving IDs) ----

    async listPhoneNumbers(query = {}) {
        return this._get({ url: this.baseUrl + this.URLs.phoneNumbers, query });
    }

    async getPhoneNumber(id) {
        return this._get({ url: this.baseUrl + this.URLs.phoneNumberById(id) });
    }

    async listUsers(query = {}) {
        return this._get({ url: this.baseUrl + this.URLs.users, query });
    }

    async getUser(id) {
        return this._get({ url: this.baseUrl + this.URLs.userById(id) });
    }

    // ---- Calls ----

    /**
     * List calls.
     * @param {object} query - phoneNumberId (required, ^PN...), participants[]
     *   (E.164, max 1), userId (^US...), maxResults (1-100), pageToken,
     *   createdAfter, createdBefore.
     */
    async listCalls(query = {}) {
        return this._get({ url: this.baseUrl + this.URLs.calls, query });
    }

    async getCall(id) {
        return this._get({ url: this.baseUrl + this.URLs.callById(id) });
    }

    async getCallRecordings(callId) {
        return this._get({ url: this.baseUrl + this.URLs.callRecordings(callId) });
    }

    async getCallTranscript(callId) {
        return this._get({ url: this.baseUrl + this.URLs.callTranscript(callId) });
    }

    async getCallSummary(callId) {
        return this._get({ url: this.baseUrl + this.URLs.callSummary(callId) });
    }

    // ---- Messages ----

    /**
     * List messages.
     * @param {object} query - phoneNumberId (required, ^PN...), participants[]
     *   (E.164, max 10), userId, maxResults (1-100), pageToken,
     *   createdAfter, createdBefore.
     */
    async listMessages(query = {}) {
        return this._get({ url: this.baseUrl + this.URLs.messages, query });
    }

    async getMessage(id) {
        return this._get({ url: this.baseUrl + this.URLs.messageById(id) });
    }

    async sendMessage(body) {
        return this._post({
            url: this.baseUrl + this.URLs.messages,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Contacts ----

    async listContacts(query = {}) {
        return this._get({ url: this.baseUrl + this.URLs.contacts, query });
    }

    async getContact(id) {
        return this._get({ url: this.baseUrl + this.URLs.contactById(id) });
    }

    async createContact(body) {
        return this._post({
            url: this.baseUrl + this.URLs.contacts,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Webhooks ----

    async listWebhooks(query = {}) {
        return this._get({ url: this.baseUrl + this.URLs.webhooks, query });
    }

    async getWebhook(id) {
        return this._get({ url: this.baseUrl + this.URLs.webhookById(id) });
    }

    async createCallWebhook(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookCalls,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    async createMessageWebhook(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookMessages,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    async createCallSummaryWebhook(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookCallSummaries,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    async createCallTranscriptWebhook(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookCallTranscripts,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    async deleteWebhook(id) {
        return this._delete({ url: this.baseUrl + this.URLs.webhookById(id) });
    }

    /**
     * Verify a Quo (OpenPhone) webhook delivery. Two schemes exist, chosen by how the subscription was made:
     *  - current (API version 2026-03-30, Standard Webhooks): webhook-id / webhook-timestamp (seconds) /
     *    webhook-signature `v1,<base64>`; HMAC-SHA256 of `${id}.${timestamp}.${raw body}`.
     *    Docs: https://www.quo.com/docs/2026-03-30/webhooks-signature-validation
     *  - legacy: `openphone-signature: hmac;1;<timestamp>;<base64 sig>`; HMAC-SHA256 of
     *    `${timestamp}.${payload}`. Docs: https://support.quo.com/core-concepts/integrations/webhooks
     * Either way the key is the base64-decoded signing secret (any `whsec_` prefix removed) and the
     * timestamp must be within 5 minutes. Legacy accepts the raw body or its compact re-serialisation
     * (the legacy docs tell you to strip whitespace). Pass `rawBody`.
     * Never throws; returns true only for a genuine delivery.
     */
    async verifyWebhookSignature({ headers, body, rawBody, now } = {}) {
        try {
            const secret = this.webhookSecret || process.env.QUO_WEBHOOK_SECRET;
            if (!secret) return false;
            const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
            const payload = whPayload(rawBody, body);
            const nowMs = whNowMs(now);

            const header = whHeader(headers, 'webhook-signature');
            if (header) {
                const id = whHeader(headers, 'webhook-id');
                const timestamp = whHeader(headers, 'webhook-timestamp');
                if (!id || !timestamp) return false;
                const ts = Number(timestamp);
                if (!Number.isFinite(ts)) return false;
                if (Math.abs(nowMs / 1000 - ts) > 300) return false;
                const expected = whHmac(key, [`${id}.${timestamp}.`, payload], 'base64');
                let ok = false;
                for (const entry of String(header).split(' ')) {
                    const i = entry.indexOf(',');
                    if (i < 0 || entry.slice(0, i) !== 'v1') continue;
                    if (whSafeEqual(expected, entry.slice(i + 1))) ok = true;
                }
                return ok;
            }

            const legacy = whHeader(headers, 'openphone-signature');
            if (!legacy) return false;
            const candidates = [payload];
            try {
                const compact = Buffer.from(JSON.stringify(JSON.parse(payload.toString('utf8'))), 'utf8');
                if (!compact.equals(payload)) candidates.push(compact);
            } catch (e) {
                /* not JSON: raw only */
            }
            let ok = false;
            for (const entry of String(legacy).split(',')) {
                const parts = entry.trim().split(';');
                if (parts.length !== 4 || parts[0] !== 'hmac' || parts[1] !== '1') continue;
                const ts = Number(parts[2]);
                if (!Number.isFinite(ts)) continue;
                const tsMs = ts > 1e12 ? ts : ts * 1000; // milliseconds in practice; seconds tolerated
                if (Math.abs(nowMs - tsMs) > 300000) continue;
                for (const candidate of candidates) {
                    const expected = whHmac(key, [`${parts[2]}.`, candidate], 'base64');
                    if (whSafeEqual(expected, parts[3])) ok = true;
                }
            }
            return ok;
        } catch (e) {
            return false;
        }
    }
}

module.exports = { Api };
