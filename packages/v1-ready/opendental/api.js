const { ApiKeyRequester, get } = require('@friggframework/core');

/**
 * Open Dental API Service client.
 *
 * Auth (official): every request must include
 *   Authorization: ODFHIR {DeveloperKey}/{CustomerKey}
 * Docs: https://www.opendental.com/site/apisetup.html
 *
 * Base URL: https://api.opendental.com/api/v1
 * Spec overview: https://www.opendental.com/site/apispecification.html
 * PDF: https://www.opendental.com/resources/OpenDentalAPI.pdf
 *
 * Developer keys come from the Open Dental Developer Portal; customer keys
 * are assigned in the customer's Setup > Advanced Setup > API. This module
 * stores the two keys separately and builds the ODFHIR Authorization value.
 *
 * Pagination: Offset / Limit (hard max 100) on list endpoints.
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        this.api_key_name = 'Authorization';

        this.developerKey =
            get(params, 'developerKey', null) ||
            get(params, 'developer_key', null) ||
            process.env.OPENDENTAL_DEVELOPER_KEY ||
            null;
        this.customerKey =
            get(params, 'customerKey', null) ||
            get(params, 'customer_key', null) ||
            process.env.OPENDENTAL_CUSTOMER_KEY ||
            null;

        this._syncAuthHeader();

        this.baseUrl =
            get(params, 'baseUrl', null) || 'https://api.opendental.com/api/v1';

        this.URLs = {
            preferences: '/preferences',
            clinics: '/clinics',
            patients: '/patients',
            patientsSimple: '/patients/Simple',
            patient: (patNum) => `/patients/${patNum}`,
            appointments: '/appointments',
            appointment: (aptNum) => `/appointments/${aptNum}`,
            procedurelogs: '/procedurelogs',
            procedurelog: (procNum) => `/procedurelogs/${procNum}`,
            statements: '/statements',
            statement: (statementNum) => `/statements/${statementNum}`,
            payments: '/payments',
            payment: (payNum) => `/payments/${payNum}`,
            aging: '/reports/Aging',
            claims: '/claims',
            claim: (claimNum) => `/claims/${claimNum}`,
            insplans: '/insplans',
            insplan: (planNum) => `/insplans/${planNum}`,
            patplans: '/patplans',
            feescheds: '/feescheds',
            fees: '/fees',
            fee: (feeNum) => `/fees/${feeNum}`,
            subscriptions: '/subscriptions',
            subscription: (subscriptionNum) =>
                `/subscriptions/${subscriptionNum}`,
            patientBalances: (patNum) =>
                `/accountmodules/${patNum}/PatientBalances`,
        };
    }

    /** Rebuild `Authorization: ODFHIR {DeveloperKey}/{CustomerKey}`. */
    _syncAuthHeader() {
        if (this.developerKey && this.customerKey) {
            this.setApiKey(`ODFHIR ${this.developerKey}/${this.customerKey}`);
        } else {
            this.api_key = null;
        }
    }

    /**
     * Set developer + customer keys and refresh the Authorization header.
     * @param {string} developerKey
     * @param {string} customerKey
     */
    setCredentials(developerKey, customerKey) {
        this.developerKey = developerKey || null;
        this.customerKey = customerKey || null;
        this._syncAuthHeader();
    }

    /** Drop null/undefined query values so they are not encoded. */
    _query(params = {}) {
        const out = {};
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null || value === '') continue;
            out[key] = value;
        }
        return out;
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'Open Dental Authentication',
                    type: 'object',
                    required: ['developerKey', 'customerKey'],
                    properties: {
                        developerKey: {
                            type: 'string',
                            title: 'Developer API Key',
                        },
                        customerKey: {
                            type: 'string',
                            title: 'Customer API Key',
                        },
                    },
                },
                uiSchema: {
                    developerKey: {
                        'ui:widget': 'password',
                        'ui:help':
                            'From the Open Dental Developer Portal. Combined with the customer key as Authorization: ODFHIR {DeveloperKey}/{CustomerKey}.',
                    },
                    customerKey: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Assigned to the dental office in Setup > Advanced Setup > API (customer enables the key).',
                    },
                },
            },
        };
    }

    // ---- Preferences / identity --------------------------------------------

    /**
     * List preferences (paginated) or filter by PrefName.
     * GET /preferences
     * Docs: https://www.opendental.com/site/apipreferences.html
     */
    async listPreferences(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.preferences,
            query: this._query(params),
        });
    }

    /**
     * Convenience: fetch a single preference by PrefName (e.g. PracticeTitle).
     * Returns the first matching preference object, or null.
     */
    async getPreference(prefName) {
        const rows = await this.listPreferences({ PrefName: prefName });
        if (Array.isArray(rows) && rows.length > 0) return rows[0];
        return null;
    }

    // ---- Clinics -----------------------------------------------------------

    /**
     * List non-hidden clinics. Empty list means clinics are not enabled.
     * GET /clinics
     * Docs: https://www.opendental.com/site/apiclinics.html
     */
    async listClinics(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.clinics,
            query: this._query(params),
        });
    }

    // ---- Patients ----------------------------------------------------------

    /**
     * List patients (Patient Select-style; can be slow on large DBs).
     * GET /patients
     * Docs: https://www.opendental.com/site/apipatients.html
     */
    async listPatients(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.patients,
            query: this._query(params),
        });
    }

    /**
     * Faster patient list / search.
     * GET /patients/Simple
     */
    async listPatientsSimple(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.patientsSimple,
            query: this._query(params),
        });
    }

    /** GET /patients/{PatNum} */
    async getPatient(patNum) {
        return this._get({
            url: this.baseUrl + this.URLs.patient(patNum),
        });
    }

    /** POST /patients */
    async createPatient(data) {
        return this._post({
            url: this.baseUrl + this.URLs.patients,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** PUT /patients/{PatNum} */
    async updatePatient(patNum, data) {
        return this._put({
            url: this.baseUrl + this.URLs.patient(patNum),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Family / patient balances for a PatNum.
     * GET /accountmodules/{PatNum}/PatientBalances
     * Docs: https://www.opendental.com/site/apiaccountmodules.html
     */
    async getPatientBalances(patNum) {
        return this._get({
            url: this.baseUrl + this.URLs.patientBalances(patNum),
        });
    }

    // ---- Appointments ------------------------------------------------------

    /**
     * List appointments.
     * GET /appointments
     * Filters include PatNum, AptStatus, date, dateStart, dateEnd, ClinicNum,
     * DateTStamp, Op, AppointmentTypeNum, Offset.
     * Docs: https://www.opendental.com/site/apiappointments.html
     */
    async listAppointments(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.appointments,
            query: this._query(params),
        });
    }

    /** GET /appointments/{AptNum} */
    async getAppointment(aptNum) {
        return this._get({
            url: this.baseUrl + this.URLs.appointment(aptNum),
        });
    }

    /** POST /appointments */
    async createAppointment(data) {
        return this._post({
            url: this.baseUrl + this.URLs.appointments,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** PUT /appointments/{AptNum} */
    async updateAppointment(aptNum, data) {
        return this._put({
            url: this.baseUrl + this.URLs.appointment(aptNum),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Procedure logs ----------------------------------------------------

    /**
     * List procedure logs.
     * GET /procedurelogs
     * Docs: https://www.opendental.com/site/apiprocedurelogs.html
     */
    async listProcedureLogs(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.procedurelogs,
            query: this._query(params),
        });
    }

    /** GET /procedurelogs/{ProcNum} */
    async getProcedureLog(procNum) {
        return this._get({
            url: this.baseUrl + this.URLs.procedurelog(procNum),
        });
    }

    // ---- Statements --------------------------------------------------------

    /**
     * List statements.
     * GET /statements
     * Docs: https://www.opendental.com/site/apistatements.html
     */
    async listStatements(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.statements,
            query: this._query(params),
        });
    }

    /** GET /statements/{StatementNum} */
    async getStatement(statementNum) {
        return this._get({
            url: this.baseUrl + this.URLs.statement(statementNum),
        });
    }

    // ---- Payments ----------------------------------------------------------

    /**
     * List payments.
     * GET /payments — filters: PatNum, PayType, DateEntry, Offset.
     * Docs: https://www.opendental.com/site/apipayments.html
     * Note: there is no documented Payments GET (single) by PayNum.
     */
    async listPayments(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.payments,
            query: this._query(params),
        });
    }

    /** POST /payments */
    async createPayment(data) {
        return this._post({
            url: this.baseUrl + this.URLs.payments,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** PUT /payments/{PayNum} */
    async updatePayment(payNum, data) {
        return this._put({
            url: this.baseUrl + this.URLs.payment(payNum),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Aging / claims / insurance / fees ---------------------------------

    /**
     * Aging report (calculates; does not update accounts).
     * GET /reports/Aging
     * Docs: https://www.opendental.com/site/apireports.html
     */
    async listAging(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.aging,
            query: this._query(params),
        });
    }

    /** GET /claims */
    async listClaims(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.claims,
            query: this._query(params),
        });
    }

    /** GET /claims/{ClaimNum} */
    async getClaim(claimNum) {
        return this._get({
            url: this.baseUrl + this.URLs.claim(claimNum),
        });
    }

    /** GET /insplans */
    async listInsPlans(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.insplans,
            query: this._query(params),
        });
    }

    /** GET /insplans/{PlanNum} */
    async getInsPlan(planNum) {
        return this._get({
            url: this.baseUrl + this.URLs.insplan(planNum),
        });
    }

    /**
     * List patient insurance plan attachments.
     * GET /patplans
     * Docs: https://www.opendental.com/site/apipatplans.html
     */
    async listPatPlans(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.patplans,
            query: this._query(params),
        });
    }

    /** GET /feescheds */
    async listFeeScheds(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.feescheds,
            query: this._query(params),
        });
    }

    /**
     * List fees. Filter with FeeSched, CodeNum, ClinicNum, ProvNum.
     * GET /fees
     * Docs: https://www.opendental.com/site/apifees.html
     */
    async listFees(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.fees,
            query: this._query(params),
        });
    }

    /** GET /fees/{FeeNum} */
    async getFee(feeNum) {
        return this._get({
            url: this.baseUrl + this.URLs.fee(feeNum),
        });
    }

    // ---- Subscriptions (API Events / webhooks) -----------------------------

    /**
     * List API event subscriptions for this customer key.
     * GET /subscriptions
     * Docs: https://www.opendental.com/site/apisubscriptions.html
     */
    async listSubscriptions(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.subscriptions,
            query: this._query(params),
        });
    }

    /** POST /subscriptions */
    async createSubscription(data) {
        return this._post({
            url: this.baseUrl + this.URLs.subscriptions,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** PUT /subscriptions/{SubscriptionNum} */
    async updateSubscription(subscriptionNum, data) {
        return this._put({
            url: this.baseUrl + this.URLs.subscription(subscriptionNum),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** DELETE /subscriptions/{SubscriptionNum} */
    async deleteSubscription(subscriptionNum) {
        return this._delete({
            url: this.baseUrl + this.URLs.subscription(subscriptionNum),
        });
    }
}

module.exports = { Api };
