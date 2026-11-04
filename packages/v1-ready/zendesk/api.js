const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Default scopes for a Support/ticketing integration. Prefer granular resource
 * scopes over broad `read` / `write`. See
 * https://developer.zendesk.com/api-reference/ticketing/oauth/grant_type_tokens/#scope
 */
const DEFAULT_SCOPE =
    'tickets:read tickets:write users:read users:write organizations:read organizations:write webhooks:read webhooks:write';

/**
 * Zendesk Support (Ticketing) API client.
 *
 * Auth: OAuth 2.0 authorization-code. Token endpoint accepts JSON body with
 * client_id + client_secret. Access tokens expire (default TTL 30 minutes for
 * new clients); refresh tokens rotate on each refresh.
 *
 * Every API host matches the vendor OAS server template
 * `https://{subdomain}.{domain}.com` (domain defaults to `zendesk`), with
 * paths under `/api/v2/...`.
 *
 * Docs: https://developer.zendesk.com/api-reference/ticketing/introduction/
 * Auth: https://developer.zendesk.com/api-reference/introduction/security-and-auth/
 * OAuth: https://support.zendesk.com/hc/en-us/articles/4408845965210
 * Official OpenAPI: https://developer.zendesk.com/zendesk/oas.yaml
 * Webhooks: https://developer.zendesk.com/api-reference/webhooks/webhooks-api/webhooks/
 *   (Webhooks paths are NOT in oas.yaml; same host + `/api/v2` prefix.)
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.subdomain = get(params, 'subdomain', null) || null;

        this.scope = this.scope || process.env.ZENDESK_SCOPE || DEFAULT_SCOPE;

        // Path strings match official oas.yaml (prefixed with /api/v2).
        this.URLs = {
            currentUser: '/api/v2/users/me',
            tickets: '/api/v2/tickets',
            ticketById: (id) => `/api/v2/tickets/${id}`,
            ticketComments: (id) => `/api/v2/tickets/${id}/comments`,
            ticketFields: '/api/v2/ticket_fields',
            ticketFieldById: (id) => `/api/v2/ticket_fields/${id}`,
            search: '/api/v2/search',
            users: '/api/v2/users',
            userById: (id) => `/api/v2/users/${id}`,
            organizations: '/api/v2/organizations',
            organizationById: (id) => `/api/v2/organizations/${id}`,
            groups: '/api/v2/groups',
            // Incremental exports (cursor preferred where offered).
            // https://developer.zendesk.com/api-reference/ticketing/ticket-management/incremental_exports/
            incrementalTicketsCursor: '/api/v2/incremental/tickets/cursor',
            incrementalUsersCursor: '/api/v2/incremental/users/cursor',
            incrementalOrganizations: '/api/v2/incremental/organizations',
            webhooks: '/api/v2/webhooks',
            webhookById: (id) => `/api/v2/webhooks/${id}`,
            webhookSigningSecret: (id) =>
                `/api/v2/webhooks/${id}/signing_secret`,
        };

        this._applySubdomain();
        this._installRetryAfterHonoring();
    }

    /**
     * Honor Zendesk `Retry-After` (seconds) on HTTP 429.
     * Core Requester already retries 429 with a fixed `backOff` ladder; this
     * wraps `fetch` to capture the header and substitutes that value (in
     * seconds) for the next `backOff[attempt]` read so the sleep matches the
     * vendor guidance:
     * https://developer.zendesk.com/api-reference/introduction/rate-limits/
     */
    _installRetryAfterHonoring() {
        const baseBackOff = Array.isArray(this.backOff)
            ? [...this.backOff]
            : [1, 3, 10, 30, 60, 180];
        this._retryAfterSec = null;
        this.backOff = new Proxy(baseBackOff, {
            get: (target, prop, receiver) => {
                if (
                    this._retryAfterSec != null &&
                    (typeof prop === 'number' ||
                        (typeof prop === 'string' && /^\d+$/.test(prop)))
                ) {
                    const sec = this._retryAfterSec;
                    this._retryAfterSec = null;
                    return sec;
                }
                return Reflect.get(target, prop, receiver);
            },
        });

        const origFetch = this.fetch.bind(this);
        this.fetch = async (url, init) => {
            const res = await origFetch(url, init);
            if (res && res.status === 429) {
                const header =
                    typeof res.headers?.get === 'function'
                        ? res.headers.get('Retry-After')
                        : null;
                const n = header != null ? Number(header) : NaN;
                if (!Number.isNaN(n) && n >= 0) {
                    this._retryAfterSec = n;
                }
            }
            return res;
        };
    }

    /**
     * Normalize list query params for Zendesk cursor pagination.
     * Accepts convenience aliases (`pageSize`, `after`, `before`) and maps
     * them to `page[size]` / `page[after]` / `page[before]`.
     * @see https://developer.zendesk.com/api-reference/introduction/pagination/
     */
    _normalizeListQuery(query = {}) {
        const q = { ...(query || {}) };
        if (q.pageSize != null && q['page[size]'] == null) {
            q['page[size]'] = q.pageSize;
            delete q.pageSize;
        }
        if (q.page_size != null && q['page[size]'] == null) {
            q['page[size]'] = q.page_size;
            delete q.page_size;
        }
        if (q.after != null && q['page[after]'] == null) {
            q['page[after]'] = q.after;
            delete q.after;
        }
        if (q.before != null && q['page[before]'] == null) {
            q['page[before]'] = q.before;
            delete q.before;
        }
        for (const key of Object.keys(q)) {
            if (q[key] === undefined || q[key] === null) delete q[key];
        }
        return q;
    }

    _normalizeIncrementalQuery(query = {}) {
        const q = { ...(query || {}) };
        for (const key of Object.keys(q)) {
            if (q[key] === undefined || q[key] === null) delete q[key];
        }
        return q;
    }

    _applySubdomain() {
        // Match official oas.yaml servers[0].url when unset so spec-sync can
        // assert equality against `https://{subdomain}.{domain}.com`.
        if (!this.subdomain || this.subdomain === '{subdomain}') {
            this.baseUrl = 'https://{subdomain}.{domain}.com';
            this.tokenUri = 'https://{subdomain}.{domain}.com/oauth/tokens';
        } else {
            this.baseUrl = `https://${this.subdomain}.zendesk.com`;
            this.tokenUri = `https://${this.subdomain}.zendesk.com/oauth/tokens`;
        }
        this.authorizationUri = this._buildAuthorizationUri();
    }

    _buildAuthorizationUri() {
        const host =
            !this.subdomain || this.subdomain === '{subdomain}'
                ? 'https://{subdomain}.{domain}.com'
                : `https://${this.subdomain}.zendesk.com`;
        const params = new URLSearchParams({
            response_type: 'code',
            redirect_uri: this.redirect_uri || '',
            client_id: this.client_id || '',
            scope: this.scope || DEFAULT_SCOPE,
            state: this.state || crypto.randomBytes(16).toString('hex'),
        });
        return `${host}/oauth/authorizations/new?${params.toString()}`;
    }

    /**
     * Set the Zendesk subdomain (e.g. `acme` for `acme.zendesk.com`) and
     * rebuild base/token/authorize URLs.
     */
    setSubdomain(subdomain) {
        this.subdomain = subdomain;
        this._applySubdomain();
        return this;
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
     * Zendesk OAuth is per-subdomain, so the form collects the subdomain before
     * redirecting to `/oauth/authorizations/new`.
     */
    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri(),
            type: 'oauth2',
            data: {
                jsonSchema: {
                    title: 'Zendesk Authentication',
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
                            'Your Zendesk subdomain (the part before .zendesk.com).',
                        'ui:placeholder': 'acme',
                    },
                },
            },
        };
    }

    /**
     * Normalize Zendesk token response fields for OAuth2Requester.setTokens.
     * Zendesk returns `refresh_token_expires_in` (not `x_refresh_token_expires_in`).
     */
    _normalizeTokenResponse(response = {}) {
        const normalized = { ...response };
        if (
            normalized.refresh_token_expires_in != null &&
            normalized.x_refresh_token_expires_in == null
        ) {
            normalized.x_refresh_token_expires_in =
                normalized.refresh_token_expires_in;
        }
        // Older local clients may omit expires_in. Avoid NaN accessTokenExpire.
        if (normalized.expires_in == null) {
            normalized.expires_in = 60 * 60 * 24; // 24h fallback for non-expiring tokens
        }
        return normalized;
    }

    /**
     * Exchange authorization code for tokens.
     * Zendesk Create Token for Grant Type expects a JSON body.
     * @see https://developer.zendesk.com/api-reference/ticketing/oauth/grant_type_tokens/
     */
    async getTokenFromCode(code) {
        const body = {
            grant_type: 'authorization_code',
            code,
            client_id: this.client_id,
            client_secret: this.client_secret,
            redirect_uri: this.redirect_uri,
            scope: this.scope || DEFAULT_SCOPE,
        };
        const options = {
            url: this.tokenUri,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body,
        };
        const response = await this._post(options, false);
        const normalized = this._normalizeTokenResponse(response);
        await this.setTokens(normalized);
        return normalized;
    }

    /**
     * Refresh access token. Zendesk invalidates the previous refresh token;
     * the new refresh_token must be persisted immediately.
     * @see https://developer.zendesk.com/documentation/authentication/refresh-token/
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const body = {
            grant_type: 'refresh_token',
            refresh_token: get(
                refreshTokenObject,
                'refresh_token',
                this.refresh_token
            ),
            client_id: this.client_id,
            client_secret: this.client_secret,
            scope: this.scope || DEFAULT_SCOPE,
        };
        const options = {
            url: this.tokenUri,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body,
        };
        const response = await this._post(options, false);
        const normalized = this._normalizeTokenResponse(response);
        await this.setTokens(normalized);
        return normalized;
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Show the currently authenticated user.
     * GET /api/v2/users/me
     * Official operationId: ShowCurrentUser
     * @see https://developer.zendesk.com/api-reference/ticketing/users/users/#show-the-currently-authenticated-user
     */
    async getCurrentUser(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.currentUser,
            headers: { 'Content-Type': 'application/json' },
            query,
        });
    }

    // ---- Tickets -----------------------------------------------------------

    /**
     * List tickets.
     * GET /api/v2/tickets
     * Official operationId: ListTickets
     * @see https://developer.zendesk.com/api-reference/ticketing/tickets/tickets/#list-tickets
     */
    async listTickets(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.tickets,
            headers: { 'Content-Type': 'application/json' },
            query: this._normalizeListQuery(query),
        });
    }

    /**
     * Show a ticket.
     * GET /api/v2/tickets/{ticket_id}
     * Official operationId: ShowTicket
     */
    async getTicket(ticketId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.ticketById(ticketId),
            headers: { 'Content-Type': 'application/json' },
            query,
        });
    }

    /**
     * Create a ticket. Body shape: `{ ticket: { ... } }`.
     * POST /api/v2/tickets
     * Official operationId: CreateTicket
     */
    async createTicket(body) {
        return this._post({
            url: this.baseUrl + this.URLs.tickets,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update a ticket. Body shape: `{ ticket: { ... } }`.
     * PUT /api/v2/tickets/{ticket_id}
     * Official operationId: UpdateTicket
     */
    async updateTicket(ticketId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.ticketById(ticketId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Add a comment to a ticket (helper wrapping UpdateTicket).
     * PUT /api/v2/tickets/{ticket_id} with `{ ticket: { comment: { body, public } } }`.
     * Official OAS has no dedicated create-comment path; comments are written
     * via UpdateTicket's `ticket.comment` (TicketCommentObject).
     */
    async addTicketComment(ticketId, { body, public: isPublic } = {}) {
        const comment = { body };
        if (isPublic !== undefined) {
            comment.public = isPublic;
        }
        return this.updateTicket(ticketId, { ticket: { comment } });
    }

    /**
     * Delete a ticket.
     * DELETE /api/v2/tickets/{ticket_id}
     * Official operationId: DeleteTicket
     */
    async deleteTicket(ticketId) {
        return this._delete({
            url: this.baseUrl + this.URLs.ticketById(ticketId),
            headers: { 'Content-Type': 'application/json' },
        });
    }

    /**
     * List comments on a ticket.
     * GET /api/v2/tickets/{ticket_id}/comments
     * Official operationId: ListTicketComments
     */
    async listTicketComments(ticketId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.ticketComments(ticketId),
            headers: { 'Content-Type': 'application/json' },
            query: this._normalizeListQuery(query),
        });
    }

    /**
     * List ticket fields (system + custom).
     * GET /api/v2/ticket_fields
     * Official operationId: ListTicketFields
     * @see https://developer.zendesk.com/api-reference/ticketing/tickets/ticket_fields/#list-ticket-fields
     */
    async listTicketFields(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.ticketFields,
            headers: { 'Content-Type': 'application/json' },
            query: this._normalizeListQuery(query),
        });
    }

    /**
     * Show a ticket field.
     * GET /api/v2/ticket_fields/{ticket_field_id}
     * Official operationId: ShowTicketField
     */
    async getTicketField(ticketFieldId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.ticketFieldById(ticketFieldId),
            headers: { 'Content-Type': 'application/json' },
            query: this._normalizeListQuery(query),
        });
    }

    /**
     * Incremental ticket export (cursor-based).
     * GET /api/v2/incremental/tickets/cursor
     * Initial call requires `start_time` (unix epoch); subsequent pages use
     * `cursor` from `after_cursor`.
     * @see https://developer.zendesk.com/api-reference/ticketing/ticket-management/incremental_exports/#incremental-ticket-export-cursor-based
     */
    async listIncrementalTickets(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.incrementalTicketsCursor,
            headers: { 'Content-Type': 'application/json' },
            query: this._normalizeIncrementalQuery(query),
        });
    }

    /**
     * Incremental user export (cursor-based).
     * GET /api/v2/incremental/users/cursor
     * @see https://developer.zendesk.com/api-reference/ticketing/ticket-management/incremental_exports/#incremental-user-export-cursor-based
     */
    async listIncrementalUsers(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.incrementalUsersCursor,
            headers: { 'Content-Type': 'application/json' },
            query: this._normalizeIncrementalQuery(query),
        });
    }

    /**
     * Incremental organization export (time-based; no cursor variant).
     * GET /api/v2/incremental/organizations
     * Requires `start_time` (unix epoch).
     * @see https://developer.zendesk.com/api-reference/ticketing/ticket-management/incremental_exports/#incremental-organization-export
     */
    async listIncrementalOrganizations(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.incrementalOrganizations,
            headers: { 'Content-Type': 'application/json' },
            query: this._normalizeIncrementalQuery(query),
        });
    }

    /**
     * Search tickets via the global Search API.
     * GET /api/v2/search
     * Official operationId: ListSearchResults
     *
     * Ensures `type:ticket` is present in the query string (appends it when
     * the caller omits it) so results are restricted to tickets.
     * @see https://developer.zendesk.com/api-reference/ticketing/ticket-management/search/
     */
    async searchTickets(query = {}) {
        const q =
            typeof query === 'string' ? { query } : { ...(query || {}) };
        const raw = q.query != null ? String(q.query) : '';
        if (!/\btype\s*:\s*ticket\b/i.test(raw)) {
            q.query = raw.trim() ? `${raw.trim()} type:ticket` : 'type:ticket';
        }
        return this._get({
            url: this.baseUrl + this.URLs.search,
            headers: { 'Content-Type': 'application/json' },
            query: q,
        });
    }

    /**
     * List groups.
     * GET /api/v2/groups
     * Official operationId: ListGroups
     */
    async listGroups(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.groups,
            headers: { 'Content-Type': 'application/json' },
            query: this._normalizeListQuery(query),
        });
    }

    /**
     * Verify an inbound Zendesk webhook signature.
     * Delegates to extensions/webhooks/signature-verifier.js (lefthook-bots
     * draft name: verifyWebhookSignature).
     *
     * @param {{ req: object, signingSecret: string }} args
     * @returns {{ valid: boolean, reason?: string }}
     */
    static verifyWebhookSignature(args) {
        const {
            verifyZendeskSignature,
        } = require('./extensions/webhooks/signature-verifier');
        return verifyZendeskSignature(args);
    }

    // ---- Users -------------------------------------------------------------

    /**
     * List users.
     * GET /api/v2/users
     * Official operationId: ListUsers
     */
    async listUsers(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.users,
            headers: { 'Content-Type': 'application/json' },
            query: this._normalizeListQuery(query),
        });
    }

    /**
     * Show a user.
     * GET /api/v2/users/{user_id}
     * Official operationId: ShowUser
     */
    async getUser(userId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.userById(userId),
            headers: { 'Content-Type': 'application/json' },
            query,
        });
    }

    /**
     * Create a user. Body shape: `{ user: { ... } }`.
     * POST /api/v2/users
     * Official operationId: CreateUser
     */
    async createUser(body) {
        return this._post({
            url: this.baseUrl + this.URLs.users,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update a user. Body shape: `{ user: { ... } }`.
     * PUT /api/v2/users/{user_id}
     * Official operationId: UpdateUser
     */
    async updateUser(userId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.userById(userId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Delete a user.
     * DELETE /api/v2/users/{user_id}
     * Official operationId: DeleteUser
     */
    async deleteUser(userId) {
        return this._delete({
            url: this.baseUrl + this.URLs.userById(userId),
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // ---- Organizations -----------------------------------------------------

    /**
     * List organizations.
     * GET /api/v2/organizations
     * Official operationId: ListOrganizations
     */
    async listOrganizations(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.organizations,
            headers: { 'Content-Type': 'application/json' },
            query: this._normalizeListQuery(query),
        });
    }

    /**
     * Show an organization.
     * GET /api/v2/organizations/{organization_id}
     * Official operationId: ShowOrganization
     */
    async getOrganization(organizationId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.organizationById(organizationId),
            headers: { 'Content-Type': 'application/json' },
            query,
        });
    }

    /**
     * Create an organization. Body shape: `{ organization: { ... } }`.
     * POST /api/v2/organizations
     * Official operationId: CreateOrganization
     */
    async createOrganization(body) {
        return this._post({
            url: this.baseUrl + this.URLs.organizations,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update an organization. Body shape: `{ organization: { ... } }`.
     * PUT /api/v2/organizations/{organization_id}
     * Official operationId: UpdateOrganization
     */
    async updateOrganization(organizationId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.organizationById(organizationId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Delete an organization.
     * DELETE /api/v2/organizations/{organization_id}
     * Official operationId: DeleteOrganization
     */
    async deleteOrganization(organizationId) {
        return this._delete({
            url: this.baseUrl + this.URLs.organizationById(organizationId),
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * List webhooks.
     * GET /api/v2/webhooks
     * @see https://developer.zendesk.com/api-reference/webhooks/webhooks-api/webhooks/#list-webhooks
     */
    async listWebhooks(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.webhooks,
            headers: { 'Content-Type': 'application/json' },
            query: this._normalizeListQuery(query),
        });
    }

    /**
     * Show a webhook.
     * GET /api/v2/webhooks/{webhook_id}
     */
    async getWebhook(webhookId) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
            headers: { 'Content-Type': 'application/json' },
        });
    }

    /**
     * Create or clone a webhook. Body shape: `{ webhook: { ... } }`.
     * POST /api/v2/webhooks
     */
    async createWebhook(body, query = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks,
            headers: { 'Content-Type': 'application/json' },
            body,
            query,
        });
    }

    /**
     * Update a webhook (full replace). Body shape: `{ webhook: { ... } }`.
     * PUT /api/v2/webhooks/{webhook_id}
     */
    async updateWebhook(webhookId, body) {
        return this._put({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Delete a webhook.
     * DELETE /api/v2/webhooks/{webhook_id}
     */
    async deleteWebhook(webhookId) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
            headers: { 'Content-Type': 'application/json' },
        });
    }

    /**
     * Show a webhook's signing secret (for inbound HMAC verification).
     * GET /api/v2/webhooks/{webhook_id}/signing_secret
     * @see https://developer.zendesk.com/documentation/webhooks/verifying/
     */
    async getWebhookSigningSecret(webhookId) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookSigningSecret(webhookId),
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

module.exports = { Api, DEFAULT_SCOPE };
