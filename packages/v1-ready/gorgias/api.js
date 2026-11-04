const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Gorgias REST API client.
 *
 * Auth (public apps): OAuth2 Bearer token, per-account subdomain.
 *   GET https://{domain}.gorgias.com/api/account
 *   Authorization: Bearer <access_token>
 *
 * Auth (private apps): HTTP Basic with account email + API key.
 *   Authorization: Basic base64(email:api_key)
 *
 * Base URL: https://{domain}.gorgias.com/api
 * Docs: https://developers.gorgias.com/reference/introduction
 * OAuth: https://developers.gorgias.com/docs/set-up-oauth2-app-store
 * Basic: https://developers.gorgias.com/docs/access-tokens-api-keys
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.subdomain = get(params, 'subdomain', null);
        this.api_key = get(params, 'api_key', null);
        this.api_user_email = get(params, 'api_user_email', null);

        this.client_id =
            get(params, 'client_id', null) || process.env.GORGIAS_CLIENT_ID;
        this.client_secret =
            get(params, 'client_secret', null) ||
            process.env.GORGIAS_CLIENT_SECRET;
        this.scope =
            get(params, 'scope', null) ||
            get(params, 'scopes', null) ||
            process.env.GORGIAS_SCOPES;
        this.redirect_uri =
            get(params, 'redirect_uri', null) ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/gorgias`
                : null);

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        this.baseUrl = this._buildBaseUrl(this.subdomain);
        this.tokenUri = this._buildTokenUri(this.subdomain);

        this.URLs = {
            account: '/account',
            tickets: '/tickets',
            ticketById: (id) => `/tickets/${id}`,
            messages: '/messages',
            ticketMessages: (ticketId) => `/tickets/${ticketId}/messages`,
            ticketMessageById: (ticketId, id) =>
                `/tickets/${ticketId}/messages/${id}`,
            customers: '/customers',
            customerById: (id) => `/customers/${id}`,
            users: '/users',
            userById: (id) => `/users/${id}`,
            tags: '/tags',
            tagById: (id) => `/tags/${id}`,
            satisfactionSurveys: '/satisfaction-surveys',
            satisfactionSurveyById: (id) => `/satisfaction-surveys/${id}`,
            integrations: '/integrations',
            integrationById: (id) => `/integrations/${id}`,
            widgets: '/widgets',
            widgetById: (id) => `/widgets/${id}`,
        };
    }

    _buildBaseUrl(subdomain) {
        // Template form matches OpenAPI servers[0].url when subdomain is unset
        // (spec-sync). Once set, resolve to the concrete account host.
        if (!subdomain) {
            return 'https://{domain}.gorgias.com/api';
        }
        return `https://${subdomain}.gorgias.com/api`;
    }

    _buildTokenUri(subdomain) {
        if (!subdomain) {
            return 'https://{domain}.gorgias.com/oauth/token';
        }
        return `https://${subdomain}.gorgias.com/oauth/token`;
    }

    _buildAuthorizeUri(subdomain, { state, nonce } = {}) {
        const domain = subdomain || '{domain}';
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            scope: this.scope || '',
            state: state || crypto.randomBytes(16).toString('hex'),
            nonce: nonce || crypto.randomBytes(16).toString('hex'),
        });
        return `https://${domain}.gorgias.com/oauth/authorize?${params.toString()}`;
    }

    setSubdomain(subdomain) {
        this.subdomain = subdomain;
        this.baseUrl = this._buildBaseUrl(subdomain);
        this.tokenUri = this._buildTokenUri(subdomain);
        if (this.redirect_uri && process.env.REDIRECT_URI) {
            // Keep account hint on the redirect for multi-tenant callback routing.
            const base = `${process.env.REDIRECT_URI}/gorgias`;
            this.redirect_uri = `${base}?account=${encodeURIComponent(
                subdomain
            )}`;
        }
    }

    /**
     * Build the authorization URL for a specific Gorgias account subdomain.
     * State and nonce are generated per call (never hard-coded).
     */
    getAuthUri({ subdomain, state, nonce } = {}) {
        const domain = subdomain || this.subdomain;
        if (!domain) {
            throw new Error(
                'Gorgias getAuthUri requires a subdomain (account domain).'
            );
        }
        return this._buildAuthorizeUri(domain, { state, nonce });
    }

    async addAuthHeaders(headers = {}) {
        // Prefer OAuth Bearer when present; fall back to Basic for private apps.
        if (this.access_token) {
            headers.Authorization = `Bearer ${this.access_token}`;
            return headers;
        }
        if (this.api_user_email && this.api_key) {
            const token = Buffer.from(
                `${this.api_user_email}:${this.api_key}`
            ).toString('base64');
            headers.Authorization = `Basic ${token}`;
            return headers;
        }
        return headers;
    }

    setBasicAuth({ api_user_email, api_key, subdomain } = {}) {
        if (api_user_email) this.api_user_email = api_user_email;
        if (api_key) this.api_key = api_key;
        if (subdomain) this.setSubdomain(subdomain);
        // Clear bearer so Basic is used.
        this.access_token = null;
    }

    async getTokenFromCode(code) {
        // Gorgias token endpoint expects HTTP Basic client credentials.
        delete this.access_token;
        return this.getTokenFromCodeBasicAuthHeader(code);
    }

    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append(
            'refresh_token',
            refreshTokenObject.refresh_token || this.refresh_token
        );

        const options = {
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(
                    `${this.client_id}:${this.client_secret}`
                ).toString('base64')}`,
            },
            url: this.tokenUri,
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    // ---- Account -----------------------------------------------------------

    /** GET /account — Retrieve your account. */
    async getAccount() {
        return this._get({ url: this.baseUrl + this.URLs.account });
    }

    // ---- Tickets -----------------------------------------------------------

    /** GET /tickets — List tickets (cursor pagination). */
    async listTickets(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.tickets,
            query,
        });
    }

    /** GET /tickets/{id} — Retrieve a ticket. */
    async getTicket(ticketId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.ticketById(ticketId),
            query,
        });
    }

    /** POST /tickets — Create a ticket. */
    async createTicket(body) {
        return this._post({
            url: this.baseUrl + this.URLs.tickets,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** PUT /tickets/{id} — Update a ticket. */
    async updateTicket(ticketId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.ticketById(ticketId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** DELETE /tickets/{id} — Delete a ticket. */
    async deleteTicket(ticketId) {
        return this._delete({
            url: this.baseUrl + this.URLs.ticketById(ticketId),
        });
    }

    // ---- Messages ----------------------------------------------------------

    /** GET /messages — List messages (optional ticket_id filter). */
    async listMessages(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.messages,
            query,
        });
    }

    /** GET /tickets/{ticket_id}/messages/{id} — Retrieve a message. */
    async getMessage(ticketId, messageId) {
        return this._get({
            url:
                this.baseUrl + this.URLs.ticketMessageById(ticketId, messageId),
        });
    }

    /** POST /tickets/{ticket_id}/messages — Create a message on a ticket. */
    async createTicketMessage(ticketId, body) {
        return this._post({
            url: this.baseUrl + this.URLs.ticketMessages(ticketId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Customers ---------------------------------------------------------

    /** GET /customers — List customers. */
    async listCustomers(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.customers,
            query,
        });
    }

    /** GET /customers/{id} — Retrieve a customer. */
    async getCustomer(customerId) {
        return this._get({
            url: this.baseUrl + this.URLs.customerById(customerId),
        });
    }

    /** POST /customers — Create a customer. */
    async createCustomer(body) {
        return this._post({
            url: this.baseUrl + this.URLs.customers,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** PUT /customers/{id} — Update a customer. */
    async updateCustomer(customerId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.customerById(customerId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** DELETE /customers/{id} — Delete a customer. */
    async deleteCustomer(customerId) {
        return this._delete({
            url: this.baseUrl + this.URLs.customerById(customerId),
        });
    }

    // ---- Users -------------------------------------------------------------

    /** GET /users — List users. */
    async listUsers(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.users,
            query,
        });
    }

    /** GET /users/{id} — Retrieve a user. */
    async getUser(userId) {
        return this._get({
            url: this.baseUrl + this.URLs.userById(userId),
        });
    }

    // ---- Tags --------------------------------------------------------------

    /** GET /tags — List tags. */
    async listTags(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.tags,
            query,
        });
    }

    /** GET /tags/{id} — Retrieve a tag. */
    async getTag(tagId) {
        return this._get({
            url: this.baseUrl + this.URLs.tagById(tagId),
        });
    }

    // ---- Satisfaction surveys ----------------------------------------------

    /** GET /satisfaction-surveys — List satisfaction surveys. */
    async listSatisfactionSurveys(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.satisfactionSurveys,
            query,
        });
    }

    /** GET /satisfaction-surveys/{id} — Retrieve a satisfaction survey. */
    async getSatisfactionSurvey(surveyId) {
        return this._get({
            url: this.baseUrl + this.URLs.satisfactionSurveyById(surveyId),
        });
    }

    // ---- Integrations (HTTP / webhook subscription management) -------------

    /** GET /integrations — List integrations. */
    async listIntegrations(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.integrations,
            query,
        });
    }

    /** GET /integrations/{id} — Retrieve an integration. */
    async getIntegration(integrationId) {
        return this._get({
            url: this.baseUrl + this.URLs.integrationById(integrationId),
        });
    }

    /**
     * POST /integrations — Create an integration.
     * For HTTP / webhook-style subscriptions use type: "http" with an `http`
     * config (url, method, triggers, headers). See
     * https://developers.gorgias.com/docs/create-integrations-and-widgets-programmatically
     */
    async createIntegration(body) {
        return this._post({
            url: this.baseUrl + this.URLs.integrations,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** PUT /integrations/{id} — Update an integration. */
    async updateIntegration(integrationId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.integrationById(integrationId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** DELETE /integrations/{id} — Delete an integration. */
    async deleteIntegration(integrationId) {
        return this._delete({
            url: this.baseUrl + this.URLs.integrationById(integrationId),
        });
    }

    // ---- Widgets (sidebar UI) ----------------------------------------------

    /** GET /widgets — List widgets. */
    async listWidgets(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.widgets,
            query,
        });
    }

    /** GET /widgets/{id} — Retrieve a widget. */
    async getWidget(widgetId) {
        return this._get({
            url: this.baseUrl + this.URLs.widgetById(widgetId),
        });
    }

    /** POST /widgets — Create a widget (ticket/customer sidebar). */
    async createWidget(body) {
        return this._post({
            url: this.baseUrl + this.URLs.widgets,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** PUT /widgets/{id} — Update a widget. */
    async updateWidget(widgetId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.widgetById(widgetId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /** DELETE /widgets/{id} — Delete a widget. */
    async deleteWidget(widgetId) {
        return this._delete({
            url: this.baseUrl + this.URLs.widgetById(widgetId),
        });
    }
}

module.exports = { Api };
