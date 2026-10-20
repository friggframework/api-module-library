const { ApiKeyRequester, ModuleConstants, get } = require('@friggframework/core');

/**
 * Namely (namely.com) HRIS REST API client.
 *
 * Auth: Personal Access Token (Bearer) for a customer's own integration, or an
 * OAuth 2.0 access token from the authorization-code grant. Both are sent as
 * `Authorization: Bearer <token>`. This module models the PAT / bearer form
 * (company subdomain + token) because OAuth apps are registered inside each
 * customer's own tenant — there is no shared partner authorization server.
 *
 *   curl https://{company}.namely.com/api/v1/profiles/me \
 *     -H "Authorization: Bearer YOUR_TOKEN"
 *
 * Base URL: https://{company}.namely.com/api/v1
 * Docs: https://developers.namely.com/
 * Official Swagger 2.0: published on the Namely Stoplight developer portal
 *   (curated subset mirrored in ./namely.openapi.yaml — one method per operationId).
 *
 * Namely publishes no webhook subscription API. Home-feed activity is polled
 * via GET /events. SCIM 2.0 provisioning is a separate surface and is out of
 * scope for this module.
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        this.company =
            get(params, 'company', null) ||
            get(params, 'company_subdomain', null) ||
            get(params, 'permalink', null);

        const raw =
            get(params, 'access_token', null) ||
            get(params, 'api_token', null) ||
            get(params, 'api_key', null);
        const token = raw ? String(raw).replace(/^Bearer\s+/i, '').trim() : null;

        this.access_token = token;
        // ApiKeyRequester.addAuthHeaders() sets headers[api_key_name] = api_key.
        this.api_key_name = 'Authorization';
        this.api_key = token ? `Bearer ${token}` : null;

        this.baseUrl = this._buildBaseUrl(this.company);

        this.URLs = {
            companyInfo: '/companies/info',
            profilesMe: '/profiles/me',
            profiles: '/profiles',
            profileById: (id) => `/profiles/${id}`,
            profileFields: '/profiles/fields',
            groups: '/groups',
            groupById: (id) => `/groups/${id}`,
            groupTypes: '/group_types',
            groupTypeById: (id) => `/group_types/${id}`,
            teams: '/teams',
            teamById: (id) => `/teams/${id}`,
            jobTitles: '/job_titles',
            jobTitleById: (id) => `/job_titles/${id}`,
            jobTiers: '/job_tiers',
            jobTierById: (id) => `/job_tiers/${id}`,
            events: '/events',
            eventById: (id) => `/events/${id}`,
        };
    }

    _buildBaseUrl(company) {
        // When company is unset, keep the OpenAPI template string so spec-sync
        // can assert servers[0].url === baseUrl before credentials are applied.
        const host = company || '{company}';
        return `https://${host}.namely.com/api/v1`;
    }

    setCompany(company) {
        if (!company) return;
        this.company = String(company).trim();
        this.baseUrl = this._buildBaseUrl(this.company);
    }

    setAccessToken(token) {
        if (!token) return;
        const raw = String(token).replace(/^Bearer\s+/i, '').trim();
        this.access_token = raw;
        this.setApiKey(`Bearer ${raw}`);
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.apiKey,
            data: {
                jsonSchema: {
                    title: 'Namely Authentication',
                    type: 'object',
                    required: ['company', 'access_token'],
                    properties: {
                        company: {
                            type: 'string',
                            title: 'Company subdomain',
                        },
                        access_token: {
                            type: 'string',
                            title: 'Personal Access Token',
                        },
                    },
                },
                uiSchema: {
                    company: {
                        'ui:help':
                            'The subdomain of your Namely tenant. If you sign in at https://acme.namely.com, enter `acme`.',
                        'ui:placeholder': 'acme',
                    },
                    access_token: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Generate a Personal Access Token under the Namely API menu (administrator). Sent as Authorization: Bearer. For partner / marketplace apps, register an OAuth application in the customer tenant instead — see module open questions.',
                        'ui:placeholder': 'Your Namely Personal Access Token',
                    },
                },
            },
        };
    }

    // ---- Identity / company ------------------------------------------------

    /**
     * Get company info (name, permalink, auth methods, logos).
     * GET /companies/info
     *
     * Authentication is NOT required for this endpoint (public home-page data),
     * but sending a Bearer token is harmless and keeps one code path.
     */
    async getCompanyInfo() {
        return this._get({ url: this.baseUrl + this.URLs.companyInfo });
    }

    /**
     * Get the authenticated user's profile.
     * GET /profiles/me
     * Response envelope: { profiles: [ Profile ], linked?, meta?, links? }
     */
    async getCurrentProfile() {
        return this._get({ url: this.baseUrl + this.URLs.profilesMe });
    }

    /** Convenience used by Definition.testAuthRequest. */
    async testAuth() {
        return this.getCurrentProfile();
    }

    // ---- Profiles ----------------------------------------------------------

    /**
     * List profiles (active and inactive). Paginate with `page` / `per_page`
     * (default 30, max 50). Official docs require pagination to avoid timeouts.
     * GET /profiles
     *
     * Supported query params (all optional): page, per_page, profile_format,
     * sort, filter[first_name], filter[last_name], filter[email],
     * filter[personal_email], filter[job_title], filter[reports_to],
     * filter[user_status] (active|pending|inactive).
     */
    async listProfiles(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.profiles,
            query,
        });
    }

    /**
     * Get one profile by id.
     * GET /profiles/{id}
     */
    async getProfile(id) {
        return this._get({
            url: this.baseUrl + this.URLs.profileById(id),
        });
    }

    /**
     * Create a profile.
     * POST /profiles
     * Body shape: { profiles: [ { first_name, last_name, user_status,
     *   start_date, email, personal_email?, ... } ] }
     * Use user_status "pending" to create an Onboarding draft (requires the
     * Onboarding feature and personal_email).
     */
    async createProfile(data) {
        return this._post({
            url: this.baseUrl + this.URLs.profiles,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a profile. PUT (not PATCH); omitted fields are preserved.
     * PUT /profiles/{id}
     * Body shape: { profiles: [ { ...fields } ] }
     */
    async updateProfile(id, data) {
        return this._put({
            url: this.baseUrl + this.URLs.profileById(id),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * List the tenant's profile field schema (including custom fields).
     * GET /profiles/fields
     */
    async listProfileFields(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.profileFields,
            query,
        });
    }

    // ---- Groups & teams ----------------------------------------------------

    /** List all groups (departments, office locations, etc.). GET /groups */
    async listGroups(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.groups,
            query,
        });
    }

    /** Get one group (includes linked profiles). GET /groups/{id} */
    async getGroup(id) {
        return this._get({
            url: this.baseUrl + this.URLs.groupById(id),
        });
    }

    /** List group types. GET /group_types */
    async listGroupTypes(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.groupTypes,
            query,
        });
    }

    /** Get one group type. GET /group_types/{id} */
    async getGroupType(id) {
        return this._get({
            url: this.baseUrl + this.URLs.groupTypeById(id),
        });
    }

    /** List teams. GET /teams */
    async listTeams(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.teams,
            query,
        });
    }

    /** Get one team. GET /teams/{id} */
    async getTeam(id) {
        return this._get({
            url: this.baseUrl + this.URLs.teamById(id),
        });
    }

    // ---- Job titles & tiers ------------------------------------------------

    /** List job titles (each links to one job tier). GET /job_titles */
    async listJobTitles(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.jobTitles,
            query,
        });
    }

    /** Get one job title. GET /job_titles/{id} */
    async getJobTitle(id) {
        return this._get({
            url: this.baseUrl + this.URLs.jobTitleById(id),
        });
    }

    /**
     * Create a job title.
     * POST /job_titles
     * Body: { job_titles: [ { title, parent } ] } where `parent` is a job tier id.
     */
    async createJobTitle(data) {
        return this._post({
            url: this.baseUrl + this.URLs.jobTitles,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a job title.
     * PUT /job_titles/{id}
     */
    async updateJobTitle(id, data) {
        return this._put({
            url: this.baseUrl + this.URLs.jobTitleById(id),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** List job tiers. GET /job_tiers */
    async listJobTiers(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.jobTiers,
            query,
        });
    }

    /** Get one job tier. GET /job_tiers/{id} */
    async getJobTier(id) {
        return this._get({
            url: this.baseUrl + this.URLs.jobTierById(id),
        });
    }

    // ---- Events (home feed; no webhook subscription API) -------------------

    /**
     * List home-feed events (birthday, announcement, recent_arrival, anniversary).
     * GET /events
     * Optional query: after, filter[type], limit (<=30), order (asc|desc), profile_id.
     */
    async listEvents(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.events,
            query,
        });
    }

    /** Get one event. GET /events/{id} */
    async getEvent(id) {
        return this._get({
            url: this.baseUrl + this.URLs.eventById(id),
        });
    }
}

module.exports = { Api };
