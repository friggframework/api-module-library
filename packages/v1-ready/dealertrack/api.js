const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Dealertrack (Cox Automotive) API client.
 *
 * Dealertrack is Cox Automotive's DMS. Public developer access is partner-gated
 * through Opentrack and the Cox Automotive Integration Platform
 * (https://developer.coxautoinc.com/). No open, self-service REST OpenAPI is
 * published. This client ports the Left Hook–cleared module surface (OAuth2
 * authorization-code + refresh, REST base `https://api.dealertrack.com/v1`)
 * into Frigg v2 shape. Paths align with Opentrack program domains (Customers,
 * Vehicles, Service, Parts) advertised publicly; exact REST path shapes are
 * not confirmed against a public OpenAPI — see the PR open questions.
 *
 * Auth: OAuth 2.0 authorization-code with refresh_token grant.
 *   Authorize: https://auth.dealertrack.com/oauth/authorize
 *   Token:     https://auth.dealertrack.com/oauth/token
 *   Default scope: `service customers repairs payments`
 *
 * The curated machine-readable contract lives in ./dealertrack.openapi.yaml —
 * this client mirrors it 1:1 (one method per operationId). Keep them in sync.
 */

const BASE_URL = 'https://api.dealertrack.com/v1';
const AUTHORIZE_URL = 'https://auth.dealertrack.com/oauth/authorize';
const TOKEN_URI = 'https://auth.dealertrack.com/oauth/token';
const DEFAULT_SCOPE = 'service customers repairs payments';

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = get(params, 'baseUrl', null) || BASE_URL;
        this.tokenUri = TOKEN_URI;
        this.authorizationUri = AUTHORIZE_URL;

        this.client_id =
            this.client_id ||
            get(params, 'client_id', null) ||
            process.env.DEALERTRACK_CLIENT_ID;
        this.client_secret =
            this.client_secret ||
            get(params, 'client_secret', null) ||
            process.env.DEALERTRACK_CLIENT_SECRET;
        this.redirect_uri =
            this.redirect_uri ||
            get(params, 'redirect_uri', null) ||
            process.env.DEALERTRACK_REDIRECT_URI ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/dealertrack`
                : null);
        this.scope =
            this.scope ||
            get(params, 'scope', null) ||
            process.env.DEALERTRACK_SCOPE ||
            DEFAULT_SCOPE;

        this.access_token =
            get(params, 'access_token', null) || this.access_token || null;
        this.refresh_token =
            get(params, 'refresh_token', null) || this.refresh_token || null;

        this.authorizationUri = this._buildAuthorizationUri();

        this.URLs = {
            dealer: '/dealer',
            locations: '/locations',
            locationById: (id) => `/locations/${id}`,
            customers: '/customers',
            customerById: (id) => `/customers/${id}`,
            customersSearch: '/customers/search',
            vehicles: '/vehicles',
            vehicleById: (id) => `/vehicles/${id}`,
            customerVehicles: (customerId) =>
                `/customers/${customerId}/vehicles`,
            vehicleDecode: (vin) => `/vehicles/decode/${vin}`,
            repairOrders: '/repair-orders',
            repairOrderById: (id) => `/repair-orders/${id}`,
            invoices: '/invoices',
            invoiceById: (id) => `/invoices/${id}`,
            payments: '/payments',
            paymentById: (id) => `/payments/${id}`,
            appointments: '/appointments',
            appointmentById: (id) => `/appointments/${id}`,
            vehicleServiceHistory: (vehicleId) =>
                `/vehicles/${vehicleId}/service-history`,
            customerServiceHistory: (customerId) =>
                `/customers/${customerId}/service-history`,
            parts: '/parts',
            partById: (id) => `/parts/${id}`,
            partsSearch: '/parts/search',
            laborOperations: '/labor-operations',
            laborOperationById: (id) => `/labor-operations/${id}`,
            technicians: '/technicians',
            technicianById: (id) => `/technicians/${id}`,
            serviceAdvisors: '/service-advisors',
            serviceAdvisorById: (id) => `/service-advisors/${id}`,
        };
    }

    _buildAuthorizationUri() {
        const q = new URLSearchParams({
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            response_type: 'code',
            scope: this.scope || DEFAULT_SCOPE,
        });
        if (this.state) q.set('state', this.state);
        return `${AUTHORIZE_URL}?${q.toString()}`;
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
            url: this.getAuthUri(),
            type: 'oauth2',
            data: {},
        };
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

    addJsonHeaders(options = {}) {
        options.headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...options.headers,
        };
        return options;
    }

    /**
     * Exchange an authorization code for tokens.
     * Form body: grant_type, code, client_id, client_secret, redirect_uri.
     */
    async getTokenFromCode(code) {
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        params.append('redirect_uri', this.redirect_uri);

        const options = {
            body: params,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            url: this.tokenUri,
        };

        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    /**
     * Refresh the access token with grant_type=refresh_token.
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append(
            'refresh_token',
            refreshTokenObject.refresh_token || this.refresh_token
        );
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);

        const options = {
            body: params,
            url: this.tokenUri,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    // ---- Dealer & locations ------------------------------------------------

    /** GET /dealer — authenticated dealer / dealership identity. */
    async getDealer() {
        return this._get({ url: this.baseUrl + this.URLs.dealer });
    }

    /** GET /locations */
    async listLocations(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.locations + this._buildQuery(params),
        });
    }

    /** GET /locations/{locationId} */
    async getLocation(locationId) {
        return this._get({
            url: this.baseUrl + this.URLs.locationById(locationId),
        });
    }

    // ---- Customers ---------------------------------------------------------

    /** GET /customers */
    async listCustomers(params = {}) {
        const { limit = 50, offset = 0, ...filters } = params;
        return this._get({
            url:
                this.baseUrl +
                this.URLs.customers +
                this._buildQuery({ limit, offset, ...filters }),
        });
    }

    /** GET /customers/{customerId} */
    async getCustomer(customerId) {
        return this._get({
            url: this.baseUrl + this.URLs.customerById(customerId),
        });
    }

    /** GET /customers/search */
    async searchCustomers(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.customersSearch +
                this._buildQuery(params),
        });
    }

    /** POST /customers */
    async createCustomer(customerData) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.customers,
                body: customerData,
            })
        );
    }

    /** PUT /customers/{customerId} */
    async updateCustomer(customerId, customerData) {
        return this._put(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.customerById(customerId),
                body: customerData,
            })
        );
    }

    // ---- Vehicles ----------------------------------------------------------

    /** GET /vehicles */
    async listVehicles(params = {}) {
        const { limit = 50, offset = 0, ...filters } = params;
        return this._get({
            url:
                this.baseUrl +
                this.URLs.vehicles +
                this._buildQuery({ limit, offset, ...filters }),
        });
    }

    /** GET /vehicles/{vehicleId} */
    async getVehicle(vehicleId) {
        return this._get({
            url: this.baseUrl + this.URLs.vehicleById(vehicleId),
        });
    }

    /** GET /customers/{customerId}/vehicles */
    async listCustomerVehicles(customerId) {
        return this._get({
            url: this.baseUrl + this.URLs.customerVehicles(customerId),
        });
    }

    /** GET /vehicles/decode/{vin} */
    async decodeVin(vin) {
        return this._get({
            url: this.baseUrl + this.URLs.vehicleDecode(vin),
        });
    }

    // ---- Repair orders -----------------------------------------------------

    /** GET /repair-orders */
    async listRepairOrders(params = {}) {
        const { limit = 50, offset = 0, ...filters } = params;
        return this._get({
            url:
                this.baseUrl +
                this.URLs.repairOrders +
                this._buildQuery({ limit, offset, ...filters }),
        });
    }

    /** GET /repair-orders/{repairOrderId} */
    async getRepairOrder(repairOrderId) {
        return this._get({
            url: this.baseUrl + this.URLs.repairOrderById(repairOrderId),
        });
    }

    /** POST /repair-orders */
    async createRepairOrder(repairOrderData) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.repairOrders,
                body: repairOrderData,
            })
        );
    }

    /** PUT /repair-orders/{repairOrderId} */
    async updateRepairOrder(repairOrderId, repairOrderData) {
        return this._put(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.repairOrderById(repairOrderId),
                body: repairOrderData,
            })
        );
    }

    // ---- Invoices ----------------------------------------------------------

    /** GET /invoices */
    async listInvoices(params = {}) {
        const { limit = 50, offset = 0, ...filters } = params;
        return this._get({
            url:
                this.baseUrl +
                this.URLs.invoices +
                this._buildQuery({ limit, offset, ...filters }),
        });
    }

    /** GET /invoices/{invoiceId} */
    async getInvoice(invoiceId) {
        return this._get({
            url: this.baseUrl + this.URLs.invoiceById(invoiceId),
        });
    }

    // ---- Payments ----------------------------------------------------------

    /** GET /payments */
    async listPayments(params = {}) {
        const { limit = 50, offset = 0, ...filters } = params;
        return this._get({
            url:
                this.baseUrl +
                this.URLs.payments +
                this._buildQuery({ limit, offset, ...filters }),
        });
    }

    /** GET /payments/{paymentId} */
    async getPayment(paymentId) {
        return this._get({
            url: this.baseUrl + this.URLs.paymentById(paymentId),
        });
    }

    /** POST /payments */
    async createPayment(paymentData) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.payments,
                body: paymentData,
            })
        );
    }

    // ---- Appointments ------------------------------------------------------

    /** GET /appointments */
    async listAppointments(params = {}) {
        const { limit = 50, offset = 0, ...filters } = params;
        return this._get({
            url:
                this.baseUrl +
                this.URLs.appointments +
                this._buildQuery({ limit, offset, ...filters }),
        });
    }

    /** GET /appointments/{appointmentId} */
    async getAppointment(appointmentId) {
        return this._get({
            url: this.baseUrl + this.URLs.appointmentById(appointmentId),
        });
    }

    /** POST /appointments */
    async createAppointment(appointmentData) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.appointments,
                body: appointmentData,
            })
        );
    }

    // ---- Service history ---------------------------------------------------

    /** GET /vehicles/{vehicleId}/service-history */
    async getVehicleServiceHistory(vehicleId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.vehicleServiceHistory(vehicleId) +
                this._buildQuery(params),
        });
    }

    /** GET /customers/{customerId}/service-history */
    async getCustomerServiceHistory(customerId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.customerServiceHistory(customerId) +
                this._buildQuery(params),
        });
    }

    // ---- Parts -------------------------------------------------------------

    /** GET /parts */
    async listParts(params = {}) {
        const { limit = 50, offset = 0, ...filters } = params;
        return this._get({
            url:
                this.baseUrl +
                this.URLs.parts +
                this._buildQuery({ limit, offset, ...filters }),
        });
    }

    /** GET /parts/{partId} */
    async getPart(partId) {
        return this._get({
            url: this.baseUrl + this.URLs.partById(partId),
        });
    }

    /** GET /parts/search */
    async searchParts(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.partsSearch + this._buildQuery(params),
        });
    }

    // ---- Labor operations --------------------------------------------------

    /** GET /labor-operations */
    async listLaborOperations(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.laborOperations +
                this._buildQuery(params),
        });
    }

    /** GET /labor-operations/{operationId} */
    async getLaborOperation(operationId) {
        return this._get({
            url: this.baseUrl + this.URLs.laborOperationById(operationId),
        });
    }

    // ---- Technicians -------------------------------------------------------

    /** GET /technicians */
    async listTechnicians(params = {}) {
        return this._get({
            url:
                this.baseUrl + this.URLs.technicians + this._buildQuery(params),
        });
    }

    /** GET /technicians/{technicianId} */
    async getTechnician(technicianId) {
        return this._get({
            url: this.baseUrl + this.URLs.technicianById(technicianId),
        });
    }

    // ---- Service advisors --------------------------------------------------

    /** GET /service-advisors */
    async listServiceAdvisors(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.serviceAdvisors +
                this._buildQuery(params),
        });
    }

    /** GET /service-advisors/{advisorId} */
    async getServiceAdvisor(advisorId) {
        return this._get({
            url: this.baseUrl + this.URLs.serviceAdvisorById(advisorId),
        });
    }
}

module.exports = { Api, BASE_URL, AUTHORIZE_URL, TOKEN_URI, DEFAULT_SCOPE };
