const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Tekmetric Partner API client.
 *
 * Tekmetric is a cloud-based auto repair shop management platform. The partner
 * REST API is gated (request access at https://api.tekmetric.com/); approved
 * partners authenticate with OAuth 2.0 **client credentials**.
 *
 * Auth (official docs: https://api.tekmetric.com/docs — Authentication /
 * Access Token):
 *   POST {base}/oauth/token
 *     Authorization: Basic base64(client_id:client_secret)
 *     Content-Type: application/x-www-form-urlencoded
 *     Body: grant_type=client_credentials
 *   Subsequent calls: Authorization: Bearer <access_token>
 *   Token `scope` is a space-separated list of authorized shop IDs.
 *
 * Environments:
 *   Sandbox:    https://sandbox.tekmetric.com/api/v1  (module default)
 *   Production: https://shop.tekmetric.com/api/v1
 *
 * This module defaults to the sandbox host (matching the cleared Left Hook
 * source port). Override with `baseUrl` / `TEKMETRIC_BASE_URL`.
 *
 * Official reference (partner-gated SPA): https://api.tekmetric.com/docs
 * Tekmetric does not publish a downloadable OpenAPI export; `tekmetric.openapi.yaml`
 * is Left Hook's curated subset of the documented surface that `api.js` implements.
 *
 * Ported from cleared Left Hook-owned module source (generic Api only).
 * Client-specific coupling and unverified /payments + /invoices helpers from
 * that source were stripped — those paths are not listed on the official docs nav.
 */
const DEFAULT_BASE_URL = 'https://sandbox.tekmetric.com/api/v1';

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super({
            ...params,
            grant_type: 'client_credentials',
        });

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'baseURL', null) ||
            process.env.TEKMETRIC_BASE_URL ||
            DEFAULT_BASE_URL;
        // OAuth2Requester also reads `baseURL`; keep both aligned.
        this.baseURL = this.baseUrl;

        this.tokenUri = `${this.baseUrl}/oauth/token`;
        this.authorizationUri = null;
        this.isRefreshable = true;

        this.client_id =
            get(params, 'client_id', null) ||
            process.env.TEKMETRIC_CLIENT_ID ||
            null;
        this.client_secret =
            get(params, 'client_secret', null) ||
            process.env.TEKMETRIC_CLIENT_SECRET ||
            null;

        // Prefer an explicit access_token; accept TEKMETRIC_API_KEY / api_key as
        // a pre-issued bearer (the source module's naming).
        const rawToken =
            get(params, 'access_token', null) ||
            get(params, 'api_key', null) ||
            process.env.TEKMETRIC_API_KEY ||
            null;
        this.access_token = rawToken
            ? String(rawToken).replace(/^Bearer\s+/i, '').trim()
            : null;

        // Shop IDs from the last token response `scope` (space-separated).
        this.shopIds = [];
        const scope = get(params, 'scope', null);
        if (typeof scope === 'string' && scope.trim()) {
            this.shopIds = scope.trim().split(/\s+/);
        }

        this.URLs = {
            token: '/oauth/token',
            shops: '/shops',
            shop: (id) => `/shops/${id}`,
            customers: '/customers',
            customer: (id) => `/customers/${id}`,
            vehicles: '/vehicles',
            vehicle: (id) => `/vehicles/${id}`,
            repairOrders: '/repair-orders',
            repairOrder: (id) => `/repair-orders/${id}`,
            jobs: '/jobs',
            job: (id) => `/jobs/${id}`,
            appointments: '/appointments',
            appointment: (id) => `/appointments/${id}`,
            employees: '/employees',
            employee: (id) => `/employees/${id}`,
        };
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: 'oauth2',
            grant_type: 'client_credentials',
            data: {
                jsonSchema: {
                    title: 'Tekmetric Authentication',
                    type: 'object',
                    required: ['client_id', 'client_secret'],
                    properties: {
                        client_id: {
                            type: 'string',
                            title: 'Client ID',
                        },
                        client_secret: {
                            type: 'string',
                            title: 'Client Secret',
                        },
                        access_token: {
                            type: 'string',
                            title: 'Access Token (optional)',
                        },
                    },
                },
                uiSchema: {
                    client_id: {
                        'ui:help':
                            'OAuth client ID issued by Tekmetric after partner approval at https://api.tekmetric.com/',
                    },
                    client_secret: {
                        'ui:widget': 'password',
                        'ui:help':
                            'OAuth client secret. Exchanged via POST /oauth/token (client_credentials) for a Bearer access token.',
                    },
                    access_token: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Optional pre-issued bearer token. When set, skips the token exchange. Same value the source module stored as TEKMETRIC_API_KEY.',
                    },
                },
            },
        };
    }

    /**
     * Client-credentials has no refresh_token; consider a non-empty access_token
     * (or the ability to mint one) as authenticated.
     */
    isAuthenticated() {
        return !!(this.access_token || (this.client_id && this.client_secret));
    }

    /**
     * Tekmetric requires HTTP Basic + form body `grant_type=client_credentials`
     * (not the JSON client_id/secret body that OAuth2Requester's default uses).
     * Docs: https://api.tekmetric.com/docs — Access Token.
     *
     * OpenAPI operationId: getAccessToken
     */
    async getAccessToken() {
        return this.getTokenFromClientCredentials();
    }

    async getTokenFromClientCredentials() {
        if (!this.client_id || !this.client_secret) {
            throw new Error(
                'Tekmetric client_credentials requires client_id and client_secret'
            );
        }

        // Token endpoint must not send a stale Bearer header.
        const previous = this.access_token;
        this.access_token = undefined;

        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');

        const options = {
            url: this.tokenUri,
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                Authorization: `Basic ${Buffer.from(
                    `${this.client_id}:${this.client_secret}`
                ).toString('base64')}`,
            },
        };

        try {
            const response = await this._post(options, false);
            await this.setTokens(response);
            if (typeof response?.scope === 'string' && response.scope.trim()) {
                this.shopIds = response.scope.trim().split(/\s+/);
            }
            return response;
        } catch (error) {
            this.access_token = previous;
            throw error;
        }
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

    /**
     * Normalize list filters. Accepts the source module's `shopId` alias and
     * maps it to Tekmetric's documented `shop` query parameter.
     */
    _listQuery(params = {}) {
        const q = { ...params };
        if (q.shopId !== undefined && q.shop === undefined) {
            q.shop = q.shopId;
            delete q.shopId;
        }
        if (q.page === undefined) q.page = 0;
        if (q.size === undefined) q.size = 25;
        return q;
    }

    _jsonHeaders(extra = {}) {
        return { 'Content-Type': 'application/json', Accept: 'application/json', ...extra };
    }

    // ---- Shops / identity --------------------------------------------------

    /**
     * List authorized shops.
     * GET /shops
     * Docs: https://api.tekmetric.com/docs — Shops
     */
    async listShops() {
        return this._get({ url: this.baseUrl + this.URLs.shops });
    }

    /**
     * Get a shop by id.
     * GET /shops/{id}
     * Docs: https://api.tekmetric.com/docs — Shop
     */
    async getShop(shopId) {
        return this._get({ url: this.baseUrl + this.URLs.shop(shopId) });
    }

    // ---- Customers ---------------------------------------------------------

    /**
     * List/search customers (Spring page envelope).
     * GET /customers?shop=&page=&size=&search=...
     * Docs: https://api.tekmetric.com/docs — Customers
     */
    async listCustomers(params = {}) {
        const query = this._listQuery(params);
        return this._get({
            url: this.baseUrl + this.URLs.customers + this._buildQuery(query),
        });
    }

    /**
     * Get a customer by id.
     * GET /customers/{id}
     */
    async getCustomer(customerId) {
        return this._get({
            url: this.baseUrl + this.URLs.customer(customerId),
        });
    }

    /**
     * Create a customer.
     * POST /customers
     * Docs: https://api.tekmetric.com/docs — Create Customer
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
     * PATCH /customers/{id}
     * Docs: https://api.tekmetric.com/docs — Update Customer
     */
    async updateCustomer(customerId, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.customer(customerId),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Vehicles ----------------------------------------------------------

    /**
     * List vehicles.
     * GET /vehicles
     * Docs: https://api.tekmetric.com/docs — Vehicles
     */
    async listVehicles(params = {}) {
        const query = this._listQuery(params);
        return this._get({
            url: this.baseUrl + this.URLs.vehicles + this._buildQuery(query),
        });
    }

    /**
     * Get a vehicle by id.
     * GET /vehicles/{id}
     */
    async getVehicle(vehicleId) {
        return this._get({
            url: this.baseUrl + this.URLs.vehicle(vehicleId),
        });
    }

    /**
     * Create a vehicle.
     * POST /vehicles
     * Docs: https://api.tekmetric.com/docs — Create Vehicle
     */
    async createVehicle(data) {
        return this._post({
            url: this.baseUrl + this.URLs.vehicles,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    /**
     * Update a vehicle.
     * PATCH /vehicles/{id}
     * Docs: https://api.tekmetric.com/docs — Update Vehicle
     */
    async updateVehicle(vehicleId, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.vehicle(vehicleId),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Repair orders -----------------------------------------------------

    /**
     * List repair orders.
     * GET /repair-orders
     * Docs: https://api.tekmetric.com/docs — Repair Orders
     *
     * Common filters: shop, page, size, customerId, vehicleId,
     * repairOrderStatusId, updatedDateStart, updatedDateEnd, repairOrderNumber.
     * The source module's `status` alias maps to `repairOrderStatusId`.
     */
    async listRepairOrders(params = {}) {
        const query = this._listQuery(params);
        if (query.status !== undefined && query.repairOrderStatusId === undefined) {
            query.repairOrderStatusId = query.status;
            delete query.status;
        }
        if (query.startDate !== undefined && query.updatedDateStart === undefined) {
            query.updatedDateStart = query.startDate;
            delete query.startDate;
        }
        if (query.endDate !== undefined && query.updatedDateEnd === undefined) {
            query.updatedDateEnd = query.endDate;
            delete query.endDate;
        }
        return this._get({
            url:
                this.baseUrl +
                this.URLs.repairOrders +
                this._buildQuery(query),
        });
    }

    /**
     * Get a repair order by id.
     * GET /repair-orders/{id}
     */
    async getRepairOrder(repairOrderId) {
        return this._get({
            url: this.baseUrl + this.URLs.repairOrder(repairOrderId),
        });
    }

    /**
     * Update a repair order.
     * PATCH /repair-orders/{id}
     * Docs: https://api.tekmetric.com/docs — Update Repair Order
     */
    async updateRepairOrder(repairOrderId, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.repairOrder(repairOrderId),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Jobs --------------------------------------------------------------

    /**
     * List jobs.
     * GET /jobs
     * Docs: https://api.tekmetric.com/docs — Jobs
     */
    async listJobs(params = {}) {
        const query = this._listQuery(params);
        return this._get({
            url: this.baseUrl + this.URLs.jobs + this._buildQuery(query),
        });
    }

    /**
     * Get a job by id.
     * GET /jobs/{id}
     */
    async getJob(jobId) {
        return this._get({ url: this.baseUrl + this.URLs.job(jobId) });
    }

    /**
     * Update a job.
     * PATCH /jobs/{id}
     * Docs: https://api.tekmetric.com/docs — Update Job
     */
    async updateJob(jobId, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.job(jobId),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Appointments ------------------------------------------------------

    /**
     * List appointments.
     * GET /appointments
     * Docs: https://api.tekmetric.com/docs — Appointments
     */
    async listAppointments(params = {}) {
        const query = this._listQuery(params);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.appointments +
                this._buildQuery(query),
        });
    }

    /**
     * Get an appointment by id.
     * GET /appointments/{id}
     */
    async getAppointment(appointmentId) {
        return this._get({
            url: this.baseUrl + this.URLs.appointment(appointmentId),
        });
    }

    /**
     * Create an appointment.
     * POST /appointments
     * Docs: https://api.tekmetric.com/docs — Create Appointment
     */
    async createAppointment(data) {
        return this._post({
            url: this.baseUrl + this.URLs.appointments,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    /**
     * Update an appointment.
     * PATCH /appointments/{id}
     * Docs: https://api.tekmetric.com/docs — Update Appointment
     */
    async updateAppointment(appointmentId, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.appointment(appointmentId),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    /**
     * Delete an appointment.
     * DELETE /appointments/{id}
     * Docs: https://api.tekmetric.com/docs — Delete Appointment
     */
    async deleteAppointment(appointmentId) {
        return this._delete({
            url: this.baseUrl + this.URLs.appointment(appointmentId),
        });
    }

    // ---- Employees ---------------------------------------------------------

    /**
     * List employees.
     * GET /employees
     * Docs: https://api.tekmetric.com/docs — Employees
     */
    async listEmployees(params = {}) {
        const query = this._listQuery(params);
        return this._get({
            url: this.baseUrl + this.URLs.employees + this._buildQuery(query),
        });
    }

    /**
     * Get an employee by id.
     * GET /employees/{id}
     */
    async getEmployee(employeeId) {
        return this._get({
            url: this.baseUrl + this.URLs.employee(employeeId),
        });
    }
}

module.exports = { Api, DEFAULT_BASE_URL };
