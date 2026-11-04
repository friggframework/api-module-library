const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Kit (ConvertKit) API v4 client.
 *
 * Auth: OAuth 2.0 authorization-code + refresh (JSON token endpoint).
 *   Authorization: Bearer <access_token>
 * Alternate: V4 API key via X-Kit-Api-Key (personal automation only).
 *
 * Base URL: https://api.kit.com/v4
 * OAuth authorize: https://api.kit.com/v4/oauth/authorize
 * OAuth token:     https://api.kit.com/v4/oauth/token
 *
 * Docs: https://developers.kit.com/api-reference/overview
 * OpenAPI: https://developers.kit.com/api-reference/v4.json
 * Auth: https://developers.kit.com/api-reference/authentication
 * OAuth: https://developers.kit.com/api-reference/oauth-refresh-token-flow
 * Webhooks: https://developers.kit.com/webhooks/overview
 *
 * The curated machine-readable contract lives in ./kit.openapi.yaml —
 * this client mirrors it 1:1 (one method per operationId).
 *
 * Ported from Left Hook-owned module code cleared for porting; client-specific
 * coupling stripped. Prior OAuth host notes referenced app.kit.com; official
 * OpenAPI + developer docs use api.kit.com/v4/oauth/*.
 */

const BASE_URL = 'https://api.kit.com/v4';
const AUTHORIZE_URL = 'https://api.kit.com/v4/oauth/authorize';
const TOKEN_URI = 'https://api.kit.com/v4/oauth/token';
const SIGNATURE_HEADER = 'x-kit-signature';
const DEFAULT_SCOPE = 'public';
const SIGNATURE_TOLERANCE_SEC = 300;

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = get(params, 'baseUrl', null) || BASE_URL;
        // OAuth2Requester historically reads baseURL; keep both aligned.
        this.baseURL = this.baseUrl;
        this.tokenUri = TOKEN_URI;

        this.client_id =
            this.client_id ||
            get(params, 'client_id', null) ||
            process.env.KIT_CLIENT_ID;
        this.client_secret =
            this.client_secret ||
            get(params, 'client_secret', null) ||
            process.env.KIT_CLIENT_SECRET;
        this.redirect_uri =
            this.redirect_uri ||
            get(params, 'redirect_uri', null) ||
            process.env.KIT_REDIRECT_URI ||
            null;
        this.scope =
            this.scope ||
            get(params, 'scope', null) ||
            get(params, 'scopes', null) ||
            process.env.KIT_SCOPE ||
            DEFAULT_SCOPE;

        this.access_token =
            get(params, 'access_token', null) ||
            process.env.KIT_ACCESS_TOKEN ||
            null;
        this.refresh_token = get(params, 'refresh_token', null);

        // Personal V4 API key (X-Kit-Api-Key). Not for public App Store apps.
        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'apiKey', null) ||
            process.env.KIT_API_KEY ||
            null;

        this.webhookSecret =
            get(params, 'webhookSecret', null) ||
            get(params, 'webhook_secret', null) ||
            process.env.KIT_WEBHOOK_SECRET ||
            null;

        this.authorizationUri = this._buildAuthorizationUri();

        this.URLs = {
            account: '/account',
            subscribers: '/subscribers',
            subscriberById: (id) => `/subscribers/${id}`,
            tags: '/tags',
            tagById: (id) => `/tags/${id}`,
            tagSubscriber: (tagId, subscriberId) =>
                `/tags/${tagId}/subscribers/${subscriberId}`,
            broadcasts: '/broadcasts',
            broadcastById: (id) => `/broadcasts/${id}`,
            sequences: '/sequences',
            sequenceById: (id) => `/sequences/${id}`,
            forms: '/forms',
            customFields: '/custom_fields',
            webhookEndpoints: '/webhook_endpoints',
            webhookEndpointById: (id) => `/webhook_endpoints/${id}`,
        };
    }

    _buildAuthorizationUri() {
        const q = new URLSearchParams();
        q.set('response_type', 'code');
        if (this.client_id) q.set('client_id', this.client_id);
        if (this.redirect_uri) q.set('redirect_uri', this.redirect_uri);
        if (this.scope) q.set('scope', this.scope);
        if (this.state) q.set('state', this.state);
        return `${AUTHORIZE_URL}?${q.toString()}`;
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

    /**
     * Kit token endpoint requires application/json (not form-urlencoded).
     * @see https://developers.kit.com/api-reference/oauth-refresh-token-flow
     */
    async getTokenFromCode(code) {
        delete this.access_token;
        const body = {
            client_id: this.client_id,
            client_secret: this.client_secret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: this.redirect_uri,
        };
        const response = await this._post(
            {
                url: this.tokenUri,
                body,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            },
            false
        );
        await this.setTokens(response);
        return response;
    }

    /**
     * Refresh tokens are single-use — the response includes a new refresh_token
     * that setTokens persists.
     * @see https://developers.kit.com/api-reference/oauth-refresh-token-flow
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const body = {
            client_id: this.client_id,
            grant_type: 'refresh_token',
            refresh_token: refreshTokenObject.refresh_token,
        };
        const response = await this._post(
            {
                url: this.tokenUri,
                body,
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            },
            false
        );
        await this.setTokens(response);
        return response;
    }

    async addAuthHeaders(headers = {}) {
        const next = { ...headers };
        delete next.Authorization;
        delete next['X-Kit-Api-Key'];
        if (this.access_token) {
            next.Authorization = `Bearer ${this.access_token}`;
        } else if (this.api_key) {
            next['X-Kit-Api-Key'] = this.api_key;
        }
        return next;
    }

    addJsonHeaders(options = {}) {
        options.headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...options.headers,
        };
        return options;
    }

    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params || {})) {
            if (value === undefined || value === null) continue;
            usp.append(key, String(value));
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    // ---- Account / identity ------------------------------------------------

    /**
     * Get current account and user.
     * GET /account
     * @see https://developers.kit.com/api-reference/accounts/get-current-account
     */
    async getAccount() {
        return this._get({ url: this.baseUrl + this.URLs.account });
    }

    // ---- Subscribers -------------------------------------------------------

    /**
     * List subscribers (cursor pagination).
     * GET /subscribers
     * @see https://developers.kit.com/api-reference/subscribers/list-subscribers
     */
    async listSubscribers(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.subscribers + this._buildQuery(params),
        });
    }

    /**
     * Get a subscriber by id.
     * GET /subscribers/{id}
     */
    async getSubscriber(id) {
        return this._get({
            url: this.baseUrl + this.URLs.subscriberById(id),
        });
    }

    /**
     * Create (upsert) a subscriber.
     * POST /subscribers
     */
    async createSubscriber(body) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.subscribers,
                body,
            })
        );
    }

    /**
     * Update a subscriber.
     * PUT /subscribers/{id}
     */
    async updateSubscriber(id, body) {
        return this._put(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.subscriberById(id),
                body,
            })
        );
    }

    // ---- Tags --------------------------------------------------------------

    /**
     * List tags.
     * GET /tags
     */
    async listTags(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.tags + this._buildQuery(params),
        });
    }

    /**
     * Create a tag (idempotent on name).
     * POST /tags
     */
    async createTag(body) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.tags,
                body,
            })
        );
    }

    /**
     * Update (rename) a tag.
     * PUT /tags/{id}
     */
    async updateTag(id, body) {
        return this._put(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.tagById(id),
                body,
            })
        );
    }

    /**
     * Tag a subscriber.
     * POST /tags/{tag_id}/subscribers/{id}
     */
    async tagSubscriber(tagId, subscriberId) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.tagSubscriber(tagId, subscriberId),
                body: {},
            })
        );
    }

    /**
     * Remove a tag from a subscriber.
     * DELETE /tags/{tag_id}/subscribers/{id}
     */
    async removeTagFromSubscriber(tagId, subscriberId) {
        return this._delete({
            url: this.baseUrl + this.URLs.tagSubscriber(tagId, subscriberId),
        });
    }

    // ---- Broadcasts --------------------------------------------------------

    /**
     * List broadcasts.
     * GET /broadcasts
     */
    async listBroadcasts(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.broadcasts + this._buildQuery(params),
        });
    }

    /**
     * Get a broadcast.
     * GET /broadcasts/{id}
     */
    async getBroadcast(id) {
        return this._get({
            url: this.baseUrl + this.URLs.broadcastById(id),
        });
    }

    /**
     * Create a broadcast.
     * POST /broadcasts
     */
    async createBroadcast(body) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.broadcasts,
                body,
            })
        );
    }

    /**
     * Update a broadcast.
     * PUT /broadcasts/{id}
     */
    async updateBroadcast(id, body) {
        return this._put(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.broadcastById(id),
                body,
            })
        );
    }

    // ---- Sequences ---------------------------------------------------------

    /**
     * List sequences.
     * GET /sequences
     */
    async listSequences(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.sequences + this._buildQuery(params),
        });
    }

    /**
     * Get a sequence.
     * GET /sequences/{id}
     */
    async getSequence(id, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.sequenceById(id) +
                this._buildQuery(params),
        });
    }

    /**
     * Create a sequence.
     * POST /sequences
     */
    async createSequence(body) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.sequences,
                body,
            })
        );
    }

    /**
     * Update a sequence.
     * PUT /sequences/{id}
     */
    async updateSequence(id, body) {
        return this._put(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.sequenceById(id),
                body,
            })
        );
    }

    // ---- Forms / custom fields ---------------------------------------------

    /**
     * List forms (and landing pages).
     * GET /forms
     */
    async listForms(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.forms + this._buildQuery(params),
        });
    }

    /**
     * List custom fields.
     * GET /custom_fields
     */
    async listCustomFields(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.customFields +
                this._buildQuery(params),
        });
    }

    /**
     * Create a custom field.
     * POST /custom_fields
     */
    async createCustomField(body) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.customFields,
                body,
            })
        );
    }

    // ---- Webhook endpoints (v2 signed deliveries) --------------------------

    /**
     * List webhook endpoints.
     * GET /webhook_endpoints
     * @see https://developers.kit.com/api-reference/webhooks/list-webhook-endpoints
     */
    async listWebhookEndpoints(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.webhookEndpoints +
                this._buildQuery(params),
        });
    }

    /**
     * Create a webhook endpoint.
     * POST /webhook_endpoints
     * Response includes `secret` once — store it for signature verification.
     */
    async createWebhookEndpoint(body) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.webhookEndpoints,
                body,
            })
        );
    }

    /**
     * Get a webhook endpoint (secret is never returned).
     * GET /webhook_endpoints/{id}
     */
    async getWebhookEndpoint(id) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookEndpointById(id),
        });
    }

    /**
     * Update a webhook endpoint.
     * PATCH /webhook_endpoints/{id}
     */
    async updateWebhookEndpoint(id, body) {
        return this._patch(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.webhookEndpointById(id),
                body,
            })
        );
    }

    /**
     * Delete a webhook endpoint.
     * DELETE /webhook_endpoints/{id}
     */
    async deleteWebhookEndpoint(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookEndpointById(id),
        });
    }

    // ---- Webhook signature -------------------------------------------------

    /**
     * Verify a Kit webhook delivery signature (X-Kit-Signature).
     * Signed string is `{t}.{raw_body}`; HMAC-SHA256 hex; 5-minute skew.
     * @see https://developers.kit.com/webhooks/verifying-signatures
     */
    verifyWebhookSignature({
        headers = {},
        rawBody,
        body,
        secret,
        toleranceSec = SIGNATURE_TOLERANCE_SEC,
    } = {}) {
        const header =
            headers[SIGNATURE_HEADER] ||
            headers['X-Kit-Signature'] ||
            headers['x-kit-signature'];
        const key = secret || this.webhookSecret;
        if (!key) {
            return { valid: false, reason: 'missing webhook secret' };
        }
        if (!header) {
            return { valid: false, reason: 'missing X-Kit-Signature header' };
        }

        const parts = String(header)
            .split(',')
            .map((s) => s.trim());
        const timestamp = parts
            .find((p) => p.startsWith('t='))
            ?.slice(2);
        if (
            !timestamp ||
            Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSec
        ) {
            return { valid: false, reason: 'stale or missing timestamp' };
        }

        let payload;
        if (rawBody !== undefined && rawBody !== null) {
            payload =
                typeof rawBody === 'string' || Buffer.isBuffer(rawBody)
                    ? rawBody
                    : Buffer.from(String(rawBody));
        } else if (body !== undefined) {
            payload =
                typeof body === 'string' ? body : JSON.stringify(body);
        } else {
            return { valid: false, reason: 'missing body' };
        }

        const signed = Buffer.concat([
            Buffer.from(`${timestamp}.`, 'utf8'),
            Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8'),
        ]);
        const expected = crypto
            .createHmac('sha256', key)
            .update(signed)
            .digest('hex');
        const expectedBuf = Buffer.from(expected);

        const match = parts
            .filter((p) => p.startsWith('v1='))
            .some((candidate) => {
                const candidateBuf = Buffer.from(candidate.slice(3));
                return (
                    candidateBuf.length === expectedBuf.length &&
                    crypto.timingSafeEqual(candidateBuf, expectedBuf)
                );
            });

        return match
            ? { valid: true }
            : { valid: false, reason: 'signature mismatch' };
    }
}

module.exports = {
    Api,
    BASE_URL,
    AUTHORIZE_URL,
    TOKEN_URI,
    SIGNATURE_HEADER,
    DEFAULT_SCOPE,
};
