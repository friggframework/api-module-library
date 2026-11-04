const {
    BasicAuthRequester,
    ModuleConstants,
    get,
} = require('@friggframework/core');

/**
 * Neon CRM API v2 client.
 *
 * Auth: HTTP Basic — username = Org ID, password = API key.
 *   Authorization: Basic Base64(orgId:apiKey)
 *   Header: NEON-API-VERSION: 2.11 (current; omit defaults to latest)
 *
 * Base URLs (official):
 *   Production / sandbox: https://api.neoncrm.com/v2
 *   Trial:                https://trial.neoncrm.com/v2
 *
 * Docs: https://developer.neoncrm.com/api-v2/
 * Auth: https://developer.neoncrm.com/authentication/
 * Versioning: https://developer.neoncrm.com/versioning/
 *
 * The curated contract in ./neon.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Keep them in sync.
 *
 * Search endpoints allow one concurrent request per org — serialized via
 * `_serializeSearch`.
 */

const NEON_API_VERSION = '2.11';
const DEFAULT_BASE_URL = 'https://api.neoncrm.com/v2';
const TRIAL_BASE_URL = 'https://trial.neoncrm.com/v2';

function baseUrlFor(environment) {
    return environment === 'trial' ? TRIAL_BASE_URL : DEFAULT_BASE_URL;
}

function normalizeOrgId(value) {
    return String(value ?? '').trim() || null;
}

class Api extends BasicAuthRequester {
    constructor(params = {}) {
        super(params);

        this.orgId =
            normalizeOrgId(get(params, 'orgId', null)) ||
            normalizeOrgId(get(params, 'org_id', null)) ||
            normalizeOrgId(get(params, 'username', null));

        this.apiKey =
            get(params, 'apiKey', null) ||
            get(params, 'api_key', null) ||
            get(params, 'password', null) ||
            null;

        this.environment =
            get(params, 'environment', null) ||
            get(params, 'env', null) ||
            'production';

        if (this.orgId) this.username = this.orgId;
        if (this.apiKey) this.password = this.apiKey;

        const explicitBase =
            get(params, 'baseUrl', null) || get(params, 'base_url', null);
        this._baseUrl = explicitBase || baseUrlFor(this.environment);

        this.URLs = {
            accounts: '/accounts',
            accountById: (id) => `/accounts/${encodeURIComponent(id)}`,
            accountsSearch: '/accounts/search',
            accountDonations: (id) =>
                `/accounts/${encodeURIComponent(id)}/donations`,
            donations: '/donations',
            donationById: (id) => `/donations/${encodeURIComponent(id)}`,
            donationsSearch: '/donations/search',
            campaigns: '/campaigns',
            campaignById: (id) => `/campaigns/${encodeURIComponent(id)}`,
            funds: '/properties/funds',
            purposes: '/properties/purposes',
            countries: '/properties/countries',
            stateProvinces: '/properties/stateProvinces',
            organizationProfile: '/properties/organizationProfile',
            events: '/events',
            eventById: (id) => `/events/${encodeURIComponent(id)}`,
            eventRegistrations: '/eventRegistrations',
            eventRegistrationById: (id) =>
                `/eventRegistrations/${encodeURIComponent(id)}`,
            eventRegistrationsForEvent: (id) =>
                `/events/${encodeURIComponent(id)}/eventRegistrations`,
            webhooks: '/webhooks',
            webhookById: (id) => `/webhooks/${encodeURIComponent(id)}`,
        };

        this._searchChain = Promise.resolve();
    }

    get baseUrl() {
        return this._baseUrl;
    }

    set baseUrl(value) {
        this._baseUrl = value;
    }

    setCredentials({ orgId, apiKey, environment, baseUrl } = {}) {
        if (orgId !== undefined) {
            this.orgId = normalizeOrgId(orgId);
            this.username = this.orgId;
        }
        if (apiKey !== undefined) {
            this.apiKey = apiKey || null;
            this.password = this.apiKey;
        }
        if (environment !== undefined) {
            this.environment = environment;
            if (!baseUrl) {
                this._baseUrl = baseUrlFor(this.environment);
            }
        }
        if (baseUrl !== undefined && baseUrl) {
            this._baseUrl = baseUrl;
        }
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.basic,
            data: {
                jsonSchema: {
                    title: 'Neon CRM API Authorization',
                    type: 'object',
                    required: ['orgId', 'apiKey'],
                    properties: {
                        orgId: {
                            type: 'string',
                            title: 'Org ID',
                            'ui:help':
                                'Your Neon organisation ID (Neon UI: Settings → Organization Profile). Used as the Basic-auth username.',
                        },
                        apiKey: {
                            type: 'string',
                            title: 'API Key',
                        },
                        environment: {
                            type: 'string',
                            title: 'API Environment',
                            enum: ['production', 'trial'],
                            enumNames: ['Production / sandbox', 'Trial'],
                            default: 'production',
                        },
                    },
                },
                uiSchema: {
                    apiKey: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Neon API key for a system user (Settings → User Settings → API Keys). Basic-auth password.',
                    },
                },
            },
        };
    }

    async addAuthHeaders(headers = {}) {
        const withBasic = await super.addAuthHeaders(headers);
        return {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...withBasic,
            'NEON-API-VERSION': NEON_API_VERSION,
        };
    }

    /**
     * Neon star/search endpoints allow one concurrent request per org.
     * @private
     */
    _serializeSearch(run) {
        const chained = this._searchChain.then(run);
        this._searchChain = chained.then(
            () => undefined,
            () => undefined
        );
        return chained;
    }

    // ---- Identity / properties ---------------------------------------------

    /**
     * Organization profile for the authenticated org.
     * GET /properties/organizationProfile
     */
    async getOrganizationProfile() {
        return this._get({
            url: this.baseUrl + this.URLs.organizationProfile,
        });
    }

    async listFunds() {
        return this._get({ url: this.baseUrl + this.URLs.funds });
    }

    async listPurposes() {
        return this._get({ url: this.baseUrl + this.URLs.purposes });
    }

    async listCountries() {
        return this._get({ url: this.baseUrl + this.URLs.countries });
    }

    async listStateProvinces() {
        return this._get({ url: this.baseUrl + this.URLs.stateProvinces });
    }

    // ---- Accounts ----------------------------------------------------------

    async listAccounts(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.accounts,
            query: params,
        });
    }

    async createAccount(body) {
        return this._post({
            url: this.baseUrl + this.URLs.accounts,
            body,
        });
    }

    async getAccount(id) {
        return this._get({
            url: this.baseUrl + this.URLs.accountById(id),
        });
    }

    /** PUT /accounts/{id} — full update */
    async updateAccount(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.accountById(id),
            body,
        });
    }

    /** PATCH /accounts/{id} — partial update */
    async patchAccount(id, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.accountById(id),
            body,
        });
    }

    /**
     * Search accounts. Rate-limited to 1 concurrent request per org.
     * POST /accounts/search
     *
     * body: { searchFields: [{ field, operator, value }], outputFields: [...] }
     */
    async searchAccounts(body) {
        return this._serializeSearch(() =>
            this._post({
                url: this.baseUrl + this.URLs.accountsSearch,
                body,
            })
        );
    }

    // ---- Donations ---------------------------------------------------------

    async createDonation(body) {
        return this._post({
            url: this.baseUrl + this.URLs.donations,
            body,
        });
    }

    async getDonation(id) {
        return this._get({
            url: this.baseUrl + this.URLs.donationById(id),
        });
    }

    async listAccountDonations(id, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.accountDonations(id),
            query: params,
        });
    }

    async searchDonations(body) {
        return this._serializeSearch(() =>
            this._post({
                url: this.baseUrl + this.URLs.donationsSearch,
                body,
            })
        );
    }

    // ---- Campaigns ---------------------------------------------------------

    async listCampaigns(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.campaigns,
            query: params,
        });
    }

    async getCampaign(id) {
        return this._get({
            url: this.baseUrl + this.URLs.campaignById(id),
        });
    }

    // ---- Events (legacy events only; Next Gen events are not exposed) ------

    async listEvents(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.events,
            query: params,
        });
    }

    async createEvent(body) {
        return this._post({
            url: this.baseUrl + this.URLs.events,
            body,
        });
    }

    async getEvent(id) {
        return this._get({
            url: this.baseUrl + this.URLs.eventById(id),
        });
    }

    async createEventRegistration(body) {
        return this._post({
            url: this.baseUrl + this.URLs.eventRegistrations,
            body,
        });
    }

    async getEventRegistration(registrationId) {
        return this._get({
            url: this.baseUrl + this.URLs.eventRegistrationById(registrationId),
        });
    }

    /**
     * List registrations for a legacy event.
     * GET /events/{id}/eventRegistrations
     * Note: paginates with `page`, not `currentPage`.
     */
    async listEventRegistrations(id, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.eventRegistrationsForEvent(id),
            query: params,
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    async listWebhooks() {
        return this._get({ url: this.baseUrl + this.URLs.webhooks });
    }

    async createWebhook(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks,
            body,
        });
    }

    async getWebhook(id) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookById(id),
        });
    }

    async updateWebhook(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.webhookById(id),
            body,
        });
    }

    async patchWebhook(id, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.webhookById(id),
            body,
        });
    }

    async deleteWebhook(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(id),
        });
    }

    /**
     * Lightweight authenticated call for auth testing / identity.
     * Prefers organizationProfile; falls back to a 1-row account list.
     */
    async testAuth() {
        try {
            return await this.getOrganizationProfile();
        } catch (_e) {
            return this.listAccounts({ pageSize: 1 });
        }
    }
}

module.exports = { Api, NEON_API_VERSION, DEFAULT_BASE_URL, TRIAL_BASE_URL };
