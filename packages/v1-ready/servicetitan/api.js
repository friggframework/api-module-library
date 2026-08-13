const { OAuth2Requester, get } = require('@friggframework/core');

// ServiceTitan runs two isolated stacks. The integration stack is a clone of
// production used for development; credentials are NOT interchangeable between
// them, so the environment is part of the stored credential.
const ENVIRONMENTS = {
    production: {
        authUrl: 'https://auth.servicetitan.io',
        apiUrl: 'https://api.servicetitan.io',
    },
    integration: {
        authUrl: 'https://auth-integration.servicetitan.io',
        apiUrl: 'https://api-integration.servicetitan.io',
    },
};

// Access tokens live 15 minutes. Refresh a little early so a token cannot
// expire between addAuthHeaders() and the request landing at ServiceTitan.
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        this.grant_type = 'client_credentials';

        this.environment = get(params, 'environment', 'production');
        this.tenant_id = get(params, 'tenant_id', null);
        this.app_key = get(params, 'app_key', null);
        this.access_token = get(params, 'access_token', null);
        this.accessTokenExpire = get(params, 'accessTokenExpire', null);
        this.isRequestingToken = false;

        this.setup();
    }

    setup() {
        const env = ENVIRONMENTS[this.environment];
        if (!env) {
            throw new Error(
                `Unknown ServiceTitan environment "${this.environment}". Expected one of: ${Object.keys(ENVIRONMENTS).join(', ')}`
            );
        }
        this.baseUrl = env.apiUrl;
        this.tokenUri = `${env.authUrl}/connect/token`;

        // Every resource path is tenant-scoped: /{module}/v2/tenant/{tenantId}/...
        const crm = this.moduleUrl('crm');
        const jpm = this.moduleUrl('jpm');
        const accounting = this.moduleUrl('accounting');
        const dispatch = this.moduleUrl('dispatch');
        const settings = this.moduleUrl('settings');

        this.URLs = {
            // --- CRM: customers of record, where Podium contacts map to ---
            customers: `${crm}/customers`,
            customerById: (id) => `${crm}/customers/${id}`,
            customerContacts: (id) => `${crm}/customers/${id}/contacts`,
            customerNotes: (id) => `${crm}/customers/${id}/notes`,
            locations: `${crm}/locations`,
            locationById: (id) => `${crm}/locations/${id}`,
            locationContacts: (id) => `${crm}/locations/${id}/contacts`,
            leads: `${crm}/leads`,
            bookings: `${crm}/bookings`,

            // --- JPM: the job/appointment lifecycle that drives automations ---
            jobs: `${jpm}/jobs`,
            jobById: (id) => `${jpm}/jobs/${id}`,
            jobNotes: (id) => `${jpm}/jobs/${id}/notes`,
            jobTypes: `${jpm}/job-types`,
            appointments: `${jpm}/appointments`,
            appointmentById: (id) => `${jpm}/appointments/${id}`,

            // --- Dispatch: who is assigned, for "tech on the way" ---
            appointmentAssignments: `${dispatch}/appointment-assignments`,

            // --- Accounting: payment writeback ---
            invoices: `${accounting}/invoices`,
            invoiceById: (id) => `${accounting}/invoices/${id}`,
            payments: `${accounting}/payments`,

            // --- Settings: used by testAuth and for display names ---
            technicians: `${settings}/technicians`,
            businessUnits: `${settings}/business-units`,
        };
    }

    moduleUrl(moduleName) {
        return `${this.baseUrl}/${moduleName}/v2/tenant/${this.tenant_id}`;
    }

    // --- Auth -------------------------------------------------------------
    //
    // Two overrides below work around the base OAuth2Requester, which is
    // written for the authorization_code flow:
    //
    //   1. getTokenFromClientCredentials() posts a JSON body. ServiceTitan's
    //      /connect/token requires application/x-www-form-urlencoded.
    //   2. isAuthenticated() requires refresh_token and refreshTokenExpire to
    //      be set. Neither exists in the client_credentials flow, so it always
    //      returns false and no token is ever considered valid.
    //
    // refreshAuth() is deliberately NOT overridden: core 2.0 branches on
    // `this.grant_type` correctly and so routes to getTokenFromClientCredentials()
    // below, and its own implementation adds failure logging and the
    // DLGT_INVALID_AUTH notification that a local override would lose.
    // (On core 1.x that branch read `this.grantType`, which was never assigned,
    // so it took the refresh-token path and broke this flow.)

    async getTokenFromClientCredentials() {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);

        // addAuthHeaders() acquires a token on demand, so the token request
        // itself must be flagged or it recurses forever.
        this.isRequestingToken = true;
        try {
            const response = await this._post(
                {
                    url: this.tokenUri,
                    body: params,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                },
                false
            );
            await this.setTokens(response);
            return response;
        } finally {
            this.isRequestingToken = false;
        }
    }

    async setTokens(params) {
        this.access_token = get(params, 'access_token');
        const expiresIn = get(params, 'expires_in', 900);
        this.accessTokenExpire = new Date(Date.now() + expiresIn * 1000);
        // No refresh token exists in the client_credentials flow. Leaving the
        // base class's refresh_token handling out avoids persisting a bogus
        // refreshTokenExpire of `new Date(Date.now() + null * 1000)`.
        await this.notify(this.DLGT_TOKEN_UPDATE);
    }

    isAuthenticated() {
        return Boolean(this.access_token) && !this.isTokenExpired();
    }

    isTokenExpired() {
        if (!this.accessTokenExpire) return true;
        const expiry = new Date(this.accessTokenExpire).getTime();
        return Number.isNaN(expiry) || Date.now() + TOKEN_EXPIRY_BUFFER_MS >= expiry;
    }

    async addAuthHeaders(headers) {
        // The token request must not recurse into token acquisition, and the
        // /connect/token endpoint takes no Bearer header or app key.
        if (this.isRequestingToken) {
            return headers || {};
        }

        // Tokens last 15 minutes. Fetch proactively rather than relying on the
        // base class's 401 retry, which only ever refreshes once per instance.
        if (!this.isAuthenticated()) {
            await this.getTokenFromClientCredentials();
        }

        return {
            ...headers,
            Authorization: `Bearer ${this.access_token}`,
            'ST-App-Key': this.app_key,
        };
    }

    // --- Pagination -------------------------------------------------------

    // ServiceTitan list responses are { page, pageSize, hasMore, totalCount, data }.
    // Walks every page and returns the concatenated `data`.
    async paginateAll(fetchPage, query = {}) {
        const pageSize = query.pageSize || 200;
        let page = query.page || 1;
        const results = [];

        for (;;) {
            const response = await fetchPage({ ...query, page, pageSize });
            results.push(...(response.data || []));
            if (!response.hasMore) return results;
            page += 1;
        }
    }

    // --- CRM --------------------------------------------------------------

    async listCustomers(query) {
        return this._get({ url: this.URLs.customers, query });
    }

    async getAllCustomers(query = {}) {
        return this.paginateAll((q) => this.listCustomers(q), query);
    }

    async getCustomer(customerId) {
        return this._get({ url: this.URLs.customerById(customerId) });
    }

    async createCustomer(body) {
        return this._post({ url: this.URLs.customers, body });
    }

    async updateCustomer(customerId, body) {
        return this._patch({ url: this.URLs.customerById(customerId), body });
    }

    async listCustomerContacts(customerId, query) {
        return this._get({ url: this.URLs.customerContacts(customerId), query });
    }

    async createCustomerNote(customerId, body) {
        return this._post({ url: this.URLs.customerNotes(customerId), body });
    }

    async listLocations(query) {
        return this._get({ url: this.URLs.locations, query });
    }

    async getAllLocations(query = {}) {
        return this.paginateAll((q) => this.listLocations(q), query);
    }

    async getLocation(locationId) {
        return this._get({ url: this.URLs.locationById(locationId) });
    }

    async listLocationContacts(locationId, query) {
        return this._get({ url: this.URLs.locationContacts(locationId), query });
    }

    async createLead(body) {
        return this._post({ url: this.URLs.leads, body });
    }

    async createBooking(body) {
        return this._post({ url: this.URLs.bookings, body });
    }

    // --- JPM --------------------------------------------------------------

    async listJobs(query) {
        return this._get({ url: this.URLs.jobs, query });
    }

    async getAllJobs(query = {}) {
        return this.paginateAll((q) => this.listJobs(q), query);
    }

    async getJob(jobId) {
        return this._get({ url: this.URLs.jobById(jobId) });
    }

    async createJobNote(jobId, body) {
        return this._post({ url: this.URLs.jobNotes(jobId), body });
    }

    async listJobTypes(query) {
        return this._get({ url: this.URLs.jobTypes, query });
    }

    async listAppointments(query) {
        return this._get({ url: this.URLs.appointments, query });
    }

    async getAllAppointments(query = {}) {
        return this.paginateAll((q) => this.listAppointments(q), query);
    }

    async getAppointment(appointmentId) {
        return this._get({ url: this.URLs.appointmentById(appointmentId) });
    }

    // --- Dispatch ---------------------------------------------------------

    async listAppointmentAssignments(query) {
        return this._get({ url: this.URLs.appointmentAssignments, query });
    }

    // --- Accounting -------------------------------------------------------

    async listInvoices(query) {
        return this._get({ url: this.URLs.invoices, query });
    }

    async getInvoice(invoiceId) {
        return this._get({ url: this.URLs.invoiceById(invoiceId) });
    }

    async listPayments(query) {
        return this._get({ url: this.URLs.payments, query });
    }

    async createPayment(body) {
        return this._post({ url: this.URLs.payments, body });
    }

    // --- Settings ---------------------------------------------------------

    async listTechnicians(query) {
        return this._get({ url: this.URLs.technicians, query });
    }

    async getTechnician(technicianId) {
        return this._get({ url: `${this.URLs.technicians}/${technicianId}` });
    }

    async listBusinessUnits(query) {
        return this._get({ url: this.URLs.businessUnits, query });
    }

    // Cheapest authenticated call that proves tenant + app key + credentials
    // all line up. A wrong tenant returns 401/403 rather than an empty list.
    async getTenantDetails() {
        const response = await this.listBusinessUnits({ page: 1, pageSize: 1 });
        return {
            tenantId: this.tenant_id,
            environment: this.environment,
            name: response?.data?.[0]?.name || `Tenant ${this.tenant_id}`,
            businessUnitCount: response?.totalCount ?? null,
        };
    }
}

module.exports = { Api, ENVIRONMENTS };
