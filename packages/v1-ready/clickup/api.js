const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

// Official OpenAPI servers[0].url — paths below include the /v2 prefix.
// https://developer.clickup.com/openapi/clickup-api-v2-reference.json
const DEFAULT_BASE_URL = 'https://api.clickup.com/api';
const AUTHORIZE_URI = 'https://app.clickup.com/api';
const TOKEN_URI = 'https://api.clickup.com/api/v2/oauth/token';
const SIGNATURE_HEADER = 'x-signature';

// ---- webhook signature helpers --------------------------------------------

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
 * Bytes ClickUp signed. Prefer rawBody — re-serializing parsed JSON with
 * whitespace breaks HMAC. Docs require minify-style stringify when falling back.
 * @see https://developer.clickup.com/docs/webhooksignature
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
 * ClickUp public API v2 client.
 *
 * Auth: OAuth 2.0 authorization-code for marketplace / shared apps, or a
 * personal API token (`pk_…`) for individual use. OAuth access tokens currently
 * do not expire (subject to change) and ClickUp does not return refresh_token.
 *
 * Headers:
 *   - OAuth: `Authorization: Bearer {access_token}`
 *   - Personal: `Authorization: {personal_token}` (no Bearer prefix)
 *
 * Base URL: https://api.clickup.com/api (paths are /v2/…)
 * Docs: https://developer.clickup.com/
 * Auth: https://developer.clickup.com/docs/authentication
 * Official OpenAPI: https://developer.clickup.com/openapi/clickup-api-v2-reference.json
 * Webhooks: https://developer.clickup.com/docs/webhooks
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'base_url', null) ||
            process.env.CLICKUP_BASE_URL ||
            DEFAULT_BASE_URL;

        this.tokenUri = TOKEN_URI;

        this.client_id =
            this.client_id || process.env.CLICKUP_CLIENT_ID || null;
        this.client_secret =
            this.client_secret || process.env.CLICKUP_CLIENT_SECRET || null;
        this.redirect_uri =
            this.redirect_uri ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/clickup`
                : null);
        // Vendor OpenAPI documents no OAuth scopes (Authorization_Token apiKey
        // header only). Keep env passthrough for future use.
        this.scope =
            this.scope || process.env.CLICKUP_SCOPE || null;

        // ClickUp OAuth tokens currently do not expire / refresh.
        // Token response schema is only `{ access_token }` (no refresh_token).
        this.isRefreshable = false;

        this.access_token =
            get(params, 'access_token', null) ||
            get(params, 'api_token', null) ||
            get(params, 'api_key', null) ||
            this.access_token ||
            null;

        this.authorizationUri = this._buildAuthorizationUri();

        this.URLs = {
            oauthToken: '/v2/oauth/token',
            user: '/v2/user',
            team: '/v2/team',
            spaces: (teamId) => `/v2/team/${teamId}/space`,
            spaceById: (spaceId) => `/v2/space/${spaceId}`,
            folders: (spaceId) => `/v2/space/${spaceId}/folder`,
            listsInFolder: (folderId) => `/v2/folder/${folderId}/list`,
            folderlessLists: (spaceId) => `/v2/space/${spaceId}/list`,
            tasksInList: (listId) => `/v2/list/${listId}/task`,
            taskById: (taskId) => `/v2/task/${taskId}`,
            webhooks: (teamId) => `/v2/team/${teamId}/webhook`,
            webhookById: (webhookId) => `/v2/webhook/${webhookId}`,
        };
    }

    _buildAuthorizationUri() {
        const params = new URLSearchParams({
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
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

    /**
     * ClickUp token exchange accepts JSON or form-urlencoded with
     * `client_id`, `client_secret`, and `code` only (no grant_type /
     * redirect_uri in the published OpenAPI).
     * @see https://developer.clickup.com/reference/getaccesstoken
     */
    async getTokenFromCode(code) {
        delete this.access_token;
        const options = {
            url: this.tokenUri,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: {
                client_id: this.client_id,
                client_secret: this.client_secret,
                code,
            },
        };
        const response = await this._post(options);
        await this.setTokens(response);
        return response;
    }

    async setTokens(params) {
        this.access_token = get(params, 'access_token');
        const newRefreshToken = get(params, 'refresh_token', null);
        if (newRefreshToken) {
            this.refresh_token = newRefreshToken;
        }
        const accessExpiresIn = get(params, 'expires_in', null);
        if (accessExpiresIn) {
            this.accessTokenExpire = new Date(
                Date.now() + accessExpiresIn * 1000
            );
        }
        await this.notify(this.DLGT_TOKEN_UPDATE);
    }

    /**
     * Personal tokens (`pk_…`) use a raw Authorization value; OAuth tokens use
     * Bearer. @see https://developer.clickup.com/docs/authentication
     */
    async addAuthHeaders(headers = {}) {
        delete headers.Authorization;
        if (!this.access_token) return headers;
        const raw = String(this.access_token).replace(/^Bearer\s+/i, '');
        headers.Authorization = raw.startsWith('pk_')
            ? raw
            : `Bearer ${raw}`;
        return headers;
    }

    isAuthenticated() {
        return !!this.access_token;
    }

    addJsonHeaders(options = {}) {
        options.headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...options.headers,
        };
        return options;
    }

    async _post(options, stringify) {
        if (
            !options.headers ||
            !options.headers['Content-Type'] ||
            options.headers['Content-Type'] === 'application/json'
        ) {
            this.addJsonHeaders(options);
        }
        return super._post(options, stringify);
    }

    async _put(options, stringify) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    // ---- Auth / identity ---------------------------------------------------

    /**
     * Get the authenticated ClickUp user.
     * GET /v2/user
     * Official operationId: GetAuthorizedUser
     * @see https://developer.clickup.com/reference/getauthorizeduser
     */
    async getAuthorizedUser() {
        return this._get({ url: this.baseUrl + this.URLs.user });
    }

    /**
     * List Workspaces (teams) authorized for this token.
     * GET /v2/team
     * Official operationId: GetAuthorizedTeams
     * @see https://developer.clickup.com/reference/getauthorizedteams
     */
    async getAuthorizedTeams() {
        return this._get({ url: this.baseUrl + this.URLs.team });
    }

    // ---- Hierarchy ---------------------------------------------------------

    /**
     * List Spaces in a Workspace.
     * GET /v2/team/{team_id}/space
     * Official operationId: GetSpaces
     * @see https://developer.clickup.com/reference/getspaces
     */
    async getSpaces(teamId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.spaces(teamId),
            query,
        });
    }

    /**
     * Get one Space.
     * GET /v2/space/{space_id}
     * Official operationId: GetSpace
     * @see https://developer.clickup.com/reference/getspace
     */
    async getSpace(spaceId) {
        return this._get({
            url: this.baseUrl + this.URLs.spaceById(spaceId),
        });
    }

    /**
     * List Folders in a Space.
     * GET /v2/space/{space_id}/folder
     * Official operationId: GetFolders
     * @see https://developer.clickup.com/reference/getfolders
     */
    async getFolders(spaceId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.folders(spaceId),
            query,
        });
    }

    /**
     * List Lists inside a Folder.
     * GET /v2/folder/{folder_id}/list
     * Official operationId: GetLists
     * @see https://developer.clickup.com/reference/getlists
     */
    async getLists(folderId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.listsInFolder(folderId),
            query,
        });
    }

    /**
     * List folderless Lists in a Space.
     * GET /v2/space/{space_id}/list
     * Official operationId: GetFolderlessLists
     * @see https://developer.clickup.com/reference/getfolderlesslists
     */
    async getFolderlessLists(spaceId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.folderlessLists(spaceId),
            query,
        });
    }

    // ---- Tasks -------------------------------------------------------------

    /**
     * List tasks in a List.
     * GET /v2/list/{list_id}/task
     * Official operationId: GetTasks
     * @see https://developer.clickup.com/reference/gettasks
     */
    async getTasks(listId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.tasksInList(listId),
            query,
        });
    }

    /**
     * Get one task.
     * GET /v2/task/{task_id}
     * Official operationId: GetTask
     * @see https://developer.clickup.com/reference/gettask
     */
    async getTask(taskId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.taskById(taskId),
            query,
        });
    }

    /**
     * Create a task in a List.
     * POST /v2/list/{list_id}/task
     * Official operationId: CreateTask
     * @see https://developer.clickup.com/reference/createtask
     */
    async createTask(listId, body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.tasksInList(listId),
            body,
        });
    }

    /**
     * Update a task.
     * PUT /v2/task/{task_id}
     * Official operationId: UpdateTask
     * @see https://developer.clickup.com/reference/updatetask
     */
    async updateTask(taskId, body = {}, query = {}) {
        return this._put({
            url: this.baseUrl + this.URLs.taskById(taskId),
            query,
            body,
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * Create a Workspace webhook.
     * POST /v2/team/{team_id}/webhook
     * Official operationId: CreateWebhook
     * Response includes `webhook.secret` for HMAC verification.
     * @see https://developer.clickup.com/reference/createwebhook
     */
    async createWebhook(teamId, body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks(teamId),
            body,
        });
    }

    /**
     * List API-created webhooks for a Workspace (current user).
     * GET /v2/team/{team_id}/webhook
     * Official operationId: GetWebhooks
     * @see https://developer.clickup.com/reference/getwebhooks
     */
    async getWebhooks(teamId) {
        return this._get({
            url: this.baseUrl + this.URLs.webhooks(teamId),
        });
    }

    /**
     * Update a webhook.
     * PUT /v2/webhook/{webhook_id}
     * Official operationId: UpdateWebhook
     * @see https://developer.clickup.com/reference/updatewebhook
     */
    async updateWebhook(webhookId, body = {}) {
        return this._put({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
            body,
        });
    }

    /**
     * Delete a webhook.
     * DELETE /v2/webhook/{webhook_id}
     * Official operationId: DeleteWebhook
     * @see https://developer.clickup.com/reference/deletewebhook
     */
    async deleteWebhook(webhookId) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
        });
    }

    /**
     * Verify a ClickUp webhook `X-Signature` (HMAC-SHA256 hex of the raw body).
     * Secret is unique per webhook and returned by createWebhook.
     * @see https://developer.clickup.com/docs/webhooksignature
     */
    verifyWebhookSignature({
        headers,
        rawBody,
        body,
        secret,
    } = {}) {
        const key =
            secret ||
            process.env.CLICKUP_WEBHOOK_SECRET ||
            null;
        if (!key) {
            return { valid: false, reason: 'missing_secret' };
        }
        const provided = whHeader(headers, SIGNATURE_HEADER);
        if (!provided) {
            return { valid: false, reason: 'missing_signature_header' };
        }
        const payload = whPayload(rawBody, body);
        const expected = crypto
            .createHmac('sha256', String(key))
            .update(payload)
            .digest('hex');
        if (!whSafeEqual(expected, provided)) {
            return { valid: false, reason: 'signature_mismatch' };
        }
        return { valid: true };
    }
}

module.exports = { Api };
