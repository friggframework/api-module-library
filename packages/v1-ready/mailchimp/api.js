const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Mailchimp Marketing API client.
 *
 * Contract: official codegen Swagger 2.0 (v3.0.91)
 *   https://raw.githubusercontent.com/mailchimp/mailchimp-client-lib-codegen/main/spec/marketing.json
 * Curated OAS subset: ./mailchimp.openapi.yaml — operationIds match Api methods 1:1.
 *
 * Auth (vendor swagger `securityDefinitions.basicAuth`):
 *   HTTP Basic with username `anystring` and password = API key or OAuth access token.
 *   Fundamentals also document Bearer; this client uses Basic to match the swagger.
 *
 * OAuth 2 (Marketplace / multi-tenant; not in the Marketing swagger host):
 *   Authorize: https://login.mailchimp.com/oauth2/authorize
 *   Token:     https://login.mailchimp.com/oauth2/token
 *   Metadata:  GET https://login.mailchimp.com/oauth2/metadata
 *              Authorization: OAuth <access_token> → { dc, api_endpoint, ... }
 *   Tokens do not expire; there is no refresh_token.
 *
 * Base URL (vendor swagger host + basePath):
 *   Default: https://server.api.mailchimp.com/3.0
 *   (`server` is the data-center placeholder). When `server_prefix` / `dc` is
 *   known: https://{dc}.api.mailchimp.com/3.0.
 */
class Api extends OAuth2Requester {
    static DEFAULT_BASE_URL = 'https://server.api.mailchimp.com/3.0';
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

    /** Build https://{dc}.api.mailchimp.com/3.0 or the swagger default host. */
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
     * MD5 of the lowercase email — Mailchimp's subscriber_hash path param
     * (documented in Fundamentals / Methods and Parameters).
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

        this.access_token = undefined;
        const response = await this._post(options, false);
        await this.setTokens(response);

        try {
            await this.applyMetadata();
        } catch (_err) {
            // Leave server_prefix unset; caller may set it explicitly.
        }
        return response;
    }

    async refreshAccessToken() {
        throw new Error(
            'Mailchimp OAuth access tokens do not expire and have no refresh_token. Re-authorize the user if the token was revoked.'
        );
    }

    async getOAuthMetadata() {
        if (!this.access_token) {
            throw new Error('Mailchimp getOAuthMetadata requires access_token');
        }
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

    async applyMetadata() {
        const meta = await this.getOAuthMetadata();
        const dc = meta && (meta.dc || meta.server_prefix);
        if (dc) {
            this.setServerPrefix(dc);
        } else if (meta && meta.api_endpoint) {
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
     * Marketing API auth per vendor swagger: HTTP Basic
     * (`anystring` : API key or OAuth access token).
     * OAuth metadata endpoint still requires `Authorization: OAuth …`.
     */
    async addAuthHeaders(headers = {}) {
        const h = { ...headers };
        delete h.Authorization;
        if (this._useOAuthMetadataHeader && this.access_token) {
            h.Authorization = `OAuth ${this.access_token}`;
        } else {
            const token = this.access_token || this.api_key;
            if (token) {
                h.Authorization = `Basic ${Buffer.from(
                    `anystring:${token}`
                ).toString('base64')}`;
            }
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

    // ---- root / ping (vendor operationIds) ---------------------------------

    /** GET / — getRoot */
    async getRoot(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.root,
            query: params,
        });
    }

    /** GET /ping — getPing */
    async getPing() {
        return this._get({
            url: this.baseUrl + this.URLs.ping,
        });
    }

    // ---- lists -------------------------------------------------------------

    /** GET /lists — getLists */
    async getLists(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.lists,
            query: params,
        });
    }

    /** POST /lists — postLists */
    async postLists(body) {
        return this._post({
            url: this.baseUrl + this.URLs.lists,
            body,
        });
    }

    /** GET /lists/{list_id} — getListsId */
    async getListsId(listId, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.listById(listId),
            query: params,
        });
    }

    /** PATCH /lists/{list_id} — patchListsId */
    async patchListsId(listId, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.listById(listId),
            body,
        });
    }

    // ---- list members ------------------------------------------------------

    /** GET /lists/{list_id}/members — getListsIdMembers */
    async getListsIdMembers(listId, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.members(listId),
            query: params,
        });
    }

    /** POST /lists/{list_id}/members — postListsIdMembers */
    async postListsIdMembers(listId, body, params = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.members(listId),
            query: params,
            body,
        });
    }

    /**
     * GET /lists/{list_id}/members/{subscriber_hash} — getListsIdMembersId
     * Accepts subscriber_hash or an email (hashed via Api.subscriberHash).
     */
    async getListsIdMembersId(listId, subscriberHashOrEmail, params = {}) {
        const hash = String(subscriberHashOrEmail).includes('@')
            ? Api.subscriberHash(subscriberHashOrEmail)
            : subscriberHashOrEmail;
        return this._get({
            url: this.baseUrl + this.URLs.memberByHash(listId, hash),
            query: params,
        });
    }

    /** PATCH /lists/{list_id}/members/{subscriber_hash} — patchListsIdMembersId */
    async patchListsIdMembersId(
        listId,
        subscriberHashOrEmail,
        body,
        params = {}
    ) {
        const hash = String(subscriberHashOrEmail).includes('@')
            ? Api.subscriberHash(subscriberHashOrEmail)
            : subscriberHashOrEmail;
        return this._patch({
            url: this.baseUrl + this.URLs.memberByHash(listId, hash),
            query: params,
            body,
        });
    }

    /** PUT /lists/{list_id}/members/{subscriber_hash} — putListsIdMembersId */
    async putListsIdMembersId(
        listId,
        subscriberHashOrEmail,
        body,
        params = {}
    ) {
        const hash = String(subscriberHashOrEmail).includes('@')
            ? Api.subscriberHash(subscriberHashOrEmail)
            : subscriberHashOrEmail;
        return this._put({
            url: this.baseUrl + this.URLs.memberByHash(listId, hash),
            query: params,
            body,
        });
    }

    // ---- campaigns ---------------------------------------------------------

    /** GET /campaigns — getCampaigns */
    async getCampaigns(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.campaigns,
            query: params,
        });
    }

    /** POST /campaigns — postCampaigns */
    async postCampaigns(body) {
        return this._post({
            url: this.baseUrl + this.URLs.campaigns,
            body,
        });
    }

    /** GET /campaigns/{campaign_id} — getCampaignsId */
    async getCampaignsId(campaignId, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.campaignById(campaignId),
            query: params,
        });
    }

    /** PATCH /campaigns/{campaign_id} — patchCampaignsId (body requires settings) */
    async patchCampaignsId(campaignId, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.campaignById(campaignId),
            body,
        });
    }

    // ---- list webhooks -----------------------------------------------------

    /** GET /lists/{list_id}/webhooks — getListsIdWebhooks */
    async getListsIdWebhooks(listId) {
        return this._get({
            url: this.baseUrl + this.URLs.webhooks(listId),
        });
    }

    /** POST /lists/{list_id}/webhooks — postListsIdWebhooks */
    async postListsIdWebhooks(listId, body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks(listId),
            body,
        });
    }

    /** GET /lists/{list_id}/webhooks/{webhook_id} — getListsIdWebhooksId */
    async getListsIdWebhooksId(listId, webhookId) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookById(listId, webhookId),
        });
    }

    /** PATCH /lists/{list_id}/webhooks/{webhook_id} — patchListsIdWebhooksId */
    async patchListsIdWebhooksId(listId, webhookId, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.webhookById(listId, webhookId),
            body,
        });
    }

    /** DELETE /lists/{list_id}/webhooks/{webhook_id} — deleteListsIdWebhooksId */
    async deleteListsIdWebhooksId(listId, webhookId) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(listId, webhookId),
        });
    }
}

module.exports = { Api };
