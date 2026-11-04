const { ApiKeyRequester, get } = require('@friggframework/core');

/**
 * AxisCare API client.
 *
 * Auth: API token sent as `Authorization: Bearer <token>` (Admin → API token).
 * Base URL: `https://{siteNumber}.axiscare.com` (per-tenant).
 * Version header: `X-AxisCare-Api-Version: 2023-10-01` (required; enum in the
 * vendor OpenAPI).
 *
 * Official docs: https://static.axiscare.com/api/documentation.html
 * Official OpenAPI: https://static.axiscare.com/api/stoplight/reference/api.yaml
 *
 * Pagination: list responses may include a `nextPage` absolute URL; follow it
 * with `getFromUrl`.
 */
class Api extends ApiKeyRequester {
    static API_KEY_VERSION = '2023-10-01';

    constructor(params = {}) {
        super(params);

        const raw =
            get(params, 'api_key', null) ||
            get(params, 'access_token', null) ||
            get(params, 'apiKey', null);
        const token = raw
            ? String(raw).replace(/^Bearer\s+/i, '').trim()
            : null;

        // Persist the raw key; ApiKeyRequester sends headers[api_key_name] = api_key.
        this.api_key_raw = token;
        this.api_key_name = 'Authorization';
        this.api_key = token ? `Bearer ${token}` : null;

        this.siteNumber =
            get(params, 'siteNumber', null) ||
            get(params, 'site_number', null);
        this.baseUrl = this.siteNumber
            ? `https://${this.siteNumber}.axiscare.com`
            : 'https://{siteNumber}.axiscare.com';

        this.URLs = {
            clients: '/api/clients',
            clientById: (id) => `/api/clients/${id}`,
            clientResponsibleParties: (id) =>
                `/api/clients/${id}/responsibleParties`,
            clientResponsibleParty: (id, listNumber) =>
                `/api/clients/${id}/responsibleParties/${listNumber}`,
            leads: '/api/leads',
            leadById: (id) => `/api/leads/${id}`,
            leadResponsibleParties: (id) =>
                `/api/leads/${id}/responsibleParties`,
            leadResponsibleParty: (id, listNumber) =>
                `/api/leads/${id}/responsibleParties/${listNumber}`,
            caregivers: '/api/caregivers',
            caregiverById: (id) => `/api/caregivers/${id}`,
            applicants: '/api/applicants',
            applicantById: (id) => `/api/applicants/${id}`,
            visits: '/api/visits',
            visitById: (id) => `/api/visits/${id}`,
            callLogs: '/api/call-logs',
            callLogById: (id) => `/api/call-logs/${id}`,
        };
    }

    /**
     * Set the API key. Accepts a raw token or a value already prefixed with
     * `Bearer `; stores the raw token and the Authorization header value.
     */
    setApiKey(apiKey) {
        if (!apiKey) {
            this.api_key_raw = null;
            this.api_key = null;
            return;
        }
        const raw = String(apiKey).replace(/^Bearer\s+/i, '').trim();
        this.api_key_raw = raw;
        this.api_key = raw ? `Bearer ${raw}` : null;
    }

    /**
     * Set the site number and rebuild the per-tenant base URL.
     * @param {string} siteNumber
     */
    setSiteNumber(siteNumber) {
        if (!siteNumber) {
            throw new Error('Site number is required for AxisCare API');
        }
        this.siteNumber = siteNumber;
        this.baseUrl = `https://${siteNumber}.axiscare.com`;
    }

    _versionHeaders(extra = {}) {
        return {
            'X-AxisCare-Api-Version': Api.API_KEY_VERSION,
            Accept: 'application/json',
            ...extra,
        };
    }

    // ---- Clients -----------------------------------------------------------

    /** GET /api/clients */
    async listClients(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.clients,
            headers: this._versionHeaders(),
            query: params,
        });
    }

    /** POST /api/clients */
    async createClient(clientData) {
        return this._post({
            url: this.baseUrl + this.URLs.clients,
            headers: this._versionHeaders({
                'Content-Type': 'application/json',
            }),
            body: clientData,
        });
    }

    /** GET /api/clients/{clientId} */
    async getClient(clientId, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.clientById(clientId),
            headers: this._versionHeaders(),
            query: params,
        });
    }

    /** PATCH /api/clients/{clientId} */
    async updateClient(clientId, clientData) {
        return this._patch({
            url: this.baseUrl + this.URLs.clientById(clientId),
            headers: this._versionHeaders({
                'Content-Type': 'application/json',
            }),
            body: clientData,
        });
    }

    /** GET /api/clients/{clientId}/responsibleParties */
    async listClientResponsibleParties(clientId) {
        return this._get({
            url: this.baseUrl + this.URLs.clientResponsibleParties(clientId),
            headers: this._versionHeaders(),
        });
    }

    /** GET /api/clients/{clientId}/responsibleParties/{listNumber} */
    async getClientResponsibleParty(clientId, listNumber) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.clientResponsibleParty(clientId, listNumber),
            headers: this._versionHeaders(),
        });
    }

    /** PUT /api/clients/{clientId}/responsibleParties/{listNumber} */
    async updateClientResponsibleParty(clientId, listNumber, data) {
        return this._put({
            url:
                this.baseUrl +
                this.URLs.clientResponsibleParty(clientId, listNumber),
            headers: this._versionHeaders({
                'Content-Type': 'application/json',
            }),
            body: data,
        });
    }

    // ---- Leads -------------------------------------------------------------

    /** GET /api/leads */
    async listLeads(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.leads,
            headers: this._versionHeaders(),
            query: params,
        });
    }

    /** POST /api/leads */
    async createLead(leadData) {
        return this._post({
            url: this.baseUrl + this.URLs.leads,
            headers: this._versionHeaders({
                'Content-Type': 'application/json',
            }),
            body: leadData,
        });
    }

    /** GET /api/leads/{leadId} */
    async getLead(leadId) {
        return this._get({
            url: this.baseUrl + this.URLs.leadById(leadId),
            headers: this._versionHeaders(),
        });
    }

    /** PATCH /api/leads/{leadId} */
    async updateLead(leadId, leadData) {
        return this._patch({
            url: this.baseUrl + this.URLs.leadById(leadId),
            headers: this._versionHeaders({
                'Content-Type': 'application/json',
            }),
            body: leadData,
        });
    }

    /** GET /api/leads/{leadId}/responsibleParties */
    async listLeadResponsibleParties(leadId) {
        return this._get({
            url: this.baseUrl + this.URLs.leadResponsibleParties(leadId),
            headers: this._versionHeaders(),
        });
    }

    /** GET /api/leads/{leadId}/responsibleParties/{listNumber} */
    async getLeadResponsibleParty(leadId, listNumber) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.leadResponsibleParty(leadId, listNumber),
            headers: this._versionHeaders(),
        });
    }

    /** PUT /api/leads/{leadId}/responsibleParties/{listNumber} */
    async updateLeadResponsibleParty(leadId, listNumber, data) {
        return this._put({
            url:
                this.baseUrl +
                this.URLs.leadResponsibleParty(leadId, listNumber),
            headers: this._versionHeaders({
                'Content-Type': 'application/json',
            }),
            body: data,
        });
    }

    // ---- Caregivers --------------------------------------------------------

    /** GET /api/caregivers */
    async listCaregivers(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.caregivers,
            headers: this._versionHeaders(),
            query: params,
        });
    }

    /** POST /api/caregivers */
    async createCaregiver(caregiverData) {
        return this._post({
            url: this.baseUrl + this.URLs.caregivers,
            headers: this._versionHeaders({
                'Content-Type': 'application/json',
            }),
            body: caregiverData,
        });
    }

    /**
     * GET /api/caregivers/{caregiverId}
     * Vendor wraps the caregiver under `results.data`; unwrap for callers.
     */
    async getCaregiver(caregiverId, params = {}) {
        const response = await this._get({
            url: this.baseUrl + this.URLs.caregiverById(caregiverId),
            headers: this._versionHeaders(),
            query: params,
        });
        return { results: response.results?.data, errors: response.errors };
    }

    /** PATCH /api/caregivers/{caregiverId} */
    async updateCaregiver(caregiverId, caregiverData) {
        return this._patch({
            url: this.baseUrl + this.URLs.caregiverById(caregiverId),
            headers: this._versionHeaders({
                'Content-Type': 'application/json',
            }),
            body: caregiverData,
        });
    }

    // ---- Applicants --------------------------------------------------------

    /** GET /api/applicants */
    async listApplicants(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.applicants,
            headers: this._versionHeaders(),
            query: params,
        });
    }

    /** POST /api/applicants */
    async createApplicant(applicantData) {
        return this._post({
            url: this.baseUrl + this.URLs.applicants,
            headers: this._versionHeaders({
                'Content-Type': 'application/json',
            }),
            body: applicantData,
        });
    }

    /**
     * GET /api/applicants/{applicantId}
     * Vendor wraps the applicant under `results.data`; unwrap for callers.
     * No PATCH/update exists on the public API.
     */
    async getApplicant(applicantId, params = {}) {
        const response = await this._get({
            url: this.baseUrl + this.URLs.applicantById(applicantId),
            headers: this._versionHeaders(),
            query: params,
        });
        return { results: response.results?.data, errors: response.errors };
    }

    // ---- Visits ------------------------------------------------------------

    /** GET /api/visits (at least one filter required by the vendor) */
    async listVisits(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.visits,
            headers: this._versionHeaders(),
            query: params,
        });
    }

    /** POST /api/visits */
    async createVisit(visitData) {
        return this._post({
            url: this.baseUrl + this.URLs.visits,
            headers: this._versionHeaders({
                'Content-Type': 'application/json',
            }),
            body: visitData,
        });
    }

    /** GET /api/visits/{visitId} — visitId format e.g. `s=222:d=2024-03-04` */
    async getVisit(visitId) {
        return this._get({
            url: this.baseUrl + this.URLs.visitById(visitId),
            headers: this._versionHeaders(),
        });
    }

    /** PATCH /api/visits/{visitId} */
    async updateVisit(visitId, visitData) {
        return this._patch({
            url: this.baseUrl + this.URLs.visitById(visitId),
            headers: this._versionHeaders({
                'Content-Type': 'application/json',
            }),
            body: visitData,
        });
    }

    /** DELETE /api/visits/{visitId} */
    async deleteVisit(visitId, params = {}) {
        return this._delete({
            url: this.baseUrl + this.URLs.visitById(visitId),
            headers: this._versionHeaders(),
            query: params,
        });
    }

    // ---- Call logs ---------------------------------------------------------

    /** GET /api/call-logs */
    async listCallLogs(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.callLogs,
            headers: this._versionHeaders(),
            query: params,
        });
    }

    /** POST /api/call-logs */
    async createCallLog(callLogData) {
        return this._post({
            url: this.baseUrl + this.URLs.callLogs,
            headers: this._versionHeaders({
                'Content-Type': 'application/json',
            }),
            body: callLogData,
        });
    }

    /** GET /api/call-logs/{callLogId} */
    async getCallLog(callLogId) {
        return this._get({
            url: this.baseUrl + this.URLs.callLogById(callLogId),
            headers: this._versionHeaders(),
        });
    }

    /** PATCH /api/call-logs/{callLogId} */
    async updateCallLog(callLogId, callLogData) {
        return this._patch({
            url: this.baseUrl + this.URLs.callLogById(callLogId),
            headers: this._versionHeaders({
                'Content-Type': 'application/json',
            }),
            body: callLogData,
        });
    }

    // ---- Pagination --------------------------------------------------------

    /**
     * Follow a vendor `nextPage` absolute URL (includes query params).
     * @param {string} fullUrl
     */
    async getFromUrl(fullUrl) {
        return this._get({
            url: fullUrl,
            headers: this._versionHeaders(),
        });
    }
}

module.exports = { Api };
