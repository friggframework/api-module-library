const { OAuth2Requester, get } = require('@friggframework/core');

const AUTHORIZE_URI = 'https://auth.atlassian.com/authorize';
const TOKEN_URI = 'https://auth.atlassian.com/oauth/token';
const PLATFORM_BASE = 'https://api.atlassian.com';
const ACCESSIBLE_RESOURCES_URL = `${PLATFORM_BASE}/oauth/token/accessible-resources`;
const ME_URL = `${PLATFORM_BASE}/me`;

/**
 * Confluence Cloud REST API v2 client (OAuth 2.0 3LO).
 *
 * Auth: Atlassian OAuth 2.0 (3LO) authorization-code grant.
 *   Authorize: https://auth.atlassian.com/authorize
 *   Token:     https://auth.atlassian.com/oauth/token  (JSON body)
 *   Docs:      https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/
 *
 * After exchanging the code, resolve the site `cloudId` via
 * GET https://api.atlassian.com/oauth/token/accessible-resources, then call
 * Confluence v2. The vendor OpenAPI server is
 *   https://{your-domain}/wiki/api/v2
 * For OAuth 2.0 (3LO), Atlassian requires the gateway form instead:
 *   https://api.atlassian.com/ex/confluence/{cloudId}/wiki/api/v2
 * The client uses the gateway whenever `cloudId` is set.
 *
 * Official REST API v2 docs / OpenAPI:
 *   https://developer.atlassian.com/cloud/confluence/rest/v2/intro/
 *   https://dac-static.atlassian.com/cloud/confluence/openapi-v2.v3.json
 *
 * Webhook subscription CRUD is NOT offered on the public Confluence Cloud REST
 * API for 3LO apps (Connect/Forge modules only; an unsupported private
 * `/wiki/rest/webhooks/1.0/webhook` endpoint exists but is out of scope).
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.tokenUri = TOKEN_URI;
        this.audience = get(params, 'audience', 'api.atlassian.com');

        this.cloudId =
            get(params, 'cloudId', null) || get(params, 'cloud_id', null);
        this.siteUrl =
            get(params, 'siteUrl', null) || get(params, 'site_url', null);
        this.siteName =
            get(params, 'siteName', null) || get(params, 'site_name', null);

        // Spec-sync: when cloudId is unset, baseUrl matches the vendor OpenAPI
        // server template (variable placeholder left unsubstituted by yaml.load).
        this.baseUrl = this._resolveBaseUrl();

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        this.URLs = {
            spaces: '/spaces',
            spaceById: (id) => `/spaces/${id}`,
            pages: '/pages',
            pageById: (id) => `/pages/${id}`,
            pagesInSpace: (spaceId) => `/spaces/${spaceId}/pages`,
            blogposts: '/blogposts',
            blogpostById: (id) => `/blogposts/${id}`,
            blogpostsInSpace: (spaceId) => `/spaces/${spaceId}/blogposts`,
        };

        this.authorizationUri = this._buildAuthorizationUri();
    }

    _resolveBaseUrl() {
        // OAuth 3LO data-plane (Atlassian requirement when cloudId is known).
        if (this.cloudId) {
            return `${PLATFORM_BASE}/ex/confluence/${this.cloudId}/wiki/api/v2`;
        }
        // Vendor OpenAPI primary server URL.
        return 'https://{your-domain}/wiki/api/v2';
    }

    setCloudId(cloudId, { siteUrl, siteName } = {}) {
        this.cloudId = cloudId ? String(cloudId) : null;
        if (siteUrl !== undefined) this.siteUrl = siteUrl;
        if (siteName !== undefined) this.siteName = siteName;
        this.baseUrl = this._resolveBaseUrl();
        return this.cloudId;
    }

    _buildAuthorizationUri() {
        const params = new URLSearchParams({
            audience: this.audience || 'api.atlassian.com',
            client_id: this.client_id || '',
            scope: this.scope || '',
            redirect_uri: this.redirect_uri || '',
            response_type: 'code',
            prompt: 'consent',
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
     * Atlassian token endpoint expects a JSON body with client_id/secret
     * (not form-urlencoded).
     * @see https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/
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
                grant_type: 'authorization_code',
                client_id: this.client_id,
                client_secret: this.client_secret,
                code,
                redirect_uri: this.redirect_uri,
            },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    /**
     * Refresh also uses JSON body. Include `offline_access` in authorize scopes
     * to receive a refresh_token.
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const options = {
            url: this.tokenUri,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: {
                grant_type: 'refresh_token',
                client_id: this.client_id,
                client_secret: this.client_secret,
                refresh_token: get(
                    refreshTokenObject,
                    'refresh_token',
                    this.refresh_token
                ),
            },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                for (const v of value) {
                    if (v === undefined || v === null) continue;
                    usp.append(key, String(v));
                }
            } else {
                usp.append(key, String(value));
            }
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    _requireCloudId() {
        if (!this.cloudId) {
            throw new Error(
                'Confluence: cloudId is required. Call listAccessibleResources() then setCloudId(), or pass cloudId when constructing the Api.'
            );
        }
        this.baseUrl = this._resolveBaseUrl();
    }

    // ---- Identity (Atlassian platform; not under /wiki/api/v2) -------------

    /**
     * List sites the token can access (includes each site's cloud id).
     * GET https://api.atlassian.com/oauth/token/accessible-resources
     */
    async listAccessibleResources() {
        return this._get({
            url: ACCESSIBLE_RESOURCES_URL,
            headers: { Accept: 'application/json' },
        });
    }

    /**
     * Current Atlassian account for the token.
     * GET https://api.atlassian.com/me  (scope: read:me)
     */
    async getCurrentUser() {
        return this._get({
            url: ME_URL,
            headers: { Accept: 'application/json' },
        });
    }

    /**
     * Pick a Confluence-capable site from accessible-resources and set cloudId.
     * Prefers an exact siteUrl match when provided; otherwise the first resource
     * whose scopes mention confluence (or the first resource if none match).
     */
    async resolveCloudId({ siteUrl } = {}) {
        const resources = await this.listAccessibleResources();
        const list = Array.isArray(resources) ? resources : [];
        if (list.length === 0) {
            throw new Error(
                'Confluence: accessible-resources returned no sites for this token.'
            );
        }

        let chosen = null;
        if (siteUrl) {
            const normalized = String(siteUrl).replace(/\/$/, '');
            chosen = list.find(
                (r) => String(r.url || '').replace(/\/$/, '') === normalized
            );
        }
        if (!chosen) {
            chosen =
                list.find((r) =>
                    (r.scopes || []).some((s) =>
                        String(s).toLowerCase().includes('confluence')
                    )
                ) || list[0];
        }

        this.setCloudId(chosen.id, {
            siteUrl: chosen.url || null,
            siteName: chosen.name || null,
        });
        return chosen;
    }

    // ---- Spaces ------------------------------------------------------------

    /**
     * List spaces.
     * GET /spaces
     * Official operationId: getSpaces
     * Scope: read:space:confluence
     */
    async getSpaces(params = {}) {
        this._requireCloudId();
        return this._get({
            url: this.baseUrl + this.URLs.spaces + this._buildQuery(params),
            headers: { Accept: 'application/json' },
        });
    }

    /**
     * Get a space by id.
     * GET /spaces/{id}
     * Official operationId: getSpaceById
     * Scope: read:space:confluence
     */
    async getSpaceById(id, params = {}) {
        this._requireCloudId();
        return this._get({
            url:
                this.baseUrl +
                this.URLs.spaceById(id) +
                this._buildQuery(params),
            headers: { Accept: 'application/json' },
        });
    }

    /**
     * Create a space.
     * POST /spaces
     * Official operationId: createSpace
     * Scope: write:space:confluence
     */
    async createSpace(data) {
        this._requireCloudId();
        return this._post({
            url: this.baseUrl + this.URLs.spaces,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: data,
        });
    }

    // ---- Pages -------------------------------------------------------------

    /**
     * List pages.
     * GET /pages
     * Official operationId: getPages
     * Scope: read:page:confluence
     */
    async getPages(params = {}) {
        this._requireCloudId();
        return this._get({
            url: this.baseUrl + this.URLs.pages + this._buildQuery(params),
            headers: { Accept: 'application/json' },
        });
    }

    /**
     * Get a page by id.
     * GET /pages/{id}
     * Official operationId: getPageById
     * Scope: read:page:confluence
     */
    async getPageById(id, params = {}) {
        this._requireCloudId();
        return this._get({
            url:
                this.baseUrl + this.URLs.pageById(id) + this._buildQuery(params),
            headers: { Accept: 'application/json' },
        });
    }

    /**
     * Create a page.
     * POST /pages
     * Official operationId: createPage
     * Scope: write:page:confluence
     */
    async createPage(data, params = {}) {
        this._requireCloudId();
        return this._post({
            url: this.baseUrl + this.URLs.pages + this._buildQuery(params),
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: data,
        });
    }

    /**
     * Update a page.
     * PUT /pages/{id}
     * Official operationId: updatePage
     * Scope: write:page:confluence
     */
    async updatePage(id, data) {
        this._requireCloudId();
        return this._put({
            url: this.baseUrl + this.URLs.pageById(id),
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: data,
        });
    }

    /**
     * Delete a page (trash / purge / draft per query flags).
     * DELETE /pages/{id}
     * Official operationId: deletePage
     * Scope: delete:page:confluence
     */
    async deletePage(id, params = {}) {
        this._requireCloudId();
        return this._delete({
            url:
                this.baseUrl + this.URLs.pageById(id) + this._buildQuery(params),
            headers: { Accept: 'application/json' },
        });
    }

    /**
     * List pages in a space.
     * GET /spaces/{id}/pages
     * Official operationId: getPagesInSpace
     * Scope: read:page:confluence
     */
    async getPagesInSpace(spaceId, params = {}) {
        this._requireCloudId();
        return this._get({
            url:
                this.baseUrl +
                this.URLs.pagesInSpace(spaceId) +
                this._buildQuery(params),
            headers: { Accept: 'application/json' },
        });
    }

    // ---- Blog posts --------------------------------------------------------

    /**
     * List blog posts.
     * GET /blogposts
     * Official operationId: getBlogPosts
     * Scope: read:page:confluence
     */
    async getBlogPosts(params = {}) {
        this._requireCloudId();
        return this._get({
            url: this.baseUrl + this.URLs.blogposts + this._buildQuery(params),
            headers: { Accept: 'application/json' },
        });
    }

    /**
     * Get a blog post by id.
     * GET /blogposts/{id}
     * Official operationId: getBlogPostById
     * Scope: read:page:confluence
     */
    async getBlogPostById(id, params = {}) {
        this._requireCloudId();
        return this._get({
            url:
                this.baseUrl +
                this.URLs.blogpostById(id) +
                this._buildQuery(params),
            headers: { Accept: 'application/json' },
        });
    }

    /**
     * Create a blog post.
     * POST /blogposts
     * Official operationId: createBlogPost
     * Scope: write:page:confluence
     */
    async createBlogPost(data, params = {}) {
        this._requireCloudId();
        return this._post({
            url: this.baseUrl + this.URLs.blogposts + this._buildQuery(params),
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: data,
        });
    }

    /**
     * Update a blog post.
     * PUT /blogposts/{id}
     * Official operationId: updateBlogPost
     * Scope: write:page:confluence
     */
    async updateBlogPost(id, data) {
        this._requireCloudId();
        return this._put({
            url: this.baseUrl + this.URLs.blogpostById(id),
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: data,
        });
    }

    /**
     * Delete a blog post.
     * DELETE /blogposts/{id}
     * Official operationId: deleteBlogPost
     * Scope: delete:page:confluence
     */
    async deleteBlogPost(id, params = {}) {
        this._requireCloudId();
        return this._delete({
            url:
                this.baseUrl +
                this.URLs.blogpostById(id) +
                this._buildQuery(params),
            headers: { Accept: 'application/json' },
        });
    }

    /**
     * List blog posts in a space.
     * GET /spaces/{id}/blogposts
     * Official operationId: getBlogPostsInSpace
     * Scope: read:page:confluence
     */
    async getBlogPostsInSpace(spaceId, params = {}) {
        this._requireCloudId();
        return this._get({
            url:
                this.baseUrl +
                this.URLs.blogpostsInSpace(spaceId) +
                this._buildQuery(params),
            headers: { Accept: 'application/json' },
        });
    }
}

module.exports = { Api };
