const {
    OAuth2Requester,
    ModuleConstants,
    get,
} = require('@friggframework/core');

/**
 * DaySmart Vet (formerly Vetter) public REST API client.
 *
 * Auth: OAuth 2.0 client credentials.
 *   POST {domain}/oauth/access_token
 *   Content-Type: application/x-www-form-urlencoded
 *   Headers: x-api-key: {client_secret}
 *   Body: grant_type=client_credentials&client_id=…&client_secret=…&scope=APIService
 *   → Authorization: Bearer <access_token>  (expires_in ≈ 3600)
 *
 * Authenticated REST calls also send `x-api-key: {client_secret}` and place the
 * clinic API key in the path: `/api/1.0.0/{apiKey}/…`.
 *
 * Production domain:
 *   https://ulimfxq67h.execute-api.us-west-2.amazonaws.com/api
 * Sandbox domain:
 *   https://ulimfxq67h.execute-api.us-west-2.amazonaws.com/sandbox
 *
 * Official docs: https://sandbox.vettersoftware.com/docs/
 *
 * The curated contract in ./daysmartvet.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Keep them in sync.
 *
 * Webhook subscription management is NOT offered in the published DaySmart Vet
 * API reference — no create/list/delete webhook REST surface is documented.
 */

const PRODUCTION_BASE_URL =
    'https://ulimfxq67h.execute-api.us-west-2.amazonaws.com/api';
const SANDBOX_BASE_URL =
    'https://ulimfxq67h.execute-api.us-west-2.amazonaws.com/sandbox';

/** Required OAuth scope from the official Authentication docs. */
const API_SERVICE_SCOPE = 'APIService';

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
        // Clinic API key embedded in every REST path (`/api/1.0.0/{apiKey}/…`).
        this.api_key =
            get(params, 'api_key', null) || get(params, 'apiKey', null);
        this.scope = get(params, 'scope', null) || API_SERVICE_SCOPE;
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
            overrideToken || `${this.baseUrl}/oauth/access_token`;

        // Client-credentials tokens are re-minted, not refresh_token rotated.
        this.isRefreshable = true;

        this.URLs = {
            clinic: () => this._clinicPath('clinic'),
            clients: () => this._clinicPath('clients'),
            client: (clientId) => this._clinicPath(`clients/${clientId}`),
            patients: () => this._clinicPath('patients'),
            patient: (patientId) => this._clinicPath(`patients/${patientId}`),
            appointments: () => this._clinicPath('appointments'),
            appointment: (appointmentId) =>
                this._clinicPath(`appointments/${appointmentId}`),
            invoices: () => this._clinicPath('invoices'),
            invoice: (invoiceId) => this._clinicPath(`invoices/${invoiceId}`),
            payments: () => this._clinicPath('payments'),
            paymentTypes: () => this._clinicPath('payment-types'),
            species: () => this._clinicPath('species'),
            breeds: () => this._clinicPath('breeds'),
        };
    }

    /**
     * Build `/api/1.0.0/{apiKey}/{resource}` once the clinic API key is set.
     */
    _clinicPath(resource) {
        const key = this._requireApiKey();
        const cleaned = String(resource || '').replace(/^\/+/, '');
        return `/api/1.0.0/${encodeURIComponent(key)}/${cleaned}`;
    }

    _requireApiKey() {
        if (!this.api_key) {
            throw new Error(
                'DaySmart Vet: api_key (clinic API key) is required on every /api/1.0.0/{apiKey}/… path.'
            );
        }
        return String(this.api_key);
    }

    /**
     * JSON-Schema form for collecting OAuth client credentials + clinic API key.
     */
    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.oauth2,
            data: {
                jsonSchema: {
                    title: 'DaySmart Vet Authentication',
                    type: 'object',
                    required: ['client_id', 'client_secret', 'api_key'],
                    properties: {
                        client_id: {
                            type: 'string',
                            title: 'Client ID',
                        },
                        client_secret: {
                            type: 'string',
                            title: 'Client Secret',
                        },
                        api_key: {
                            type: 'string',
                            title: 'Clinic API Key',
                            description:
                                'Clinic-scoped API key used in REST paths (/api/1.0.0/{apiKey}/…). Returned on GET /clinic as resource.apiKey.',
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
                            'OAuth client_id obtained from DaySmart Vet. Exchanged at {domain}/oauth/access_token with grant_type=client_credentials and scope=APIService.',
                    },
                    client_secret: {
                        'ui:widget': 'password',
                        'ui:help':
                            'OAuth client_secret. Also sent as the x-api-key request header on token and REST calls per the official docs.',
                    },
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Clinic API key embedded in every REST path. Distinct from the OAuth client_secret.',
                    },
                    environment: {
                        'ui:help':
                            'production → …/api stage; sandbox → …/sandbox stage (see https://sandbox.vettersoftware.com/docs/).',
                    },
                },
            },
        };
    }

    setEnvironment(environment) {
        const env = String(environment || 'production').toLowerCase();
        this.environment =
            env === 'sandbox' || env === 'demo' ? 'sandbox' : 'production';
        this.baseUrl =
            this.environment === 'sandbox'
                ? SANDBOX_BASE_URL
                : PRODUCTION_BASE_URL;
        this.tokenUri = `${this.baseUrl}/oauth/access_token`;
    }

    setApiKey(apiKey) {
        if (apiKey != null && apiKey !== '') {
            this.api_key = String(apiKey);
        }
    }

    /**
     * Official docs require x-api-key: {client_secret} on every authenticated
     * call in addition to Authorization: Bearer {token}.
     */
    async addAuthHeaders(headers = {}) {
        const next = await super.addAuthHeaders(headers);
        if (this.client_secret) {
            next['x-api-key'] = this.client_secret;
        }
        return next;
    }

    /**
     * Mint a Bearer token via client_credentials.
     * Docs: https://sandbox.vettersoftware.com/docs/ (Authentication)
     */
    async getTokenFromClientCredentials() {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        params.append('scope', this.scope || API_SERVICE_SCOPE);

        const options = {
            url: this.tokenUri,
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cache-Control': 'no-cache',
                'x-api-key': this.client_secret,
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
                'DaySmart Vet: client_id and client_secret are required to obtain an access token.'
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

    async _authedPut(options) {
        await this.ensureAccessToken();
        return this._put(options);
    }

    _jsonHeaders(extra = {}) {
        return {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...extra,
        };
    }

    /**
     * Build list query params. Official list endpoints share page / perPage
     * (default 20, max 200) plus optional where / orderBy / showAll / category.
     */
    _listQuery(params = {}) {
        const q = {};
        if (params.page != null) q.page = params.page;
        if (params.perPage != null) q.perPage = params.perPage;
        if (params.where != null) q.where = params.where;
        if (params.orderBy != null) q.orderBy = params.orderBy;
        if (params.showAll != null) q.showAll = params.showAll;
        if (params.category != null) q.category = params.category;
        if (params.showAllInvoice != null) {
            q.showAllInvoice = params.showAllInvoice;
        }
        if (params.showAllInvoiceItem != null) {
            q.showAllInvoiceItem = params.showAllInvoiceItem;
        }
        return q;
    }

    // ---- Clinic / identity -------------------------------------------------

    /**
     * Display the clinic information (identity).
     * GET /api/1.0.0/{apiKey}/clinic
     */
    async getClinic() {
        return this._authedGet({
            url: this.baseUrl + this.URLs.clinic(),
        });
    }

    // ---- Clients (pet owners) ----------------------------------------------

    /**
     * Display a listing of the clients.
     * GET /api/1.0.0/{apiKey}/clients
     */
    async listClients(params = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.clients(),
            query: this._listQuery(params),
        });
    }

    /**
     * Display the specified client.
     * GET /api/1.0.0/{apiKey}/clients/{clientId}
     */
    async getClient(clientId) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.client(clientId),
        });
    }

    /**
     * Store a newly created client in storage.
     * POST /api/1.0.0/{apiKey}/clients
     */
    async createClient(clientData) {
        return this._authedPost({
            url: this.baseUrl + this.URLs.clients(),
            headers: this._jsonHeaders(),
            body: clientData,
        });
    }

    /**
     * Update the specified client in storage.
     * PUT /api/1.0.0/{apiKey}/clients/{clientId}
     */
    async updateClient(clientId, clientData) {
        return this._authedPut({
            url: this.baseUrl + this.URLs.client(clientId),
            headers: this._jsonHeaders(),
            body: clientData,
        });
    }

    // ---- Patients (pets) ---------------------------------------------------

    /**
     * Display a listing of the patients.
     * GET /api/1.0.0/{apiKey}/patients
     */
    async listPatients(params = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.patients(),
            query: this._listQuery(params),
        });
    }

    /**
     * Display the specified patient.
     * GET /api/1.0.0/{apiKey}/patients/{patientId}
     */
    async getPatient(patientId) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.patient(patientId),
        });
    }

    /**
     * Store a newly created patient in storage.
     * POST /api/1.0.0/{apiKey}/patients
     */
    async createPatient(patientData) {
        return this._authedPost({
            url: this.baseUrl + this.URLs.patients(),
            headers: this._jsonHeaders(),
            body: patientData,
        });
    }

    /**
     * Update the specified patient in storage.
     * PUT /api/1.0.0/{apiKey}/patients/{patientId}
     */
    async updatePatient(patientId, patientData) {
        return this._authedPut({
            url: this.baseUrl + this.URLs.patient(patientId),
            headers: this._jsonHeaders(),
            body: patientData,
        });
    }

    // ---- Appointments ------------------------------------------------------

    /**
     * Display a listing of the appointments.
     * GET /api/1.0.0/{apiKey}/appointments
     * Optional `category`: 0 Medical, 1 Personal, 2 Both.
     */
    async listAppointments(params = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.appointments(),
            query: this._listQuery(params),
        });
    }

    /**
     * Display the specified appointment.
     * GET /api/1.0.0/{apiKey}/appointments/{appointmentId}
     */
    async getAppointment(appointmentId) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.appointment(appointmentId),
        });
    }

    /**
     * Store a newly created appointment in storage.
     * POST /api/1.0.0/{apiKey}/appointments
     */
    async createAppointment(appointmentData) {
        return this._authedPost({
            url: this.baseUrl + this.URLs.appointments(),
            headers: this._jsonHeaders(),
            body: appointmentData,
        });
    }

    /**
     * Update the specified appointment in storage.
     * PUT /api/1.0.0/{apiKey}/appointments/{appointmentId}
     */
    async updateAppointment(appointmentId, appointmentData) {
        return this._authedPut({
            url: this.baseUrl + this.URLs.appointment(appointmentId),
            headers: this._jsonHeaders(),
            body: appointmentData,
        });
    }

    // ---- Invoices ----------------------------------------------------------

    /**
     * Display a listing of the invoices.
     * GET /api/1.0.0/{apiKey}/invoices
     */
    async listInvoices(params = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.invoices(),
            query: this._listQuery(params),
        });
    }

    /**
     * Display the specified invoice.
     * GET /api/1.0.0/{apiKey}/invoices/{invoiceId}
     */
    async getInvoice(invoiceId, params = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.invoice(invoiceId),
            query: this._listQuery(params),
        });
    }

    // ---- Payments ----------------------------------------------------------

    /**
     * Display a listing of the available payments.
     * GET /api/1.0.0/{apiKey}/payments
     */
    async listPayments(params = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.payments(),
            query: this._listQuery(params),
        });
    }

    /**
     * Display a listing of the available payment types.
     * GET /api/1.0.0/{apiKey}/payment-types
     */
    async listPaymentTypes(params = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.paymentTypes(),
            query: this._listQuery(params),
        });
    }

    // ---- Reference data ----------------------------------------------------

    /**
     * Display a listing of the available species.
     * GET /api/1.0.0/{apiKey}/species
     */
    async listSpecies(params = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.species(),
            query: this._listQuery(params),
        });
    }

    /**
     * Display a listing of the available breeds.
     * GET /api/1.0.0/{apiKey}/breeds
     */
    async listBreeds(params = {}) {
        return this._authedGet({
            url: this.baseUrl + this.URLs.breeds(),
            query: this._listQuery(params),
        });
    }
}

module.exports = {
    Api,
    PRODUCTION_BASE_URL,
    SANDBOX_BASE_URL,
    API_SERVICE_SCOPE,
};
