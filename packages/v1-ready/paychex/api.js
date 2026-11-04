const { OAuth2Requester, ModuleConstants, get } = require('@friggframework/core');

/**
 * Paychex Flex External API client.
 *
 * Auth: OAuth 2.0 client credentials (application API key + secret).
 *   POST https://api.paychex.com/auth/oauth/v2/token
 *     Content-Type: application/x-www-form-urlencoded
 *     grant_type=client_credentials&client_id=...&client_secret=...
 *   Then: Authorization: Bearer <access_token>
 *
 * Base URL (production): https://api.paychex.com
 * Access tokens expire in ~600 seconds; there is no refresh_token — re-request
 * with client credentials when expired.
 *
 * Partner approval is required for production API keys (Paychex Developer
 * Program). Build from public docs; sandbox credentials are issued after
 * partnership evaluation.
 *
 * Sources (official only):
 *   https://developer.paychex.com/documentation
 *   https://developer.paychex.com/sites/default/files/apidocument/openapi-merge-develop.210-public_0.json
 *   https://developer.paychex.com/resources/overview
 *   https://developer.paychex.com/partner
 *
 * The canonical machine-readable contract for this module lives in
 * ./paychex.openapi.yaml — curated subset whose operationIds match Api
 * methods 1:1 (spec-sync). Keep them in sync.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        const withGrant = {
            ...params,
            grant_type: get(params, 'grant_type', 'client_credentials'),
        };
        super(withGrant);

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'base_url', null) ||
            'https://api.paychex.com';

        this.tokenUri = `${this.baseUrl}/auth/oauth/v2/token`;

        this.access_token = get(params, 'access_token', null);
        this.client_id = get(params, 'client_id', null) || this.client_id;
        this.client_secret =
            get(params, 'client_secret', null) || this.client_secret;

        // Client-credentials tokens are re-minted, not refreshed with a
        // refresh_token (Paychex token response has no refresh_token).
        this.isRefreshable = true;

        // Optional default company for convenience helpers / entity binding.
        this.company_id =
            get(params, 'company_id', null) ||
            get(params, 'companyId', null);

        this.URLs = {
            token: '/auth/oauth/v2/token',
            companies: '/companies',
            companyById: (companyId) => `/companies/${companyId}`,
            companyWorkers: (companyId) =>
                `/companies/${companyId}/workers`,
            workerById: (workerId) => `/workers/${workerId}`,
            companyPayPeriods: (companyId) =>
                `/companies/${companyId}/payperiods`,
            companyPayPeriodById: (companyId, payPeriodId) =>
                `/companies/${companyId}/payperiods/${payPeriodId}`,
            webhookDomains: '/management/domains',
            webhooks: '/management/hooks',
            webhookById: (hookId) => `/management/hooks/${hookId}`,
        };
    }

    /**
     * JSON-Schema form for collecting Paychex application credentials.
     * Client ID / Secret come from the Paychex Developer Program after
     * partner approval (see https://developer.paychex.com/partner).
     */
    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.oauth2,
            data: {
                jsonSchema: {
                    title: 'Paychex Authentication',
                    type: 'object',
                    required: ['client_id', 'client_secret'],
                    properties: {
                        client_id: {
                            type: 'string',
                            title: 'Client ID (API Key)',
                        },
                        client_secret: {
                            type: 'string',
                            title: 'Client Secret',
                        },
                        company_id: {
                            type: 'string',
                            title: 'Default Company ID (optional)',
                        },
                    },
                },
                uiSchema: {
                    client_id: {
                        'ui:help':
                            'Application API key from the Paychex Developer Program.',
                    },
                    client_secret: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Paired with Client ID for the OAuth client_credentials grant (form-urlencoded POST to /auth/oauth/v2/token).',
                    },
                    company_id: {
                        'ui:help':
                            'Optional Paychex Flex companyId to bind as the default company for this connection. Leave blank to discover via GET /companies.',
                    },
                },
            },
        };
    }

    /**
     * Paychex requires application/x-www-form-urlencoded (not JSON).
     * The base OAuth2Requester posts JSON for client_credentials — override
     * to match the official External API docs.
     *
     * @see https://developer.paychex.com/documentation (Create Bearer token)
     */
    async getTokenFromClientCredentials() {
        try {
            const params = new URLSearchParams();
            params.append('grant_type', 'client_credentials');
            params.append('client_id', this.client_id);
            params.append('client_secret', this.client_secret);

            const tokenRes = await this._post(
                {
                    url: this.tokenUri,
                    body: params,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        Accept: 'application/json',
                    },
                },
                false
            );
            await this.setTokens(tokenRes);
            return tokenRes;
        } catch (error) {
            await this.notify(this.DLGT_INVALID_AUTH, {
                statusCode: error?.statusCode,
            });
        }
    }

    jsonHeaders(extra = {}) {
        return {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...extra,
        };
    }

    // ---- Companies ---------------------------------------------------------

    /**
     * List companies the application can access.
     * GET /companies
     * Optional query: displayid (8-digit Flex display id, no dashes/spaces).
     * @see https://developer.paychex.com/documentation
     */
    async listCompanies(query = {}) {
        const options = {
            url: this.baseUrl + this.URLs.companies,
        };
        if (query && Object.keys(query).length) options.query = query;
        return this._get(options);
    }

    /**
     * Get a company by ID.
     * GET /companies/{companyId}
     * Optional query: includelineage (boolean).
     */
    async getCompany(companyId, query) {
        const id = companyId || this.company_id;
        if (!id) {
            throw new Error(
                'Paychex: companyId is required (pass an argument or set api.company_id).'
            );
        }
        const options = {
            url: this.baseUrl + this.URLs.companyById(id),
        };
        if (query) options.query = query;
        return this._get(options);
    }

    // ---- Workers -----------------------------------------------------------

    /**
     * List workers for a company.
     * GET /companies/{companyId}/workers
     * Query (paging OR filter — not both per Paychex): offset, limit,
     * givenname, familyname, legallastfour, employeeid, from, to,
     * locationid, status.
     */
    async listCompanyWorkers(companyId, query = {}) {
        const id = companyId || this.company_id;
        if (!id) {
            throw new Error(
                'Paychex: companyId is required for listCompanyWorkers.'
            );
        }
        return this._get({
            url: this.baseUrl + this.URLs.companyWorkers(id),
            query,
        });
    }

    /**
     * Create in-progress worker(s) for a company.
     * POST /companies/{companyId}/workers
     * Content-Type: application/vnd.paychex.workers.v1+json
     */
    async createCompanyWorkers(companyId, body) {
        const id = companyId || this.company_id;
        if (!id) {
            throw new Error(
                'Paychex: companyId is required for createCompanyWorkers.'
            );
        }
        return this._post({
            url: this.baseUrl + this.URLs.companyWorkers(id),
            headers: this.jsonHeaders({
                'Content-Type': 'application/vnd.paychex.workers.v1+json',
            }),
            body,
        });
    }

    /**
     * Get a worker by ID.
     * GET /workers/{workerId}
     */
    async getWorker(workerId) {
        return this._get({
            url: this.baseUrl + this.URLs.workerById(workerId),
        });
    }

    /**
     * Update a worker.
     * PATCH /workers/{workerId}
     * Content-Type: application/vnd.paychex.worker.v1+json (or application/json).
     */
    async updateWorker(workerId, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.workerById(workerId),
            headers: this.jsonHeaders({
                'Content-Type': 'application/vnd.paychex.worker.v1+json',
            }),
            body,
        });
    }

    // ---- Pay periods -------------------------------------------------------

    /**
     * List pay periods for a company.
     * GET /companies/{companyId}/payperiods
     * Optional query: status (array), from, to.
     */
    async listCompanyPayPeriods(companyId, query = {}) {
        const id = companyId || this.company_id;
        if (!id) {
            throw new Error(
                'Paychex: companyId is required for listCompanyPayPeriods.'
            );
        }
        return this._get({
            url: this.baseUrl + this.URLs.companyPayPeriods(id),
            query,
        });
    }

    /**
     * Get a single pay period.
     * GET /companies/{companyId}/payperiods/{payperiodId}
     */
    async getCompanyPayPeriod(companyId, payPeriodId) {
        const id = companyId || this.company_id;
        if (!id) {
            throw new Error(
                'Paychex: companyId is required for getCompanyPayPeriod.'
            );
        }
        return this._get({
            url:
                this.baseUrl +
                this.URLs.companyPayPeriodById(id, payPeriodId),
        });
    }

    // ---- Webhook subscriptions ---------------------------------------------

    /**
     * List available webhook domains for the application type.
     * GET /management/domains
     * @see https://developer.paychex.com/documentation#operation/domains
     */
    async listWebhookDomains() {
        return this._get({
            url: this.baseUrl + this.URLs.webhookDomains,
        });
    }

    /**
     * List webhooks registered for the calling application.
     * GET /management/hooks
     */
    async listWebhooks() {
        return this._get({
            url: this.baseUrl + this.URLs.webhooks,
        });
    }

    /**
     * Register a webhook for the calling application.
     * POST /management/hooks
     * body: { uri, domains, authentication: { authType, ... }, companyId?, hookId? }
     */
    async createWebhook(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks,
            headers: this.jsonHeaders(),
            body,
        });
    }

    /**
     * Get a webhook by hookId.
     * GET /management/hooks/{hookId}
     */
    async getWebhook(hookId) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookById(hookId),
        });
    }

    /**
     * Delete a webhook by hookId.
     * DELETE /management/hooks/{hookId}
     */
    async deleteWebhook(hookId) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(hookId),
        });
    }

    /**
     * Verify an inbound webhook delivery when the subscription uses APIKEY
     * authentication. Paychex authenticates to your URI using the configured
     * authentication object; for APIKEY, compare the presented key to the
     * shared secret you registered.
     *
     * NO_AUTH subscriptions have no signature — callers should rely on
     * network controls. Documented auth types: NO_AUTH, BASIC_AUTH, APIKEY,
     * OAUTH2, OAUTH2_BASIC.
     *
     * @see https://developer.paychex.com/documentation (Add a webhook)
     */
    verifyWebhookDelivery({
        headers = {},
        expectedApiKey,
        headerName = 'x-api-key',
    } = {}) {
        const {
            verifyPaychexApiKeyDelivery,
        } = require('./extensions/webhooks/signature-verifier');
        return verifyPaychexApiKeyDelivery({
            headers,
            expectedApiKey,
            headerName,
        });
    }
}

module.exports = { Api };
