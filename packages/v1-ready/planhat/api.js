const { ApiKeyRequester, ModuleConstants, get } = require('@friggframework/core');

/**
 * Planhat main REST API client.
 *
 * Auth: Private App API Access Token sent as `Authorization: Bearer <token>`
 *   (Basic with trailing colon is also documented; this client uses Bearer).
 *
 * Base URL: https://api.planhat.com
 * Soft quota: 200 calls/minute on the main API.
 *
 * Docs:
 *   https://www.planhat.com/developers/api/introduction
 *   https://www.planhat.com/developers/api/authentication-limits
 *
 * The curated machine-readable contract lives in ./planhat.openapi.yaml —
 * this client mirrors it 1:1 (one method per operationId). Keep them in sync.
 *
 * Analytics endpoints (https://analytics.planhat.com — user activities /
 * dimension metrics) use a separate Tenant Token and are out of scope here.
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        const raw =
            get(params, 'api_token', null) ||
            get(params, 'access_token', null) ||
            get(params, 'api_key', null);
        const token = raw ? String(raw).replace(/^Bearer\s+/i, '').trim() : null;

        this.api_token = token;
        // ApiKeyRequester.addAuthHeaders() sets headers[api_key_name] = api_key.
        this.api_key_name = 'Authorization';
        this.api_key = token ? `Bearer ${token}` : null;

        this.baseUrl = 'https://api.planhat.com';

        this.URLs = {
            companies: '/companies',
            companyById: (id) => `/companies/${id}`,
            leanCompanies: '/leancompanies',
            endusers: '/endusers',
            enduserById: (id) => `/endusers/${id}`,
            tasks: '/tasks',
            taskById: (id) => `/tasks/${id}`,
            conversations: '/conversations',
            conversationById: (id) => `/conversations/${id}`,
            customFields: '/customfields',
            customFieldById: (id) => `/customfields/${id}`,
            users: '/users',
            userById: (id) => `/users/${id}`,
        };
    }

    setApiToken(token) {
        const raw = token ? String(token).replace(/^Bearer\s+/i, '').trim() : null;
        this.api_token = raw;
        this.api_key = raw ? `Bearer ${raw}` : null;
        if (raw) this.setApiKey(this.api_key);
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.apiKey,
            data: {
                jsonSchema: {
                    title: 'Planhat Authentication',
                    type: 'object',
                    required: ['api_token'],
                    properties: {
                        api_token: {
                            type: 'string',
                            title: 'API Access Token',
                        },
                    },
                },
                uiSchema: {
                    api_token: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Create a Private App under Settings → Private Apps and copy the API Access Token. Sent as Authorization: Bearer <token>.',
                        'ui:placeholder': 'Your Planhat API Access Token',
                    },
                },
            },
        };
    }

    // ---- Companies ---------------------------------------------------------

    /**
     * List companies.
     * GET /companies
     * Query: companyId, limit (default 100, max 5000), offset, sort, select
     */
    async listCompanies(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.companies,
            query,
        });
    }

    /**
     * Get one company by _id (or extid-/srcid- prefixed keyable).
     * GET /companies/{id}
     */
    async getCompany(companyId) {
        return this._get({
            url: this.baseUrl + this.URLs.companyById(companyId),
        });
    }

    /**
     * Lightweight company id list.
     * GET /leancompanies
     * Query: externalId, sourceId, status
     */
    async listLeanCompanies(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.leanCompanies,
            query,
        });
    }

    /**
     * Create a company (name required).
     * POST /companies
     */
    async createCompany(body) {
        return this._post({
            url: this.baseUrl + this.URLs.companies,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update a company by _id (or extid-/srcid- keyable).
     * PUT /companies/{id}
     */
    async updateCompany(companyId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.companyById(companyId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Convenience (not a separate OpenAPI path): fetch a company and project
     * health-related fields. Health lives on the Company model (`h`,
     * `hProfile`, `csmScore`, `hDiff`, `hDiffDate`, `orgHealthTotal`) —
     * Planhat does not publish a dedicated health-score REST resource.
     * @see https://www.planhat.com/developers/api/company
     */
    async getCompanyHealth(companyId) {
        const company = await this.getCompany(companyId);
        return {
            _id: company?._id,
            name: company?.name,
            h: company?.h,
            hProfile: company?.hProfile,
            csmScore: company?.csmScore,
            hDiff: company?.hDiff,
            hDiffDate: company?.hDiffDate,
            orgHealthTotal: company?.orgHealthTotal,
            lastUpdated: company?.lastUpdated || company?.updatedAt,
        };
    }

    // ---- Endusers (contacts) -----------------------------------------------

    /**
     * List endusers.
     * GET /endusers
     * Query: companyId, limit (default 100, max 2000), offset, sort, select,
     *        archived, email, euId
     */
    async listEndusers(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.endusers,
            query,
        });
    }

    /** GET /endusers/{id} */
    async getEnduser(enduserId) {
        return this._get({
            url: this.baseUrl + this.URLs.enduserById(enduserId),
        });
    }

    /** POST /endusers — email + companyId required (or domain match). */
    async createEnduser(body) {
        return this._post({
            url: this.baseUrl + this.URLs.endusers,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** PUT /endusers/{id} */
    async updateEnduser(enduserId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.enduserById(enduserId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Tasks (CTAs) ------------------------------------------------------

    /**
     * List tasks / events.
     * GET /tasks
     * Query: companyId, limit (default 500, max 10000), offset, sort, select,
     *        enduserIds, isArchived
     */
    async listTasks(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.tasks,
            query,
        });
    }

    /** GET /tasks/{id} */
    async getTask(taskId) {
        return this._get({
            url: this.baseUrl + this.URLs.taskById(taskId),
        });
    }

    /** POST /tasks — companyId required; mainType defaults to "task". */
    async createTask(body) {
        return this._post({
            url: this.baseUrl + this.URLs.tasks,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** PUT /tasks/{id} */
    async updateTask(taskId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.taskById(taskId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Conversations (timeline / activities) -----------------------------

    /**
     * List conversations (notes, emails, chats, tickets, custom types).
     * GET /conversations
     * Query: companyId, limit (default 30, max 2000), offset, sort, select
     */
    async listConversations(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.conversations,
            query,
        });
    }

    /** GET /conversations/{id} */
    async getConversation(conversationId) {
        return this._get({
            url: this.baseUrl + this.URLs.conversationById(conversationId),
        });
    }

    /** POST /conversations — companyId required. */
    async createConversation(body) {
        return this._post({
            url: this.baseUrl + this.URLs.conversations,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** PUT /conversations/{id} */
    async updateConversation(conversationId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.conversationById(conversationId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Custom fields -----------------------------------------------------

    /**
     * List custom field definitions.
     * GET /customfields
     * Query: limit (default 100, max 2000), offset, sort, select
     */
    async listCustomFields(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.customFields,
            query,
        });
    }

    /** GET /customfields/{id} */
    async getCustomField(customFieldId) {
        return this._get({
            url: this.baseUrl + this.URLs.customFieldById(customFieldId),
        });
    }

    // ---- Users (team / identity) -------------------------------------------

    /**
     * List team users.
     * GET /users
     * Query: limit (default/max 10000), offset, sort, select
     */
    async listUsers(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.users,
            query,
        });
    }

    /** GET /users/{id} */
    async getUser(userId) {
        return this._get({
            url: this.baseUrl + this.URLs.userById(userId),
        });
    }
}

module.exports = { Api };
