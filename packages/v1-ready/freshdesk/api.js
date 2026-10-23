const { BasicAuthRequester, ModuleConstants, get } = require('@friggframework/core');

/**
 * Freshdesk REST API v2 client.
 *
 * Auth: per-agent API key with HTTP Basic auth. The API key is the username;
 * any dummy password works — Freshdesk documents `X` as the conventional value.
 *
 *   curl -u YOUR_API_KEY:X -H "Content-Type: application/json" \
 *     https://YOUR_DOMAIN.freshdesk.com/api/v2/tickets
 *
 * Base URL: https://{domain}.freshdesk.com/api/v2
 * Find the API key: Profile picture → Profile settings.
 *
 * Docs: https://developers.freshdesk.com/api/
 *
 * Freshdesk does not publish an official OpenAPI document. The curated contract
 * in ./freshdesk.openapi.yaml mirrors the official HTML reference for exactly
 * the endpoints this client implements (one method per operationId).
 *
 * Default domain `domain` is a placeholder so OpenAPI servers[0].url matches
 * `baseUrl` when no real helpdesk is configured. Pass `domain` (or a full
 * `base_url`) for a real instance.
 */
const DEFAULT_DOMAIN = 'domain';
const DUMMY_PASSWORD = 'X';

class Api extends BasicAuthRequester {
    constructor(params = {}) {
        super(params);

        this.domain = this._normalizeDomain(
            get(params, 'domain', null) || DEFAULT_DOMAIN
        );
        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'username', null) ||
            get(params, 'access_token', null);

        // Freshdesk Basic auth = Base64(api_key:X)
        if (this.api_key) this.username = this.api_key;
        this.password = get(params, 'password', null) || DUMMY_PASSWORD;

        const overrideBase =
            get(params, 'base_url', null) || get(params, 'baseUrl', null);
        this.baseUrl =
            overrideBase || `https://${this.domain}.freshdesk.com/api/v2`;

        this.URLs = {
            account: '/account',
            agents: '/agents',
            agentById: (id) => `/agents/${id}`,
            agentsMe: '/agents/me',
            tickets: '/tickets',
            ticketById: (id) => `/tickets/${id}`,
            ticketConversations: (id) => `/tickets/${id}/conversations`,
            ticketReply: (id) => `/tickets/${id}/reply`,
            ticketNotes: (id) => `/tickets/${id}/notes`,
            conversationById: (id) => `/conversations/${id}`,
            contacts: '/contacts',
            contactById: (id) => `/contacts/${id}`,
            companies: '/companies',
            companyById: (id) => `/companies/${id}`,
            groups: '/groups',
            groupById: (id) => `/groups/${id}`,
        };
    }

    _normalizeDomain(domain) {
        if (!domain) return DEFAULT_DOMAIN;
        let d = String(domain).trim().toLowerCase();
        d = d.replace(/^https?:\/\//, '');
        d = d.replace(/\.freshdesk\.com.*$/, '');
        d = d.replace(/\/.*$/, '');
        return d || DEFAULT_DOMAIN;
    }

    setDomain(domain) {
        this.domain = this._normalizeDomain(domain);
        this.baseUrl = `https://${this.domain}.freshdesk.com/api/v2`;
    }

    setApiKey(apiKey) {
        this.api_key = apiKey;
        this.username = apiKey;
        this.password = DUMMY_PASSWORD;
    }

    /**
     * JSON-Schema form for collecting Freshdesk domain + API key.
     * Domain is the helpdesk subdomain; API key is under Profile settings.
     */
    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.basic,
            data: {
                jsonSchema: {
                    title: 'Freshdesk Authentication',
                    type: 'object',
                    required: ['domain', 'api_key'],
                    properties: {
                        domain: {
                            type: 'string',
                            title: 'Freshdesk Domain',
                        },
                        api_key: {
                            type: 'string',
                            title: 'API Key',
                        },
                    },
                },
                uiSchema: {
                    domain: {
                        'ui:help':
                            'Your helpdesk subdomain (acme in https://acme.freshdesk.com). Full hostnames are accepted and normalized.',
                        'ui:placeholder': 'acme',
                    },
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'From Profile picture → Profile settings. Sent as HTTP Basic username with dummy password X (per Freshdesk docs).',
                    },
                },
            },
        };
    }

    _jsonHeaders() {
        return { 'Content-Type': 'application/json', Accept: 'application/json' };
    }

    // ---- Account / identity ------------------------------------------------

    /**
     * View Account.
     * GET /api/v2/account
     * Returns account_id, account_name, account_domain, organisation_*, etc.
     */
    async getAccount() {
        return this._get({ url: this.baseUrl + this.URLs.account });
    }

    /**
     * Currently Authenticated Agent.
     * GET /api/v2/agents/me
     */
    async getAuthenticatedAgent() {
        return this._get({ url: this.baseUrl + this.URLs.agentsMe });
    }

    // ---- Agents ------------------------------------------------------------

    /**
     * List All Agents.
     * GET /api/v2/agents
     * Optional filters: email, mobile, phone, state (fulltime|occasional),
     * page, per_page.
     */
    async listAgents(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.agents,
            query: params,
        };
        return this._get(options);
    }

    /**
     * View an Agent.
     * GET /api/v2/agents/{id}
     */
    async getAgent(id) {
        return this._get({ url: this.baseUrl + this.URLs.agentById(id) });
    }

    // ---- Tickets -----------------------------------------------------------

    /**
     * List All Tickets.
     * GET /api/v2/tickets
     * Optional: filter, requester_id, email, company_id, updated_since,
     * order_by, order_type, include, page, per_page.
     */
    async listTickets(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.tickets,
            query: params,
        };
        return this._get(options);
    }

    /**
     * View a Ticket.
     * GET /api/v2/tickets/{id}
     * Optional query: include (conversations, requester, company, stats).
     */
    async getTicket(id, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.ticketById(id),
            query: params,
        };
        return this._get(options);
    }

    /**
     * Create a Ticket.
     * POST /api/v2/tickets
     * Requester identity: one of email, requester_id, facebook_id, phone,
     * twitter_id, unique_external_id (plus name when using phone alone).
     * Required-ish business fields: subject, description; status/priority
     * default when omitted.
     */
    async createTicket(data) {
        return this._post({
            url: this.baseUrl + this.URLs.tickets,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    /**
     * Update a Ticket.
     * PUT /api/v2/tickets/{id}
     */
    async updateTicket(id, data) {
        return this._put({
            url: this.baseUrl + this.URLs.ticketById(id),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Conversations -----------------------------------------------------

    /**
     * List All Conversations of a Ticket.
     * GET /api/v2/tickets/{id}/conversations
     * Optional: page (30 conversations per page).
     */
    async listTicketConversations(ticketId, params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.ticketConversations(ticketId),
            query: params,
        };
        return this._get(options);
    }

    /**
     * Create a Reply on a ticket.
     * POST /api/v2/tickets/{id}/reply
     * body or structured_body is mandatory.
     */
    async createReply(ticketId, data) {
        return this._post({
            url: this.baseUrl + this.URLs.ticketReply(ticketId),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    /**
     * Create a Note on a ticket.
     * POST /api/v2/tickets/{ticket_id}/notes
     * Notes are private by default (`private: true`).
     */
    async createNote(ticketId, data) {
        return this._post({
            url: this.baseUrl + this.URLs.ticketNotes(ticketId),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    /**
     * Update a conversation (public or private note).
     * PUT /api/v2/conversations/{id}
     */
    async updateConversation(id, data) {
        return this._put({
            url: this.baseUrl + this.URLs.conversationById(id),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Contacts ----------------------------------------------------------

    /**
     * List All Contacts.
     * GET /api/v2/contacts
     * Optional: email, mobile, phone, company_id, state, contact_type,
     * updated_since, page, per_page.
     */
    async listContacts(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.contacts,
            query: params,
        };
        return this._get(options);
    }

    /**
     * View a Contact.
     * GET /api/v2/contacts/{id}
     */
    async getContact(id) {
        return this._get({ url: this.baseUrl + this.URLs.contactById(id) });
    }

    /**
     * Create a Contact.
     * POST /api/v2/contacts
     * name is mandatory; one of email / phone / mobile / twitter_id /
     * unique_external_id / social_handler is required.
     */
    async createContact(data) {
        return this._post({
            url: this.baseUrl + this.URLs.contacts,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    /**
     * Update a Contact.
     * PUT /api/v2/contacts/{id}
     */
    async updateContact(id, data) {
        return this._put({
            url: this.baseUrl + this.URLs.contactById(id),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Companies ---------------------------------------------------------

    /**
     * List All Companies.
     * GET /api/v2/companies
     * Optional: page, per_page, updated_since.
     */
    async listCompanies(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.companies,
            query: params,
        };
        return this._get(options);
    }

    /**
     * View a Company.
     * GET /api/v2/companies/{id}
     */
    async getCompany(id) {
        return this._get({ url: this.baseUrl + this.URLs.companyById(id) });
    }

    /**
     * Create a Company.
     * POST /api/v2/companies
     * name is mandatory.
     */
    async createCompany(data) {
        return this._post({
            url: this.baseUrl + this.URLs.companies,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    /**
     * Update a Company.
     * PUT /api/v2/companies/{id}
     */
    async updateCompany(id, data) {
        return this._put({
            url: this.baseUrl + this.URLs.companyById(id),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Groups ------------------------------------------------------------

    /**
     * List All Groups.
     * GET /api/v2/groups
     */
    async listGroups(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.groups,
            query: params,
        };
        return this._get(options);
    }

    /**
     * View a Group.
     * GET /api/v2/groups/{id}
     */
    async getGroup(id) {
        return this._get({ url: this.baseUrl + this.URLs.groupById(id) });
    }

    /**
     * Create a Group.
     * POST /api/v2/groups
     * name is mandatory.
     */
    async createGroup(data) {
        return this._post({
            url: this.baseUrl + this.URLs.groups,
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    /**
     * Update a Group.
     * PUT /api/v2/groups/{id}
     */
    async updateGroup(id, data) {
        return this._put({
            url: this.baseUrl + this.URLs.groupById(id),
            headers: this._jsonHeaders(),
            body: data,
        });
    }

    // ---- Auth check --------------------------------------------------------

    /**
     * Lightweight authenticated request used to validate credentials.
     * GET /account returns 200 for valid keys; invalid keys return 401.
     */
    async testAuth() {
        return this.getAccount();
    }
}

module.exports = { Api, DEFAULT_DOMAIN, DUMMY_PASSWORD };
