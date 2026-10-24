const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

const JSON_API_CONTENT_TYPE = 'application/vnd.api+json';
const SIGNATURE_HEADER = 'Outreach-Webhook-Signature';

/**
 * Outreach (outreach.io) public REST API client.
 *
 * Auth: OAuth 2.0 authorization-code. Access tokens are short-lived (~2h);
 * refresh tokens rotate and last 14 days. Scopes are period-separated
 * resource.action strings (e.g. `prospects.read`, `accounts.all`,
 * `webhooks.all`) and are NOT additive — `write` does not imply `read`.
 *
 * Base URL: https://api.outreach.io/api/v2
 * Content-Type: application/vnd.api+json (JSON:API 1.0)
 * Rate limit: 10,000 requests/hour per user (general).
 *
 * Docs: https://developers.outreach.io/api/getting-started
 * OpenAPI: https://api.outreach.io/api/v2/schema/openapi.json
 *
 * The curated contract in ./outreach.openapi.yaml is the source of truth this
 * client mirrors 1:1 (one method per operationId). Keep them in sync.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://api.outreach.io/api/v2';

        // OAuth2Requester loads client_id / client_secret / redirect_uri / scope
        // from params + Definition.env. Rebuild the authorize URL once those
        // are present (constructor may run before env is injected).
        this.tokenUri = 'https://api.outreach.io/oauth/token';
        this.authorizationUri = this._buildAuthorizationUri();

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        // Optional per-install webhook signing secret (returned on webhook
        // create as attributes.secret). Used by verifyWebhookSignature.
        this.webhook_secret = get(params, 'webhook_secret', null);

        this.URLs = {
            root: '',
            accounts: '/accounts',
            accountById: (id) => `/accounts/${id}`,
            prospects: '/prospects',
            prospectById: (id) => `/prospects/${id}`,
            tasks: '/tasks',
            taskById: (id) => `/tasks/${id}`,
            users: '/users',
            userById: (id) => `/users/${id}`,
            webhooks: '/webhooks',
            webhookById: (id) => `/webhooks/${id}`,
            webhookCleanup: '/webhooks/cleanup',
        };
    }

    _buildAuthorizationUri() {
        const clientId = this.client_id || '';
        const redirectUri = this.redirect_uri || '';
        const scope = this.scope || this.scopes || '';
        const state = this.state || '';
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: String(scope),
        });
        if (state) params.set('state', String(state));
        return `https://api.outreach.io/oauth/authorize?${params.toString()}`;
    }

    getAuthorizationUri() {
        this.authorizationUri = this._buildAuthorizationUri();
        return this.authorizationUri;
    }

    getAuthUri() {
        return this.getAuthorizationUri();
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri(),
            type: 'oauth2',
        };
    }

    /** JSON:API media type required on every mutating request. */
    addJsonApiHeaders(options = {}) {
        options.headers = {
            Accept: JSON_API_CONTENT_TYPE,
            'Content-Type': JSON_API_CONTENT_TYPE,
            ...options.headers,
        };
        return options;
    }

    async _get(options) {
        options.headers = {
            Accept: JSON_API_CONTENT_TYPE,
            ...options.headers,
        };
        return super._get(options);
    }

    async _post(options, stringify) {
        // Token exchange uses form-urlencoded; leave those alone.
        if (
            options.headers &&
            options.headers['Content-Type'] ===
                'application/x-www-form-urlencoded'
        ) {
            return super._post(options, stringify);
        }
        this.addJsonApiHeaders(options);
        return super._post(options, stringify);
    }

    async _patch(options, stringify) {
        this.addJsonApiHeaders(options);
        return super._patch(options, stringify);
    }

    async _delete(options) {
        options.headers = {
            Accept: JSON_API_CONTENT_TYPE,
            ...options.headers,
        };
        return super._delete(options);
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Root API descriptor for the authenticated token / org.
     * GET https://api.outreach.io/api/v2
     *
     * Docs: https://developers.outreach.io/api/getting-started
     * ("The root API endpoint will return information about your current
     * OAuth application and token, as well as attributes related to your
     * organization.") Exact response field names are not fully documented —
     * see PR open questions.
     */
    async getApiRoot() {
        return this._get({ url: this.baseUrl + this.URLs.root });
    }

    // ---- Accounts ----------------------------------------------------------

    /** GET /accounts */
    async listAccounts(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.accounts,
            query: params.query || params,
        });
    }

    /** GET /accounts/{id} */
    async getAccount(id, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.accountById(id),
            query: params.query || params,
        });
    }

    /** POST /accounts — body is a JSON:API document */
    async createAccount(data) {
        return this._post({
            url: this.baseUrl + this.URLs.accounts,
            body: data,
        });
    }

    /** PATCH /accounts/{id} */
    async updateAccount(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.accountById(id),
            body: data,
        });
    }

    /** DELETE /accounts/{id} */
    async deleteAccount(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.accountById(id),
        });
    }

    // ---- Prospects ---------------------------------------------------------

    /** GET /prospects */
    async listProspects(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.prospects,
            query: params.query || params,
        });
    }

    /** GET /prospects/{id} */
    async getProspect(id, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.prospectById(id),
            query: params.query || params,
        });
    }

    /** POST /prospects */
    async createProspect(data) {
        return this._post({
            url: this.baseUrl + this.URLs.prospects,
            body: data,
        });
    }

    /** PATCH /prospects/{id} */
    async updateProspect(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.prospectById(id),
            body: data,
        });
    }

    /** DELETE /prospects/{id} */
    async deleteProspect(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.prospectById(id),
        });
    }

    // ---- Tasks -------------------------------------------------------------

    /** GET /tasks */
    async listTasks(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.tasks,
            query: params.query || params,
        });
    }

    /** GET /tasks/{id} */
    async getTask(id, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.taskById(id),
            query: params.query || params,
        });
    }

    /** POST /tasks */
    async createTask(data) {
        return this._post({
            url: this.baseUrl + this.URLs.tasks,
            body: data,
        });
    }

    /** PATCH /tasks/{id} */
    async updateTask(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.taskById(id),
            body: data,
        });
    }

    /** DELETE /tasks/{id} */
    async deleteTask(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.taskById(id),
        });
    }

    // ---- Users -------------------------------------------------------------

    /** GET /users */
    async listUsers(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.users,
            query: params.query || params,
        });
    }

    /** GET /users/{id} */
    async getUser(id, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.userById(id),
            query: params.query || params,
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /** GET /webhooks */
    async listWebhooks(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.webhooks,
            query: params.query || params,
        });
    }

    /** GET /webhooks/{id} */
    async getWebhook(id, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookById(id),
            query: params.query || params,
        });
    }

    /**
     * POST /webhooks
     * body: { data: { type: 'webhook', attributes: { url, resource?, action?,
     *         payloadVersion?, secret?, active? } } }
     */
    async createWebhook(data) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks,
            body: data,
        });
    }

    /** PATCH /webhooks/{id} */
    async updateWebhook(id, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.webhookById(id),
            body: data,
        });
    }

    /** DELETE /webhooks/{id} */
    async deleteWebhook(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(id),
        });
    }

    /**
     * POST /webhooks/cleanup — remove a webhook using its cleanupToken when
     * the OAuth grant is gone. Authorization: Bearer <cleanupToken>.
     * Docs: https://developers.outreach.io/api/webhooks
     */
    async cleanupWebhook(cleanupToken) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookCleanup,
            headers: {
                Authorization: `Bearer ${cleanupToken}`,
                Accept: JSON_API_CONTENT_TYPE,
                'Content-Type': JSON_API_CONTENT_TYPE,
            },
            body: {},
        });
    }

    /**
     * Verify an Outreach webhook delivery.
     * Docs: https://developers.outreach.io/api/webhooks#authenticity-validation
     *
     * Algorithm: Outreach-Webhook-Signature ===
     *   HMAC-SHA256-hex(secret, raw_body)
     * Never throws; returns true only for a genuine delivery.
     */
    async verifyWebhookSignature({ headers, body, rawBody, secret } = {}) {
        try {
            const signingSecret =
                secret ||
                this.webhook_secret ||
                process.env.OUTREACH_WEBHOOK_SECRET;
            if (!signingSecret) return false;

            const signature = headerValue(headers, SIGNATURE_HEADER);
            if (!signature) return false;

            const payload = rawPayload(rawBody, body);
            const expected = crypto
                .createHmac('sha256', String(signingSecret))
                .update(payload)
                .digest('hex');
            return timingSafeEqualHex(expected, String(signature));
        } catch (_e) {
            return false;
        }
    }
}

function headerValue(headers, name) {
    if (!headers || typeof headers !== 'object') return undefined;
    if (headers[name] !== undefined) return headers[name];
    const lower = name.toLowerCase();
    if (headers[lower] !== undefined) return headers[lower];
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lower) return headers[key];
    }
    return undefined;
}

function rawPayload(rawBody, body) {
    if (typeof rawBody === 'string') return rawBody;
    if (Buffer.isBuffer(rawBody)) return rawBody.toString('utf8');
    if (typeof body === 'string') return body;
    if (Buffer.isBuffer(body)) return body.toString('utf8');
    if (body === undefined || body === null) return '';
    return JSON.stringify(body);
}

function timingSafeEqualHex(a, b) {
    const bufA = Buffer.from(String(a), 'utf8');
    const bufB = Buffer.from(String(b), 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
    Api,
    JSON_API_CONTENT_TYPE,
    SIGNATURE_HEADER,
};
