const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

const DEFAULT_BASE_URL = 'https://api.airtable.com/v0';
const AUTHORIZE_URI = 'https://airtable.com/oauth2/v1/authorize';
const TOKEN_URI = 'https://airtable.com/oauth2/v1/token';
const CONTENT_MAC_HEADER = 'x-airtable-content-mac';

// URL-unreserved delimiter used to pack caller state + encrypted PKCE verifier.
const STATE_VERIFIER_DELIMITER = '~';

/**
 * Airtable Web API client.
 *
 * Auth: OAuth 2.0 authorization-code + PKCE (S256) for third-party / marketplace
 * connections. Token endpoint uses HTTP Basic (`client_id:client_secret`) and
 * `application/x-www-form-urlencoded` body. Access tokens expire in ~60 minutes;
 * refresh tokens rotate and expire in ~60 days.
 *
 * Personal access tokens (Bearer) also work when passed as `access_token` (no
 * refresh). Legacy `api_key` query-param auth is not supported by Airtable.
 *
 * Base URL: https://api.airtable.com/v0
 * Docs: https://airtable.com/developers/web/api/introduction
 * Auth: https://airtable.com/developers/web/api/authentication
 * OAuth: https://airtable.com/developers/web/api/oauth-reference
 * Webhooks: https://airtable.com/developers/web/api/webhooks-overview
 * Rate limit: 5 requests/second/base (429 → wait 30s).
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'base_url', null) ||
            process.env.AIRTABLE_BASE_URL ||
            DEFAULT_BASE_URL;

        this.tokenUri = TOKEN_URI;
        this.authorizationUri = this._buildAuthorizationUri();

        // PKCE verifier for the in-flight authorize → token exchange.
        this.code_verifier = get(params, 'code_verifier', null);

        // Optional per-webhook MAC secret (base64) for local/single-tenant verify.
        this.webhookMacSecretBase64 =
            get(params, 'webhookMacSecretBase64', null) ||
            get(params, 'webhook_mac_secret_base64', null) ||
            process.env.AIRTABLE_WEBHOOK_MAC_SECRET ||
            null;

        this.URLs = {
            whoami: '/meta/whoami',
            bases: '/meta/bases',
            baseTables: (baseId) => `/meta/bases/${baseId}/tables`,
            records: (baseId, tableIdOrName) =>
                `/${baseId}/${encodeURIComponent(tableIdOrName)}`,
            recordById: (baseId, tableIdOrName, recordId) =>
                `/${baseId}/${encodeURIComponent(tableIdOrName)}/${recordId}`,
            webhooks: (baseId) => `/bases/${baseId}/webhooks`,
            webhookById: (baseId, webhookId) =>
                `/bases/${baseId}/webhooks/${webhookId}`,
            webhookRefresh: (baseId, webhookId) =>
                `/bases/${baseId}/webhooks/${webhookId}/refresh`,
            webhookPayloads: (baseId, webhookId) =>
                `/bases/${baseId}/webhooks/${webhookId}/payloads`,
            webhookEnableNotifications: (baseId, webhookId) =>
                `/bases/${baseId}/webhooks/${webhookId}/enableNotifications`,
        };
    }

    // ---- OAuth / PKCE ------------------------------------------------------

    /**
     * Generate a PKCE code_verifier (43–128 chars from the unreserved set).
     * @see https://airtable.com/developers/web/api/oauth-reference#authorization-parameter-rules
     */
    static generateCodeVerifier() {
        // 32 bytes → 43 base64url chars (within Airtable's 43–128 range).
        return crypto.randomBytes(32).toString('base64url');
    }

    static codeChallengeS256(verifier) {
        return crypto.createHash('sha256').update(verifier).digest('base64url');
    }

    _buildAuthorizationUri({ codeChallenge } = {}) {
        const params = new URLSearchParams({
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            response_type: 'code',
            code_challenge_method: 'S256',
        });
        if (this.scope) params.set('scope', this.scope);
        if (this.state) params.set('state', this.state);
        if (codeChallenge) params.set('code_challenge', codeChallenge);
        return `${AUTHORIZE_URI}?${params.toString()}`;
    }

    /**
     * Build the authorize URL with a fresh PKCE verifier. The verifier is
     * AES-GCM encrypted into `state` (Salesforce-style) so the token exchange
     * can recover it without server-side session storage.
     */
    getAuthorizationUri() {
        const verifier = Api.generateCodeVerifier();
        this.code_verifier = verifier;
        const challenge = Api.codeChallengeS256(verifier);
        const url = this._buildAuthorizationUri({ codeChallenge: challenge });

        const encoded = this._encryptVerifier(verifier);
        const callerState = this.state || null;
        const state = callerState
            ? `${callerState}${STATE_VERIFIER_DELIMITER}${encoded}`
            : encoded;

        const urlObj = new URL(url);
        urlObj.searchParams.set('state', state);
        this.authorizationUri = urlObj.toString();
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

    restoreVerifierFromState(state) {
        if (!state) return;
        const at = String(state).lastIndexOf(STATE_VERIFIER_DELIMITER);
        const encrypted = at === -1 ? state : String(state).slice(at + 1);
        this.code_verifier = this._decryptVerifier(encrypted);
    }

    _encryptVerifier(verifier) {
        if (!this.client_secret) {
            throw new Error(
                'Airtable PKCE: client_secret is required to encrypt the code_verifier into state'
            );
        }
        const key = crypto
            .createHash('sha256')
            .update(this.client_secret)
            .digest();
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([
            cipher.update(verifier, 'utf8'),
            cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        return `${iv.toString('base64url')}.${encrypted.toString('base64url')}.${tag.toString('base64url')}`;
    }

    _decryptVerifier(encryptedState) {
        if (!this.client_secret) {
            throw new Error(
                'Airtable PKCE: client_secret is required to decrypt the code_verifier from state'
            );
        }
        const [ivB64, encB64, tagB64] = String(encryptedState).split('.');
        const key = crypto
            .createHash('sha256')
            .update(this.client_secret)
            .digest();
        const iv = Buffer.from(ivB64, 'base64url');
        const encryptedBuf = Buffer.from(encB64, 'base64url');
        const tag = Buffer.from(tagB64, 'base64url');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([
            decipher.update(encryptedBuf),
            decipher.final(),
        ]).toString('utf8');
    }

    _tokenHeaders() {
        return {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(
                `${this.client_id}:${this.client_secret}`
            ).toString('base64')}`,
            Accept: 'application/json',
        };
    }

    /**
     * Exchange an authorization code for tokens (PKCE).
     * POST https://airtable.com/oauth2/v1/token
     * @see https://airtable.com/developers/web/api/oauth-reference
     */
    async getTokenFromCode(code) {
        delete this.access_token;
        if (!this.code_verifier) {
            throw new Error(
                'Airtable PKCE: code_verifier missing — call getAuthorizationUri() then restoreVerifierFromState(state) before getTokenFromCode()'
            );
        }
        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            code: String(code),
            redirect_uri: this.redirect_uri,
            code_verifier: this.code_verifier,
        });
        const response = await this._post({
            url: this.tokenUri,
            headers: this._tokenHeaders(),
            body: body.toString(),
        }, false);
        this.code_verifier = null;
        await this.setTokens(response);
        return response;
    }

    /**
     * Refresh tokens. Airtable invalidates the previous access + refresh pair
     * and returns new ones (`refresh_expires_in` ≈ 60 days).
     * @see https://airtable.com/developers/web/api/oauth-reference
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: get(
                refreshTokenObject,
                'refresh_token',
                this.refresh_token
            ),
        });
        const response = await this._post({
            url: this.tokenUri,
            headers: this._tokenHeaders(),
            body: body.toString(),
        }, false);
        await this.setTokens(response);
        return response;
    }

    async setTokens(params) {
        await super.setTokens(params);
        // Airtable also returns refresh_expires_in; surface for callers.
        const refreshExpiresIn = get(params, 'refresh_expires_in', null);
        if (refreshExpiresIn) {
            this.refreshTokenExpire = new Date(
                Date.now() + Number(refreshExpiresIn) * 1000
            );
        }
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Get the authenticated user's id (and email/scopes when granted).
     * GET /meta/whoami
     * @see https://airtable.com/developers/web/api/get-user-id-scopes
     */
    async getWhoami() {
        return this._get({ url: this.baseUrl + this.URLs.whoami });
    }

    // ---- Bases / schema ----------------------------------------------------

    /**
     * List bases the token can access.
     * GET /meta/bases
     * @see https://airtable.com/developers/web/api/list-bases
     */
    async listBases(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.bases,
            query,
        });
    }

    /**
     * Get the schema of all tables in a base.
     * GET /meta/bases/{baseId}/tables
     * @see https://airtable.com/developers/web/api/get-base-schema
     */
    async getBaseSchema(baseId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.baseTables(baseId),
            query,
        });
    }

    // ---- Records -----------------------------------------------------------

    /**
     * List records in a table.
     * GET /{baseId}/{tableIdOrName}
     * @see https://airtable.com/developers/web/api/list-records
     */
    async listRecords(baseId, tableIdOrName, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.records(baseId, tableIdOrName),
            query,
        });
    }

    /**
     * Get a single record.
     * GET /{baseId}/{tableIdOrName}/{recordId}
     * @see https://airtable.com/developers/web/api/get-record
     */
    async getRecord(baseId, tableIdOrName, recordId, query = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.recordById(baseId, tableIdOrName, recordId),
            query,
        });
    }

    /**
     * Create one or more records.
     * POST /{baseId}/{tableIdOrName}
     * @see https://airtable.com/developers/web/api/create-records
     */
    async createRecords(baseId, tableIdOrName, body) {
        return this._post({
            url: this.baseUrl + this.URLs.records(baseId, tableIdOrName),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update a single record (PATCH — only specified fields).
     * PATCH /{baseId}/{tableIdOrName}/{recordId}
     * @see https://airtable.com/developers/web/api/update-record
     */
    async updateRecord(baseId, tableIdOrName, recordId, body) {
        return this._patch({
            url:
                this.baseUrl +
                this.URLs.recordById(baseId, tableIdOrName, recordId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update or upsert multiple records.
     * PATCH /{baseId}/{tableIdOrName}
     * @see https://airtable.com/developers/web/api/update-multiple-records
     */
    async updateRecords(baseId, tableIdOrName, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.records(baseId, tableIdOrName),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Delete a single record.
     * DELETE /{baseId}/{tableIdOrName}/{recordId}
     * @see https://airtable.com/developers/web/api/delete-record
     */
    async deleteRecord(baseId, tableIdOrName, recordId) {
        return this._delete({
            url:
                this.baseUrl +
                this.URLs.recordById(baseId, tableIdOrName, recordId),
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * List webhooks for a base.
     * GET /bases/{baseId}/webhooks
     * @see https://airtable.com/developers/web/api/list-webhooks
     */
    async listWebhooks(baseId) {
        return this._get({
            url: this.baseUrl + this.URLs.webhooks(baseId),
        });
    }

    /**
     * Create a webhook on a base.
     * POST /bases/{baseId}/webhooks
     * Response includes `macSecretBase64` once — store it to verify pings.
     * @see https://airtable.com/developers/web/api/create-a-webhook
     */
    async createWebhook(baseId, body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks(baseId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Delete a webhook.
     * DELETE /bases/{baseId}/webhooks/{webhookId}
     * @see https://airtable.com/developers/web/api/delete-a-webhook
     */
    async deleteWebhook(baseId, webhookId) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(baseId, webhookId),
        });
    }

    /**
     * Extend an active webhook's life by 7 days.
     * POST /bases/{baseId}/webhooks/{webhookId}/refresh
     * @see https://airtable.com/developers/web/api/refresh-a-webhook
     */
    async refreshWebhook(baseId, webhookId) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookRefresh(baseId, webhookId),
            headers: { 'Content-Type': 'application/json' },
            body: {},
        });
    }

    /**
     * List webhook payloads (call after a notification ping). Also extends life.
     * GET /bases/{baseId}/webhooks/{webhookId}/payloads
     * @see https://airtable.com/developers/web/api/list-webhook-payloads
     */
    async listWebhookPayloads(baseId, webhookId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookPayloads(baseId, webhookId),
            query,
        });
    }

    /**
     * Enable or disable notification pings for a webhook.
     * POST /bases/{baseId}/webhooks/{webhookId}/enableNotifications
     * @see https://airtable.com/developers/web/api/enable-disable-webhook-notifications
     */
    async toggleWebhookNotifications(baseId, webhookId, body) {
        return this._post({
            url:
                this.baseUrl +
                this.URLs.webhookEnableNotifications(baseId, webhookId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Webhook signature helper (also used by extensions/webhooks) -------

    /**
     * Verify `X-Airtable-Content-MAC` on a notification ping.
     * @see https://airtable.com/developers/web/api/webhooks-overview#webhook-notification-delivery
     */
    static verifyWebhookContentMac({
        headers,
        rawBody,
        body,
        macSecretBase64,
    }) {
        return verifyAirtableContentMac({
            headers,
            rawBody,
            body,
            macSecretBase64,
        });
    }
}

/**
 * Official Airtable notification MAC check.
 *
 *   macSecretDecoded = Buffer.from(macSecretBase64, 'base64')
 *   hmac = HMAC-SHA256(secret, JSON.stringify(payload) as ascii)
 *   expected = 'hmac-sha256=' + hexDigest
 *
 * @see https://airtable.com/developers/web/api/webhooks-overview
 */
function verifyAirtableContentMac({
    headers = {},
    rawBody,
    body,
    macSecretBase64,
}) {
    if (!macSecretBase64) {
        return { valid: false, reason: 'missing_mac_secret' };
    }

    let provided;
    for (const key of Object.keys(headers || {})) {
        if (key.toLowerCase() === CONTENT_MAC_HEADER) {
            const v = headers[key];
            provided = Array.isArray(v) ? v[0] : v;
            break;
        }
    }
    if (!provided) {
        return { valid: false, reason: 'missing_mac_header' };
    }

    let bodyBuf;
    if (rawBody !== undefined && rawBody !== null) {
        bodyBuf = Buffer.isBuffer(rawBody)
            ? rawBody
            : Buffer.from(String(rawBody), 'utf8');
    } else if (body === undefined || body === null) {
        bodyBuf = Buffer.alloc(0);
    } else if (Buffer.isBuffer(body)) {
        bodyBuf = body;
    } else if (typeof body === 'string') {
        bodyBuf = Buffer.from(body, 'utf8');
    } else {
        // Airtable's sample signs JSON.stringify(payload).
        bodyBuf = Buffer.from(JSON.stringify(body), 'utf8');
    }

    const macSecretDecoded = Buffer.from(String(macSecretBase64), 'base64');
    const hmac = crypto.createHmac('sha256', macSecretDecoded);
    hmac.update(bodyBuf.toString(), 'ascii');
    const expected = `hmac-sha256=${hmac.digest('hex')}`;

    const a = Buffer.from(String(provided), 'utf8');
    const b = Buffer.from(expected, 'utf8');
    const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
    return valid
        ? { valid: true }
        : { valid: false, reason: 'mac_mismatch' };
}

module.exports = {
    Api,
    verifyAirtableContentMac,
    CONTENT_MAC_HEADER,
    STATE_VERIFIER_DELIMITER,
};
