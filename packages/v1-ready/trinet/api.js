const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * TriNet HR Platform API client (formerly Zenefits Platform API).
 *
 * Auth: OAuth 2.0 authorization-code flow (admin-only).
 *   Authorize: https://secure.trinet.com/oauth2/platform-authorize/
 *   Token:     https://secure.trinet.com/oauth2/token/
 *   API:       https://api.trinet.com  → Authorization: Bearer <access_token>
 *
 * Tokens expire after 30 days (`expires_in: 2592000`) and refresh with
 * grant_type=refresh_token.
 *
 * The Core API is primarily read-only (GET). Platform write endpoints update
 * installation / subscription lifecycle status. Webhook URLs are configured at
 * app setup (no public REST subscription CRUD).
 *
 * Docs: https://developers.zenefits.com/
 * The curated contract in ./trinet.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Keep them in sync.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        this.baseUrl = 'https://api.trinet.com';
        this.baseURL = this.baseUrl;
        this.tokenUri = 'https://secure.trinet.com/oauth2/token/';

        const scope =
            this.scope ||
            process.env.TRINET_SCOPE ||
            'platform companies people employments departments locations';

        const authParams = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            scope,
            state: this.state || 'STATE',
        });
        this.authorizationUri = `https://secure.trinet.com/oauth2/platform-authorize/?${authParams.toString()}`;

        this.URLs = {
            me: '/core/me',
            companies: '/core/companies',
            companyById: (id) => `/core/companies/${id}`,
            people: '/core/people',
            personById: (id) => `/core/people/${id}`,
            companyPeople: (companyId) =>
                `/core/companies/${companyId}/people`,
            employments: '/core/employments',
            employmentById: (id) => `/core/employments/${id}`,
            personEmployments: (personId) =>
                `/core/people/${personId}/employments`,
            departments: '/core/departments',
            departmentById: (id) => `/core/departments/${id}`,
            companyDepartments: (companyId) =>
                `/core/companies/${companyId}/departments`,
            locations: '/core/locations',
            locationById: (id) => `/core/locations/${id}`,
            companyLocations: (companyId) =>
                `/core/companies/${companyId}/locations`,
            applications: '/platform/applications',
            applicationById: (id) => `/platform/applications/${id}`,
            companyInstalls: '/platform/company_installs',
            companyInstallById: (id) => `/platform/company_installs/${id}`,
            companyInstallStatus: (id) =>
                `/platform/company_installs/${id}/status_changes/`,
            personSubscriptionStatus: (id) =>
                `/platform/person_subscriptions/${id}/status_changes/`,
            vacationRequests: '/time_off/vacation_requests',
            vacationRequestById: (id) =>
                `/time_off/vacation_requests/${id}`,
        };
    }

    /**
     * TriNet token exchange does not take `scope` on the token POST
     * (unlike the default OAuth2Requester). Body fields match the official docs:
     * grant_type, client_id, client_secret, code, redirect_uri.
     *
     * @see https://developers.zenefits.com/reference/auth
     */
    async getTokenFromCode(code) {
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);
        params.append('redirect_uri', this.redirect_uri);
        params.append('code', code);
        const options = {
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            url: this.tokenUri,
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    /**
     * Refresh per TriNet docs — no redirect_uri on refresh.
     *
     * @see https://developers.zenefits.com/reference/auth
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refreshTokenObject.refresh_token);
        params.append('client_id', this.client_id);
        params.append('client_secret', this.client_secret);

        const options = {
            body: params,
            url: this.tokenUri,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * GET /core/me — currently authorized user, scopes, company/person refs.
     * Optional query: includes (e.g. `company`).
     */
    async getMe(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.me,
            query,
        });
    }

    // ---- Companies ---------------------------------------------------------

    /** GET /core/companies */
    async listCompanies(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.companies,
            query,
        });
    }

    /** GET /core/companies/{id} */
    async getCompany(id, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.companyById(id),
            query,
        });
    }

    // ---- People ------------------------------------------------------------

    /**
     * GET /core/people — people for the company the access token applies to.
     * Optional filters: company, department, location, manager, status,
     * first_name, last_name, includes, starting_after, ending_before, limit.
     */
    async listPeople(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.people,
            query,
        });
    }

    /** GET /core/people/{id} */
    async getPerson(id, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.personById(id),
            query,
        });
    }

    /** GET /core/companies/{companyId}/people */
    async listCompanyPeople(companyId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.companyPeople(companyId),
            query,
        });
    }

    // ---- Employments -------------------------------------------------------

    /** GET /core/employments */
    async listEmployments(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.employments,
            query,
        });
    }

    /** GET /core/employments/{id} */
    async getEmployment(id, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.employmentById(id),
            query,
        });
    }

    /** GET /core/people/{personId}/employments */
    async listPersonEmployments(personId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.personEmployments(personId),
            query,
        });
    }

    // ---- Departments -------------------------------------------------------

    /** GET /core/departments */
    async listDepartments(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.departments,
            query,
        });
    }

    /** GET /core/departments/{id} */
    async getDepartment(id, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.departmentById(id),
            query,
        });
    }

    /** GET /core/companies/{companyId}/departments */
    async listCompanyDepartments(companyId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.companyDepartments(companyId),
            query,
        });
    }

    // ---- Locations ---------------------------------------------------------

    /** GET /core/locations */
    async listLocations(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.locations,
            query,
        });
    }

    /** GET /core/locations/{id} */
    async getLocation(id, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.locationById(id),
            query,
        });
    }

    /** GET /core/companies/{companyId}/locations */
    async listCompanyLocations(companyId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.companyLocations(companyId),
            query,
        });
    }

    // ---- Platform ----------------------------------------------------------

    /** GET /platform/applications */
    async listApplications(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.applications,
            query,
        });
    }

    /** GET /platform/applications/{id} */
    async getApplication(id, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.applicationById(id),
            query,
        });
    }

    /** GET /platform/company_installs */
    async listCompanyInstalls(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.companyInstalls,
            query,
        });
    }

    /** GET /platform/company_installs/{id} */
    async getCompanyInstall(id, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.companyInstallById(id),
            query,
        });
    }

    /**
     * POST /platform/company_installs/{id}/status_changes/
     * Body: { status: 'ok' | 'not_enrolled' | 'enrolling' }
     */
    async setCompanyInstallStatus(id, data) {
        return this._post({
            url: this.baseUrl + this.URLs.companyInstallStatus(id),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * POST /platform/person_subscriptions/{id}/status_changes/
     * Body: { status: 'ok' | 'not_enrolled' | 'disabled' }
     */
    async setPersonSubscriptionStatus(id, data) {
        return this._post({
            url: this.baseUrl + this.URLs.personSubscriptionStatus(id),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Time off ----------------------------------------------------------

    /** GET /time_off/vacation_requests */
    async listVacationRequests(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.vacationRequests,
            query,
        });
    }

    /** GET /time_off/vacation_requests/{id} */
    async getVacationRequest(id, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.vacationRequestById(id),
            query,
        });
    }

    // ---- Webhooks (offline verify) -----------------------------------------

    /**
     * Verify a TriNet webhook delivery signature (offline — no HTTP).
     *
     * Header: `Signature` = hex HMAC-SHA256(webhook_shared_secret, raw_body).
     * The webhook shared secret is distinct from the OAuth client secret and is
     * issued when the integration is configured.
     *
     * Official test vector (developers.zenefits.com/reference/webhooks):
     *   secret  = lDVtBQnoRcqYv4fUeVD0oyzgsKWHGtqhatjBX5wXRFQzkVUCzBA571E4qUxvR5LE
     *   payload = {"test":"valid payload"}
     *   Signature: 219a08ea32f319931dc849badc076323f40367aad859ddba4de82e33135fad31
     *
     * @param {Object} args
     * @param {string|Buffer} args.rawBody - Exact delivery body bytes/string
     * @param {Object} args.headers - Request headers (any case)
     * @param {string} args.secret - Application webhook shared secret
     * @returns {{ valid: boolean, reason?: string }}
     */
    verifyWebhookSignature({ rawBody, headers = {}, secret }) {
        if (!secret || typeof secret !== 'string') {
            return { valid: false, reason: 'missing webhook shared secret' };
        }

        const getHeader = (name) => {
            if (!headers || typeof headers !== 'object') return undefined;
            if (headers[name] !== undefined) return headers[name];
            const lower = name.toLowerCase();
            if (headers[lower] !== undefined) return headers[lower];
            for (const key of Object.keys(headers)) {
                if (key.toLowerCase() === lower) return headers[key];
            }
            return undefined;
        };

        const provided = getHeader('signature') || getHeader('Signature');
        if (!provided) {
            return { valid: false, reason: 'missing Signature header' };
        }

        const body =
            Buffer.isBuffer(rawBody)
                ? rawBody.toString('utf8')
                : rawBody == null
                  ? ''
                  : String(rawBody);

        const expected = crypto
            .createHmac('sha256', secret)
            .update(body, 'utf8')
            .digest('hex');

        try {
            const a = Buffer.from(expected, 'utf8');
            const b = Buffer.from(String(provided).toLowerCase(), 'utf8');
            if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
                return { valid: false, reason: 'signature mismatch' };
            }
        } catch (_err) {
            return { valid: false, reason: 'signature mismatch' };
        }
        return { valid: true };
    }

    // ---- Auth check --------------------------------------------------------

    /** Lightweight authenticated request used to validate credentials. */
    async testAuth() {
        return this.getMe();
    }
}

module.exports = { Api };
