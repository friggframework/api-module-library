const {
    OAuth2Requester,
    ModuleConstants,
    get,
} = require('@friggframework/core');

/**
 * Paylocity WebLink / Web Services API client (api/v2).
 *
 * Auth: OAuth 2.0 client credentials.
 *   POST {tokenUri}
 *   Content-Type: application/x-www-form-urlencoded
 *   grant_type=client_credentials&client_id=…&client_secret=…&scope=WebLinkAPI
 *   → Authorization: Bearer <access_token>  (expires_in ≈ 3600)
 *
 * Production:
 *   baseUrl  https://api.paylocity.com/api/v2
 *   tokenUri https://api.paylocity.com/IdentityServer/connect/token
 * Sandbox (after partner/customer approval):
 *   baseUrl  https://dc1demogw.paylocity.com/api/v2
 *   tokenUri https://dc1demogw.paylocity.com/IdentityServer/connect/token
 *
 * Official docs:
 *   https://developer.paylocity.com/integrations/docs/getting-started
 *   https://developer.paylocity.com/integrations/reference/authentication-weblink
 *   https://developer.paylocity.com/integrations/reference/get-all-employees
 *   https://developer.paylocity.com/integrations/reference/get-employee
 *   https://developer.paylocity.com/integrations/reference/add-employee
 *   https://developer.paylocity.com/integrations/reference/update-employee
 *   https://developer.paylocity.com/integrations/reference/get-all-company-codes-and-descriptions-by-resource
 *   https://developer.paylocity.com/integrations/reference/get-company-specific-open-api-documentation
 *
 * The curated contract in ./paylocity.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Keep them in sync.
 *
 * Webhook subscription management is NOT offered as a public REST API —
 * Paylocity configures delivery URLs via partner/customer access requests.
 * See https://developer.paylocity.com/integrations/v2025-08-12/reference/webhooks-overview
 */

const PRODUCTION_BASE_URL = 'https://api.paylocity.com/api/v2';
const PRODUCTION_TOKEN_URI =
    'https://api.paylocity.com/IdentityServer/connect/token';
const SANDBOX_BASE_URL = 'https://dc1demogw.paylocity.com/api/v2';
const SANDBOX_TOKEN_URI =
    'https://dc1demogw.paylocity.com/IdentityServer/connect/token';

/** Required scope for the Weblink / Web Services API (official docs). */
const WEBLINK_SCOPE = 'WebLinkAPI';

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super({
            ...params,
            grant_type: 'client_credentials',
        });

        this.client_id =
            get(params, 'client_id', null) || get(params, 'clientId', null);
        this.client_secret =
            get(params, 'client_secret', null) ||
            get(params, 'clientSecret', null);
        this.company_id =
            get(params, 'company_id', null) || get(params, 'companyId', null);
        // Official Weblink scope is fixed; allow override only if explicitly set.
        this.scope = get(params, 'scope', null) || WEBLINK_SCOPE;
        this.access_token =
            get(params, 'access_token', null) ||
            get(params, 'accessToken', null);

        const environment = String(
            get(params, 'environment', null) || 'production'
        ).toLowerCase();
        this.environment =
            environment === 'sandbox' || environment === 'demo'
                ? 'sandbox'
                : 'production';

        const overrideBase =
            get(params, 'base_url', null) || get(params, 'baseUrl', null);
        const overrideToken =
            get(params, 'token_uri', null) || get(params, 'tokenUri', null);

        this.baseUrl =
            overrideBase ||
            (this.environment === 'sandbox'
                ? SANDBOX_BASE_URL
                : PRODUCTION_BASE_URL);
        this.tokenUri =
            overrideToken ||
            (this.environment === 'sandbox'
                ? SANDBOX_TOKEN_URI
                : PRODUCTION_TOKEN_URI);

        // Client-credentials tokens are re-minted, not refresh_token rotated.
        this.isRefreshable = true;

        this.URLs = {
            employees: (companyId) => `/companies/${companyId}/employees`,
            employeeById: (companyId, employeeId) =>
                `/companies/${companyId}/employees/${employeeId}`,
            companyCodes: (companyId, codeResource) =>
                `/companies/${companyId}/codes/${codeResource}`,
            companyOpenApi: (companyId) =>
                `/companies/${companyId}/openapi`,
        };
    }

    /**
     * JSON-Schema form for collecting Paylocity OAuth client credentials and
     * the company id the credential is authorized to access.
     */
    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.oauth2,
            data: {
                jsonSchema: {
                    title: 'Paylocity Authentication',
                    type: 'object',
                    required: ['client_id', 'client_secret', 'company_id'],
                    properties: {
                        client_id: {
                            type: 'string',
                            title: 'Client ID',
                        },
                        client_secret: {
                            type: 'string',
                            title: 'Client Secret',
                        },
                        company_id: {
                            type: 'string',
                            title: 'Company ID',
                        },
                        environment: {
                            type: 'string',
                            title: 'Environment',
                            enum: ['production', 'sandbox'],
                            default: 'production',
                        },
                    },
                },
                uiSchema: {
                    client_id: {
                        'ui:help':
                            'OAuth client_id issued by Paylocity after sandbox/production access approval. See Getting Started on the developer portal.',
                    },
                    client_secret: {
                        'ui:widget': 'password',
                        'ui:help':
                            'OAuth client secret paired with the Client ID. Exchanged for a Bearer token via POST …/IdentityServer/connect/token with scope=WebLinkAPI.',
                    },
                    company_id: {
                        'ui:help':
                            'Paylocity Company Identifier (≤9 chars) your credentials are authorized to access. Required on every /companies/{companyId}/… path.',
                        'ui:placeholder': 'e.g. A12345',
                    },
                    environment: {
                        'ui:help':
                            'production → api.paylocity.com; sandbox → dc1demogw.paylocity.com (demo gateway).',
                    },
                },
            },
        };
    }

    /**
     * Switch production vs sandbox hosts (unless base_url / token_uri overrides
     * were already applied at construction — callers can still set those).
     */
    setEnvironment(environment) {
        const env = String(environment || 'production').toLowerCase();
        this.environment =
            env === 'sandbox' || env === 'demo' ? 'sandbox' : 'production';
        this.baseUrl =
            this.environment === 'sandbox'
                ? SANDBOX_BASE_URL
                : PRODUCTION_BASE_URL;
        this.tokenUri =
            this.environment === 'sandbox'
                ? SANDBOX_TOKEN_URI
                : PRODUCTION_TOKEN_URI;
    }

    setCompanyId(companyId) {
        if (companyId != null && companyId !== '') {
            this.company_id = String(companyId);
        }
    }

    _requireCompanyId(companyId) {
        const id =
            companyId != null && companyId !== ''
                ? String(companyId)
                : this.company_id
                  ? String(this.company_id)
                  : null;
        if (!id) {
            throw new Error(
                'Paylocity: companyId is required (pass it or set api.company_id).'
            );
        }
        return id;
    }

    /**
     * Paylocity requires application/x-www-form-urlencoded with scope=WebLinkAPI.
     * The core OAuth2Requester default posts JSON + audience; override to match
     * the official Authentication (Weblink) docs.
     *
     * @see https://developer.paylocity.com/integrations/reference/authentication-weblink
     */
    async getTokenFromClientCredentials() {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        params.append('scope', this.scope || WEBLINK_SCOPE);

        const options = {
            url: this.tokenUri,
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    /** Alias for callers / capability manifest that expect a getToken name. */
    async getToken() {
        return this.getTokenFromClientCredentials();
    }

    /**
     * Client-credentials auth has no refresh_token. Authenticated means we
     * either hold a Bearer token or can mint one from client_id + secret.
     */
    isAuthenticated() {
        return !!(
            this.access_token ||
            (this.client_id && this.client_secret)
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
        if (!this.client_id || !this.client_secret) {
            throw new Error(
                'Paylocity: client_id and client_secret are required to obtain an access token.'
            );
        }
        await this.getTokenFromClientCredentials();
        return this.access_token;
    }

    async _authedGet(options) {
        await this.ensureAccessToken();
        return this._get(options);
    }

    async _authedPost(options) {
        await this.ensureAccessToken();
        return this._post(options);
    }

    async _authedPatch(options) {
        await this.ensureAccessToken();
        return this._patch(options);
    }

    // ---- Employees ---------------------------------------------------------

    /**
     * Get All Employees.
     * GET /companies/{companyId}/employees
     *
     * Official query params: pagesize (default 25), pagenumber (0-based),
     * includetotalcount (default true). Response may include header
     * X-Pcty-Total-Count when includetotalcount is true.
     *
     * @see https://developer.paylocity.com/integrations/reference/get-all-employees
     */
    async listEmployees(companyId, params = {}) {
        // Allow listEmployees({ pagesize }) when api.company_id is already set.
        let cid = companyId;
        let query = params;
        if (
            companyId &&
            typeof companyId === 'object' &&
            !Array.isArray(companyId)
        ) {
            query = companyId;
            cid = this.company_id;
        }
        const resolvedId = this._requireCompanyId(cid);

        const q = {};
        if (query.pagesize != null) q.pagesize = query.pagesize;
        if (query.pagenumber != null) q.pagenumber = query.pagenumber;
        if (query.includetotalcount != null) {
            q.includetotalcount = query.includetotalcount;
        }

        return this._authedGet({
            url: this.baseUrl + this.URLs.employees(resolvedId),
            query: q,
        });
    }

    /**
     * Get Employee.
     * GET /companies/{companyId}/employees/{employeeId}
     *
     * @see https://developer.paylocity.com/integrations/reference/get-employee
     */
    async getEmployee(companyId, employeeId) {
        // Support getEmployee(employeeId) when company_id is already set.
        let cid = companyId;
        let eid = employeeId;
        if (eid === undefined) {
            eid = companyId;
            cid = this.company_id;
        }
        const resolvedCompany = this._requireCompanyId(cid);
        if (eid == null || eid === '') {
            throw new Error('Paylocity: employeeId is required.');
        }
        return this._authedGet({
            url:
                this.baseUrl +
                this.URLs.employeeById(resolvedCompany, eid),
        });
    }

    /**
     * Create New Employee.
     * POST /companies/{companyId}/employees
     *
     * Body is the Employee model (firstName, lastName, status, primaryPayRate,
     * homeAddress, workAddress, departmentPosition, …). Leave employeeId blank
     * to let Web Pay assign the next available ID. Returns 201 with
     * [{ employeeId }].
     *
     * @see https://developer.paylocity.com/integrations/reference/add-employee
     */
    async createEmployee(companyId, body) {
        let cid = companyId;
        let payload = body;
        if (payload === undefined && companyId && typeof companyId === 'object') {
            payload = companyId;
            cid = this.company_id;
        }
        const resolvedCompany = this._requireCompanyId(cid);
        return this._authedPost({
            url: this.baseUrl + this.URLs.employees(resolvedCompany),
            headers: { 'Content-Type': 'application/json' },
            body: payload || {},
        });
    }

    /**
     * Update Employee.
     * PATCH /companies/{companyId}/employees/{employeeId}
     *
     * Partial Employee model. Status changes (including termination via
     * status.employeeStatus = T) use this endpoint per official docs.
     *
     * @see https://developer.paylocity.com/integrations/reference/update-employee
     */
    async updateEmployee(companyId, employeeId, body) {
        // Support updateEmployee(employeeId, body) when company_id is set.
        let cid = companyId;
        let eid = employeeId;
        let payload = body;
        if (payload === undefined && eid && typeof eid === 'object') {
            payload = eid;
            eid = companyId;
            cid = this.company_id;
        }
        const resolvedCompany = this._requireCompanyId(cid);
        if (eid == null || eid === '') {
            throw new Error('Paylocity: employeeId is required.');
        }
        return this._authedPatch({
            url:
                this.baseUrl +
                this.URLs.employeeById(resolvedCompany, eid),
            headers: { 'Content-Type': 'application/json' },
            body: payload || {},
        });
    }

    // ---- Company codes / OpenAPI -------------------------------------------

    /**
     * Get All Company Codes for a resource.
     * GET /companies/{companyId}/codes/{codeResource}
     *
     * codeResource examples (official): costcenter1, costcenter2, costcenter3,
     * deductions, earnings, taxes, paygrade, positions.
     *
     * @see https://developer.paylocity.com/integrations/reference/get-all-company-codes-and-descriptions-by-resource
     */
    async listCompanyCodes(companyId, codeResource) {
        let cid = companyId;
        let resource = codeResource;
        if (resource === undefined) {
            resource = companyId;
            cid = this.company_id;
        }
        const resolvedCompany = this._requireCompanyId(cid);
        if (!resource) {
            throw new Error(
                'Paylocity: codeResource is required (e.g. costcenter1, deductions, positions).'
            );
        }
        return this._authedGet({
            url:
                this.baseUrl +
                this.URLs.companyCodes(resolvedCompany, resource),
        });
    }

    /**
     * Get Company-Specific Open API Documentation.
     * GET /companies/{companyId}/openapi
     *
     * Returns an OpenAPI document customized with company-specific enums and
     * required fields for Payroll/HR schemas.
     *
     * @see https://developer.paylocity.com/integrations/reference/get-company-specific-open-api-documentation
     */
    async getCompanyOpenApi(companyId) {
        const resolvedCompany = this._requireCompanyId(companyId);
        return this._authedGet({
            url: this.baseUrl + this.URLs.companyOpenApi(resolvedCompany),
        });
    }
}

module.exports = {
    Api,
    PRODUCTION_BASE_URL,
    PRODUCTION_TOKEN_URI,
    SANDBOX_BASE_URL,
    SANDBOX_TOKEN_URI,
    WEBLINK_SCOPE,
};
