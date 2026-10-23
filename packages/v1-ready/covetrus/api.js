const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Covetrus (Pulse / Covetrus Connect) API client.
 *
 * Covetrus Pulse is a cloud-based veterinary practice management system.
 * Partner integrations use OAuth 2.0 against Covetrus Connect.
 *
 * Auth: OAuth 2.0 authorization code + refresh_token grant
 *   Authorize: https://auth.covetrus.com/oauth/authorize
 *   Token:     https://auth.covetrus.com/oauth/token
 *   Default scope (from cleared port / brief): clients invoices payments
 *
 * Base URL: https://api.covetrus.com/v1
 *
 * Official REST reference and OpenAPI are not publicly browsable — access is
 * gated behind the Covetrus Technology Integration Partner Program / Connect
 * Developers Tool Kit. This client ports the generic surface from a
 * Left Hook–cleared module and documents that fact in the OpenAPI description.
 *
 * Partner / public references:
 *   https://covetrus.com/covetrus-platform/workflow-and-productivity-tools/technology-integration-hub/
 *   https://api.covetrus.com/
 *
 * The curated contract in ./covetrus.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Keep them in sync.
 */
const DEFAULT_BASE_URL = 'https://api.covetrus.com/v1';
const DEFAULT_AUTHORIZE_URL = 'https://auth.covetrus.com/oauth/authorize';
const DEFAULT_TOKEN_URL = 'https://auth.covetrus.com/oauth/token';
const DEFAULT_SCOPE = 'clients invoices payments';

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.client_id =
            get(params, 'client_id', null) ||
            process.env.COVETRUS_CLIENT_ID ||
            this.client_id;
        this.client_secret =
            get(params, 'client_secret', null) ||
            process.env.COVETRUS_CLIENT_SECRET ||
            this.client_secret;
        this.redirect_uri =
            get(params, 'redirect_uri', null) ||
            process.env.COVETRUS_REDIRECT_URI ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/covetrus`
                : this.redirect_uri);
        this.scope =
            get(params, 'scope', null) ||
            process.env.COVETRUS_SCOPE ||
            DEFAULT_SCOPE;

        this.baseUrl = get(params, 'base_url', null) || DEFAULT_BASE_URL;
        this.tokenUri =
            get(params, 'tokenUri', null) ||
            get(params, 'token_uri', null) ||
            DEFAULT_TOKEN_URL;
        this.authorizationUri = DEFAULT_AUTHORIZE_URL;

        this.URLs = {
            practice: '/practice',
            locations: '/locations',
            locationById: (id) => `/locations/${id}`,
            clients: '/clients',
            clientById: (id) => `/clients/${id}`,
            clientsSearch: '/clients/search',
            clientPatients: (clientId) => `/clients/${clientId}/patients`,
            clientInvoices: (clientId) => `/clients/${clientId}/invoices`,
            clientBalance: (clientId) => `/clients/${clientId}/balance`,
            clientLedger: (clientId) => `/clients/${clientId}/ledger`,
            patients: '/patients',
            patientById: (id) => `/patients/${id}`,
            patientReminders: (id) => `/patients/${id}/reminders`,
            patientRecords: (id) => `/patients/${id}/records`,
            appointments: '/appointments',
            appointmentById: (id) => `/appointments/${id}`,
            invoices: '/invoices',
            invoiceById: (id) => `/invoices/${id}`,
            payments: '/payments',
            paymentById: (id) => `/payments/${id}`,
            reminders: '/reminders',
            recordById: (id) => `/records/${id}`,
            staff: '/staff',
            staffById: (id) => `/staff/${id}`,
            services: '/services',
            products: '/products',
        };
    }

    getAuthorizationUri() {
        const params = new URLSearchParams({
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            response_type: 'code',
            scope: this.scope || DEFAULT_SCOPE,
        });
        if (this.state) {
            params.append('state', this.state);
        }
        return `${this.authorizationUri}?${params.toString()}`;
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri(),
            type: 'oauth2',
            data: {
                jsonSchema: {
                    title: 'Covetrus Authentication',
                    type: 'object',
                    properties: {},
                },
                uiSchema: {},
            },
        };
    }

    async getTokenFromCode(code) {
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        params.append('redirect_uri', this.redirect_uri);

        const response = await this._post(
            {
                body: params,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                url: this.tokenUri,
            },
            false
        );
        await this.setTokens(response);
        return response;
    }

    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refreshTokenObject.refresh_token);
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);

        const response = await this._post(
            {
                body: params,
                url: this.tokenUri,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            },
            false
        );
        await this.setTokens(response);
        return response;
    }

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

    _url(path, query) {
        return this.baseUrl + path + this._buildQuery(query);
    }

    // ---- Practice & locations (identity) -----------------------------------

    async getPractice() {
        return this._get({ url: this._url(this.URLs.practice) });
    }

    async listLocations(params = {}) {
        return this._get({ url: this._url(this.URLs.locations, params) });
    }

    async getLocation(locationId) {
        return this._get({
            url: this._url(this.URLs.locationById(locationId)),
        });
    }

    // ---- Clients (pet owners) ----------------------------------------------

    async listClients(params = {}) {
        const { limit = 50, offset = 0, ...filters } = params;
        return this._get({
            url: this._url(this.URLs.clients, { limit, offset, ...filters }),
        });
    }

    async getClient(clientId) {
        return this._get({
            url: this._url(this.URLs.clientById(clientId)),
        });
    }

    async searchClients(params = {}) {
        return this._get({
            url: this._url(this.URLs.clientsSearch, params),
        });
    }

    async createClient(clientData) {
        return this._post({
            url: this._url(this.URLs.clients),
            headers: { 'Content-Type': 'application/json' },
            body: clientData,
        });
    }

    async updateClient(clientId, clientData) {
        return this._put({
            url: this._url(this.URLs.clientById(clientId)),
            headers: { 'Content-Type': 'application/json' },
            body: clientData,
        });
    }

    async getClientBalance(clientId) {
        return this._get({
            url: this._url(this.URLs.clientBalance(clientId)),
        });
    }

    async getClientLedger(clientId, params = {}) {
        return this._get({
            url: this._url(this.URLs.clientLedger(clientId), params),
        });
    }

    async listClientPatients(clientId, params = {}) {
        return this._get({
            url: this._url(this.URLs.clientPatients(clientId), params),
        });
    }

    async listClientInvoices(clientId, params = {}) {
        return this._get({
            url: this._url(this.URLs.clientInvoices(clientId), params),
        });
    }

    // ---- Patients (pets) ---------------------------------------------------

    async listPatients(params = {}) {
        const { limit = 50, offset = 0, ...filters } = params;
        return this._get({
            url: this._url(this.URLs.patients, { limit, offset, ...filters }),
        });
    }

    async getPatient(patientId) {
        return this._get({
            url: this._url(this.URLs.patientById(patientId)),
        });
    }

    // ---- Appointments ------------------------------------------------------

    async listAppointments(params = {}) {
        const { limit = 50, offset = 0, ...filters } = params;
        return this._get({
            url: this._url(this.URLs.appointments, {
                limit,
                offset,
                ...filters,
            }),
        });
    }

    async getAppointment(appointmentId) {
        return this._get({
            url: this._url(this.URLs.appointmentById(appointmentId)),
        });
    }

    // ---- Invoices ----------------------------------------------------------

    async listInvoices(params = {}) {
        const { limit = 50, offset = 0, ...filters } = params;
        return this._get({
            url: this._url(this.URLs.invoices, { limit, offset, ...filters }),
        });
    }

    async getInvoice(invoiceId) {
        return this._get({
            url: this._url(this.URLs.invoiceById(invoiceId)),
        });
    }

    // ---- Payments ----------------------------------------------------------

    async listPayments(params = {}) {
        const { limit = 50, offset = 0, ...filters } = params;
        return this._get({
            url: this._url(this.URLs.payments, { limit, offset, ...filters }),
        });
    }

    async getPayment(paymentId) {
        return this._get({
            url: this._url(this.URLs.paymentById(paymentId)),
        });
    }

    async createPayment(paymentData) {
        return this._post({
            url: this._url(this.URLs.payments),
            headers: { 'Content-Type': 'application/json' },
            body: paymentData,
        });
    }

    // ---- Reminders ---------------------------------------------------------

    async listReminders(params = {}) {
        const { limit = 50, offset = 0, ...filters } = params;
        return this._get({
            url: this._url(this.URLs.reminders, { limit, offset, ...filters }),
        });
    }

    async getPatientReminders(patientId) {
        return this._get({
            url: this._url(this.URLs.patientReminders(patientId)),
        });
    }

    // ---- Medical records ---------------------------------------------------

    async listMedicalRecords(patientId, params = {}) {
        return this._get({
            url: this._url(this.URLs.patientRecords(patientId), params),
        });
    }

    async getMedicalRecord(recordId) {
        return this._get({
            url: this._url(this.URLs.recordById(recordId)),
        });
    }

    // ---- Staff -------------------------------------------------------------

    async listStaff(params = {}) {
        return this._get({ url: this._url(this.URLs.staff, params) });
    }

    async getStaff(staffId) {
        return this._get({
            url: this._url(this.URLs.staffById(staffId)),
        });
    }

    // ---- Services & products -----------------------------------------------

    async listServices(params = {}) {
        return this._get({ url: this._url(this.URLs.services, params) });
    }

    async listProducts(params = {}) {
        return this._get({ url: this._url(this.URLs.products, params) });
    }
}

module.exports = { Api };
