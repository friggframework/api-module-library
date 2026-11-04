const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Dated API version pinned via the Rippling-Api-Version header.
 * Matches the Platform API reference version published at
 * https://developer.rippling.com/documentation/rest-api/reference/rippling-platform-api
 */
const DEFAULT_API_VERSION = '2024-08-01';

/**
 * Rippling Platform API (v2 REST) client.
 *
 * Auth (App Shop partners): OAuth 2.0 authorization code + refresh tokens.
 *   Authorize: https://app.rippling.com/apps/PLATFORM/{APP_NAME}/authorize
 *   Token:     POST https://api.rippling.com/api/o/token/
 *              Authorization: Basic Base64(client_id:client_secret)
 *   Install:   POST https://api.rippling.com/platform/api/mark_app_installed
 *
 * REST base URL: https://rest.ripplingapis.com
 * Version header: Rippling-Api-Version: YYYY-MM-DD
 *
 * Customer/internal integrations may instead use a Bearer API token created in
 * Developer → API credentials (same REST base + version header). App Shop
 * partners must use OAuth — using an API key on behalf of another org violates
 * Rippling's Terms of Service.
 *
 * Official docs:
 *   - https://developer.rippling.com/documentation/rest-api
 *   - https://developer.rippling.com/documentation/developer-portal/v2-guides/installation
 *   - https://developer.rippling.com/llms.txt
 *
 * The canonical machine-readable contract for the REST surface lives in
 * ./rippling.openapi.yaml — this client mirrors it 1:1 (one method per
 * operationId). Keep them in sync. Platform-host helpers (token exchange,
 * markAppInstalled) are intentionally outside that OpenAPI server.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://rest.ripplingapis.com';
        this.platformBaseUrl = 'https://api.rippling.com';
        this.apiVersion =
            get(params, 'api_version', null) || DEFAULT_API_VERSION;

        this.client_id = get(params, 'client_id', null) || this.client_id;
        this.client_secret =
            get(params, 'client_secret', null) || this.client_secret;
        this.redirect_uri =
            get(params, 'redirect_uri', null) || this.redirect_uri;
        this.scope = get(params, 'scope', null) || this.scope;
        this.app_name = get(params, 'app_name', null) || null;

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        this.tokenUri = `${this.platformBaseUrl}/api/o/token/`;
        this.authorizationUri = this._buildAuthorizationUri();

        this.URLs = {
            companies: '/companies/',
            workers: '/workers/',
            workerById: (id) => `/workers/${id}/`,
            users: '/users/',
            userById: (id) => `/users/${id}/`,
            departments: '/departments/',
            departmentById: (id) => `/departments/${id}/`,
            workLocations: '/work-locations/',
            workLocationById: (id) => `/work-locations/${id}/`,
            draftHires: '/draft-hires/',
            markAppInstalled: '/platform/api/mark_app_installed',
        };
    }

    _buildAuthorizationUri() {
        const appName = this.app_name || 'APPNAME';
        return `https://app.rippling.com/apps/PLATFORM/${appName}/authorize`;
    }

    setAppName(appName) {
        this.app_name = appName || null;
        this.authorizationUri = this._buildAuthorizationUri();
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    getAuthorizationRequirements() {
        return {
            url: this.authorizationUri,
            type: 'oauth2',
            data: {
                jsonSchema: {
                    title: 'Rippling Authentication',
                    type: 'object',
                    required: ['client_id', 'client_secret', 'app_name'],
                    properties: {
                        client_id: {
                            type: 'string',
                            title: 'Client ID',
                        },
                        client_secret: {
                            type: 'string',
                            title: 'Client Secret',
                        },
                        app_name: {
                            type: 'string',
                            title: 'App Name',
                            description:
                                'PLATFORM app name from your Rippling App Shop listing (used in the authorize URL).',
                        },
                    },
                },
                uiSchema: {
                    client_secret: {
                        'ui:widget': 'password',
                        'ui:help':
                            'From your Rippling Developer Portal listing credentials. App Shop partners exchange authorization codes at https://api.rippling.com/api/o/token/ with Basic auth.',
                    },
                    app_name: {
                        'ui:help':
                            'Appears in https://app.rippling.com/apps/PLATFORM/{APP_NAME}/authorize',
                    },
                },
            },
        };
    }

    async addAuthHeaders(headers = {}) {
        const next = await super.addAuthHeaders(headers);
        next.Accept = next.Accept || 'application/json';
        if (this.apiVersion) {
            next['Rippling-Api-Version'] = this.apiVersion;
        }
        return next;
    }

    /**
     * Exchange an App Shop authorization code for access + refresh tokens.
     * Rippling requires HTTP Basic (client_id:client_secret) on the token POST.
     */
    async getTokenFromCode(code) {
        delete this.access_token;
        return this.getTokenFromCodeBasicAuthHeader(code);
    }

    /**
     * Refresh the access token using Basic auth + form body, per
     * https://developer.rippling.com/documentation/developer-portal/v2-guides/installation
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append(
            'refresh_token',
            refreshTokenObject.refresh_token || this.refresh_token
        );

        const options = {
            body: params,
            url: this.tokenUri,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(
                    `${this.client_id}:${this.client_secret}`
                ).toString('base64')}`,
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

    // ---- Identity / companies ------------------------------------------------

    /**
     * List companies for the authenticated token.
     * GET /companies/
     * Scope: companies.read
     * Used after OAuth to bind the token to the Rippling company.
     */
    async listCompanies(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.companies +
                this._buildQuery(params),
        });
    }

    // ---- Workers -------------------------------------------------------------

    /**
     * List workers (employment/engagement profiles).
     * GET /workers/
     * Scope: workers.read
     * Query: filter, expand, order_by, limit, cursor
     */
    async listWorkers(params = {}) {
        return this._get({
            url:
                this.baseUrl + this.URLs.workers + this._buildQuery(params),
        });
    }

    /**
     * Retrieve a worker by id.
     * GET /workers/{id}/
     * Scope: workers.read
     */
    async getWorker(workerId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.workerById(workerId) +
                this._buildQuery(params),
        });
    }

    // ---- Users ---------------------------------------------------------------

    /**
     * List users (person/login profiles).
     * GET /users/
     * Scope: users.read
     */
    async listUsers(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.users + this._buildQuery(params),
        });
    }

    /**
     * Retrieve a user by id.
     * GET /users/{id}/
     * Scope: users.read
     */
    async getUser(userId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.userById(userId) +
                this._buildQuery(params),
        });
    }

    // ---- Departments ---------------------------------------------------------

    /**
     * List departments.
     * GET /departments/
     * Scope: departments.read
     */
    async listDepartments(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.departments +
                this._buildQuery(params),
        });
    }

    /**
     * Retrieve a department by id.
     * GET /departments/{id}/
     * Scope: departments.read
     */
    async getDepartment(departmentId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.departmentById(departmentId) +
                this._buildQuery(params),
        });
    }

    /**
     * Create a department.
     * POST /departments/
     * Scope: departments.read-write
     * body: { name (required), parent_id?, reference_code? }
     */
    async createDepartment(data) {
        return this._post({
            url: this.baseUrl + this.URLs.departments,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a department.
     * PATCH /departments/{id}/
     * Scope: departments.read-write
     */
    async updateDepartment(departmentId, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.departmentById(departmentId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Work locations ------------------------------------------------------

    /**
     * List work locations.
     * GET /work-locations/
     * Scope: work-locations.read
     */
    async listWorkLocations(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.workLocations +
                this._buildQuery(params),
        });
    }

    /**
     * Retrieve a work location by id.
     * GET /work-locations/{id}/
     * Scope: work-locations.read
     */
    async getWorkLocation(workLocationId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.workLocationById(workLocationId) +
                this._buildQuery(params),
        });
    }

    /**
     * Create a work location.
     * POST /work-locations/
     * Scope: work-locations.read-write
     * body: { name (required), address (required) }
     */
    async createWorkLocation(data) {
        return this._post({
            url: this.baseUrl + this.URLs.workLocations,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a work location.
     * PATCH /work-locations/{id}/
     * Scope: work-locations.read-write
     */
    async updateWorkLocation(workLocationId, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.workLocationById(workLocationId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Draft hires (worker create path) ------------------------------------

    /**
     * Create one or more draft hires (bulk).
     * POST /draft-hires/
     * Scope: draft-hires.read-write
     * An admin finishes hiring in Rippling; the resulting worker then appears
     * on GET /workers/ and GET /users/.
     */
    async createDraftHires(data) {
        return this._post({
            url: this.baseUrl + this.URLs.draftHires,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- App Shop install finalize (platform host) ---------------------------

    /**
     * Mark the App Shop listing as installed for the company.
     * POST https://api.rippling.com/platform/api/mark_app_installed
     * Documented in the v2 Installation guide (not on rest.ripplingapis.com).
     */
    async markAppInstalled() {
        return this._post({
            url: this.platformBaseUrl + this.URLs.markAppInstalled,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: {},
        });
    }
}

module.exports = { Api, DEFAULT_API_VERSION };
