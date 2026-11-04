const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Gusto App Integrations API client.
 *
 * Auth: OAuth2 authorization-code (company-scoped access token).
 *   Docs: https://docs.gusto.com/app-integrations/docs/oauth2
 *
 * Token exchange uses JSON bodies (Content-Type: application/json), not
 * form-urlencoded — see the OAuth2 guide. Access tokens expire in 2 hours;
 * refresh tokens are single-use and rotate on each refresh.
 *
 * Base URL (production): https://api.gusto.com
 * Demo/sandbox:          https://api.gusto-demo.com
 * API version header:    X-Gusto-API-Version (default 2026-06-15)
 *
 * Webhook subscription endpoints require system-level auth per Gusto
 * (SystemAccessAuth / organization API token). Pass `system_access_token`
 * for those calls; company OAuth tokens are used for company-scoped resources.
 *
 * Sources:
 *   https://docs.gusto.com/app-integrations/docs/introduction
 *   https://docs.gusto.com/app-integrations/docs/oauth2
 *   https://docs.gusto.com/app-integrations/docs/webhooks
 *   https://docs.gusto.com/app-integrations/reference/...
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'base_url', null) ||
            'https://api.gusto.com';

        this.apiVersion =
            get(params, 'apiVersion', null) ||
            get(params, 'api_version', null) ||
            '2026-06-15';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
        this.company_uuid = get(params, 'company_uuid', null);
        // System / organization token for webhook subscription management.
        this.system_access_token =
            get(params, 'system_access_token', null) ||
            get(params, 'api_token', null);

        this.URLs = {
            tokenInfo: '/v1/token_info',
            companyById: (companyId) => `/v1/companies/${companyId}`,
            employees: (companyId) => `/v1/companies/${companyId}/employees`,
            employeeById: (employeeId) => `/v1/employees/${employeeId}`,
            payrolls: (companyId) => `/v1/companies/${companyId}/payrolls`,
            payrollById: (companyId, payrollId) =>
                `/v1/companies/${companyId}/payrolls/${payrollId}`,
            webhookSubscriptions: '/v1/webhook_subscriptions',
            webhookSubscriptionById: (uuid) =>
                `/v1/webhook_subscriptions/${uuid}`,
            verifyWebhookSubscription: (uuid) =>
                `/v1/webhook_subscriptions/${uuid}/verify`,
        };

        // Gusto authorize URL does NOT take a scope query param — scopes are
        // assigned to the application in the Developer Portal / during review.
        // See https://docs.gusto.com/app-integrations/docs/oauth2
        this.authorizationUri = encodeURI(
            `${this.baseUrl}/oauth/authorize` +
                `?client_id=${this.client_id}` +
                `&redirect_uri=${this.redirect_uri}` +
                `&response_type=code` +
                `&state=${this.state}`
        );
        this.tokenUri = `${this.baseUrl}/oauth/token`;
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    /**
     * Gusto requires JSON token requests (not form-urlencoded).
     * @see https://docs.gusto.com/app-integrations/docs/oauth2
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
                redirect_uri: this.redirect_uri,
                code,
                grant_type: 'authorization_code',
            },
        };
        const response = await this._post(options);
        await this.setTokens(response);
        return response;
    }

    /**
     * Refresh tokens are single-use; the response includes a new refresh_token.
     * @see https://docs.gusto.com/app-integrations/docs/oauth2
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
                client_id: this.client_id,
                client_secret: this.client_secret,
                redirect_uri: this.redirect_uri,
                refresh_token: refreshTokenObject.refresh_token,
                grant_type: 'refresh_token',
            },
        };
        const response = await this._post(options);
        await this.setTokens(response);
        return response;
    }

    async addAuthHeaders(headers = {}) {
        const next = await super.addAuthHeaders(headers);
        next.Accept = next.Accept || 'application/json';
        next['X-Gusto-API-Version'] = this.apiVersion;
        return next;
    }

    /**
     * Auth headers for system-level endpoints (webhook subscriptions).
     * Uses system_access_token when set; otherwise falls back to the company
     * access_token (callers must supply a system token for those endpoints).
     */
    async addSystemAuthHeaders(headers = {}) {
        const next = { ...headers };
        delete next.Authorization;
        const token = this.system_access_token || this.access_token;
        if (token) {
            next.Authorization = `Bearer ${token}`;
        }
        next.Accept = next.Accept || 'application/json';
        next['X-Gusto-API-Version'] = this.apiVersion;
        return next;
    }

    jsonHeaders(extra = {}) {
        return {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...extra,
        };
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Get info about the current access token.
     * GET /v1/token_info
     * @see https://docs.gusto.com/app-integrations/reference/get-v1-token-info
     */
    async getTokenInfo() {
        return this._get({
            url: this.baseUrl + this.URLs.tokenInfo,
        });
    }

    /**
     * Resolve the company UUID from token_info (resource.type === 'Company').
     * Caches on this.company_uuid when found.
     */
    async resolveCompanyUuid() {
        if (this.company_uuid) return this.company_uuid;
        const info = await this.getTokenInfo();
        const uuid = info?.resource?.uuid;
        if (uuid && info?.resource?.type === 'Company') {
            this.company_uuid = uuid;
            return uuid;
        }
        throw new Error(
            'Gusto: token_info did not return a Company resource uuid. ' +
                'Ensure the access token is a company-level OAuth token.'
        );
    }

    // ---- Companies ---------------------------------------------------------

    /**
     * Get a company.
     * GET /v1/companies/{company_id}
     * scope: companies:read
     * @see https://docs.gusto.com/app-integrations/reference/get-v1-companies
     */
    async getCompany(companyId, query) {
        const id = companyId || (await this.resolveCompanyUuid());
        const options = {
            url: this.baseUrl + this.URLs.companyById(id),
        };
        if (query) options.query = query;
        return this._get(options);
    }

    /**
     * Update a company.
     * PUT /v1/companies/{company_id}
     * scope: companies:write
     * @see https://docs.gusto.com/app-integrations/reference/put-v1-companies
     */
    async updateCompany(companyId, body) {
        const id = companyId || (await this.resolveCompanyUuid());
        return this._put({
            url: this.baseUrl + this.URLs.companyById(id),
            headers: this.jsonHeaders(),
            body,
        });
    }

    // ---- Employees ---------------------------------------------------------

    /**
     * List employees of a company.
     * GET /v1/companies/{company_id}/employees
     * scope: employees:read
     * @see https://docs.gusto.com/app-integrations/reference/get-v1-companies-company_id-employees
     */
    async listEmployees(companyId, query = {}) {
        const id = companyId || (await this.resolveCompanyUuid());
        return this._get({
            url: this.baseUrl + this.URLs.employees(id),
            query,
        });
    }

    /**
     * Get an employee by UUID.
     * GET /v1/employees/{employee_id}
     * scope: employees:read
     * @see https://docs.gusto.com/app-integrations/reference/get-v1-employees
     */
    async getEmployee(employeeId, query) {
        const options = {
            url: this.baseUrl + this.URLs.employeeById(employeeId),
        };
        if (query) options.query = query;
        return this._get(options);
    }

    /**
     * Create an employee.
     * POST /v1/companies/{company_id}/employees
     * scope: employees:manage
     * @see https://docs.gusto.com/app-integrations/reference/post-v1-employees
     */
    async createEmployee(companyId, body) {
        const id = companyId || (await this.resolveCompanyUuid());
        return this._post({
            url: this.baseUrl + this.URLs.employees(id),
            headers: this.jsonHeaders(),
            body,
        });
    }

    /**
     * Update an employee.
     * PUT /v1/employees/{employee_id}
     * scope: employees:write
     * Body must include `version` (optimistic concurrency).
     * @see https://docs.gusto.com/app-integrations/reference/put-v1-employees
     */
    async updateEmployee(employeeId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.employeeById(employeeId),
            headers: this.jsonHeaders(),
            body,
        });
    }

    // ---- Payrolls ----------------------------------------------------------

    /**
     * List payrolls for a company.
     * GET /v1/companies/{company_id}/payrolls
     * scope: payrolls:read
     * Defaults (per Gusto): processed, regular payrolls for the past 6 months.
     * @see https://docs.gusto.com/app-integrations/reference/get-v1-companies-company_id-payrolls
     */
    async listPayrolls(companyId, query = {}) {
        const id = companyId || (await this.resolveCompanyUuid());
        return this._get({
            url: this.baseUrl + this.URLs.payrolls(id),
            query,
        });
    }

    /**
     * Get a single payroll.
     * GET /v1/companies/{company_id}/payrolls/{payroll_id}
     * scope: payrolls:read
     * @see https://docs.gusto.com/app-integrations/reference/get-v1-companies-company_id-payrolls-payroll_id
     */
    async getPayroll(companyId, payrollId, query) {
        const id = companyId || (await this.resolveCompanyUuid());
        const options = {
            url: this.baseUrl + this.URLs.payrollById(id, payrollId),
        };
        if (query) options.query = query;
        return this._get(options);
    }

    // ---- Webhook subscriptions (system auth) -------------------------------

    async _systemGet(path, query) {
        const options = {
            url: this.baseUrl + path,
            headers: await this.addSystemAuthHeaders({}),
        };
        if (query) options.query = query;
        return this._get(options);
    }

    async _systemMutate(method, path, body) {
        const headers = await this.addSystemAuthHeaders(this.jsonHeaders());
        const options = {
            url: this.baseUrl + path,
            headers,
            body,
        };
        if (method === 'post') return this._post(options);
        if (method === 'put') return this._put(options);
        if (method === 'delete') return this._delete(options);
        throw new Error(`Unsupported method ${method}`);
    }

    /**
     * List webhook subscriptions.
     * GET /v1/webhook_subscriptions
     * scope: webhook_subscriptions:read (system access)
     * @see https://docs.gusto.com/app-integrations/reference/get-v1-webhook-subscriptions
     */
    async listWebhookSubscriptions(query) {
        return this._systemGet(this.URLs.webhookSubscriptions, query);
    }

    /**
     * Get a webhook subscription.
     * GET /v1/webhook_subscriptions/{webhook_subscription_uuid}
     * scope: webhook_subscriptions:read (system access)
     * @see https://docs.gusto.com/app-integrations/reference/get-v1-webhook-subscription-uuid
     */
    async getWebhookSubscription(webhookSubscriptionUuid) {
        return this._systemGet(
            this.URLs.webhookSubscriptionById(webhookSubscriptionUuid)
        );
    }

    /**
     * Create a webhook subscription.
     * POST /v1/webhook_subscriptions
     * scope: webhook_subscriptions:write (system access)
     * body: { url, subscription_types: string[] }
     * @see https://docs.gusto.com/app-integrations/reference/post-v1-webhook-subscription
     */
    async createWebhookSubscription(body) {
        return this._systemMutate(
            'post',
            this.URLs.webhookSubscriptions,
            body
        );
    }

    /**
     * Update a webhook subscription.
     * PUT /v1/webhook_subscriptions/{webhook_subscription_uuid}
     * scope: webhook_subscriptions:write (system access)
     * @see https://docs.gusto.com/app-integrations/reference/put-v1-webhook-subscription-uuid
     */
    async updateWebhookSubscription(webhookSubscriptionUuid, body) {
        return this._systemMutate(
            'put',
            this.URLs.webhookSubscriptionById(webhookSubscriptionUuid),
            body
        );
    }

    /**
     * Delete a webhook subscription.
     * DELETE /v1/webhook_subscriptions/{webhook_subscription_uuid}
     * scope: webhook_subscriptions:write (system access)
     * @see https://docs.gusto.com/app-integrations/reference/delete-v1-webhook-subscription-uuid
     */
    async deleteWebhookSubscription(webhookSubscriptionUuid) {
        return this._systemMutate(
            'delete',
            this.URLs.webhookSubscriptionById(webhookSubscriptionUuid)
        );
    }

    /**
     * Verify a webhook subscription with the verification_token Gusto POSTed
     * to the subscriber URL.
     * PUT /v1/webhook_subscriptions/{webhook_subscription_uuid}/verify
     * scope: webhook_subscriptions:write (system access)
     * @see https://docs.gusto.com/app-integrations/reference/put-v1-verify-webhook-subscription-uuid
     */
    async verifyWebhookSubscription(webhookSubscriptionUuid, body) {
        return this._systemMutate(
            'put',
            this.URLs.verifyWebhookSubscription(webhookSubscriptionUuid),
            body
        );
    }

    /**
     * Verify an inbound webhook signature (X-Gusto-Signature).
     * HMAC-SHA256 of the raw body using the subscription's verification_token.
     * @see https://docs.gusto.com/app-integrations/docs/webhooks (Secure your webhook endpoint)
     */
    verifyWebhookSignature({
        rawBody,
        signature,
        verificationToken,
    } = {}) {
        const {
            verifyGustoSignature,
        } = require('./extensions/webhooks/signature-verifier');
        return verifyGustoSignature({
            rawBody,
            signature,
            verificationToken,
        });
    }
}

module.exports = { Api };
