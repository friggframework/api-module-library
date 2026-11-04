const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

const DEFAULT_BASE_URL = 'https://api.notion.com';
const DEFAULT_NOTION_VERSION = '2026-03-11';
const AUTHORIZE_URI = 'https://api.notion.com/v1/oauth/authorize';
const TOKEN_URI = 'https://api.notion.com/v1/oauth/token';
const SIGNATURE_HEADER = 'x-notion-signature';

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

/**
 * Bytes Notion signed. Prefer rawBody (re-serializing parsed JSON breaks HMAC).
 * When falling back to a parsed object, minify like JSON.stringify (Notion's sample).
 */
function whPayload(rawBody, body) {
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

function whSafeEqual(a, b) {
    const x = Buffer.from(String(a), 'utf8');
    const y = Buffer.from(String(b), 'utf8');
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * Notion API client.
 *
 * Auth: OAuth 2.0 authorization-code for public connections (marketplace).
 * Token endpoint uses HTTP Basic (`client_id:client_secret`) and a JSON body
 * (`grant_type`, `code` / `refresh_token`, `redirect_uri`). Every API request
 * requires `Authorization: Bearer <token>` and a `Notion-Version` header.
 *
 * Internal connection / PAT bearer tokens also work when passed as
 * `access_token` (no refresh). Webhook subscriptions are configured in the
 * Notion connection UI — there is no public REST API to create them.
 *
 * Base URL: https://api.notion.com
 * Docs: https://developers.notion.com/reference/intro
 * Official OpenAPI: https://developers.notion.com/openapi.json
 * Auth: https://developers.notion.com/guides/get-started/authorization
 * Webhooks: https://developers.notion.com/reference/webhooks
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'base_url', null) ||
            process.env.NOTION_BASE_URL ||
            DEFAULT_BASE_URL;

        this.notionVersion =
            get(params, 'notionVersion', null) ||
            get(params, 'notion_version', null) ||
            process.env.NOTION_VERSION ||
            DEFAULT_NOTION_VERSION;

        this.tokenUri = TOKEN_URI;
        this.authorizationUri = this._buildAuthorizationUri();

        // From the OAuth token response — used as the Frigg entity externalId.
        this.workspace_id = get(params, 'workspace_id', null);
        this.workspace_name = get(params, 'workspace_name', null);
        this.bot_id = get(params, 'bot_id', null);

        this.webhookVerificationToken =
            get(params, 'webhookVerificationToken', null) ||
            process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN ||
            null;

        this.URLs = {
            users: '/v1/users',
            userById: (userId) => `/v1/users/${userId}`,
            me: '/v1/users/me',
            pages: '/v1/pages',
            pageById: (pageId) => `/v1/pages/${pageId}`,
            databases: '/v1/databases',
            databaseById: (databaseId) => `/v1/databases/${databaseId}`,
            dataSources: '/v1/data_sources',
            dataSourceById: (dataSourceId) =>
                `/v1/data_sources/${dataSourceId}`,
            dataSourceQuery: (dataSourceId) =>
                `/v1/data_sources/${dataSourceId}/query`,
            search: '/v1/search',
            blockById: (blockId) => `/v1/blocks/${blockId}`,
            blockChildren: (blockId) => `/v1/blocks/${blockId}/children`,
            comments: '/v1/comments',
        };
    }

    _buildAuthorizationUri() {
        const params = new URLSearchParams({
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            response_type: 'code',
            owner: 'user',
        });
        if (this.state) params.set('state', this.state);
        return `${AUTHORIZE_URI}?${params.toString()}`;
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

    /** Notion requires Notion-Version on every request, including OAuth token. */
    _notionHeaders(extra = {}) {
        return {
            'Notion-Version': this.notionVersion,
            Accept: 'application/json',
            ...extra,
        };
    }

    /**
     * Notion's token endpoint uses Basic auth + JSON body (not form-urlencoded).
     * @see https://developers.notion.com/reference/create-a-token
     */
    async getTokenFromCode(code) {
        delete this.access_token;
        const options = {
            url: this.tokenUri,
            headers: this._notionHeaders({
                'Content-Type': 'application/json',
                Authorization: `Basic ${Buffer.from(
                    `${this.client_id}:${this.client_secret}`
                ).toString('base64')}`,
            }),
            body: {
                grant_type: 'authorization_code',
                code,
                redirect_uri: this.redirect_uri,
            },
        };
        const response = await this._post(options);
        await this.setTokens(response);
        return response;
    }

    /**
     * Refresh also uses Basic auth + JSON body; Notion rotates refresh_token.
     * @see https://developers.notion.com/reference/refresh-a-token
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const options = {
            url: this.tokenUri,
            headers: this._notionHeaders({
                'Content-Type': 'application/json',
                Authorization: `Basic ${Buffer.from(
                    `${this.client_id}:${this.client_secret}`
                ).toString('base64')}`,
            }),
            body: {
                grant_type: 'refresh_token',
                refresh_token: get(
                    refreshTokenObject,
                    'refresh_token',
                    this.refresh_token
                ),
            },
        };
        const response = await this._post(options);
        await this.setTokens(response);
        return response;
    }

    async setTokens(params) {
        await super.setTokens(params);
        const workspaceId = get(params, 'workspace_id', null);
        if (workspaceId) this.workspace_id = workspaceId;
        const workspaceName = get(params, 'workspace_name', null);
        if (workspaceName !== null && workspaceName !== undefined) {
            this.workspace_name = workspaceName;
        }
        const botId = get(params, 'bot_id', null);
        if (botId) this.bot_id = botId;
    }

    async addAuthHeaders(headers = {}) {
        const next = await super.addAuthHeaders(headers);
        next['Notion-Version'] = this.notionVersion;
        return next;
    }

    addJsonHeaders(options = {}) {
        options.headers = {
            ...this._notionHeaders({ 'Content-Type': 'application/json' }),
            ...options.headers,
        };
        return options;
    }

    async _get(options) {
        options.headers = {
            ...this._notionHeaders(),
            ...options.headers,
        };
        return super._get(options);
    }

    async _post(options, stringify) {
        // Token exchange already sets Content-Type; entity posts need JSON.
        if (
            !options.headers ||
            !options.headers['Content-Type'] ||
            options.headers['Content-Type'] === 'application/json'
        ) {
            this.addJsonHeaders(options);
        } else {
            options.headers = {
                ...this._notionHeaders(),
                ...options.headers,
            };
        }
        return super._post(options, stringify);
    }

    async _patch(options, stringify) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    async _delete(options) {
        options.headers = {
            ...this._notionHeaders(),
            ...options.headers,
        };
        return super._delete(options);
    }

    // ---- Users / identity --------------------------------------------------

    /**
     * Retrieve the bot user for the current token.
     * GET /v1/users/me
     * @see https://developers.notion.com/reference/get-self
     */
    async getSelf() {
        return this._get({ url: this.baseUrl + this.URLs.me });
    }

    /**
     * List users in the workspace.
     * GET /v1/users
     * @see https://developers.notion.com/reference/get-users
     */
    async listUsers(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.users,
            query,
        });
    }

    /**
     * Retrieve a user by id.
     * GET /v1/users/{user_id}
     * @see https://developers.notion.com/reference/get-user
     */
    async getUser(userId) {
        return this._get({
            url: this.baseUrl + this.URLs.userById(userId),
        });
    }

    // ---- Pages -------------------------------------------------------------

    /**
     * Create a page.
     * POST /v1/pages
     * @see https://developers.notion.com/reference/post-page
     */
    async createPage(body) {
        return this._post({
            url: this.baseUrl + this.URLs.pages,
            body,
        });
    }

    /**
     * Retrieve a page.
     * GET /v1/pages/{page_id}
     * Capability manifest name: retrievePage
     * @see https://developers.notion.com/reference/retrieve-a-page
     */
    async retrievePage(pageId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.pageById(pageId),
            query,
        });
    }

    /**
     * Update a page (properties, icon, cover, archived, in_trash, etc.).
     * PATCH /v1/pages/{page_id}
     * @see https://developers.notion.com/reference/patch-page
     */
    async updatePage(pageId, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.pageById(pageId),
            body,
        });
    }

    // ---- Databases ---------------------------------------------------------

    /**
     * Create a database (and its initial data source).
     * POST /v1/databases
     * @see https://developers.notion.com/reference/create-database
     */
    async createDatabase(body) {
        return this._post({
            url: this.baseUrl + this.URLs.databases,
            body,
        });
    }

    /**
     * Retrieve a database.
     * GET /v1/databases/{database_id}
     * @see https://developers.notion.com/reference/retrieve-database
     */
    async retrieveDatabase(databaseId) {
        return this._get({
            url: this.baseUrl + this.URLs.databaseById(databaseId),
        });
    }

    /**
     * Update a database (title, description, icon, cover, …).
     * PATCH /v1/databases/{database_id}
     * @see https://developers.notion.com/reference/update-database
     */
    async updateDatabase(databaseId, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.databaseById(databaseId),
            body,
        });
    }

    /**
     * Search for databases shared with the connection (title filter).
     * POST /v1/search with filter object=database.
     * Capability manifest name: searchDatabases
     * @see https://developers.notion.com/reference/post-search
     */
    async searchDatabases({ query, start_cursor, page_size, sort } = {}) {
        const body = {
            filter: { property: 'object', value: 'database' },
        };
        if (query !== undefined) body.query = query;
        if (start_cursor !== undefined) body.start_cursor = start_cursor;
        if (page_size !== undefined) body.page_size = page_size;
        if (sort !== undefined) body.sort = sort;
        return this._post({
            url: this.baseUrl + this.URLs.search,
            body,
        });
    }

    /**
     * Query a data source. As of Notion-Version 2025-09-03 / 2026-03-11 the
     * former `POST /v1/databases/{id}/query` path is replaced by
     * `POST /v1/data_sources/{data_source_id}/query`. The capability manifest
     * still names this `queryDatabase` and passes `databaseId` — callers should
     * pass a **data source id** (or the sole data source under a database).
     *
     * @see https://developers.notion.com/reference/query-a-data-source
     */
    async queryDatabase(databaseId, body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.dataSourceQuery(databaseId),
            body,
        });
    }

    // ---- Data sources ------------------------------------------------------

    /**
     * Retrieve a data source.
     * GET /v1/data_sources/{data_source_id}
     * @see https://developers.notion.com/reference/retrieve-a-data-source
     */
    async retrieveDataSource(dataSourceId) {
        return this._get({
            url: this.baseUrl + this.URLs.dataSourceById(dataSourceId),
        });
    }

    /**
     * Update a data source.
     * PATCH /v1/data_sources/{data_source_id}
     * @see https://developers.notion.com/reference/update-a-data-source
     */
    async updateDataSource(dataSourceId, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.dataSourceById(dataSourceId),
            body,
        });
    }

    // ---- Blocks ------------------------------------------------------------

    /**
     * Retrieve a block.
     * GET /v1/blocks/{block_id}
     * @see https://developers.notion.com/reference/retrieve-a-block
     */
    async retrieveBlock(blockId) {
        return this._get({
            url: this.baseUrl + this.URLs.blockById(blockId),
        });
    }

    /**
     * List block children.
     * GET /v1/blocks/{block_id}/children
     * @see https://developers.notion.com/reference/get-block-children
     */
    async getBlockChildren(blockId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.blockChildren(blockId),
            query,
        });
    }

    /**
     * Append block children.
     * PATCH /v1/blocks/{block_id}/children
     * Capability manifest name: appendBlockChildren
     * @see https://developers.notion.com/reference/patch-block-children
     */
    async appendBlockChildren(blockId, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.blockChildren(blockId),
            body,
        });
    }

    /**
     * Update a block.
     * PATCH /v1/blocks/{block_id}
     * @see https://developers.notion.com/reference/update-a-block
     */
    async updateBlock(blockId, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.blockById(blockId),
            body,
        });
    }

    /**
     * Delete (archive) a block.
     * DELETE /v1/blocks/{block_id}
     * @see https://developers.notion.com/reference/delete-a-block
     */
    async deleteBlock(blockId) {
        return this._delete({
            url: this.baseUrl + this.URLs.blockById(blockId),
        });
    }

    // ---- Search / comments -------------------------------------------------

    /**
     * Search pages and data sources shared with the connection.
     * POST /v1/search
     * @see https://developers.notion.com/reference/post-search
     */
    async search(body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.search,
            body,
        });
    }

    /**
     * List comments on a page or block.
     * GET /v1/comments?block_id=
     * @see https://developers.notion.com/reference/list-comments
     */
    async listComments(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.comments,
            query,
        });
    }

    /**
     * Create a comment.
     * POST /v1/comments
     * @see https://developers.notion.com/reference/create-a-comment
     */
    async createComment(body) {
        return this._post({
            url: this.baseUrl + this.URLs.comments,
            body,
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * Verify an inbound Notion webhook signature.
     *
     * Notion signs the raw request body with HMAC-SHA256 using the subscription
     * `verification_token`, and sends `X-Notion-Signature: sha256=<hex>`.
     * Subscriptions are created in the connection UI (no REST create API).
     *
     * @see https://developers.notion.com/reference/webhooks
     * @returns {Promise<boolean>}
     */
    async verifyWebhookSignature({ headers, body, rawBody } = {}) {
        try {
            const secret =
                this.webhookVerificationToken ||
                process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;
            if (!secret) return false;
            const signature = whHeader(headers, SIGNATURE_HEADER);
            if (!signature) return false;
            const payload = whPayload(rawBody, body);
            const expected = `sha256=${crypto
                .createHmac('sha256', String(secret))
                .update(payload)
                .digest('hex')}`;
            return whSafeEqual(expected, signature);
        } catch (_e) {
            return false;
        }
    }
}

module.exports = {
    Api,
    DEFAULT_BASE_URL,
    DEFAULT_NOTION_VERSION,
    SIGNATURE_HEADER,
};
