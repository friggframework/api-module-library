const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Jira Cloud platform REST API v3 client (OAuth 2.0 / 3LO).
 *
 * Auth: Atlassian OAuth 2.0 authorization-code (3LO). Access tokens are sent as
 * `Authorization: Bearer <token>`. Token exchange uses JSON bodies against
 * `https://auth.atlassian.com/oauth/token`. Include `offline_access` (Atlassian
 * auth-server scope from the 3LO docs — not listed in swagger-v3 OAuth2 scopes)
 * to receive rotating refresh tokens.
 *
 * Base URL (OAuth): `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3`
 * The `cloudId` comes from GET https://api.atlassian.com/oauth/token/accessible-resources
 * and is persisted on the credential.
 *
 * Docs:
 *   https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/
 *   https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
 *   https://developer.atlassian.com/cloud/jira/platform/webhooks/
 * Official OpenAPI: https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json
 */

const AUTH_BASE = 'https://auth.atlassian.com/authorize';
const TOKEN_URI = 'https://auth.atlassian.com/oauth/token';
const ACCESSIBLE_RESOURCES_URI =
    'https://api.atlassian.com/oauth/token/accessible-resources';
const API_HOST = 'https://api.atlassian.com/ex/jira';

const DEFAULT_SCOPES = [
    'read:jira-user',
    'read:jira-work',
    'write:jira-work',
    'manage:jira-webhook',
    'offline_access',
].join(' ');

function base64UrlEncode(buf) {
    return Buffer.from(buf)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function base64UrlDecodeToBuffer(str) {
    const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
    return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * Verify an HS256 JWT (OAuth 2.0 dynamic webhook bearer token signed with the
 * app client secret). Returns { valid, payload?, reason? }.
 * Docs: https://developer.atlassian.com/cloud/jira/platform/webhooks/
 *   ("Webhooks authentication for OAuth 2.0 apps")
 */
function verifyHs256Jwt(token, secret) {
    if (!token || !secret) {
        return { valid: false, reason: 'missing_token_or_secret' };
    }
    const parts = String(token).replace(/^Bearer\s+/i, '').split('.');
    if (parts.length !== 3) {
        return { valid: false, reason: 'malformed_jwt' };
    }
    const [headerB64, payloadB64, signatureB64] = parts;
    let header;
    try {
        header = JSON.parse(base64UrlDecodeToBuffer(headerB64).toString('utf8'));
    } catch (_e) {
        return { valid: false, reason: 'invalid_header' };
    }
    if (header.alg && header.alg !== 'HS256') {
        return { valid: false, reason: `unsupported_alg:${header.alg}` };
    }
    const data = `${headerB64}.${payloadB64}`;
    const expected = base64UrlEncode(
        crypto.createHmac('sha256', secret).update(data).digest()
    );
    const a = Buffer.from(signatureB64);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return { valid: false, reason: 'bad_signature' };
    }
    let payload;
    try {
        payload = JSON.parse(base64UrlDecodeToBuffer(payloadB64).toString('utf8'));
    } catch (_e) {
        return { valid: false, reason: 'invalid_payload' };
    }
    return { valid: true, payload };
}

function getHeader(headers, name) {
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

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.tokenUri = TOKEN_URI;
        this.isRefreshable = true;

        this.client_id =
            this.client_id || process.env.JIRA_CLIENT_ID || null;
        this.client_secret =
            this.client_secret || process.env.JIRA_CLIENT_SECRET || null;
        this.redirect_uri =
            this.redirect_uri ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/jira`
                : null);
        this.scope =
            this.scope || process.env.JIRA_SCOPE || DEFAULT_SCOPES;

        this.access_token = get(params, 'access_token', null) || this.access_token;
        this.refresh_token =
            get(params, 'refresh_token', null) || this.refresh_token;

        this.cloudId =
            get(params, 'cloudId', null) ||
            get(params, 'cloud_id', null) ||
            null;
        this.siteUrl = get(params, 'siteUrl', null) || get(params, 'site_url', null);
        this.siteName = get(params, 'siteName', null) || get(params, 'site_name', null);
        this.site =
            get(params, 'site', null) ||
            (this.siteUrl
                ? (() => {
                      try {
                          return new URL(this.siteUrl).host;
                      } catch (_e) {
                          return String(this.siteUrl)
                              .replace(/^https?:\/\//, '')
                              .replace(/\/$/, '');
                      }
                  })()
                : null);

        this._applyCloudUrls();
        this.authorizationUri = this._buildAuthorizationUri();

        this.URLs = {
            myself: '/myself',
            projectSearch: '/project/search',
            project: '/project',
            projectByIdOrKey: (projectIdOrKey) =>
                `/project/${encodeURIComponent(projectIdOrKey)}`,
            issue: '/issue',
            issueByIdOrKey: (issueIdOrKey) =>
                `/issue/${encodeURIComponent(issueIdOrKey)}`,
            searchJql: '/search/jql',
            issueComments: (issueIdOrKey) =>
                `/issue/${encodeURIComponent(issueIdOrKey)}/comment`,
            userSearch: '/user/search',
            webhook: '/webhook',
            webhookRefresh: '/webhook/refresh',
        };
    }

    // ---- Cloud ID / URL wiring ---------------------------------------------

    /**
     * Set the Atlassian site cloudId used in OAuth API URLs.
     * Docs: https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
     */
    setCloudId(cloudId, meta = {}) {
        this.cloudId = cloudId ? String(cloudId) : null;
        if (meta.url) {
            this.siteUrl = meta.url;
            // Host only (acme.atlassian.net) — matches lefthook-bots account.site
            try {
                this.site = new URL(meta.url).host;
            } catch (_e) {
                this.site = String(meta.url)
                    .replace(/^https?:\/\//, '')
                    .replace(/\/$/, '');
            }
        }
        if (meta.name) this.siteName = meta.name;
        this._applyCloudUrls();
    }

    _applyCloudUrls() {
        const id = this.cloudId || '{cloudId}';
        this.baseUrl = `${API_HOST}/${id}/rest/api/3`;
    }

    _buildAuthorizationUri() {
        const q = new URLSearchParams({
            audience: 'api.atlassian.com',
            client_id: this.client_id || '',
            scope: this.scope || DEFAULT_SCOPES,
            redirect_uri: this.redirect_uri || '',
            state: this.state || '',
            response_type: 'code',
            prompt: 'consent',
        });
        return `${AUTH_BASE}?${q.toString()}`;
    }

    getAuthorizationUri() {
        this.authorizationUri = this._buildAuthorizationUri();
        return this.authorizationUri;
    }

    getAuthUri() {
        return this.getAuthorizationUri();
    }

    // ---- Token exchange (JSON body per Atlassian docs) ---------------------

    /**
     * Exchange an authorization code for tokens.
     * Atlassian requires application/json (not form-urlencoded).
     * https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
     */
    async getTokenFromCode(code) {
        delete this.access_token;
        const options = {
            url: this.tokenUri,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: {
                grant_type: 'authorization_code',
                client_id: this.client_id,
                client_secret: this.client_secret,
                code,
                redirect_uri: this.redirect_uri,
            },
        };
        const response = await this._post(options);
        await this.setTokens(response);
        return response;
    }

    /**
     * Refresh using rotating refresh tokens (JSON body).
     * Must replace the stored refresh_token with the new one returned.
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const refreshToken =
            (refreshTokenObject && refreshTokenObject.refresh_token) ||
            this.refresh_token;
        const options = {
            url: this.tokenUri,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: {
                grant_type: 'refresh_token',
                client_id: this.client_id,
                client_secret: this.client_secret,
                refresh_token: refreshToken,
            },
        };
        const response = await this._post(options);
        await this.setTokens(response);
        return response;
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
            options &&
            options.body &&
            typeof options.body === 'object' &&
            !(options.body instanceof URLSearchParams)
        ) {
            this.addJsonHeaders(options);
        }
        return super._post(options, stringify);
    }

    async _put(options, stringify) {
        if (options && options.body && typeof options.body === 'object') {
            this.addJsonHeaders(options);
        }
        return super._put(options, stringify);
    }

    async _delete(options) {
        if (options && options.body && typeof options.body === 'object') {
            this.addJsonHeaders(options);
        }
        return super._delete(options);
    }

    // ---- Identity / accessible resources -----------------------------------

    /**
     * List Atlassian sites the current access token can use.
     * GET https://api.atlassian.com/oauth/token/accessible-resources
     */
    async getAccessibleResources() {
        return this._get({
            url: ACCESSIBLE_RESOURCES_URI,
            headers: { Accept: 'application/json' },
        });
    }

    /**
     * Resolve and set cloudId from accessible-resources.
     * Prefers an explicit cloudId, else the first resource that grants a Jira
     * scope (or the first resource if none advertise jira scopes).
     */
    async ensureCloudId(preferredCloudId = null) {
        if (preferredCloudId) {
            this.setCloudId(preferredCloudId);
            return this.cloudId;
        }
        if (this.cloudId && this.cloudId !== '{cloudId}') {
            return this.cloudId;
        }
        const resources = await this.getAccessibleResources();
        const list = Array.isArray(resources) ? resources : [];
        const jiraScoped = list.find(
            (r) =>
                Array.isArray(r.scopes) &&
                r.scopes.some((s) => String(s).includes('jira'))
        );
        const chosen = jiraScoped || list[0];
        if (!chosen || !chosen.id) {
            throw new Error(
                'Jira: accessible-resources returned no site with a cloudId'
            );
        }
        this.setCloudId(chosen.id, { url: chosen.url, name: chosen.name });
        return this.cloudId;
    }

    /**
     * Get current user.
     * GET /rest/api/3/myself
     * Official operationId: getCurrentUser
     * Scope: read:jira-user
     */
    async getCurrentUser(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.myself,
            query: params,
        });
    }

    // ---- Projects ----------------------------------------------------------

    /**
     * Get projects paginated (preferred over deprecated GET /project).
     * GET /rest/api/3/project/search
     * operationId: searchProjects (official swagger-v3)
     * Scope: read:jira-work
     */
    async searchProjects(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.projectSearch,
            query: params,
        });
    }

    /**
     * Get project.
     * GET /rest/api/3/project/{projectIdOrKey}
     * Official operationId: getProject
     * Scope: read:jira-work
     */
    async getProject(projectIdOrKey, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.projectByIdOrKey(projectIdOrKey),
            query: params,
        });
    }

    /**
     * Create project.
     * POST /rest/api/3/project
     * Official operationId: createProject
     * Scope: manage:jira-configuration
     */
    async createProject(body) {
        return this._post({
            url: this.baseUrl + this.URLs.project,
            body,
        });
    }

    /**
     * Update project.
     * PUT /rest/api/3/project/{projectIdOrKey}
     * Official operationId: updateProject
     * Scope: manage:jira-project
     */
    async updateProject(projectIdOrKey, body) {
        return this._put({
            url: this.baseUrl + this.URLs.projectByIdOrKey(projectIdOrKey),
            body,
        });
    }

    // ---- Issues ------------------------------------------------------------

    /**
     * Create issue.
     * POST /rest/api/3/issue
     * Official operationId: createIssue
     * Scope: write:jira-work
     */
    async createIssue(body, params = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.issue,
            query: params,
            body,
        });
    }

    /**
     * Get issue.
     * GET /rest/api/3/issue/{issueIdOrKey}
     * Official operationId: getIssue
     * Scope: read:jira-work
     */
    async getIssue(issueIdOrKey, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.issueByIdOrKey(issueIdOrKey),
            query: params,
        });
    }

    /**
     * Edit issue.
     * PUT /rest/api/3/issue/{issueIdOrKey}
     * Official operationId: editIssue
     * Scope: write:jira-work
     */
    async editIssue(issueIdOrKey, body, params = {}) {
        return this._put({
            url: this.baseUrl + this.URLs.issueByIdOrKey(issueIdOrKey),
            query: params,
            body,
        });
    }

    /**
     * Delete issue.
     * DELETE /rest/api/3/issue/{issueIdOrKey}
     * Official operationId: deleteIssue
     * Scope: write:jira-work
     */
    async deleteIssue(issueIdOrKey, params = {}) {
        return this._delete({
            url: this.baseUrl + this.URLs.issueByIdOrKey(issueIdOrKey),
            query: params,
        });
    }

    /**
     * Search issues with JQL enhanced search (replaces deprecated /search).
     * GET /rest/api/3/search/jql
     * operationId: searchAndReconsileIssuesUsingJql (official swagger-v3 spelling)
     * Scope: read:jira-work
     */
    async searchAndReconsileIssuesUsingJql(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.searchJql,
            query: params,
        });
    }

    // ---- Comments ----------------------------------------------------------

    /**
     * Get comments for an issue.
     * GET /rest/api/3/issue/{issueIdOrKey}/comment
     * operationId: getComments
     * Scope: read:jira-work
     */
    async getComments(issueIdOrKey, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.issueComments(issueIdOrKey),
            query: params,
        });
    }

    /**
     * Add comment.
     * POST /rest/api/3/issue/{issueIdOrKey}/comment
     * Official operationId: addComment
     * Scope: write:jira-work
     */
    async addComment(issueIdOrKey, body, params = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.issueComments(issueIdOrKey),
            query: params,
            body,
        });
    }

    // ---- Users -------------------------------------------------------------

    /**
     * Find users.
     * GET /rest/api/3/user/search
     * Official operationId: findUsers
     * Scope: read:jira-user
     */
    async findUsers(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.userSearch,
            query: params,
        });
    }

    // ---- Dynamic webhooks (Connect / OAuth 2.0 apps) -----------------------

    /**
     * Get dynamic webhooks for the calling app.
     * GET /rest/api/3/webhook
     * operationId: getDynamicWebhooksForApp
     * Scopes: read:jira-work, manage:jira-webhook
     */
    async getDynamicWebhooksForApp(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.webhook,
            query: params,
        });
    }

    /**
     * Register dynamic webhooks.
     * POST /rest/api/3/webhook
     * operationId: registerDynamicWebhooks
     * Body: { url, webhooks: [{ events, jqlFilter, ... }] }
     * Scopes: read:jira-work, manage:jira-webhook
     */
    async registerDynamicWebhooks(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhook,
            body,
        });
    }

    /**
     * Delete webhooks by ID.
     * DELETE /rest/api/3/webhook
     * operationId: deleteWebhookById
     * Body: { webhookIds: number[] }
     * Scopes: read:jira-work, manage:jira-webhook
     */
    async deleteWebhookById(body) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhook,
            body,
        });
    }

    /**
     * Extend webhook life.
     * PUT /rest/api/3/webhook/refresh
     * operationId: refreshWebhooks
     * Body: { webhookIds: number[] }
     * Scopes: read:jira-work, manage:jira-webhook
     */
    async refreshWebhooks(body) {
        return this._put({
            url: this.baseUrl + this.URLs.webhookRefresh,
            body,
        });
    }

    /**
     * Verify an OAuth 2.0 dynamic webhook Authorization bearer JWT using the
     * app client secret (HS256).
     * https://developer.atlassian.com/cloud/jira/platform/webhooks/
     */
    verifyWebhookSignature({
        req,
        headers,
        authorization,
        clientSecret,
    } = {}) {
        const hdrs = headers || (req && req.headers) || {};
        const auth =
            authorization ||
            getHeader(hdrs, 'Authorization') ||
            getHeader(hdrs, 'authorization');
        const secret =
            clientSecret || this.client_secret || process.env.JIRA_CLIENT_SECRET;
        if (!secret) {
            return { valid: false, reason: 'missing_client_secret' };
        }
        if (!auth) {
            return { valid: false, reason: 'missing_authorization' };
        }
        return verifyHs256Jwt(auth, secret);
    }
}

module.exports = { Api, verifyHs256Jwt };
