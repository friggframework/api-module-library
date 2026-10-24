const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Default scopes for a helpdesk integration. Prefer granular scopes over the
 * deprecated `write:all`. See https://developers.gorgias.com/docs/oauth2-scopes
 */
const DEFAULT_SCOPE =
    'openid email profile offline account:read tickets:read tickets:write customers:read customers:write integrations:read integrations:write';

/**
 * Gorgias REST API client.
 *
 * Auth: OAuth 2.0 authorization-code. Token endpoint uses HTTP Basic
 * (`client_id:client_secret`). Access tokens expire after 24 hours; request
 * the `offline` scope to receive a non-expiring `refresh_token`.
 *
 * Every API host is per-account: `https://{domain}.gorgias.com`.
 *
 * Docs: https://developers.gorgias.com/reference/introduction
 * OAuth: https://developers.gorgias.com/docs/oauth2-authentication-for-creating-apps-with-gorgias
 * Scopes: https://developers.gorgias.com/docs/oauth2-scopes
 *
 * HTTP integrations (`type: http`) are Gorgias's webhook-style outbound calls
 * on ticket events — there is no separate `/webhooks` resource.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.subdomain =
            get(params, 'subdomain', null) ||
            get(params, 'domain', null) ||
            null;

        this.scope =
            this.scope || process.env.GORGIAS_SCOPE || DEFAULT_SCOPE;

        this.URLs = {
            account: '/api/account',
            tickets: '/api/tickets',
            ticketById: (id) => `/api/tickets/${id}`,
            customers: '/api/customers',
            customerById: (id) => `/api/customers/${id}`,
            integrations: '/api/integrations',
            integrationById: (id) => `/api/integrations/${id}`,
            widgets: '/api/widgets',
            widgetById: (id) => `/api/widgets/${id}`,
        };

        this._applySubdomain();
    }

    _applySubdomain() {
        // Match the official OpenAPI server URL when no domain is set yet so
        // spec-sync can assert equality against `https://{domain}.gorgias.com`.
        const domain = this.subdomain || '{domain}';
        this.baseUrl = `https://${domain}.gorgias.com`;
        this.tokenUri = `${this.baseUrl}/oauth/token`;
        this._syncRedirectUri();
        this.authorizationUri = this._buildAuthorizationUri();
    }

    _syncRedirectUri() {
        const base =
            this.redirect_uri ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/gorgias`
                : null);
        if (!base) {
            this.redirect_uri = null;
            return;
        }
        // Gorgias docs append `?account=<subdomain>` on the redirect_uri so the
        // callback knows which helpdesk authorized the app.
        if (this.subdomain && this.subdomain !== '{domain}') {
            const url = new URL(base);
            url.searchParams.set('account', this.subdomain);
            this.redirect_uri = url.toString();
        } else {
            this.redirect_uri = base;
        }
    }

    _buildAuthorizationUri() {
        const domain = this.subdomain || '{domain}';
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            scope: this.scope || DEFAULT_SCOPE,
            state: this.state || crypto.randomBytes(16).toString('hex'),
            nonce: crypto.randomBytes(12).toString('hex'),
        });
        return `https://${domain}.gorgias.com/oauth/authorize?${params.toString()}`;
    }

    /**
     * Set the helpdesk subdomain (e.g. `acme` for `acme.gorgias.com`) and
     * rebuild base/token/authorize URLs.
     */
    setSubdomain(subdomain) {
        this.subdomain = subdomain;
        this._applySubdomain();
        return this;
    }

    /** Alias used by some callers / credential restore paths. */
    setDomain(domain) {
        return this.setSubdomain(domain);
    }

    getAuthorizationUri() {
        this.authorizationUri = this._buildAuthorizationUri();
        return this.authorizationUri;
    }

    getAuthUri() {
        return this.getAuthorizationUri();
    }

    /**
     * Authorization requirements for the Frigg auth UI / `frigg auth` CLI.
     * Gorgias OAuth is per-subdomain, so the form collects the helpdesk domain
     * before redirecting to `/oauth/authorize`.
     */
    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri(),
            type: 'oauth2',
            data: {
                jsonSchema: {
                    title: 'Gorgias Authentication',
                    type: 'object',
                    required: ['subdomain'],
                    properties: {
                        subdomain: {
                            type: 'string',
                            title: 'Subdomain',
                        },
                    },
                },
                uiSchema: {
                    subdomain: {
                        'ui:help':
                            'Your Gorgias helpdesk subdomain (the part before .gorgias.com).',
                        'ui:placeholder': 'acme',
                    },
                },
            },
        };
    }

    /**
     * Gorgias's token endpoint requires HTTP Basic auth with client_id:client_secret.
     * @see https://developers.gorgias.com/docs/set-up-oauth2-app-store
     */
    async getTokenFromCode(code) {
        return this.getTokenFromCodeBasicAuthHeader(code);
    }

    /**
     * Refresh also uses Basic auth. Access tokens last 24h; refresh_token does
     * not currently expire (per Gorgias docs).
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append(
            'refresh_token',
            get(refreshTokenObject, 'refresh_token', this.refresh_token)
        );

        const options = {
            body: params,
            url: this.tokenUri,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
                Authorization: `Basic ${Buffer.from(
                    `${this.client_id}:${this.client_secret}`
                ).toString('base64')}`,
            },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    // ---- Account -----------------------------------------------------------

    /**
     * Retrieve your account.
     * GET /api/account
     * @see https://developers.gorgias.com/reference/get-account
     */
    async getAccount() {
        return this._get({
            url: this.baseUrl + this.URLs.account,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // ---- Tickets -----------------------------------------------------------

    /**
     * List tickets (paginated).
     * GET /api/tickets
     * @see https://developers.gorgias.com/reference/list-tickets
     */
    async listTickets(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.tickets,
            headers: { 'Content-Type': 'application/json' },
            query,
        });
    }

    /**
     * Retrieve a ticket.
     * GET /api/tickets/{id}
     * @see https://developers.gorgias.com/reference/get-ticket
     */
    async getTicket(id) {
        return this._get({
            url: this.baseUrl + this.URLs.ticketById(id),
            headers: { 'Content-Type': 'application/json' },
        });
    }

    /**
     * Create a ticket. Body must include `messages`.
     * POST /api/tickets
     * @see https://developers.gorgias.com/reference/create-ticket
     */
    async createTicket(body) {
        return this._post({
            url: this.baseUrl + this.URLs.tickets,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update a ticket.
     * PUT /api/tickets/{id}
     * @see https://developers.gorgias.com/reference/update-ticket
     */
    async updateTicket(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.ticketById(id),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Delete a ticket.
     * DELETE /api/tickets/{id}
     * @see https://developers.gorgias.com/reference/delete-ticket
     */
    async deleteTicket(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.ticketById(id),
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // ---- Customers ---------------------------------------------------------

    /**
     * List customers (paginated).
     * GET /api/customers
     * @see https://developers.gorgias.com/reference/list-customers
     */
    async listCustomers(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.customers,
            headers: { 'Content-Type': 'application/json' },
            query,
        });
    }

    /**
     * Retrieve a customer.
     * GET /api/customers/{id}
     * @see https://developers.gorgias.com/reference/get-customer
     */
    async getCustomer(id) {
        return this._get({
            url: this.baseUrl + this.URLs.customerById(id),
            headers: { 'Content-Type': 'application/json' },
        });
    }

    /**
     * Create a customer.
     * POST /api/customers
     * @see https://developers.gorgias.com/reference/create-customer
     */
    async createCustomer(body) {
        return this._post({
            url: this.baseUrl + this.URLs.customers,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update a customer.
     * PUT /api/customers/{id}
     * @see https://developers.gorgias.com/reference/update-customer
     */
    async updateCustomer(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.customerById(id),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Delete a customer.
     * DELETE /api/customers/{id}
     * @see https://developers.gorgias.com/reference/delete-customer
     */
    async deleteCustomer(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.customerById(id),
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // ---- Integrations (HTTP / webhook-style) -------------------------------

    /**
     * List integrations (paginated). Filter `type=http` for outbound webhooks.
     * GET /api/integrations
     * @see https://developers.gorgias.com/reference/list-integrations
     */
    async listIntegrations(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.integrations,
            headers: { 'Content-Type': 'application/json' },
            query,
        });
    }

    /**
     * Retrieve an integration.
     * GET /api/integrations/{id}
     * @see https://developers.gorgias.com/reference/get-integration
     */
    async getIntegration(id) {
        return this._get({
            url: this.baseUrl + this.URLs.integrationById(id),
            headers: { 'Content-Type': 'application/json' },
        });
    }

    /**
     * Create an integration (e.g. HTTP integration that fires on ticket events).
     * POST /api/integrations
     * @see https://developers.gorgias.com/reference/create-integration
     * @see https://developers.gorgias.com/docs/create-integrations-and-widgets-programmatically
     */
    async createIntegration(body) {
        return this._post({
            url: this.baseUrl + this.URLs.integrations,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update an integration.
     * PUT /api/integrations/{id}
     * @see https://developers.gorgias.com/reference/update-integration
     */
    async updateIntegration(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.integrationById(id),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Delete an integration.
     * DELETE /api/integrations/{id}
     * @see https://developers.gorgias.com/reference/delete-integration
     */
    async deleteIntegration(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.integrationById(id),
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // ---- Widgets (sidebar UI) ----------------------------------------------

    /**
     * List widgets.
     * GET /api/widgets
     * @see https://developers.gorgias.com/reference/list-widgets
     */
    async listWidgets(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.widgets,
            headers: { 'Content-Type': 'application/json' },
            query,
        });
    }

    /**
     * Retrieve a widget.
     * GET /api/widgets/{id}
     * @see https://developers.gorgias.com/reference/get-widget
     */
    async getWidget(id) {
        return this._get({
            url: this.baseUrl + this.URLs.widgetById(id),
            headers: { 'Content-Type': 'application/json' },
        });
    }

    /**
     * Create a widget (JSON template rendered in the ticket/customer sidebar).
     * POST /api/widgets
     * @see https://developers.gorgias.com/reference/create-widget
     */
    async createWidget(body) {
        return this._post({
            url: this.baseUrl + this.URLs.widgets,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update a widget.
     * PUT /api/widgets/{id}
     * @see https://developers.gorgias.com/reference/update-widget
     */
    async updateWidget(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.widgetById(id),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Delete a widget.
     * DELETE /api/widgets/{id}
     * @see https://developers.gorgias.com/reference/delete-widget
     */
    async deleteWidget(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.widgetById(id),
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

module.exports = { Api, DEFAULT_SCOPE };
