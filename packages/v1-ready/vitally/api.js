const { BasicAuthRequester, ModuleConstants, get } = require('@friggframework/core');

/**
 * Vitally public REST API client.
 *
 * Vitally (vitally.io) is a Customer Success platform. The public REST API
 * authenticates with HTTP Basic auth: the REST API key is the username and the
 * password is empty (`Authorization: Basic base64(<api_key>:)`).
 *
 *   - Create keys: Settings → Integrations → Vitally REST API
 *   - US base URL: https://{subdomain}.rest.vitally.io/resources
 *   - EU base URL: https://rest.vitally-eu.io/resources
 *   - Rate limits: 1000 requests/min (token bucket); 429 when exceeded
 *
 * Docs: https://docs.vitally.io/en/articles/9880649-rest-api-overview
 *
 * The canonical machine-readable contract lives in ./vitally.openapi.yaml —
 * this client mirrors it 1:1 (one method per operationId). Keep them in sync.
 */
class Api extends BasicAuthRequester {
    constructor(params = {}) {
        super(params);

        // Vitally Basic auth = Base64(apiKey:). Accept native + common aliases.
        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'access_token', null) ||
            get(params, 'apiKey', null);
        this.subdomain = get(params, 'subdomain', null);

        if (this.api_key) {
            this.username = this.api_key;
            this.password = '';
        }

        // Prefer explicit base_url (EU / custom). Otherwise build from subdomain.
        // Default host matches OpenAPI servers[0].url for spec-sync.
        const override = get(params, 'base_url', null);
        if (override) {
            this.baseUrl = override.replace(/\/$/, '');
        } else if (this.subdomain) {
            this.baseUrl = `https://${this.subdomain}.rest.vitally.io/resources`;
        } else {
            this.baseUrl = 'https://yoursubdomain.rest.vitally.io/resources';
        }

        this.URLs = {
            accounts: '/accounts',
            accountById: (id) => `/accounts/${id}`,
            accountHealthScores: (id) => `/accounts/${id}/healthScores`,
            accountUsers: (accountId) => `/accounts/${accountId}/users`,
            accountTasks: (accountId) => `/accounts/${accountId}/tasks`,
            accountNotes: (accountId) => `/accounts/${accountId}/notes`,
            accountConversations: (accountId) =>
                `/accounts/${accountId}/conversations`,
            accountNpsResponses: (accountId) =>
                `/accounts/${accountId}/npsResponses`,
            organizations: '/organizations',
            organizationById: (id) => `/organizations/${id}`,
            users: '/users',
            userById: (id) => `/users/${id}`,
            usersSearch: '/users/search',
            tasks: '/tasks',
            taskById: (id) => `/tasks/${id}`,
            taskCategories: '/taskCategories',
            notes: '/notes',
            noteById: (id) => `/notes/${id}`,
            conversations: '/conversations',
            conversationById: (id) => `/conversations/${id}`,
            customFields: '/customFields',
            npsResponses: '/npsResponses',
            admins: '/admins',
            adminsSearch: '/admins/search',
        };
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.basic,
            data: {
                jsonSchema: {
                    type: 'object',
                    required: ['api_key', 'subdomain'],
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'Vitally REST API Key',
                        },
                        subdomain: {
                            type: 'string',
                            title: 'Vitally Subdomain (US)',
                        },
                        base_url: {
                            type: 'string',
                            title: 'Base URL override (optional, EU)',
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Create under Settings → Integrations → Vitally REST API. Sent as Basic auth username with an empty password. Docs: https://docs.vitally.io/en/articles/9880649-rest-api-overview',
                        'ui:placeholder': 'Your Vitally REST API key',
                    },
                    subdomain: {
                        'ui:help':
                            'US data center subdomain from https://{subdomain}.vitally.io. Builds https://{subdomain}.rest.vitally.io/resources.',
                        'ui:placeholder': 'yoursubdomain',
                    },
                    base_url: {
                        'ui:help':
                            'Optional. For EU use https://rest.vitally-eu.io/resources (overrides subdomain).',
                        'ui:placeholder':
                            'https://rest.vitally-eu.io/resources',
                    },
                },
            },
        };
    }

    setApiKey(apiKey) {
        this.api_key = apiKey;
        this.username = apiKey;
        this.password = '';
    }

    setSubdomain(subdomain) {
        this.subdomain = subdomain;
        if (subdomain && !this._baseUrlPinned) {
            this.baseUrl = `https://${subdomain}.rest.vitally.io/resources`;
        }
    }

    setBaseUrl(baseUrl) {
        if (baseUrl) {
            this.baseUrl = String(baseUrl).replace(/\/$/, '');
            this._baseUrlPinned = true;
        }
    }

    /**
     * Vitally uses Basic auth with an empty password. Core's BasicAuthRequester
     * only emits Authorization when both username and password are truthy, so
     * we override to allow `password === ''`.
     */
    async addAuthHeaders(headers = {}) {
        if (this.username) {
            const token = Buffer.from(
                `${this.username}:${this.password || ''}`
            ).toString('base64');
            headers['Authorization'] = `Basic ${token}`;
        }
        return headers;
    }

    _pageQuery(params = {}) {
        const query = {};
        if (params.limit !== undefined) query.limit = params.limit;
        if (params.from !== undefined) query.from = params.from;
        if (params.sortBy !== undefined) query.sortBy = params.sortBy;
        return query;
    }

    // ---- Accounts -----------------------------------------------------------

    /** List Accounts. Query: limit, from, sortBy, status (active|churned|activeOrChurned). */
    async listAccounts(params = {}) {
        const query = this._pageQuery(params);
        if (params.status !== undefined) query.status = params.status;
        return this._get({
            url: this.baseUrl + this.URLs.accounts,
            query,
        });
    }

    /** Get an Account by Vitally id or externalId. */
    async getAccount(accountId) {
        return this._get({
            url: this.baseUrl + this.URLs.accountById(accountId),
        });
    }

    /** Get an Account's health score breakdown. */
    async getAccountHealthScores(accountId) {
        return this._get({
            url: this.baseUrl + this.URLs.accountHealthScores(accountId),
        });
    }

    /** Create an Account. Body requires externalId + name; optional traits, organizationId. */
    async createAccount(body) {
        return this._post({
            url: this.baseUrl + this.URLs.accounts,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** Update an Account by Vitally id or externalId. Traits merge; null clears a trait. */
    async updateAccount(accountId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.accountById(accountId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Organizations ------------------------------------------------------

    /** List Organizations. Query: limit, from, sortBy. */
    async listOrganizations(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.organizations,
            query: this._pageQuery(params),
        });
    }

    /** Get an Organization by Vitally id or externalId. */
    async getOrganization(organizationId) {
        return this._get({
            url: this.baseUrl + this.URLs.organizationById(organizationId),
        });
    }

    /** Create an Organization. Body requires externalId + name; optional traits. */
    async createOrganization(body) {
        return this._post({
            url: this.baseUrl + this.URLs.organizations,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** Update an Organization by Vitally id or externalId. */
    async updateOrganization(organizationId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.organizationById(organizationId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Users / Contacts ---------------------------------------------------

    /** List Users (tracked Account/Organization associations only). */
    async listUsers(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.users,
            query: this._pageQuery(params),
        });
    }

    /** List Users for an Account. */
    async listUsersForAccount(accountId, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.accountUsers(accountId),
            query: this._pageQuery(params),
        });
    }

    /** Get a User by Vitally id or externalId. */
    async getUser(userId) {
        return this._get({
            url: this.baseUrl + this.URLs.userById(userId),
        });
    }

    /**
     * Search Users. Exactly one of externalId, email, or emailSubdomain is required.
     */
    async searchUsers(params = {}) {
        const query = {};
        if (params.externalId !== undefined) query.externalId = params.externalId;
        if (params.email !== undefined) query.email = params.email;
        if (params.emailSubdomain !== undefined) {
            query.emailSubdomain = params.emailSubdomain;
        }
        return this._get({
            url: this.baseUrl + this.URLs.usersSearch,
            query,
        });
    }

    /** Create a User. Body requires externalId and accountIds or organizationIds. */
    async createUser(body) {
        return this._post({
            url: this.baseUrl + this.URLs.users,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** Update a User by Vitally id or externalId. */
    async updateUser(userId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.userById(userId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Tasks (CTAs) -------------------------------------------------------

    /** List Tasks. Query: limit, from, sortBy, archived, source. */
    async listTasks(params = {}) {
        const query = this._pageQuery(params);
        if (params.archived !== undefined) query.archived = params.archived;
        if (params.source !== undefined) query.source = params.source;
        return this._get({
            url: this.baseUrl + this.URLs.tasks,
            query,
        });
    }

    /** List Tasks for an Account. */
    async listTasksForAccount(accountId, params = {}) {
        const query = this._pageQuery(params);
        if (params.source !== undefined) query.source = params.source;
        return this._get({
            url: this.baseUrl + this.URLs.accountTasks(accountId),
            query,
        });
    }

    /**
     * Get a Task by Vitally id, or by externalId when `source` is also provided.
     */
    async getTask(taskId, params = {}) {
        const query = {};
        if (params.source !== undefined) query.source = params.source;
        return this._get({
            url: this.baseUrl + this.URLs.taskById(taskId),
            query,
        });
    }

    /** Create a Task. Body requires name + accountId (or organizationId). */
    async createTask(body) {
        return this._post({
            url: this.baseUrl + this.URLs.tasks,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** Update a Task by Vitally id (or externalId + source). */
    async updateTask(taskId, body, params = {}) {
        const query = {};
        if (params.source !== undefined) query.source = params.source;
        return this._put({
            url: this.baseUrl + this.URLs.taskById(taskId),
            headers: { 'Content-Type': 'application/json' },
            query,
            body,
        });
    }

    /** List Task Categories. */
    async listTaskCategories(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.taskCategories,
            query: this._pageQuery(params),
        });
    }

    // ---- Notes (timeline) ---------------------------------------------------

    /** List Notes. Query: limit, from, sortBy, archived, source. */
    async listNotes(params = {}) {
        const query = this._pageQuery(params);
        if (params.archived !== undefined) query.archived = params.archived;
        if (params.source !== undefined) query.source = params.source;
        return this._get({
            url: this.baseUrl + this.URLs.notes,
            query,
        });
    }

    /** List Notes for an Account. */
    async listNotesForAccount(accountId, params = {}) {
        const query = this._pageQuery(params);
        if (params.archived !== undefined) query.archived = params.archived;
        if (params.source !== undefined) query.source = params.source;
        return this._get({
            url: this.baseUrl + this.URLs.accountNotes(accountId),
            query,
        });
    }

    /** Get a Note by Vitally id (or externalId + source). */
    async getNote(noteId, params = {}) {
        const query = {};
        if (params.source !== undefined) query.source = params.source;
        return this._get({
            url: this.baseUrl + this.URLs.noteById(noteId),
            query,
        });
    }

    /** Create a Note. */
    async createNote(body) {
        return this._post({
            url: this.baseUrl + this.URLs.notes,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** Update a Note by Vitally id (or externalId + source). */
    async updateNote(noteId, body, params = {}) {
        const query = {};
        if (params.source !== undefined) query.source = params.source;
        return this._put({
            url: this.baseUrl + this.URLs.noteById(noteId),
            headers: { 'Content-Type': 'application/json' },
            query,
            body,
        });
    }

    // ---- Conversations (timeline) -------------------------------------------

    /** List Conversations. Query: limit, from, sortBy, source. */
    async listConversations(params = {}) {
        const query = this._pageQuery(params);
        if (params.source !== undefined) query.source = params.source;
        return this._get({
            url: this.baseUrl + this.URLs.conversations,
            query,
        });
    }

    /** List Conversations for an Account. */
    async listConversationsForAccount(accountId, params = {}) {
        const query = this._pageQuery(params);
        if (params.source !== undefined) query.source = params.source;
        return this._get({
            url: this.baseUrl + this.URLs.accountConversations(accountId),
            query,
        });
    }

    /** Get a Conversation by Vitally id. */
    async getConversation(conversationId) {
        return this._get({
            url: this.baseUrl + this.URLs.conversationById(conversationId),
        });
    }

    // ---- Custom traits / fields ---------------------------------------------

    /**
     * List custom traits for a model.
     * model: users | accounts | organizations | customObjects | tasks | notes |
     *        projects | conversations | team
     * customObjectId required when model=customObjects.
     */
    async listCustomFields(params = {}) {
        const query = {};
        if (params.model !== undefined) query.model = params.model;
        if (params.customObjectId !== undefined) {
            query.customObjectId = params.customObjectId;
        }
        return this._get({
            url: this.baseUrl + this.URLs.customFields,
            query,
        });
    }

    // ---- NPS Responses ------------------------------------------------------

    /** List NPS Responses. Query: target (accounts|organizations), limit, from. */
    async listNpsResponses(params = {}) {
        const query = this._pageQuery(params);
        if (params.target !== undefined) query.target = params.target;
        return this._get({
            url: this.baseUrl + this.URLs.npsResponses,
            query,
        });
    }

    /** List NPS Responses for an Account. */
    async listNpsResponsesForAccount(accountId, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.accountNpsResponses(accountId),
            query: this._pageQuery(params),
        });
    }

    // ---- Admins -------------------------------------------------------------

    /** List Admins. */
    async listAdmins(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.admins,
            query: this._pageQuery(params),
        });
    }

    /** Search Admins by email. */
    async searchAdmins(params = {}) {
        const query = {};
        if (params.email !== undefined) query.email = params.email;
        return this._get({
            url: this.baseUrl + this.URLs.adminsSearch,
            query,
        });
    }

    // ---- Auth check ---------------------------------------------------------

    /**
     * Lightweight authenticated request used to validate credentials.
     * Listing a single account page returns 200 for valid keys; invalid keys
     * return 401, which the requester surfaces as an error.
     */
    async testAuth() {
        return this.listAccounts({ limit: 1 });
    }
}

module.exports = { Api };
