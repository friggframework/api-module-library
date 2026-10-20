const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

const DEFAULT_BASE_URL = 'https://api.intercom.io';
const DEFAULT_AUTH_HOST = 'https://app.intercom.com';
const TOKEN_PATH = '/auth/eagle/token';
const DEFAULT_API_VERSION = '2.17';

const SIGNATURE_HEADER = 'x-hub-signature';

/**
 * Intercom REST API client (API version 2.17).
 *
 * Auth: OAuth 2.0 authorization-code for public marketplace apps, or a
 * workspace Access Token (Bearer) for private apps. Token exchange uses
 * Intercom's Eagle endpoint (form body: code, client_id, client_secret) —
 * not the standard OAuth token grant shape. Access tokens do not refresh.
 *
 * Base URL: https://api.intercom.io (also api.eu.intercom.io, api.au.intercom.io)
 * Authorize: https://app.intercom.com/oauth?client_id=…&state=…
 * Token: POST https://api.intercom.io/auth/eagle/token
 *
 * Official OpenAPI: https://github.com/intercom/Intercom-OpenAPI
 * Docs: https://developers.intercom.com/docs/references/rest-api/api.intercom.io
 * OAuth: https://developers.intercom.com/docs/build-an-integration/learn-more/authentication/setting-up-oauth
 *
 * The curated machine-readable contract lives in ./intercom.openapi.yaml —
 * this client mirrors it 1:1 (one method per operationId). Keep them in sync.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'base_url', null) ||
            process.env.INTERCOM_BASE_URL ||
            DEFAULT_BASE_URL;

        this.authHost =
            get(params, 'authHost', null) ||
            get(params, 'auth_host', null) ||
            process.env.INTERCOM_AUTH_HOST ||
            DEFAULT_AUTH_HOST;

        this.apiVersion =
            get(params, 'apiVersion', null) ||
            get(params, 'api_version', null) ||
            process.env.INTERCOM_API_VERSION ||
            DEFAULT_API_VERSION;

        this.client_id =
            this.client_id ||
            get(params, 'client_id', null) ||
            process.env.INTERCOM_CLIENT_ID;
        this.client_secret =
            this.client_secret ||
            get(params, 'client_secret', null) ||
            process.env.INTERCOM_CLIENT_SECRET;
        this.redirect_uri =
            this.redirect_uri ||
            get(params, 'redirect_uri', null) ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/intercom`
                : null);

        this.access_token = get(params, 'access_token', null);
        // Intercom OAuth does not issue refresh tokens.
        this.refresh_token = get(params, 'refresh_token', null);
        this.isRefreshable = false;

        this.webhookSecret =
            get(params, 'webhookSecret', null) ||
            get(params, 'webhook_secret', null) ||
            process.env.INTERCOM_WEBHOOK_SECRET ||
            this.client_secret ||
            null;

        this.tokenUri = `${this.baseUrl.replace(/\/$/, '')}${TOKEN_PATH}`;
        this.authorizationUri = this._buildAuthorizationUri();

        this.URLs = {
            me: '/me',
            contacts: '/contacts',
            contactById: (id) => `/contacts/${id}`,
            conversations: '/conversations',
            conversationById: (id) => `/conversations/${id}`,
            conversationReply: (id) => `/conversations/${id}/reply`,
            admins: '/admins',
            adminById: (id) => `/admins/${id}`,
            companies: '/companies',
            companiesList: '/companies/list',
            companyById: (id) => `/companies/${id}`,
            tags: '/tags',
            tagById: (id) => `/tags/${id}`,
        };
    }

    _buildAuthorizationUri() {
        const q = new URLSearchParams();
        if (this.client_id) q.set('client_id', this.client_id);
        if (this.state) q.set('state', this.state);
        // Intercom scopes are selected in the Developer Hub Authorization
        // settings — they are not authorize-query params.
        return `${this.authHost.replace(/\/$/, '')}/oauth?${q.toString()}`;
    }

    getAuthUri() {
        this.authorizationUri = this._buildAuthorizationUri();
        return this.authorizationUri;
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthUri(),
            type: 'oauth2',
            data: {},
        };
    }

    /**
     * Intercom Eagle token exchange.
     * POST /auth/eagle/token with form fields code, client_id, client_secret.
     * Response: { token_type: 'Bearer', token, access_token } (no refresh).
     * @see https://developers.intercom.com/docs/build-an-integration/learn-more/authentication/setting-up-oauth
     */
    async getTokenFromCode(code) {
        const params = new URLSearchParams();
        params.append('code', code);
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);

        const options = {
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            url: this.tokenUri,
        };
        const response = await this._post(options, false);
        const normalized = {
            ...response,
            access_token:
                response.access_token || response.token || null,
            token_type: response.token_type || 'Bearer',
        };
        await this.setTokens(normalized);
        return normalized;
    }

    isAuthenticated() {
        return !!(this.access_token && String(this.access_token).length > 0);
    }

    async addAuthHeaders(headers = {}) {
        const next = await super.addAuthHeaders({ ...headers });
        next.Accept = next.Accept || 'application/json';
        next['Intercom-Version'] = this.apiVersion;
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
            if (Array.isArray(value)) {
                for (const v of value) {
                    if (v === undefined || v === null) continue;
                    usp.append(`${key}[]`, String(v));
                }
            } else {
                usp.append(key, String(value));
            }
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Identify the authorized admin and embedded workspace (app).
     * GET /me
     * Official operationId: identifyAdmin
     * Response includes admin id/email/name and app.id_code (workspace).
     */
    async getMe() {
        return this._get({ url: this.baseUrl + this.URLs.me });
    }

    // ---- Contacts ----------------------------------------------------------

    /**
     * List contacts (cursor pagination via pages).
     * GET /contacts
     * Optional query: per_page, starting_after
     */
    async listContacts(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.contacts + this._buildQuery(params),
        });
    }

    /**
     * Fetch a contact by id.
     * GET /contacts/{contact_id}
     */
    async getContact(contactId) {
        return this._get({
            url: this.baseUrl + this.URLs.contactById(contactId),
        });
    }

    /**
     * Create a contact.
     * POST /contacts
     * Body: { role, email?, external_id?, phone?, name?, … }
     */
    async createContact(body) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.contacts,
                body,
            })
        );
    }

    /**
     * Update a contact.
     * PUT /contacts/{contact_id}
     */
    async updateContact(contactId, body) {
        return this._put(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.contactById(contactId),
                body,
            })
        );
    }

    // ---- Conversations -----------------------------------------------------

    /**
     * List conversations.
     * GET /conversations
     * Optional query: per_page, starting_after
     */
    async listConversations(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.conversations +
                this._buildQuery(params),
        });
    }

    /**
     * Retrieve a conversation (includes conversation parts).
     * GET /conversations/{conversation_id}
     */
    async getConversation(conversationId) {
        return this._get({
            url: this.baseUrl + this.URLs.conversationById(conversationId),
        });
    }

    /**
     * Create a conversation initiated by a contact.
     * POST /conversations
     */
    async createConversation(body) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.conversations,
                body,
            })
        );
    }

    /**
     * Update a conversation (custom attributes, title, …).
     * PUT /conversations/{conversation_id}
     * For reply / assign / open / close / snooze use replyConversation
     * or the manage parts endpoint (not modeled in this cut).
     */
    async updateConversation(conversationId, body) {
        return this._put(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.conversationById(conversationId),
                body,
            })
        );
    }

    /**
     * Reply to a conversation (admin/contact message or note).
     * POST /conversations/{conversation_id}/reply
     */
    async replyConversation(conversationId, body) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.conversationReply(conversationId),
                body,
            })
        );
    }

    // ---- Admins ------------------------------------------------------------

    /**
     * List admins (teammates).
     * GET /admins
     */
    async listAdmins(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.admins + this._buildQuery(params),
        });
    }

    /**
     * Retrieve an admin by id.
     * GET /admins/{admin_id}
     */
    async getAdmin(adminId) {
        return this._get({
            url: this.baseUrl + this.URLs.adminById(adminId),
        });
    }

    // ---- Companies ---------------------------------------------------------

    /**
     * List all companies (POST list endpoint).
     * POST /companies/list
     * Optional body/query pagination: per_page, starting_after
     */
    async listCompanies(params = {}) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.companiesList,
                body: params || {},
            })
        );
    }

    /**
     * Retrieve a company by Intercom id.
     * GET /companies/{company_id}
     */
    async getCompany(companyId) {
        return this._get({
            url: this.baseUrl + this.URLs.companyById(companyId),
        });
    }

    /**
     * Create or update a company.
     * POST /companies
     */
    async createOrUpdateCompany(body) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.companies,
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
     * Find a tag by id.
     * GET /tags/{tag_id}
     */
    async getTag(tagId) {
        return this._get({
            url: this.baseUrl + this.URLs.tagById(tagId),
        });
    }

    /**
     * Create a tag (or tag a contact/company when body includes those ids).
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

    // ---- Webhooks (local verify; subscriptions are Developer Hub app config)

    /**
     * Verify an Intercom webhook notification signature.
     *
     * Algorithm (https://developers.intercom.com/docs/webhooks/webhook-signatures):
     *   signature = 'sha1=' + hex(HMAC-SHA1(client_secret, rawBody))
     *   header    = X-Hub-Signature
     *
     * Webhook *subscriptions* (topics + HTTPS endpoint) are configured in the
     * Developer Hub for the app — there is no REST CRUD for them in the public
     * OpenAPI (2.17).
     *
     * @param {Object} args
     * @param {Object} [args.headers]
     * @param {string|Buffer} [args.rawBody]
     * @param {*} [args.body]
     * @param {string} [args.secret] - Defaults to webhookSecret / client_secret
     * @returns {{ valid: boolean, reason?: string }}
     */
    verifyWebhookSignature({
        headers = {},
        rawBody,
        body,
        secret,
    } = {}) {
        const token = secret || this.webhookSecret;
        if (!token || typeof token !== 'string') {
            return { valid: false, reason: 'missing webhook secret' };
        }

        const signature = _header(headers, SIGNATURE_HEADER);
        if (!signature) {
            return { valid: false, reason: `missing ${SIGNATURE_HEADER}` };
        }

        const payload = _payloadBuffer(rawBody, body);
        const digest = crypto
            .createHmac('sha1', token)
            .update(payload)
            .digest('hex');
        const expected = `sha1=${digest}`;

        if (!_safeEqual(expected, signature)) {
            return { valid: false, reason: 'signature mismatch' };
        }
        return { valid: true };
    }
}

function _header(headers, name) {
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

function _payloadBuffer(rawBody, body) {
    if (rawBody !== undefined && rawBody !== null) {
        return Buffer.isBuffer(rawBody)
            ? rawBody
            : Buffer.from(String(rawBody), 'utf8');
    }
    if (body === undefined || body === null) return Buffer.alloc(0);
    if (Buffer.isBuffer(body)) return body;
    if (typeof body === 'string') return Buffer.from(body, 'utf8');
    return Buffer.from(JSON.stringify(body), 'utf8');
}

function _safeEqual(a, b) {
    try {
        const x = Buffer.from(String(a), 'utf8');
        const y = Buffer.from(String(b), 'utf8');
        return x.length === y.length && crypto.timingSafeEqual(x, y);
    } catch (_e) {
        return false;
    }
}

module.exports = {
    Api,
    SIGNATURE_HEADER,
    DEFAULT_BASE_URL,
    DEFAULT_AUTH_HOST,
    DEFAULT_API_VERSION,
};
