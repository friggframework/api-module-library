const {
    OAuth2Requester,
    ModuleConstants,
    get,
} = require('@friggframework/core');

/**
 * Workday HCM REST API client.
 *
 * Auth (OAuth 2.0) — two official modes:
 *
 * 1) Extend / API Gateway (default)
 *    Token: POST https://auth.api.workday.com/v1/token
 *    Authorization: ID <base64(client_id:client_secret)>
 *    Grants: authorization_code, refresh_token, client_credentials (+ tenant_alias)
 *    REST:   https://api.workday.com/{service}/{version}/…
 *    Docs:   https://developer.workday.com/documentation/vle1524593542839
 *            https://developer.workday.com/documentation/yai1528997518068
 *
 * 2) Tenanted Integrations ("API Client for Integrations")
 *    Token: POST https://{tenantHostname}/ccx/oauth2/{tenant}/token
 *    Authorization: Basic <base64(client_id:client_secret)>
 *    Grant: refresh_token (from Manage Refresh Tokens for Integrations)
 *    REST:  https://{tenantHostname}/api/{service}/{version}/{tenant}/…
 *    Docs:  https://developer.workday.com/documentation/GUID-85810465-bcfb-4fdf-a26d-55eaff3968a8-enHYPHENus
 *
 * Curated contract: ./workday.openapi.yaml (one method per operationId).
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.client_id =
            get(params, 'client_id', null) || get(params, 'clientId', null);
        this.client_secret =
            get(params, 'client_secret', null) ||
            get(params, 'clientSecret', null);
        this.access_token =
            get(params, 'access_token', null) ||
            get(params, 'accessToken', null);
        this.refresh_token =
            get(params, 'refresh_token', null) ||
            get(params, 'refreshToken', null);
        this.tenant_alias =
            get(params, 'tenant_alias', null) ||
            get(params, 'tenantAlias', null) ||
            get(params, 'tenant', null);
        this.tenant_hostname =
            get(params, 'tenant_hostname', null) ||
            get(params, 'tenantHostname', null);
        this.auth_mode = (
            get(params, 'auth_mode', null) ||
            get(params, 'authMode', null) ||
            'extend'
        ).toLowerCase();

        this.redirect_uri =
            get(params, 'redirect_uri', null) ||
            get(params, 'redirectUri', null);
        this.scope = get(params, 'scope', null);
        this.state = get(params, 'state', 'STATE');

        this._configureEndpoints(params);

        this.isRefreshable = true;

        this.URLs = {
            workers: '/workers',
            workerById: (id) => `/workers/${encodeURIComponent(id)}`,
            supervisoryOrganizations: '/supervisoryOrganizations',
            supervisoryOrganizationById: (id) =>
                `/supervisoryOrganizations/${encodeURIComponent(id)}`,
            supervisoryOrganizationWorkers: (id) =>
                `/supervisoryOrganizations/${encodeURIComponent(id)}/workers`,
            jobChanges: (workerId) =>
                `/workers/${encodeURIComponent(workerId)}/jobChanges`,
            submitJobChange: (jobChangeId) =>
                `/jobChanges/${encodeURIComponent(jobChangeId)}/submit`,
            eligibleAbsenceTypes: (workerId) =>
                `/workers/${encodeURIComponent(workerId)}/eligibleAbsenceTypes`,
            timeOffDetails: (workerId) =>
                `/workers/${encodeURIComponent(workerId)}/timeOffDetails`,
            timeOffDetailById: (workerId, entryId) =>
                `/workers/${encodeURIComponent(workerId)}/timeOffDetails/${encodeURIComponent(entryId)}`,
            requestTimeOff: (workerId) =>
                `/workers/${encodeURIComponent(workerId)}/requestTimeOff`,
            leavesOfAbsence: (workerId) =>
                `/workers/${encodeURIComponent(workerId)}/leavesOfAbsence`,
            balances: '/balances',
            balanceById: (id) => `/balances/${encodeURIComponent(id)}`,
        };
    }

    _configureEndpoints(params = {}) {
        if (this.auth_mode === 'integrations') {
            const host = this.tenant_hostname;
            const tenant = this.tenant_alias;
            if (host && tenant) {
                const root = `https://${host}`;
                this.tokenUri =
                    get(params, 'token_url', null) ||
                    get(params, 'tokenUri', null) ||
                    `${root}/ccx/oauth2/${tenant}/token`;
                this.baseUrl =
                    get(params, 'baseUrl', null) ||
                    get(params, 'base_url', null) ||
                    `${root}/api/common/v1/${tenant}`;
                this.staffingBaseUrl =
                    get(params, 'staffingBaseUrl', null) ||
                    get(params, 'staffing_base_url', null) ||
                    `${root}/api/staffing/v1/${tenant}`;
                this.absenceBaseUrl =
                    get(params, 'absenceBaseUrl', null) ||
                    get(params, 'absence_base_url', null) ||
                    `${root}/api/absenceManagement/v5/${tenant}`;
            } else {
                // Placeholders until setAuthParams supplies host + tenant.
                this.tokenUri =
                    get(params, 'token_url', null) ||
                    get(params, 'tokenUri', null) ||
                    null;
                this.baseUrl =
                    get(params, 'baseUrl', null) ||
                    get(params, 'base_url', null) ||
                    'https://api.workday.com/common/v1';
                this.staffingBaseUrl =
                    get(params, 'staffingBaseUrl', null) ||
                    'https://api.workday.com/staffing/v1';
                this.absenceBaseUrl =
                    get(params, 'absenceBaseUrl', null) ||
                    'https://api.workday.com/absenceManagement/v5';
            }
        } else {
            this.tokenUri =
                get(params, 'token_url', null) ||
                get(params, 'tokenUri', null) ||
                'https://auth.api.workday.com/v1/token';
            this.baseUrl =
                get(params, 'baseUrl', null) ||
                get(params, 'base_url', null) ||
                'https://api.workday.com/common/v1';
            this.staffingBaseUrl =
                get(params, 'staffingBaseUrl', null) ||
                get(params, 'staffing_base_url', null) ||
                'https://api.workday.com/staffing/v1';
            this.absenceBaseUrl =
                get(params, 'absenceBaseUrl', null) ||
                get(params, 'absence_base_url', null) ||
                'https://api.workday.com/absenceManagement/v5';
            this.authorizationUri = encodeURI(
                `https://auth.api.workday.com/v1/authorize` +
                    `?response_type=code` +
                    `&client_id=${this.client_id || ''}` +
                    (this.redirect_uri
                        ? `&redirect_uri=${this.redirect_uri}`
                        : '') +
                    `&state=${this.state}`
            );
        }
        this.baseURL = this.baseUrl;
    }

    getAuthorizationRequirements() {
        return {
            url:
                this.auth_mode === 'extend' && this.client_id
                    ? this.authorizationUri
                    : null,
            type: ModuleConstants.authType.apiKey,
            data: {
                jsonSchema: {
                    title: 'Workday Authentication',
                    type: 'object',
                    required: [
                        'client_id',
                        'client_secret',
                        'tenant_alias',
                        'auth_mode',
                    ],
                    properties: {
                        client_id: {
                            type: 'string',
                            title: 'Client ID',
                        },
                        client_secret: {
                            type: 'string',
                            title: 'Client Secret',
                        },
                        refresh_token: {
                            type: 'string',
                            title: 'Refresh Token',
                        },
                        tenant_alias: {
                            type: 'string',
                            title: 'Tenant Alias',
                        },
                        auth_mode: {
                            type: 'string',
                            title: 'Auth Mode',
                            enum: ['extend', 'integrations'],
                            default: 'extend',
                        },
                        tenant_hostname: {
                            type: 'string',
                            title: 'Tenant Hostname (integrations mode)',
                        },
                        scope: {
                            type: 'string',
                            title: 'Scope (optional)',
                        },
                    },
                },
                uiSchema: {
                    client_id: {
                        'ui:help':
                            'From the Workday Developer Site Console (Extend API Client) or View API Clients (API Client for Integrations).',
                    },
                    client_secret: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Client secret generated when the API Client was registered.',
                    },
                    refresh_token: {
                        'ui:widget': 'password',
                        'ui:help':
                            'From authorization-code exchange, or Manage Refresh Tokens for Integrations (ISU). Required for non-interactive refresh; omit when using Extend client_credentials with tenant_alias.',
                    },
                    tenant_alias: {
                        'ui:help':
                            'Workday tenant alias (e.g. gms). Used as Frigg entity externalId and in tenanted REST paths.',
                        'ui:placeholder': 'mytenant',
                    },
                    auth_mode: {
                        'ui:help':
                            'extend = API Gateway (auth.api.workday.com + api.workday.com). integrations = tenanted /ccx oauth2 + /api/{service}/{version}/{tenant}.',
                    },
                    tenant_hostname: {
                        'ui:help':
                            'Required for integrations mode. Hostname from View API Clients / REST endpoint (no https://). Example: wd2-impl-services1.workday.com',
                        'ui:placeholder': 'wd2-impl-services1.workday.com',
                    },
                    scope: {
                        'ui:help':
                            'Optional. Functional-area scopes selected on the API Client (e.g. Staffing, Absence).',
                    },
                },
            },
        };
    }

    _clientCredentialsHeader() {
        const encoded = Buffer.from(
            `${this.client_id}:${this.client_secret}`
        ).toString('base64');
        // Extend uses the non-standard "ID" auth scheme; Integrations uses Basic.
        if (this.auth_mode === 'integrations') {
            return `Basic ${encoded}`;
        }
        return `ID ${encoded}`;
    }

    /**
     * Exchange a refresh_token for a new access_token (+ rotated refresh_token).
     * @see https://developer.workday.com/documentation/cqa1553122177664
     */
    async getTokenFromRefreshToken() {
        if (!this.refresh_token) {
            throw new Error('Workday: refresh_token is required.');
        }
        if (!this.tokenUri) {
            throw new Error(
                'Workday: token URL is not configured (set auth_mode + tenant_hostname/tenant_alias for integrations).'
            );
        }
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', this.refresh_token);
        if (this.client_id) params.append('client_id', this.client_id);

        const options = {
            url: this.tokenUri,
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: this._clientCredentialsHeader(),
            },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    /**
     * Extend client-credentials grant (ISU mapped via Client Credentials Mapping).
     * @see https://developer.workday.com/documentation/vle1524593542839
     */
    async getTokenFromClientCredentials() {
        if (!this.tenant_alias) {
            throw new Error(
                'Workday: tenant_alias is required for client_credentials grant.'
            );
        }
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('tenant_alias', this.tenant_alias);

        const options = {
            url: this.tokenUri || 'https://auth.api.workday.com/v1/token',
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: this._clientCredentialsHeader(),
            },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    /**
     * Authorization-code exchange (Extend).
     * @see https://developer.workday.com/documentation/yai1528997518068
     */
    async getTokenFromCode(code) {
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        if (this.client_id) params.append('client_id', this.client_id);
        if (this.redirect_uri) params.append('redirect_uri', this.redirect_uri);

        const options = {
            url: this.tokenUri || 'https://auth.api.workday.com/v1/token',
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: this._clientCredentialsHeader(),
            },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    /** Prefer refresh_token; fall back to Extend client_credentials. */
    async getToken() {
        if (this.refresh_token) {
            return this.getTokenFromRefreshToken();
        }
        if (this.auth_mode === 'extend') {
            return this.getTokenFromClientCredentials();
        }
        throw new Error(
            'Workday: provide a refresh_token (or use extend auth_mode with tenant_alias for client_credentials).'
        );
    }

    async refreshAccessToken(refreshTokenObject) {
        const token =
            get(refreshTokenObject, 'refresh_token', null) || this.refresh_token;
        if (token) this.refresh_token = token;
        return this.getTokenFromRefreshToken();
    }

    isAuthenticated() {
        return !!(
            this.access_token ||
            this.refresh_token ||
            (this.client_id &&
                this.client_secret &&
                this.auth_mode === 'extend' &&
                this.tenant_alias)
        );
    }

    async ensureAccessToken() {
        const skewMs = 60 * 1000;
        if (
            this.access_token &&
            this.accessTokenExpire &&
            Date.now() < this.accessTokenExpire.getTime() - skewMs
        ) {
            return this.access_token;
        }
        if (
            this.access_token &&
            !this.accessTokenExpire &&
            !this.refresh_token &&
            !(this.auth_mode === 'extend' && this.tenant_alias)
        ) {
            return this.access_token;
        }
        await this.getToken();
        return this.access_token;
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

    async _authedGet(options) {
        await this.ensureAccessToken();
        return this._get(options);
    }

    async _authedPost(options) {
        await this.ensureAccessToken();
        return this._post(options);
    }

    // ---- Identity / Workers (Common) ---------------------------------------

    /**
     * List workers.
     * GET /workers
     * @see https://developer.workday.com/documentation/dan1370797991225
     */
    async listWorkers(params = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.workers + this._buildQuery(params),
        });
    }

    /**
     * Get a worker by WID, reference id, or `me`.
     * GET /workers/{id}
     */
    async getWorker(id, params = {}) {
        return this._authedGet({
            url:
                this.baseUrl +
                this.URLs.workerById(id) +
                this._buildQuery(params),
        });
    }

    /** Convenience identity probe used by testAuth / entity details. */
    async getCurrentWorker(params = {}) {
        return this.getWorker('me', params);
    }

    // ---- Supervisory Organizations (Common) --------------------------------

    /**
     * List supervisory organizations.
     * GET /supervisoryOrganizations
     * @see https://developer.workday.com/documentation/dan1370797989680
     */
    async listSupervisoryOrganizations(params = {}) {
        return this._authedGet({
            url:
                this.baseUrl +
                this.URLs.supervisoryOrganizations +
                this._buildQuery(params),
        });
    }

    /**
     * Get a supervisory organization.
     * GET /supervisoryOrganizations/{id}
     */
    async getSupervisoryOrganization(id, params = {}) {
        return this._authedGet({
            url:
                this.baseUrl +
                this.URLs.supervisoryOrganizationById(id) +
                this._buildQuery(params),
        });
    }

    /**
     * List workers in a supervisory organization.
     * GET /supervisoryOrganizations/{id}/workers
     * @see https://developer.workday.com/documentation/dan1370797990836
     */
    async listSupervisoryOrganizationWorkers(id, params = {}) {
        return this._authedGet({
            url:
                this.baseUrl +
                this.URLs.supervisoryOrganizationWorkers(id) +
                this._buildQuery(params),
        });
    }

    // ---- Staffing / Job Changes --------------------------------------------

    /**
     * Initiate a Change Job event for a worker.
     * POST {staffing}/workers/{id}/jobChanges
     * @see https://developer.workday.com/documentation/uxy1596042655617
     */
    async createJobChange(workerId, data = {}) {
        return this._authedPost({
            url: this.staffingBaseUrl + this.URLs.jobChanges(workerId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Submit (or save-for-later) a Change Job event.
     * POST {staffing}/jobChanges/{id}/submit
     */
    async submitJobChange(jobChangeId, data = {}) {
        return this._authedPost({
            url: this.staffingBaseUrl + this.URLs.submitJobChange(jobChangeId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Absence Management ------------------------------------------------

    /**
     * List eligible absence types for a worker.
     * GET {absence}/workers/{id}/eligibleAbsenceTypes
     * @see https://community.workday.com/sites/default/files/file-hosting/restapi/
     */
    async listEligibleAbsenceTypes(workerId, params = {}) {
        return this._authedGet({
            url:
                this.absenceBaseUrl +
                this.URLs.eligibleAbsenceTypes(workerId) +
                this._buildQuery(params),
        });
    }

    /**
     * List time-off details for a worker.
     * GET {absence}/workers/{id}/timeOffDetails
     */
    async listTimeOffDetails(workerId, params = {}) {
        return this._authedGet({
            url:
                this.absenceBaseUrl +
                this.URLs.timeOffDetails(workerId) +
                this._buildQuery(params),
        });
    }

    /**
     * Get a single time-off detail entry.
     * GET {absence}/workers/{id}/timeOffDetails/{subresourceID}
     */
    async getTimeOffDetail(workerId, entryId, params = {}) {
        return this._authedGet({
            url:
                this.absenceBaseUrl +
                this.URLs.timeOffDetailById(workerId, entryId) +
                this._buildQuery(params),
        });
    }

    /**
     * Create a time-off request (initiates the business process).
     * POST {absence}/workers/{id}/requestTimeOff
     */
    async requestTimeOff(workerId, data = {}) {
        return this._authedPost({
            url: this.absenceBaseUrl + this.URLs.requestTimeOff(workerId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * List leaves of absence for a worker.
     * GET {absence}/workers/{id}/leavesOfAbsence
     */
    async listLeavesOfAbsence(workerId, params = {}) {
        return this._authedGet({
            url:
                this.absenceBaseUrl +
                this.URLs.leavesOfAbsence(workerId) +
                this._buildQuery(params),
        });
    }

    /**
     * List absence / leave balances.
     * GET {absence}/balances
     */
    async listBalances(params = {}) {
        return this._authedGet({
            url:
                this.absenceBaseUrl +
                this.URLs.balances +
                this._buildQuery(params),
        });
    }

    /**
     * Get a specific balance.
     * GET {absence}/balances/{id}
     */
    async getBalance(id, params = {}) {
        return this._authedGet({
            url:
                this.absenceBaseUrl +
                this.URLs.balanceById(id) +
                this._buildQuery(params),
        });
    }

    async testAuth() {
        // Prefer /workers/me; fall back to a bounded list if `me` is denied.
        try {
            return await this.getCurrentWorker();
        } catch (e) {
            return this.listWorkers({ limit: 1 });
        }
    }
}

module.exports = { Api };
