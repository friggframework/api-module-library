const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Mailchimp Marketing API client (v3.0).
 *
 * Primary auth (Marketplace / multi-tenant): OAuth 2.0 authorization code.
 *   Authorize: https://login.mailchimp.com/oauth2/authorize
 *   Token:     https://login.mailchimp.com/oauth2/token
 *   Metadata:  GET https://login.mailchimp.com/oauth2/metadata
 *              Authorization: OAuth <access_token>
 *              → { dc, api_endpoint, ... } for the account data center
 *   API calls: Authorization: Bearer <access_token>
 *   Tokens do not expire; there is no refresh_token.
 *   Docs: https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/
 *         https://mailchimp.com/developer/marketing/api-concepts/authentication/oauth-2/
 *
 * Secondary auth (single-account / local): API key.
 *   Authorization: Bearer <api_key>
 *   The key ends with `-<dc>` (e.g. …-us6); that suffix becomes server_prefix.
 *   Docs: https://mailchimp.com/developer/marketing/docs/fundamentals/
 *
 * Base URL: https://api.mailchimp.com/3.0 by default (as in the current API
 * reference). When `server_prefix` / `dc` is known, requests go to
 * https://{dc}.api.mailchimp.com/3.0 instead.
 *
 * This client mirrors `./mailchimp.openapi.yaml` 1:1 (one method per
 * operationId). Keep them in sync.
 */
class Api extends OAuth2Requester {
    static DEFAULT_BASE_URL = 'https://api.mailchimp.com/3.0';
    static METADATA_URL = 'https://login.mailchimp.com/oauth2/metadata';
    static AUTHORIZE_BASE = 'https://login.mailchimp.com/oauth2/authorize';
    static TOKEN_URI = 'https://login.mailchimp.com/oauth2/token';

    constructor(params = {}) {
        super(params);

        this.tokenUri = Api.TOKEN_URI;
        this.authorizeBase = Api.AUTHORIZE_BASE;

        this.access_token = get(params, 'access_token', null);
        this.api_key =
            get(params, 'api_key', null) || get(params, 'apiKey', null) || null;

        // Data-center / server prefix (e.g. "us6"). Required for reliable
        // routing; discovered via OAuth metadata or the API-key suffix.
        this.server_prefix =
            get(params, 'server_prefix', null) ||
            get(params, 'dc', null) ||
            process.env.MAILCHIMP_SERVER_PREFIX ||
            null;

        if (!this.server_prefix && this.api_key) {
            this.server_prefix = Api.dcFromApiKey(this.api_key);
        }

        const explicitBase = get(params, 'base_url', null);
        this.baseUrl = explicitBase || Api.buildBaseUrl(this.server_prefix);

        this.authorizationUri = null;

        const enc = (id) => encodeURIComponent(String(id));
        this.URLs = {
            root: '/',
            ping: '/ping',
            lists: '/lists',
            listById: (listId) => `/lists/${enc(listId)}`,
            members: (listId) => `/lists/${enc(listId)}/members`,
            memberByHash: (listId, hash) =>
                `/lists/${enc(listId)}/members/${enc(hash)}`,
            campaigns: '/campaigns',
            campaignById: (campaignId) => `/campaigns/${enc(campaignId)}`,
            webhooks: (listId) => `/lists/${enc(listId)}/webhooks`,
            webhookById: (listId, webhookId) =>
                `/lists/${enc(listId)}/webhooks/${enc(webhookId)}`,
        };
    }

    /** Build https://{dc}.api.mailchimp.com/3.0 or the default host. */
    static buildBaseUrl(serverPrefix) {
        if (serverPrefix) {
            return `https://${serverPrefix}.api.mailchimp.com/3.0`;
        }
        return Api.DEFAULT_BASE_URL;
    }

    /** Extract the data-center suffix from an API key (`…-us6` → `us6`). */
    static dcFromApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') return null;
        const at = apiKey.lastIndexOf('-');
        if (at === -1 || at === apiKey.length - 1) return null;
        return apiKey.slice(at + 1);
    }

    /**
     * MD5 of the lowercase email — Mailchimp's subscriber_hash path param.
     * Docs: https://mailchimp.com/developer/marketing/docs/methods-parameters/
     */
    static subscriberHash(email) {
        return crypto
            .createHash('md5')
            .update(String(email).toLowerCase())
            .digest('hex');
    }

    setServerPrefix(serverPrefix) {
        this.server_prefix = serverPrefix || null;
        this.baseUrl = Api.buildBaseUrl(this.server_prefix);
    }

    setApiKey(apiKey) {
        this.api_key = apiKey;
        if (!this.server_prefix) {
            const dc = Api.dcFromApiKey(apiKey);
            if (dc) this.setServerPrefix(dc);
        }
    }

    // ---- Auth --------------------------------------------------------------

    /**
     * Build the OAuth authorize URL.
     * Official params: response_type, client_id, redirect_uri
     * (no scopes on Mailchimp Marketing OAuth).
     */
    getAuthorizationUri() {
        const url = new URL(this.authorizeBase);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('client_id', this.client_id || '');
        url.searchParams.set('redirect_uri', this.redirect_uri || '');
        if (this.state) {
            url.searchParams.set('state', this.state);
        }
        this.authorizationUri = url.toString();
        return this.authorizationUri;
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri(),
            type: 'oauth2',
        };
    }

    /**
     * Exchange authorization code for an access token.
     * Body: application/x-www-form-urlencoded with grant_type, client_id,
     * client_secret, redirect_uri, code. No refresh_token is returned.
     */
    async getTokenFromCode(code) {
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        params.append('redirect_uri', this.redirect_uri);
        params.append('code', code);

        const options = {
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            url: this.tokenUri,
        };

        // Don't send a stale Bearer on the token endpoint.
        this.access_token = undefined;
        const response = await this._post(options, false);
        await this.setTokens(response);

        // Discover the account data center so subsequent API calls route
        // correctly. Persist server_prefix via apiPropertiesToPersist.
        try {
            await this.applyMetadata();
        } catch (_err) {
            // Leave server_prefix unset; caller may set it explicitly.
        }
        return response;
    }

    /**
     * Mailchimp access tokens do not expire and have no refresh_token.
     * Override to avoid accidental refresh attempts from the base class.
     */
    async refreshAccessToken() {
        throw new Error(
            'Mailchimp OAuth access tokens do not expire and have no refresh_token. Re-authorize the user if the token was revoked.'
        );
    }

    /**
     * GET https://login.mailchimp.com/oauth2/metadata
     * Header: Authorization: OAuth <access_token>
     * Response includes `dc` and `api_endpoint`.
     */
    async getOAuthMetadata() {
        if (!this.access_token) {
            throw new Error('Mailchimp getOAuthMetadata requires access_token');
        }
        // Metadata requires `Authorization: OAuth …`, not Bearer. Flag the
        // next addAuthHeaders call; see addAuthHeaders below.
        this._useOAuthMetadataHeader = true;
        try {
            return await this._get({
                url: Api.METADATA_URL,
                headers: { Accept: 'application/json' },
            });
        } finally {
            this._useOAuthMetadataHeader = false;
        }
    }

    /** Fetch OAuth metadata and set server_prefix / baseUrl from `dc`. */
    async applyMetadata() {
        const meta = await this.getOAuthMetadata();
        const dc = meta && (meta.dc || meta.server_prefix);
        if (dc) {
            this.setServerPrefix(dc);
        } else if (meta && meta.api_endpoint) {
            // api_endpoint is like https://us1.api.mailchimp.com
            try {
                const host = new URL(meta.api_endpoint).hostname;
                const match = host.match(/^([^.]+)\.api\.mailchimp\.com$/i);
                if (match) this.setServerPrefix(match[1]);
            } catch (_e) {
                // ignore malformed api_endpoint
            }
        }
        return meta;
    }

    /**
     * Prefer OAuth Bearer; fall back to API key Bearer when no access_token.
     * Official docs accept Bearer for both API keys and OAuth tokens.
     * Metadata endpoint is the exception — it requires `OAuth` (not Bearer).
     */
    async addAuthHeaders(headers = {}) {
        const h = { ...headers };
        delete h.Authorization;
        if (this._useOAuthMetadataHeader && this.access_token) {
            h.Authorization = `OAuth ${this.access_token}`;
        } else if (this.access_token) {
            h.Authorization = `Bearer ${this.access_token}`;
        } else if (this.api_key) {
            h.Authorization = `Bearer ${this.api_key}`;
        }
        return h;
    }

    isAuthenticated() {
        return Boolean(this.access_token || this.api_key);
    }

    addJsonHeaders(options = {}) {
        const jsonHeaders = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
        options.headers = {
            ...jsonHeaders,
            ...options.headers,
        };
        return options;
    }

    async _post(options, stringify) {
        // Token / form posts pass stringify=false and set their own Content-Type.
        if (stringify !== false) {
            this.addJsonHeaders(options);
        }
        return super._post(options, stringify);
    }

    async _patch(options, stringify) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    async _put(options, stringify) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    // ---- Account / identity ------------------------------------------------

    /**
     * API root — account identity and resource links.
     * GET /
     * Docs: https://mailchimp.com/developer/marketing/api/root/list
     */
    async getAccount(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.root,
            query: params,
        };
        return this._get(options);
    }

    /**
     * Health check that does not return account-specific information.
     * GET /ping
     * Docs: https://mailchimp.com/developer/marketing/api/ping/
     */
    async ping() {
        const options = {
            url: this.baseUrl + this.URLs.ping,
        };
        return this._get(options);
    }

    // ---- Lists / Audiences -------------------------------------------------

    /**
     * List audiences.
     * GET /lists
     * Docs: https://mailchimp.com/developer/marketing/api/lists/list
     */
    async listLists(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.lists,
            query: params,
        };
        return this._get(options);
    }

    /**
     * Get a single audience.
     * GET /lists/{list_id}
     */
    async getList(listId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.listById(listId),
            query: params,
        };
        return this._get(options);
    }

    /**
     * Create an audience.
     * POST /lists
     * Required body fields per docs: name, contact, permission_reminder,
     * campaign_defaults, email_type_option.
     */
    async createList(body) {
        const options = {
            url: this.baseUrl + this.URLs.lists,
            body,
        };
        return this._post(options);
    }

    /**
     * Update an audience.
     * PATCH /lists/{list_id}
     */
    async updateList(listId, body) {
        const options = {
            url: this.baseUrl + this.URLs.listById(listId),
            body,
        };
        return this._patch(options);
    }

    // ---- List members ------------------------------------------------------

    /**
     * List members in an audience.
     * GET /lists/{list_id}/members
     */
    async listMembers(listId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.members(listId),
            query: params,
        };
        return this._get(options);
    }

    /**
     * Get a member by subscriber_hash (MD5 of lowercase email) or email.
     * GET /lists/{list_id}/members/{subscriber_hash}
     */
    async getMember(listId, subscriberHashOrEmail, params = {}) {
        const hash = subscriberHashOrEmail.includes('@')
            ? Api.subscriberHash(subscriberHashOrEmail)
            : subscriberHashOrEmail;
        const options = {
            url: this.baseUrl + this.URLs.memberByHash(listId, hash),
            query: params,
        };
        return this._get(options);
    }

    /**
     * Add a member to an audience.
     * POST /lists/{list_id}/members
     * Required: email_address, status.
     */
    async createMember(listId, body, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.members(listId),
            query: params,
            body,
        };
        return this._post(options);
    }

    /**
     * Update a member (partial).
     * PATCH /lists/{list_id}/members/{subscriber_hash}
     */
    async updateMember(listId, subscriberHashOrEmail, body, params = {}) {
        const hash = subscriberHashOrEmail.includes('@')
            ? Api.subscriberHash(subscriberHashOrEmail)
            : subscriberHashOrEmail;
        const options = {
            url: this.baseUrl + this.URLs.memberByHash(listId, hash),
            query: params,
            body,
        };
        return this._patch(options);
    }

    /**
     * Add or update a member (upsert).
     * PUT /lists/{list_id}/members/{subscriber_hash}
     */
    async upsertMember(listId, subscriberHashOrEmail, body, params = {}) {
        const hash = subscriberHashOrEmail.includes('@')
            ? Api.subscriberHash(subscriberHashOrEmail)
            : subscriberHashOrEmail;
        const options = {
            url: this.baseUrl + this.URLs.memberByHash(listId, hash),
            query: params,
            body,
        };
        return this._put(options);
    }

    // ---- Campaigns ---------------------------------------------------------

    /**
     * List campaigns.
     * GET /campaigns
     * Docs: https://mailchimp.com/developer/marketing/api/campaigns/list-campaigns
     */
    async listCampaigns(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.campaigns,
            query: params,
        };
        return this._get(options);
    }

    /**
     * Get a campaign.
     * GET /campaigns/{campaign_id}
     */
    async getCampaign(campaignId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.campaignById(campaignId),
            query: params,
        };
        return this._get(options);
    }

    /**
     * Create a campaign.
     * POST /campaigns
     */
    async createCampaign(body) {
        const options = {
            url: this.baseUrl + this.URLs.campaigns,
            body,
        };
        return this._post(options);
    }

    /**
     * Update a campaign.
     * PATCH /campaigns/{campaign_id}
     */
    async updateCampaign(campaignId, body) {
        const options = {
            url: this.baseUrl + this.URLs.campaignById(campaignId),
            body,
        };
        return this._patch(options);
    }

    // ---- List webhooks -----------------------------------------------------

    /**
     * List webhooks for an audience.
     * GET /lists/{list_id}/webhooks
     */
    async listWebhooks(listId) {
        const options = {
            url: this.baseUrl + this.URLs.webhooks(listId),
        };
        return this._get(options);
    }

    /**
     * Get a webhook.
     * GET /lists/{list_id}/webhooks/{webhook_id}
     */
    async getWebhook(listId, webhookId) {
        const options = {
            url: this.baseUrl + this.URLs.webhookById(listId, webhookId),
        };
        return this._get(options);
    }

    /**
     * Create a list webhook.
     * POST /lists/{list_id}/webhooks
     * Body: { url, events?, sources? }
     * Response may include `signing_secret` exactly once.
     *
     * Recommend appending `?account_id={account_id}` to `url` so the Tier 3
     * webhook extension can reverse-look up the owning integration (classic
     * payloads carry list_id but not account_id).
     */
    async createWebhook(listId, body) {
        const options = {
            url: this.baseUrl + this.URLs.webhooks(listId),
            body,
        };
        return this._post(options);
    }

    /**
     * Update a list webhook.
     * PATCH /lists/{list_id}/webhooks/{webhook_id}
     */
    async updateWebhook(listId, webhookId, body) {
        const options = {
            url: this.baseUrl + this.URLs.webhookById(listId, webhookId),
            body,
        };
        return this._patch(options);
    }

    /**
     * Delete a list webhook.
     * DELETE /lists/{list_id}/webhooks/{webhook_id}
     */
    async deleteWebhook(listId, webhookId) {
        const options = {
            url: this.baseUrl + this.URLs.webhookById(listId, webhookId),
        };
        return this._delete(options);
    }
}

module.exports = { Api };
