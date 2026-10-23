const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * DrChrono EHR API client.
 *
 * Auth: OAuth 2.0 authorization-code grant with refresh_token.
 *   Authorize: https://app.drchrono.com/o/authorize/
 *   Token:     POST https://app.drchrono.com/o/token/  (x-www-form-urlencoded)
 *   Revoke:    POST https://app.drchrono.com/o/revoke_token/
 *   API:       https://app.drchrono.com/api/...
 *
 * Authenticated requests send `Authorization: Bearer <access_token>`.
 * Access tokens expire in 172800 seconds (48 hours).
 *
 * Docs: https://app.drchrono.com/api-docs/v2/documentation
 * Auth tutorial: https://app.drchrono.com/api-docs/tutorial/
 * Scopes: https://app.drchrono.com/api-docs/popup/v3/scope
 *
 * Webhook subscriptions are configured in the DrChrono API application
 * management UI — not via a public subscribe REST surface. This module
 * verifies inbound deliveries (X-drchrono-signature) and the GET challenge.
 */
const DEFAULT_SCOPE =
    'patients:read patients:write billing:read billing:write';

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://app.drchrono.com';
        this.tokenUri = `${this.baseUrl}/o/token/`;
        this.revokeUri = `${this.baseUrl}/o/revoke_token/`;

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        this.client_id =
            get(params, 'client_id', null) || process.env.DRCHRONO_CLIENT_ID;
        this.client_secret =
            get(params, 'client_secret', null) ||
            process.env.DRCHRONO_CLIENT_SECRET;
        this.redirect_uri =
            get(params, 'redirect_uri', null) ||
            process.env.DRCHRONO_REDIRECT_URI ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/drchrono`
                : null);

        this.scope =
            get(params, 'scope', null) ||
            process.env.DRCHRONO_SCOPE ||
            DEFAULT_SCOPE;

        this.URLs = {
            currentUser: '/api/users/current',
            doctors: '/api/doctors',
            doctor: (id) => `/api/doctors/${id}`,
            patients: '/api/patients',
            patient: (id) => `/api/patients/${id}`,
            appointments: '/api/appointments',
            appointment: (id) => `/api/appointments/${id}`,
            offices: '/api/offices',
            office: (id) => `/api/offices/${id}`,
            lineItems: '/api/line_items',
            lineItem: (id) => `/api/line_items/${id}`,
            patientPayments: '/api/patient_payments',
            patientPayment: (id) => `/api/patient_payments/${id}`,
            patientPaymentLog: '/api/patient_payment_log',
            patientPaymentLogById: (id) => `/api/patient_payment_log/${id}`,
            billingProfiles: '/api/billing_profiles',
            billingProfile: (id) => `/api/billing_profiles/${id}`,
            insurances: '/api/insurances',
            insurance: (id) => `/api/insurances/${id}`,
            transactions: '/api/transactions',
            transaction: (id) => `/api/transactions/${id}`,
            iframeIntegration: '/api/iframe_integration',
        };
    }

    getAuthorizationUri() {
        const params = new URLSearchParams({
            client_id: this.client_id,
            redirect_uri: this.redirect_uri,
            response_type: 'code',
            scope: this.scope,
        });
        if (this.state) {
            params.append('state', this.state);
        }
        return `${this.baseUrl}/o/authorize/?${params.toString()}`;
    }

    getAuthUri() {
        return this.getAuthorizationUri();
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri(),
            type: 'oauth2',
            data: {},
        };
    }

    /**
     * Exchange authorization code for tokens.
     * DrChrono requires application/x-www-form-urlencoded (not JSON).
     * Docs: https://app.drchrono.com/api-docs/v2/documentation (Initial authorization)
     */
    async getTokenFromCode(code) {
        delete this.access_token;
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        params.append('redirect_uri', this.redirect_uri);

        const response = await this._post(
            {
                url: this.tokenUri,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params,
            },
            false
        );
        await this.setTokens(response);
        return response;
    }

    /**
     * Refresh access token. Omit redirect_uri per DrChrono refresh docs.
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refreshTokenObject.refresh_token);
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);

        const response = await this._post(
            {
                url: this.tokenUri,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params,
            },
            false
        );
        await this.setTokens(response);
        return response;
    }

    async revokeToken(token) {
        const params = new URLSearchParams();
        params.append('token', token);
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);

        return this._post(
            {
                url: this.revokeUri,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params,
            },
            false
        );
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

    _jsonHeaders(extra = {}) {
        return { 'Content-Type': 'application/json', ...extra };
    }

    // ---- User & doctors ----------------------------------------------------

    /**
     * Get the authenticated user (identity).
     * GET /api/users/current → redirects to /api/users/{id}
     */
    async getCurrentUser() {
        return this._get({
            url: this.baseUrl + this.URLs.currentUser,
        });
    }

    /** List doctors. GET /api/doctors */
    async listDoctors(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.doctors + this._buildQuery(params),
        });
    }

    /** Get a doctor. GET /api/doctors/{id} */
    async getDoctor(doctorId) {
        return this._get({
            url: this.baseUrl + this.URLs.doctor(doctorId),
        });
    }

    // ---- Patients ----------------------------------------------------------

    /**
     * List patients.
     * GET /api/patients
     * Pagination: cursor, page_size. Filters include doctor, email, etc.
     */
    async listPatients(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.patients + this._buildQuery(params),
        });
    }

    /** Get a patient. GET /api/patients/{id} */
    async getPatient(patientId) {
        return this._get({
            url: this.baseUrl + this.URLs.patient(patientId),
        });
    }

    /** Create a patient. POST /api/patients */
    async createPatient(data) {
        return this._post({
            url: this.baseUrl + this.URLs.patients,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    /** Update a patient. PATCH /api/patients/{id} */
    async updatePatient(patientId, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.patient(patientId),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Appointments ------------------------------------------------------

    /**
     * List appointments.
     * GET /api/appointments
     * Note: docs require one of since, occurred_since, date, or date_range.
     * Scope: calendar:read (not in the module's narrow default scope).
     */
    async listAppointments(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.appointments +
                this._buildQuery(params),
        });
    }

    /** Get an appointment. GET /api/appointments/{id} */
    async getAppointment(appointmentId) {
        return this._get({
            url: this.baseUrl + this.URLs.appointment(appointmentId),
        });
    }

    /** Create an appointment. POST /api/appointments */
    async createAppointment(data) {
        return this._post({
            url: this.baseUrl + this.URLs.appointments,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    /** Update an appointment. PATCH /api/appointments/{id} */
    async updateAppointment(appointmentId, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.appointment(appointmentId),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Offices -----------------------------------------------------------

    /** List offices. GET /api/offices */
    async listOffices(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.offices + this._buildQuery(params),
        });
    }

    /** Get an office. GET /api/offices/{id} */
    async getOffice(officeId) {
        return this._get({
            url: this.baseUrl + this.URLs.office(officeId),
        });
    }

    // ---- Billing -----------------------------------------------------------

    /** List billing line items. GET /api/line_items */
    async listLineItems(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.lineItems + this._buildQuery(params),
        });
    }

    /** Get a line item. GET /api/line_items/{id} */
    async getLineItem(lineItemId) {
        return this._get({
            url: this.baseUrl + this.URLs.lineItem(lineItemId),
        });
    }

    /** List patient payments. GET /api/patient_payments */
    async listPatientPayments(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.patientPayments +
                this._buildQuery(params),
        });
    }

    /** Get a patient payment. GET /api/patient_payments/{id} */
    async getPatientPayment(paymentId) {
        return this._get({
            url: this.baseUrl + this.URLs.patientPayment(paymentId),
        });
    }

    /** Create a patient payment. POST /api/patient_payments */
    async createPatientPayment(data) {
        return this._post({
            url: this.baseUrl + this.URLs.patientPayments,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    /** List patient payment logs. GET /api/patient_payment_log */
    async listPatientPaymentLog(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.patientPaymentLog +
                this._buildQuery(params),
        });
    }

    /** Get a patient payment log. GET /api/patient_payment_log/{id} */
    async getPatientPaymentLog(logId) {
        return this._get({
            url: this.baseUrl + this.URLs.patientPaymentLogById(logId),
        });
    }

    /** List billing profiles. GET /api/billing_profiles */
    async listBillingProfiles(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.billingProfiles +
                this._buildQuery(params),
        });
    }

    /** Get a billing profile. GET /api/billing_profiles/{id} */
    async getBillingProfile(profileId) {
        return this._get({
            url: this.baseUrl + this.URLs.billingProfile(profileId),
        });
    }

    /** List insurance payers. GET /api/insurances */
    async listInsurances(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.insurances + this._buildQuery(params),
        });
    }

    /** Get an insurance payer. GET /api/insurances/{id} */
    async getInsurance(insuranceId) {
        return this._get({
            url: this.baseUrl + this.URLs.insurance(insuranceId),
        });
    }

    /** List transactions. GET /api/transactions */
    async listTransactions(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.transactions +
                this._buildQuery(params),
        });
    }

    /** Get a transaction. GET /api/transactions/{id} */
    async getTransaction(transactionId) {
        return this._get({
            url: this.baseUrl + this.URLs.transaction(transactionId),
        });
    }

    // ---- Iframe integration ------------------------------------------------

    /**
     * Enable the iframe app for the authorizing doctor.
     * POST /api/iframe_integration (no body)
     */
    async createIframeIntegration() {
        return this._post({
            url: this.baseUrl + this.URLs.iframeIntegration,
            headers: this._jsonHeaders(),
            body: {},
        });
    }

    /**
     * Disable the iframe app for the authorizing doctor.
     * DELETE /api/iframe_integration
     */
    async deleteIframeIntegration() {
        return this._delete({
            url: this.baseUrl + this.URLs.iframeIntegration,
        });
    }
}

module.exports = { Api, DEFAULT_SCOPE };
