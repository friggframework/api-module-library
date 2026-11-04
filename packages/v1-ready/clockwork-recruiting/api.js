const { OAuth2Requester, get } = require('@friggframework/core');

// Clockwork's OAuth provider is firm-less (central) and lives on the
// `account` subdomain. Resource-API calls (people/projects/etc.) are
// per-firm and live on `{firm}.clockworkrecruiting.com/api/v3`.
// Stage selected via CLOCKWORK_STAGE env (local | qa | prod, defaults to prod).
const STAGE_URLS = {
    local: {
        oauthAuthorize: 'http://account.clockwork.local:4001/oauth/authorize',
        oauthToken: 'http://account.clockwork.local:4001/oauth/token',
        resourceTemplate: 'http://{firm}.clockwork.local:4001/api/v3',
    },
    qa: {
        oauthAuthorize:
            'https://account.qa.clockworkrecruiting.com/oauth/authorize',
        oauthToken: 'https://account.qa.clockworkrecruiting.com/oauth/token',
        resourceTemplate: 'https://{firm}.qa.clockworkrecruiting.com/api/v3',
    },
    prod: {
        oauthAuthorize:
            'https://account.clockworkrecruiting.com/oauth/authorize',
        oauthToken: 'https://account.clockworkrecruiting.com/oauth/token',
        resourceTemplate: 'https://{firm}.clockworkrecruiting.com/api/v3',
    },
};

function urlsForStage(stage) {
    return STAGE_URLS[stage] || STAGE_URLS.prod;
}

class Api extends OAuth2Requester {
    // Sub-resource writes can hang longer than other vendors; keep below the
    // 60s OAuth2Requester default so one stuck call does not dominate a batch.
    static requestTimeoutMs = 30_000;

    constructor(params = {}) {
        super(params);

        const firmSubdomain = get(params, 'firm_subdomain', null);
        if (firmSubdomain && !/^[a-zA-Z0-9-]+$/.test(firmSubdomain)) {
            throw new Error(
                'firm_subdomain must only contain alphanumeric characters and hyphens',
            );
        }

        const stageUrls = urlsForStage(process.env.CLOCKWORK_STAGE || 'prod');

        this.resourceBaseUrlTemplate =
            get(params, 'resourceBaseUrlTemplate', null) ||
            stageUrls.resourceTemplate;

        this.firm_subdomain = firmSubdomain;
        this.baseUrl = firmSubdomain
            ? this.resourceBaseUrlTemplate.replace('{firm}', firmSubdomain)
            : null;

        this.client_id =
            get(params, 'client_id', null) ||
            process.env.CLOCKWORK_OAUTH_CLIENT_ID ||
            null;
        this.client_secret =
            get(params, 'client_secret', null) ||
            process.env.CLOCKWORK_OAUTH_CLIENT_SECRET ||
            null;
        this.redirect_uri =
            get(params, 'redirect_uri', null) ||
            process.env.CLOCKWORK_RECRUITING_REDIRECT_URI ||
            process.env.REDIRECT_URI ||
            null;
        this.scope = get(params, 'scope', 'read write');

        this.authorizationUri =
            get(params, 'authorizationUri', null) || stageUrls.oauthAuthorize;
        this.tokenUri = get(params, 'tokenUri', null) || stageUrls.oauthToken;

        this.URLs = {
            // People
            people: '/people',
            personById: (id) => `/people/${id}`,
            peopleSearch: '/people_search',

            // Person sub-resources
            personAddresses: (personId) => `/people/${personId}/addresses`,
            personAddressById: (personId, id) =>
                `/people/${personId}/addresses/${id}`,
            personAttachments: (personId) => `/people/${personId}/attachments`,
            personAttachmentById: (personId, id) =>
                `/people/${personId}/attachments/${id}`,
            personCompensation: (personId) =>
                `/people/${personId}/compensation`,
            personCompensationById: (personId, id) =>
                `/people/${personId}/compensation/${id}`,
            personEducation: (personId) => `/people/${personId}/education`,
            personEducationById: (personId, id) =>
                `/people/${personId}/education/${id}`,
            personEmailAddresses: (personId) =>
                `/people/${personId}/email_addresses`,
            personEmailAddressById: (personId, id) =>
                `/people/${personId}/email_addresses/${id}`,
            personLinkedinUrls: (personId) =>
                `/people/${personId}/linkedin_urls`,
            personLinkedinUrlById: (personId, id) =>
                `/people/${personId}/linkedin_urls/${id}`,
            personNotes: (personId) => `/people/${personId}/notes`,
            personNoteById: (personId, id) => `/people/${personId}/notes/${id}`,
            personPhoneNumbers: (personId) =>
                `/people/${personId}/phone_numbers`,
            personPhoneNumberById: (personId, id) =>
                `/people/${personId}/phone_numbers/${id}`,
            personProfilePicture: (personId) =>
                `/people/${personId}/profile_picture`,
            personPositions: (personId) => `/people/${personId}/positions`,
            personPositionById: (personId, id) =>
                `/people/${personId}/positions/${id}`,
            personTags: (personId) => `/people/${personId}/tags`,
            personTagById: (personId, id) => `/people/${personId}/tags/${id}`,
            personWebSites: (personId) => `/people/${personId}/web_sites`,
            personWebSiteById: (personId, id) =>
                `/people/${personId}/web_sites/${id}`,

            // Projects
            projects: '/projects',
            projectById: (id) => `/projects/${id}`,
            projectAdmin: (projectId) => `/projects/${projectId}/admin`,
            projectAttachments: (projectId) =>
                `/projects/${projectId}/attachments`,
            projectClients: (projectId) => `/projects/${projectId}/clients`,
            projectClientById: (projectId, id) =>
                `/projects/${projectId}/clients/${id}`,
            projectCompensation: (projectId) =>
                `/projects/${projectId}/compensation`,
            projectFees: (projectId) => `/projects/${projectId}/fees`,
            projectLocation: (projectId) => `/projects/${projectId}/location`,
            projectPayments: (projectId) => `/projects/${projectId}/payments`,
            projectCustomFields: (projectId) =>
                `/projects/${projectId}/custom_fields`,
            projectUsers: (projectId) => `/projects/${projectId}/users`,
            projectUserById: (projectId, id) =>
                `/projects/${projectId}/users/${id}`,

            // Candidacies
            candidacies: (projectId) => `/projects/${projectId}/candidacies`,
            candidacyById: (projectId, id) =>
                `/projects/${projectId}/candidacies/${id}`,
            candidacyNotes: (projectId, candidacyId) =>
                `/projects/${projectId}/candidacies/${candidacyId}/notes`,
            candidacyNoteById: (projectId, candidacyId, id) =>
                `/projects/${projectId}/candidacies/${candidacyId}/notes/${id}`,

            // Companies
            companies: '/companies',
            companyById: (id) => `/companies/${id}`,

            // Reference data
            regions: '/regions',
            schools: '/schools',
            schoolById: (id) => `/schools/${id}`,
            tags: '/tags',
            tagById: (id) => `/tags/${id}`,

            // Utility
            noteCategories: '/note_categories',
            statuses: '/statuses',
            users: '/users',
            firmFields: '/firm_fields',
            uploadSignatures: '/upload_signatures',
            webhooks: '/webhooks',
            webhookById: (id) => `/webhooks/${id}`,

            // Legacy support
            support: '/support/timestamp',
        };

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
    }

    setFirmSubdomain(firmSubdomain) {
        if (!firmSubdomain) return;
        if (!/^[a-zA-Z0-9-]+$/.test(firmSubdomain)) {
            throw new Error(
                'firm_subdomain must only contain alphanumeric characters and hyphens',
            );
        }
        this.firm_subdomain = firmSubdomain;
        this.baseUrl = this.resourceBaseUrlTemplate.replace(
            '{firm}',
            firmSubdomain,
        );
    }

    getAuthorizationUri() {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            scope: this.scope,
        });
        if (this.state) params.append('state', this.state);
        return `${this.authorizationUri}?${params.toString()}`;
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri(),
            type: 'oauth2',
            data: {},
        };
    }

    addJsonHeaders(options) {
        const jsonHeaders = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
        options.headers = {
            ...jsonHeaders,
            ...options.headers,
        };
    }

    async _post(options, stringify) {
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    async _patch(options, stringify) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    async _put(options, stringify) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    // ── Auth state ──────────────────────────────────────────────────────

    // Clockwork's Doorkeeper issues refresh tokens with no time expiry (rotation
    // on use, but no `refresh_token_expires_in` in the response). The default
    // OAuth2Requester.isAuthenticated() requires `refreshTokenExpire` to be
    // truthy, which would otherwise stay null forever and trigger a refresh
    // loop on every request. Override to check access-token validity only.
    isAuthenticated() {
        return !!(
            this.access_token &&
            this.refresh_token &&
            this.accessTokenExpire
        );
    }

    async setTokens(response) {
        if (!this.firm_subdomain && response?.access_token) {
            const firmHostname = this._extractFirmFromJwt(
                response.access_token,
            );
            if (firmHostname) this.setFirmSubdomain(firmHostname);
        }
        return super.setTokens(response);
    }

    _extractFirmFromJwt(token) {
        try {
            const payload = token.split('.')[1];
            if (!payload) return null;
            const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
            const decoded = JSON.parse(
                Buffer.from(normalized, 'base64').toString('utf8'),
            );
            return decoded.firm_hostname ?? null;
        } catch {
            return null;
        }
    }

    // ── Connection ──────────────────────────────────────────────────────

    async testConnection() {
        // Fails loudly if firm_subdomain wasn't passed/persisted — prevents a
        // confusing 404 against `null/people`.
        if (!this.baseUrl) {
            throw new Error(
                'Clockwork Recruiting: firm_subdomain is required (call setFirmSubdomain or pass it to the constructor)',
            );
        }
        // List a single person as the liveness probe — exercises the OAuth
        // Bearer flow end-to-end.
        const options = {
            url: this.baseUrl + this.URLs.people,
            query: { limit: 1 },
        };
        return this._get(options);
    }

    // ── People ──────────────────────────────────────────────────────────

    async listPeople(params = {}) {
        const query = {};
        const allowedParams = [
            'limit',
            'offset',
            'sort',
            'include',
            'linkedin_url',
            'updated_since',
        ];
        for (const key of allowedParams) {
            const val = get(params, key, null);
            if (val !== null) query[key] = val;
        }
        if (query.limit === undefined || query.limit === null)
            query.limit = 100;
        if (query.offset === undefined || query.offset === null)
            query.offset = 0;

        const options = {
            url: this.baseUrl + this.URLs.people,
            query,
        };
        return this._get(options);
    }

    async getPerson(id, params = {}) {
        const query = {};
        if (params.include) query.include = params.include;

        const options = {
            url: this.baseUrl + this.URLs.personById(id),
            query,
        };
        return this._get(options);
    }

    async createPerson(data) {
        const options = {
            url: this.baseUrl + this.URLs.people,
            body: { person: data },
        };
        return this._post(options);
    }

    async updatePerson(id, data) {
        const options = {
            url: this.baseUrl + this.URLs.personById(id),
            body: { person: data },
        };
        return this._put(options);
    }

    async deletePerson(id) {
        const options = {
            url: this.baseUrl + this.URLs.personById(id),
        };
        return this._delete(options);
    }

    async searchPeople(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.peopleSearch,
            query: { ...params },
        };
        return this._get(options);
    }

    // ── Person Addresses ────────────────────────────────────────────────

    async listPersonAddresses(personId) {
        const options = {
            url: this.baseUrl + this.URLs.personAddresses(personId),
        };
        return this._get(options);
    }

    async getPersonAddress(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personAddressById(personId, id),
        };
        return this._get(options);
    }

    async createPersonAddress(personId, data) {
        const options = {
            url: this.baseUrl + this.URLs.personAddresses(personId),
            body: { address: data },
        };
        return this._post(options);
    }

    async updatePersonAddress(personId, id, data) {
        const options = {
            url: this.baseUrl + this.URLs.personAddressById(personId, id),
            body: { address: data },
        };
        return this._put(options);
    }

    async deletePersonAddress(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personAddressById(personId, id),
        };
        return this._delete(options);
    }

    // ── Person Attachments ──────────────────────────────────────────────

    async listPersonAttachments(personId) {
        const options = {
            url: this.baseUrl + this.URLs.personAttachments(personId),
        };
        return this._get(options);
    }

    async getPersonAttachment(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personAttachmentById(personId, id),
        };
        return this._get(options);
    }

    async createPersonAttachment(personId, data) {
        const options = {
            url: this.baseUrl + this.URLs.personAttachments(personId),
            body: { attachment: data },
        };
        return this._post(options);
    }

    async deletePersonAttachment(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personAttachmentById(personId, id),
        };
        return this._delete(options);
    }

    // ── Person Compensation ─────────────────────────────────────────────

    async listPersonCompensation(personId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.personCompensation(personId),
            query: { ...params },
        };
        return this._get(options);
    }

    async getPersonCompensation(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personCompensationById(personId, id),
        };
        return this._get(options);
    }

    async createPersonCompensation(personId, data) {
        const options = {
            url: this.baseUrl + this.URLs.personCompensation(personId),
            body: { compensation: data },
        };
        return this._post(options);
    }

    async updatePersonCompensation(personId, id, data) {
        const options = {
            url: this.baseUrl + this.URLs.personCompensationById(personId, id),
            body: { compensation: data },
        };
        return this._put(options);
    }

    async deletePersonCompensation(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personCompensationById(personId, id),
        };
        return this._delete(options);
    }

    // ── Person Education ────────────────────────────────────────────────

    async listPersonEducation(personId) {
        const options = {
            url: this.baseUrl + this.URLs.personEducation(personId),
        };
        return this._get(options);
    }

    async getPersonEducation(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personEducationById(personId, id),
        };
        return this._get(options);
    }

    async createPersonEducation(personId, data) {
        const options = {
            url: this.baseUrl + this.URLs.personEducation(personId),
            body: { education: data },
        };
        return this._post(options);
    }

    async updatePersonEducation(personId, id, data) {
        const options = {
            url: this.baseUrl + this.URLs.personEducationById(personId, id),
            body: { education: data },
        };
        return this._put(options);
    }

    async deletePersonEducation(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personEducationById(personId, id),
        };
        return this._delete(options);
    }

    // ── Person Email Addresses ──────────────────────────────────────────

    async listPersonEmailAddresses(personId) {
        const options = {
            url: this.baseUrl + this.URLs.personEmailAddresses(personId),
        };
        return this._get(options);
    }

    async getPersonEmailAddress(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personEmailAddressById(personId, id),
        };
        return this._get(options);
    }

    async createPersonEmailAddress(personId, data) {
        const options = {
            url: this.baseUrl + this.URLs.personEmailAddresses(personId),
            body: { email: data },
        };
        return this._post(options);
    }

    async updatePersonEmailAddress(personId, id, data) {
        const options = {
            url: this.baseUrl + this.URLs.personEmailAddressById(personId, id),
            body: { email: data },
        };
        return this._put(options);
    }

    async deletePersonEmailAddress(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personEmailAddressById(personId, id),
        };
        return this._delete(options);
    }

    // ── Person LinkedIn URLs ────────────────────────────────────────────

    async listPersonLinkedinUrls(personId) {
        const options = {
            url: this.baseUrl + this.URLs.personLinkedinUrls(personId),
        };
        return this._get(options);
    }

    async getPersonLinkedinUrl(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personLinkedinUrlById(personId, id),
        };
        return this._get(options);
    }

    async createPersonLinkedinUrl(personId, data) {
        const options = {
            url: this.baseUrl + this.URLs.personLinkedinUrls(personId),
            body: { linkedin_url: data },
        };
        return this._post(options);
    }

    async updatePersonLinkedinUrl(personId, id, data) {
        const options = {
            url: this.baseUrl + this.URLs.personLinkedinUrlById(personId, id),
            body: { linkedin_url: data },
        };
        return this._put(options);
    }

    async deletePersonLinkedinUrl(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personLinkedinUrlById(personId, id),
        };
        return this._delete(options);
    }

    // ── Person Notes ────────────────────────────────────────────────────

    async listPersonNotes(personId, params = {}) {
        const query = {};
        if (params.include) query.include = params.include;

        const options = {
            url: this.baseUrl + this.URLs.personNotes(personId),
            query,
        };
        return this._get(options);
    }

    async getPersonNote(personId, id, params = {}) {
        const query = {};
        if (params.include) query.include = params.include;

        const options = {
            url: this.baseUrl + this.URLs.personNoteById(personId, id),
            query,
        };
        return this._get(options);
    }

    async createPersonNote(personId, data) {
        const options = {
            url: this.baseUrl + this.URLs.personNotes(personId),
            body: { note: data },
        };
        return this._post(options);
    }

    async updatePersonNote(personId, id, data) {
        const options = {
            url: this.baseUrl + this.URLs.personNoteById(personId, id),
            body: { note: data },
        };
        return this._put(options);
    }

    async deletePersonNote(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personNoteById(personId, id),
        };
        return this._delete(options);
    }

    // ── Person Phone Numbers ────────────────────────────────────────────

    async listPersonPhoneNumbers(personId) {
        const options = {
            url: this.baseUrl + this.URLs.personPhoneNumbers(personId),
        };
        return this._get(options);
    }

    async getPersonPhoneNumber(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personPhoneNumberById(personId, id),
        };
        return this._get(options);
    }

    async createPersonPhoneNumber(personId, data) {
        const options = {
            url: this.baseUrl + this.URLs.personPhoneNumbers(personId),
            body: { phone_number: data },
        };
        return this._post(options);
    }

    async updatePersonPhoneNumber(personId, id, data) {
        const options = {
            url: this.baseUrl + this.URLs.personPhoneNumberById(personId, id),
            body: { phone_number: data },
        };
        return this._put(options);
    }

    async deletePersonPhoneNumber(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personPhoneNumberById(personId, id),
        };
        return this._delete(options);
    }

    // ── Person Profile Picture ──────────────────────────────────────────

    async getPersonProfilePicture(personId) {
        const options = {
            url: this.baseUrl + this.URLs.personProfilePicture(personId),
        };
        return this._get(options);
    }

    async createPersonProfilePicture(personId, data) {
        const options = {
            url: this.baseUrl + this.URLs.personProfilePicture(personId),
            body: { profile_picture: data },
        };
        return this._post(options);
    }

    async deletePersonProfilePicture(personId) {
        const options = {
            url: this.baseUrl + this.URLs.personProfilePicture(personId),
        };
        return this._delete(options);
    }

    // ── Person Positions ────────────────────────────────────────────────

    async listPersonPositions(personId) {
        const options = {
            url: this.baseUrl + this.URLs.personPositions(personId),
        };
        return this._get(options);
    }

    async getPersonPosition(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personPositionById(personId, id),
        };
        return this._get(options);
    }

    async createPersonPosition(personId, data) {
        const options = {
            url: this.baseUrl + this.URLs.personPositions(personId),
            body: { position: data },
        };
        return this._post(options);
    }

    async updatePersonPosition(personId, id, data) {
        const options = {
            url: this.baseUrl + this.URLs.personPositionById(personId, id),
            body: { position: data },
        };
        return this._put(options);
    }

    async deletePersonPosition(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personPositionById(personId, id),
        };
        return this._delete(options);
    }

    // ── Person Tags ─────────────────────────────────────────────────────

    async listPersonTags(personId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.personTags(personId),
            query: { ...params },
        };
        return this._get(options);
    }

    async createPersonTag(personId, data) {
        // API v3 expects the `tag` envelope (not `person_tag`).
        const options = {
            url: this.baseUrl + this.URLs.personTags(personId),
            body: { tag: data },
        };
        return this._post(options);
    }

    async deletePersonTag(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personTagById(personId, id),
        };
        return this._delete(options);
    }

    // ── Person Web Sites ────────────────────────────────────────────────

    async listPersonWebSites(personId) {
        const options = {
            url: this.baseUrl + this.URLs.personWebSites(personId),
        };
        return this._get(options);
    }

    async getPersonWebSite(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personWebSiteById(personId, id),
        };
        return this._get(options);
    }

    async createPersonWebSite(personId, data) {
        const options = {
            url: this.baseUrl + this.URLs.personWebSites(personId),
            body: { web_site: data },
        };
        return this._post(options);
    }

    async updatePersonWebSite(personId, id, data) {
        const options = {
            url: this.baseUrl + this.URLs.personWebSiteById(personId, id),
            body: { web_site: data },
        };
        return this._put(options);
    }

    async deletePersonWebSite(personId, id) {
        const options = {
            url: this.baseUrl + this.URLs.personWebSiteById(personId, id),
        };
        return this._delete(options);
    }

    // ── Projects ────────────────────────────────────────────────────────

    async listProjects(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.projects,
            query: { ...params },
        };
        return this._get(options);
    }

    async getProject(id, params = {}) {
        const query = {};
        if (params.include) query.include = params.include;

        const options = {
            url: this.baseUrl + this.URLs.projectById(id),
            query,
        };
        return this._get(options);
    }

    async getProjectAdmin(projectId) {
        const options = {
            url: this.baseUrl + this.URLs.projectAdmin(projectId),
        };
        return this._get(options);
    }

    async listProjectAttachments(projectId) {
        const options = {
            url: this.baseUrl + this.URLs.projectAttachments(projectId),
        };
        return this._get(options);
    }

    async listProjectClients(projectId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.projectClients(projectId),
            query: { ...params },
        };
        return this._get(options);
    }

    async getProjectClient(projectId, id) {
        const options = {
            url: this.baseUrl + this.URLs.projectClientById(projectId, id),
        };
        return this._get(options);
    }

    async getProjectCompensation(projectId) {
        const options = {
            url: this.baseUrl + this.URLs.projectCompensation(projectId),
        };
        return this._get(options);
    }

    async getProjectFees(projectId) {
        const options = {
            url: this.baseUrl + this.URLs.projectFees(projectId),
        };
        return this._get(options);
    }

    async getProjectLocation(projectId) {
        const options = {
            url: this.baseUrl + this.URLs.projectLocation(projectId),
        };
        return this._get(options);
    }

    async listProjectPayments(projectId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.projectPayments(projectId),
            query: { ...params },
        };
        return this._get(options);
    }

    async listProjectCustomFields(projectId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.projectCustomFields(projectId),
            query: { ...params },
        };
        return this._get(options);
    }

    async listProjectUsers(projectId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.projectUsers(projectId),
            query: { ...params },
        };
        return this._get(options);
    }

    async getProjectUser(projectId, id) {
        const options = {
            url: this.baseUrl + this.URLs.projectUserById(projectId, id),
        };
        return this._get(options);
    }

    // ── Candidacies ─────────────────────────────────────────────────────

    async listCandidacies(projectId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.candidacies(projectId),
            query: { ...params },
        };
        return this._get(options);
    }

    async getCandidacy(projectId, id, params = {}) {
        const query = {};
        if (params.include) query.include = params.include;

        const options = {
            url: this.baseUrl + this.URLs.candidacyById(projectId, id),
            query,
        };
        return this._get(options);
    }

    async createCandidacy(projectId, data) {
        const options = {
            url: this.baseUrl + this.URLs.candidacies(projectId),
            body: { candidacy: data },
        };
        return this._post(options);
    }

    async updateCandidacy(projectId, id, data) {
        const options = {
            url: this.baseUrl + this.URLs.candidacyById(projectId, id),
            body: { candidacy: data },
        };
        return this._put(options);
    }

    async deleteCandidacy(projectId, id) {
        const options = {
            url: this.baseUrl + this.URLs.candidacyById(projectId, id),
        };
        return this._delete(options);
    }

    async listCandidacyNotes(projectId, candidacyId, params = {}) {
        const options = {
            url:
                this.baseUrl + this.URLs.candidacyNotes(projectId, candidacyId),
            query: { ...params },
        };
        return this._get(options);
    }

    async getCandidacyNote(projectId, candidacyId, id, params = {}) {
        const query = {};
        if (params.include) query.include = params.include;

        const options = {
            url:
                this.baseUrl +
                this.URLs.candidacyNoteById(projectId, candidacyId, id),
            query,
        };
        return this._get(options);
    }

    // ── Companies ───────────────────────────────────────────────────────

    async listCompanies(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.companies,
            query: { ...params },
        };
        return this._get(options);
    }

    async getCompany(id) {
        const options = {
            url: this.baseUrl + this.URLs.companyById(id),
        };
        return this._get(options);
    }

    async createCompany(data) {
        const options = {
            url: this.baseUrl + this.URLs.companies,
            body: { company: data },
        };
        return this._post(options);
    }

    async updateCompany(id, data) {
        const options = {
            url: this.baseUrl + this.URLs.companyById(id),
            body: { company: data },
        };
        return this._put(options);
    }

    // ── Regions ─────────────────────────────────────────────────────────

    async listRegions(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.regions,
            query: { ...params },
        };
        return this._get(options);
    }

    // ── Schools ─────────────────────────────────────────────────────────

    async listSchools(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.schools,
            query: { ...params },
        };
        return this._get(options);
    }

    async getSchool(id) {
        const options = {
            url: this.baseUrl + this.URLs.schoolById(id),
        };
        return this._get(options);
    }

    async createSchool(data) {
        const options = {
            url: this.baseUrl + this.URLs.schools,
            body: { school: data },
        };
        return this._post(options);
    }

    async updateSchool(id, data) {
        const options = {
            url: this.baseUrl + this.URLs.schoolById(id),
            body: { school: data },
        };
        return this._put(options);
    }

    // ── Tags ────────────────────────────────────────────────────────────

    async listTags(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.tags,
            query: { ...params },
        };
        return this._get(options);
    }

    async getTag(id) {
        const options = {
            url: this.baseUrl + this.URLs.tagById(id),
        };
        return this._get(options);
    }

    async createTag(data) {
        const options = {
            url: this.baseUrl + this.URLs.tags,
            body: { tag: data },
        };
        return this._post(options);
    }

    async updateTag(id, data) {
        const options = {
            url: this.baseUrl + this.URLs.tagById(id),
            body: { tag: data },
        };
        return this._put(options);
    }

    async deleteTag(id) {
        const options = {
            url: this.baseUrl + this.URLs.tagById(id),
        };
        return this._delete(options);
    }

    // ── Note Categories ─────────────────────────────────────────────────

    async listNoteCategories() {
        const options = {
            url: this.baseUrl + this.URLs.noteCategories,
        };
        return this._get(options);
    }

    // ── Statuses ────────────────────────────────────────────────────────

    async listStatuses(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.statuses,
            query: { ...params },
        };
        return this._get(options);
    }

    // ── Users ───────────────────────────────────────────────────────────

    async listUsers(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.users,
            query: { ...params },
        };
        return this._get(options);
    }

    // ── Firm Fields ─────────────────────────────────────────────────────

    async listFirmFields() {
        const options = {
            url: this.baseUrl + this.URLs.firmFields,
        };
        return this._get(options);
    }

    // ── Upload Signatures ───────────────────────────────────────────────

    async createUploadSignature(data) {
        const options = {
            url: this.baseUrl + this.URLs.uploadSignatures,
            body: { upload_signature: data },
        };
        return this._post(options);
    }

    // ── Webhooks ────────────────────────────────────────────────────────

    async createWebhook(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.webhooks,
            query: { ...params },
            body: {},
        };
        return this._post(options);
    }

    async deleteWebhook(id) {
        const options = {
            url: this.baseUrl + this.URLs.webhookById(id),
        };
        return this._delete(options);
    }
}

module.exports = { Api };

