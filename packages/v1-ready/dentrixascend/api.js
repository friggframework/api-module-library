const { OAuth2Requester, get } = require('@friggframework/core');

const PROD_API_HOST = 'https://prod.hs1api.com';
const PROD_BASE_URL = `${PROD_API_HOST}/ascend-gateway/api`;

/**
 * Dentrix Ascend (Henry Schein One) Public API client.
 *
 * Auth: OAuth 2.0 **client credentials** (not authorization code).
 *   POST {apiHost}/oauth/client_credential/accesstoken?grant_type=client_credentials
 *   Body (x-www-form-urlencoded): client_id, client_secret
 *   Then: Authorization: Bearer <access_token> and Organization-ID on every call.
 *
 * Base URL (production): https://prod.hs1api.com/ascend-gateway/api
 * Sandbox:               https://test.hs1api.com/ascend-gateway/api
 *
 * Docs:
 *   https://papidocs.hs1api.com/publicapi/api-consumer-guide
 *   https://papidocs.hs1api.com/publicapi/apispec
 *
 * Note: An earlier Left Hook draft targeted api.dentrixascend.com/v2 with an
 * authorization-code + refresh_token flow and scope string
 * "patients ledger payments". That host/grant/scope combination is **not**
 * present in the published HS1 Public API docs; this client follows the
 * official papidocs.hs1api.com surface instead.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        const apiHost =
            get(params, 'api_host', null) ||
            process.env.DENTRIX_ASCEND_API_HOST ||
            PROD_API_HOST;
        const baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'baseURL', null) ||
            process.env.DENTRIX_ASCEND_BASE_URL ||
            PROD_BASE_URL;

        super({
            ...params,
            grant_type: 'client_credentials',
            client_id:
                get(params, 'client_id', null) ||
                process.env.DENTRIX_ASCEND_CLIENT_ID,
            client_secret:
                get(params, 'client_secret', null) ||
                process.env.DENTRIX_ASCEND_CLIENT_SECRET,
            tokenUri: `${apiHost}/oauth/client_credential/accesstoken?grant_type=client_credentials`,
        });

        this.apiHost = apiHost;
        // Spec-sync and sibling modules use `baseUrl`; OAuth2Requester also
        // accepts `baseURL` — keep both in sync.
        this.baseUrl = baseUrl;
        this.baseURL = baseUrl;

        this.organizationId =
            get(params, 'organizationId', null) ||
            get(params, 'organization_id', null) ||
            process.env.DENTRIX_ASCEND_ORGANIZATION_ID ||
            null;

        // Client-credentials tokens have no refresh_token; re-mint instead.
        this.isRefreshable = true;

        this.URLs = {
            linkedOrgs: '/orgmapper/LinkedOrgs',
            organization: (organizationId) =>
                `/v1/organizations/${organizationId}`,
            locations: '/v1/locations',
            locationById: (locationId) => `/v1/locations/${locationId}`,
            providers: '/v1/providers',
            providerById: (providerId) => `/v1/providers/${providerId}`,
            patients: '/v1/patients',
            patientById: (patientId) => `/v1/patients/${patientId}`,
            appointments: '/v1/appointments',
            appointmentById: (appointmentId) =>
                `/v1/appointments/${appointmentId}`,
            transactions: '/v1/transactions',
            transactionById: (transactionId) =>
                `/v1/transactions/${transactionId}`,
            patientPayments: '/v1/transactions/patientpayments',
            patientPaymentById: (transactionId) =>
                `/v1/transactions/patientpayments/${transactionId}`,
            insuranceClaims: '/v1/insuranceclaims',
            insuranceClaimById: (claimId) =>
                `/v1/insuranceclaims/${claimId}`,
            feeSchedules: '/v1/feeschedules',
            feeScheduleById: (feeScheduleId) =>
                `/v1/feeschedules/${feeScheduleId}`,
            patientProcedures: '/v1/patientprocedures',
            patientProcedureById: (procedureId) =>
                `/v1/patientprocedures/${procedureId}`,
            patientStatements: '/v1/patientstatements',
            patientStatementById: (statementId) =>
                `/v1/patientstatements/${statementId}`,
            patientInsurancePlans: '/v1/patientinsuranceplans',
            patientInsurancePlanById: (planId) =>
                `/v1/patientinsuranceplans/${planId}`,
        };
    }

    /**
     * Client-credentials form for Frigg auth UI / CLI.
     * Ascend has no browser authorize redirect for the Public API.
     */
    getAuthorizationRequirements() {
        return {
            url: null,
            type: 'oauth2',
            grantType: 'client_credentials',
            data: {
                jsonSchema: {
                    title: 'Dentrix Ascend Authentication',
                    type: 'object',
                    required: [
                        'client_id',
                        'client_secret',
                        'organization_id',
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
                        organization_id: {
                            type: 'string',
                            title: 'Organization ID',
                            description:
                                'Value for the Organization-ID header. Discover ids via OrgMapper LinkedOrgs after minting a token.',
                        },
                    },
                },
                uiSchema: {
                    client_secret: {
                        'ui:widget': 'password',
                    },
                    organization_id: {
                        'ui:help':
                            'Required on every Public API request. Issued by HS1 / OrgMapper for organizations your client_id can access.',
                    },
                },
            },
        };
    }

    /**
     * Ascend token endpoint expects x-www-form-urlencoded body and
     * grant_type as a query parameter (already on this.tokenUri).
     * Core's default posts JSON — override to match vendor docs.
     */
    async getTokenFromClientCredentials() {
        try {
            const params = new URLSearchParams();
            params.append('client_id', this.client_id);
            params.append('client_secret', this.client_secret);

            const tokenRes = await this._post(
                {
                    url: this.tokenUri,
                    body: params,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
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
            return undefined;
        }
    }

    /**
     * Client-credentials tokens have no refresh_token. Treat a non-empty
     * access_token as authenticated.
     */
    isAuthenticated() {
        return !!this.access_token;
    }

    async addAuthHeaders(headers = {}) {
        const next = await super.addAuthHeaders(headers);
        if (this.organizationId) {
            next['Organization-ID'] = String(this.organizationId);
        }
        return next;
    }

    setOrganizationId(organizationId) {
        this.organizationId = organizationId ? String(organizationId) : null;
    }

    // ---- Query helper ------------------------------------------------------

    _withQuery(path, params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params || {})) {
            if (value === undefined || value === null) continue;
            usp.append(key, String(value));
        }
        const qs = usp.toString();
        return qs ? `${path}?${qs}` : path;
    }

    _apiUrl(path, params) {
        return this.baseUrl + this._withQuery(path, params);
    }

    _hostUrl(path, params) {
        return this.apiHost + this._withQuery(path, params);
    }

    _jsonOptions(url, body) {
        return {
            url,
            headers: { 'Content-Type': 'application/json' },
            body,
        };
    }

    // ---- Auth / identity ---------------------------------------------------

    /**
     * List OrgMapper organization ids the client_id can access.
     * GET {apiHost}/orgmapper/LinkedOrgs (not under ascend-gateway/api).
     * Response is plain JSON: { organizations: [id, ...] } — not the
     * Public API statusCode/data envelope.
     */
    async listLinkedOrganizations() {
        return this._get({
            url: this._hostUrl(this.URLs.linkedOrgs),
        });
    }

    /**
     * GET /v1/organizations/{organizationId}
     */
    async getOrganization(organizationId = this.organizationId) {
        if (!organizationId) {
            throw new Error(
                'Dentrix Ascend: organizationId is required for getOrganization'
            );
        }
        return this._get({
            url: this._apiUrl(this.URLs.organization(organizationId)),
        });
    }

    // ---- Locations ---------------------------------------------------------

    /** GET /v1/locations */
    async listLocations(params = {}) {
        return this._get({
            url: this._apiUrl(this.URLs.locations, params),
        });
    }

    /** GET /v1/locations/{locationId} */
    async getLocation(locationId, params = {}) {
        return this._get({
            url: this._apiUrl(this.URLs.locationById(locationId), params),
        });
    }

    /** PUT /v1/locations/{locationId} */
    async updateLocation(locationId, data) {
        return this._put(
            this._jsonOptions(
                this._apiUrl(this.URLs.locationById(locationId)),
                data
            )
        );
    }

    // ---- Providers ---------------------------------------------------------

    /** GET /v1/providers */
    async listProviders(params = {}) {
        return this._get({
            url: this._apiUrl(this.URLs.providers, params),
        });
    }

    /** GET /v1/providers/{providerId} */
    async getProvider(providerId, params = {}) {
        return this._get({
            url: this._apiUrl(this.URLs.providerById(providerId), params),
        });
    }

    /** POST /v1/providers */
    async createProvider(data) {
        return this._post(
            this._jsonOptions(this._apiUrl(this.URLs.providers), data)
        );
    }

    /** PUT /v1/providers/{providerId} */
    async updateProvider(providerId, data) {
        return this._put(
            this._jsonOptions(
                this._apiUrl(this.URLs.providerById(providerId)),
                data
            )
        );
    }

    // ---- Patients ----------------------------------------------------------

    /** GET /v1/patients */
    async listPatients(params = {}) {
        return this._get({
            url: this._apiUrl(this.URLs.patients, params),
        });
    }

    /** GET /v1/patients/{patientId} */
    async getPatient(patientId, params = {}) {
        return this._get({
            url: this._apiUrl(this.URLs.patientById(patientId), params),
        });
    }

    /** POST /v1/patients */
    async createPatient(data) {
        return this._post(
            this._jsonOptions(this._apiUrl(this.URLs.patients), data)
        );
    }

    /** PUT /v1/patients/{patientId} */
    async updatePatient(patientId, data) {
        return this._put(
            this._jsonOptions(
                this._apiUrl(this.URLs.patientById(patientId)),
                data
            )
        );
    }

    // ---- Appointments ------------------------------------------------------

    /** GET /v1/appointments */
    async listAppointments(params = {}) {
        return this._get({
            url: this._apiUrl(this.URLs.appointments, params),
        });
    }

    /** GET /v1/appointments/{appointmentId} */
    async getAppointment(appointmentId, params = {}) {
        return this._get({
            url: this._apiUrl(
                this.URLs.appointmentById(appointmentId),
                params
            ),
        });
    }

    /** POST /v1/appointments */
    async createAppointment(data) {
        return this._post(
            this._jsonOptions(this._apiUrl(this.URLs.appointments), data)
        );
    }

    /** PUT /v1/appointments/{appointmentId} */
    async updateAppointment(appointmentId, data) {
        return this._put(
            this._jsonOptions(
                this._apiUrl(this.URLs.appointmentById(appointmentId)),
                data
            )
        );
    }

    /** DELETE /v1/appointments/{appointmentId} */
    async deleteAppointment(appointmentId) {
        return this._delete({
            url: this._apiUrl(this.URLs.appointmentById(appointmentId)),
        });
    }

    // ---- Ledger / transactions ---------------------------------------------

    /** GET /v1/transactions — unified ledger read model */
    async listTransactions(params = {}) {
        return this._get({
            url: this._apiUrl(this.URLs.transactions, params),
        });
    }

    /** GET /v1/transactions/{transactionId} */
    async getTransaction(transactionId, params = {}) {
        return this._get({
            url: this._apiUrl(
                this.URLs.transactionById(transactionId),
                params
            ),
        });
    }

    /** GET /v1/transactions/patientpayments */
    async listPatientPayments(params = {}) {
        return this._get({
            url: this._apiUrl(this.URLs.patientPayments, params),
        });
    }

    /** GET /v1/transactions/patientpayments/{transactionId} */
    async getPatientPayment(transactionId, params = {}) {
        return this._get({
            url: this._apiUrl(
                this.URLs.patientPaymentById(transactionId),
                params
            ),
        });
    }

    // ---- Insurance claims --------------------------------------------------

    /** GET /v1/insuranceclaims */
    async listInsuranceClaims(params = {}) {
        return this._get({
            url: this._apiUrl(this.URLs.insuranceClaims, params),
        });
    }

    /** GET /v1/insuranceclaims/{claimId} */
    async getInsuranceClaim(claimId, params = {}) {
        return this._get({
            url: this._apiUrl(
                this.URLs.insuranceClaimById(claimId),
                params
            ),
        });
    }

    // ---- Fee schedules -----------------------------------------------------

    /** GET /v1/feeschedules */
    async listFeeSchedules(params = {}) {
        return this._get({
            url: this._apiUrl(this.URLs.feeSchedules, params),
        });
    }

    /** GET /v1/feeschedules/{feeScheduleId} */
    async getFeeSchedule(feeScheduleId, params = {}) {
        return this._get({
            url: this._apiUrl(
                this.URLs.feeScheduleById(feeScheduleId),
                params
            ),
        });
    }

    // ---- Patient procedures ------------------------------------------------

    /** GET /v1/patientprocedures */
    async listPatientProcedures(params = {}) {
        return this._get({
            url: this._apiUrl(this.URLs.patientProcedures, params),
        });
    }

    /** GET /v1/patientprocedures/{procedureId} */
    async getPatientProcedure(procedureId, params = {}) {
        return this._get({
            url: this._apiUrl(
                this.URLs.patientProcedureById(procedureId),
                params
            ),
        });
    }

    // ---- Statements --------------------------------------------------------

    /** GET /v1/patientstatements */
    async listPatientStatements(params = {}) {
        return this._get({
            url: this._apiUrl(this.URLs.patientStatements, params),
        });
    }

    /** GET /v1/patientstatements/{patientstatementId} */
    async getPatientStatement(statementId, params = {}) {
        return this._get({
            url: this._apiUrl(
                this.URLs.patientStatementById(statementId),
                params
            ),
        });
    }

    // ---- Patient insurance plans -------------------------------------------

    /** GET /v1/patientinsuranceplans */
    async listPatientInsurancePlans(params = {}) {
        return this._get({
            url: this._apiUrl(this.URLs.patientInsurancePlans, params),
        });
    }

    /** GET /v1/patientinsuranceplans/{patientInsurancePlanId} */
    async getPatientInsurancePlan(planId, params = {}) {
        return this._get({
            url: this._apiUrl(
                this.URLs.patientInsurancePlanById(planId),
                params
            ),
        });
    }

    /** Authenticated smoke call used by Definition.testAuthRequest. */
    async testAuthRequest() {
        if (!this.organizationId) {
            return this.listLinkedOrganizations();
        }
        return this.getOrganization(this.organizationId);
    }
}

module.exports = { Api };
