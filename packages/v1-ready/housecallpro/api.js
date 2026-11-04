const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Housecall Pro Public API client.
 *
 * Auth: OAuth 2.0 authorization-code grant (marketplace / connected apps).
 *   Authorize: https://pro.housecallpro.com/oauth/authorize
 *   Token:     POST https://api.housecallpro.com/oauth/token  (JSON body)
 *   API:       https://api.housecallpro.com
 *
 * Authenticated requests send `Authorization: Bearer <access_token>`.
 * (Pros may also use API keys as `Authorization: Token <key>`; this module
 * targets the OAuth connected-app path.)
 *
 * Multi-location: optional `X-Company-Id` header selects a location context.
 *
 * Docs: https://docs.housecallpro.com/
 * Auth: https://docs.housecallpro.com/docs/housecall-public-api/b87d37ae48a0d-authentication
 * Company: https://docs.housecallpro.com/docs/housecall-public-api/24a5d891a80a8-get-company
 * Webhooks: https://docs.housecallpro.com/docs/housecall-public-api/46e9e1be07621-webhooks
 *
 * Webhook subscriptions are configured in the Housecall Pro Webhooks app
 * (My Apps > Webhooks) — not via a documented public subscribe REST surface
 * on Stoplight. This module verifies inbound deliveries (Api-Signature /
 * Api-Timestamp HMAC-SHA256).
 */
const DEFAULT_SCOPE = 'public';

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://api.housecallpro.com';
        this.tokenUri = 'https://api.housecallpro.com/oauth/token';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        this.scope =
            get(params, 'scope', null) ||
            process.env.HOUSECALLPRO_SCOPE ||
            DEFAULT_SCOPE;

        this.companyId =
            get(params, 'companyId', null) ||
            get(params, 'company_id', null) ||
            process.env.HOUSECALLPRO_COMPANY_ID ||
            null;

        const state = this.state || 'STATE';
        const authorize =
            `https://pro.housecallpro.com/oauth/authorize` +
            `?response_type=code` +
            `&client_id=${this.client_id}` +
            `&redirect_uri=${this.redirect_uri}` +
            `&scope=${this.scope}` +
            `&state=${state}`;
        this.authorizationUri = encodeURI(authorize);

        this.URLs = {
            company: '/company',
            customers: '/customers',
            customer: (customerId) => `/customers/${customerId}`,
            jobs: '/jobs',
            job: (jobId) => `/jobs/${jobId}`,
            jobSchedule: (jobId) => `/jobs/${jobId}/schedule`,
            employees: '/employees',
            employee: (employeeId) => `/employees/${employeeId}`,
            estimates: '/estimates',
            estimate: (estimateId) => `/estimates/${estimateId}`,
            invoices: '/invoices',
            invoice: (invoiceId) => `/invoices/${invoiceId}`,
            leads: '/leads',
            lead: (leadId) => `/leads/${leadId}`,
        };
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    /**
     * Optional multi-location context header.
     * Docs: https://docs.housecallpro.com/docs/housecall-public-api/4c64fe617d191-multi-location-enabled-ap-is
     */
    setCompanyId(companyId) {
        this.companyId = companyId || null;
    }

    async addAuthHeaders(headers = {}) {
        const next = await super.addAuthHeaders(headers);
        if (this.companyId) {
            next['X-Company-Id'] = this.companyId;
        }
        return next;
    }

    /**
     * Housecall Pro token endpoint expects a JSON body (not form-urlencoded).
     * Clear any stale access_token so the token request is unauthenticated.
     */
    async getTokenFromCode(code) {
        delete this.access_token;
        const options = {
            url: this.tokenUri,
            headers: { 'Content-Type': 'application/json' },
            body: {
                client_id: this.client_id,
                client_secret: this.client_secret,
                grant_type: 'authorization_code',
                code,
                redirect_uri: this.redirect_uri,
            },
        };
        // Default _post stringify=true JSON-encodes the body (HCP expects JSON,
        // not application/x-www-form-urlencoded).
        const response = await this._post(options);
        await this.setTokens(response);
        return response;
    }

    /**
     * Refresh with JSON body per Housecall Pro auth docs.
     * Always persist whatever setTokens stores (refresh tokens may rotate).
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const options = {
            url: this.tokenUri,
            headers: { 'Content-Type': 'application/json' },
            body: {
                client_id: this.client_id,
                client_secret: this.client_secret,
                grant_type: 'refresh_token',
                refresh_token: refreshTokenObject.refresh_token,
                redirect_uri: this.redirect_uri,
            },
        };
        const response = await this._post(options);
        await this.setTokens(response);
        return response;
    }

    // ---- Query helpers -----------------------------------------------------

    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params || {})) {
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

    _jsonHeaders(extra = {}) {
        return { 'Content-Type': 'application/json', ...extra };
    }

    // ---- Company / identity ------------------------------------------------

    /**
     * Get the authenticated company (identity + multi-location ids).
     * GET /company
     * Docs: https://docs.housecallpro.com/docs/housecall-public-api/24a5d891a80a8-get-company
     */
    async getCompany() {
        return this._get({
            url: this.baseUrl + this.URLs.company,
        });
    }

    // ---- Customers ---------------------------------------------------------

    /**
     * List customers.
     * GET /customers
     * Common query params: page, page_size, q
     * Docs: https://docs.housecallpro.com/docs/housecall-public-api/042bd3bf861ae-get-customers
     */
    async listCustomers(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.customers + this._buildQuery(params),
        });
    }

    /**
     * Get a customer by id.
     * GET /customers/{customer_id}
     * Docs: https://docs.housecallpro.com/docs/housecall-public-api/7599b1ec89338-get-customer
     */
    async getCustomer(customerId) {
        return this._get({
            url: this.baseUrl + this.URLs.customer(customerId),
        });
    }

    /**
     * Create a customer.
     * POST /customers
     * Docs: https://docs.housecallpro.com/docs/housecall-public-api/4e0bf8c4d65d7-create-customer
     */
    async createCustomer(data) {
        return this._post({
            url: this.baseUrl + this.URLs.customers,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    /**
     * Update a customer.
     * PUT /customers/{customer_id}
     * Docs: https://docs.housecallpro.com/docs/housecall-public-api/b1c3acd657849-update-customer
     */
    async updateCustomer(customerId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.customer(customerId),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Jobs --------------------------------------------------------------

    /**
     * List jobs.
     * GET /jobs
     * Common query params: page, page_size, scheduled_start_min,
     * scheduled_start_max, customer_id, employee_ids
     * Docs: https://docs.housecallpro.com/docs/housecall-public-api/6c97704da8bf3-get-jobs
     */
    async listJobs(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.jobs + this._buildQuery(params),
        });
    }

    /**
     * Get a job by id.
     * GET /jobs/{job_id}
     */
    async getJob(jobId) {
        return this._get({
            url: this.baseUrl + this.URLs.job(jobId),
        });
    }

    /**
     * Create a job.
     * POST /jobs
     * Docs: https://docs.housecallpro.com/docs/housecall-public-api/2dcf481ed7d69-create-a-job
     */
    async createJob(data) {
        return this._post({
            url: this.baseUrl + this.URLs.jobs,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    /**
     * Update a job's schedule.
     * PUT /jobs/{job_id}/schedule
     *
     * Housecall Pro documents schedule update as a dedicated path (not a
     * general PUT /jobs/{id} resource update).
     */
    async updateJobSchedule(jobId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.jobSchedule(jobId),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Employees ---------------------------------------------------------

    /**
     * List employees.
     * GET /employees
     * Docs: https://docs.housecallpro.com/docs/housecall-public-api/303ee235f23fa-get-employees
     */
    async listEmployees(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.employees + this._buildQuery(params),
        });
    }

    /**
     * Get an employee by id.
     * GET /employees/{employee_id}
     */
    async getEmployee(employeeId) {
        return this._get({
            url: this.baseUrl + this.URLs.employee(employeeId),
        });
    }

    // ---- Estimates ---------------------------------------------------------

    /**
     * List estimates.
     * GET /estimates
     */
    async listEstimates(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.estimates + this._buildQuery(params),
        });
    }

    /**
     * Get an estimate by id.
     * GET /estimates/{estimate_id}
     */
    async getEstimate(estimateId) {
        return this._get({
            url: this.baseUrl + this.URLs.estimate(estimateId),
        });
    }

    /**
     * Create an estimate.
     * POST /estimates
     * Docs: https://docs.housecallpro.com/docs/housecall-public-api/4004d373be14c-create-an-estimate
     */
    async createEstimate(data) {
        return this._post({
            url: this.baseUrl + this.URLs.estimates,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Invoices ----------------------------------------------------------

    /**
     * List invoices.
     * GET /invoices
     * Docs: https://docs.housecallpro.com/docs/housecall-public-api/65ce9f430d605-get-invoices
     */
    async listInvoices(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.invoices + this._buildQuery(params),
        });
    }

    /**
     * Get an invoice by id/UUID.
     * GET /invoices/{invoice_id}
     * Docs: https://docs.housecallpro.com/docs/housecall-public-api/0ae16219c3e58-get-invoice-by-uuid
     */
    async getInvoice(invoiceId) {
        return this._get({
            url: this.baseUrl + this.URLs.invoice(invoiceId),
        });
    }

    // ---- Leads -------------------------------------------------------------

    /**
     * List leads.
     * GET /leads
     */
    async listLeads(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.leads + this._buildQuery(params),
        });
    }

    /**
     * Get a lead by id.
     * GET /leads/{lead_id}
     */
    async getLead(leadId) {
        return this._get({
            url: this.baseUrl + this.URLs.lead(leadId),
        });
    }

    /**
     * Create a lead.
     * POST /leads
     */
    async createLead(data) {
        return this._post({
            url: this.baseUrl + this.URLs.leads,
            headers: this._jsonHeaders(),
            body: data,
        });
    }
}

module.exports = { Api, DEFAULT_SCOPE };
