const { OAuth2Requester, get } = require('@friggframework/core');

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
const DEFAULT_TENANT = 'common';
const DEFAULT_SCOPE = [
    'openid',
    'offline_access',
    'User.Read',
    'Mail.ReadWrite',
    'Mail.Send',
    'Calendars.ReadWrite',
].join(' ');

/**
 * Microsoft Outlook API client (Microsoft Graph v1.0 mail + calendar).
 *
 * Auth: OAuth 2.0 authorization-code (delegated) against the Microsoft identity
 * platform. Optional client-credentials (application) via
 * `getTokenFromClientCredentials` for daemon scenarios.
 *
 * Base URL: https://graph.microsoft.com/v1.0
 *
 * Docs:
 *   https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview
 *   https://learn.microsoft.com/en-us/graph/api/resources/calendar-api-overview
 *   https://learn.microsoft.com/en-us/graph/auth-v2-user
 * Change notifications:
 *   https://learn.microsoft.com/en-us/graph/change-notifications-overview
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.tenant_id =
            get(params, 'tenant_id', null) ||
            process.env.OUTLOOK_TENANT_ID ||
            DEFAULT_TENANT;

        this.scope =
            this.scope || process.env.OUTLOOK_SCOPE || DEFAULT_SCOPE;

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'base_url', null) ||
            GRAPH_BASE_URL;

        this.webhookClientState =
            get(params, 'webhookClientState', null) ||
            process.env.OUTLOOK_WEBHOOK_CLIENT_STATE ||
            null;

        this.forceConsent = get(params, 'forceConsent', true);

        this._setAuthUrls();

        this.URLs = {
            me: '/me',
            organization: '/organization',
            messages: '/me/messages',
            message: (id) => `/me/messages/${id}`,
            sendMail: '/me/sendMail',
            mailFolders: '/me/mailFolders',
            mailFolder: (id) => `/me/mailFolders/${id}`,
            calendars: '/me/calendars',
            calendar: (id) => `/me/calendars/${id}`,
            events: '/me/events',
            event: (id) => `/me/events/${id}`,
            calendarView: '/me/calendarView',
            subscriptions: '/subscriptions',
            subscription: (id) => `/subscriptions/${id}`,
        };
    }

    _setAuthUrls() {
        const tenant = this.tenant_id || DEFAULT_TENANT;
        this.authorizationUri = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`;
        this.tokenUri = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
    }

    setTenantId(tenantId) {
        this.tenant_id = tenantId || DEFAULT_TENANT;
        this._setAuthUrls();
    }

    /**
     * Build the Microsoft identity platform authorize URL.
     * @see https://learn.microsoft.com/en-us/graph/auth-v2-user
     */
    getAuthorizationUri() {
        this._setAuthUrls();
        const params = new URLSearchParams({
            client_id: this.client_id || '',
            response_type: 'code',
            redirect_uri: this.redirect_uri || '',
            scope: this.scope || DEFAULT_SCOPE,
            response_mode: 'query',
            state: this.state || '',
        });
        if (this.forceConsent) {
            params.set('prompt', 'consent');
        }
        return `${this.authorizationUri}?${params.toString()}`;
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri(),
            type: 'oauth2',
        };
    }

    /**
     * Exchange an authorization code for tokens.
     * @see https://learn.microsoft.com/en-us/graph/auth-v2-user#step-3-redeem-a-code-for-an-access-token
     */
    async getTokenFromCode(code) {
        return super.getTokenFromCode(code);
    }

    /**
     * Application (client credentials) token for daemon/app-only Graph calls.
     * Scope must be `https://graph.microsoft.com/.default`.
     * @see https://learn.microsoft.com/en-us/graph/auth-v2-service
     */
    async getTokenFromClientCredentials() {
        this._setAuthUrls();
        const body = new URLSearchParams();
        body.append('client_id', this.client_id);
        body.append('client_secret', this.client_secret);
        body.append('scope', 'https://graph.microsoft.com/.default');
        body.append('grant_type', 'client_credentials');

        const tokenRes = await this._post(
            {
                url: this.tokenUri,
                body,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            },
            false
        );
        await this.setTokens(tokenRes);
        return tokenRes;
    }

    addJsonHeaders(options = {}) {
        options.headers = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...options.headers,
        };
        return options;
    }

    async _get(options) {
        options.headers = {
            Accept: 'application/json',
            ...options.headers,
        };
        return super._get(options);
    }

    async _post(options, stringify) {
        if (
            options.headers &&
            options.headers['Content-Type'] ===
                'application/x-www-form-urlencoded'
        ) {
            return super._post(options, stringify);
        }
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    async _patch(options) {
        this.addJsonHeaders(options);
        return super._patch(options);
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * GET /me
     * @see https://learn.microsoft.com/en-us/graph/api/user-get
     */
    async getMe() {
        return this._get({ url: this.baseUrl + this.URLs.me });
    }

    /**
     * GET /organization — returns the first organization in `value`.
     * @see https://learn.microsoft.com/en-us/graph/api/organization-get
     */
    async getOrganization() {
        const response = await this._get({
            url: this.baseUrl + this.URLs.organization,
        });
        if (Array.isArray(response?.value) && response.value.length > 0) {
            return response.value[0];
        }
        return response;
    }

    // ---- Messages ----------------------------------------------------------

    /**
     * GET /me/messages
     * @see https://learn.microsoft.com/en-us/graph/api/user-list-messages
     */
    async listMessages(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.messages,
            query,
        });
    }

    /**
     * GET /me/messages/{id}
     * @see https://learn.microsoft.com/en-us/graph/api/message-get
     */
    async getMessage(messageId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.message(messageId),
            query,
        });
    }

    /**
     * POST /me/messages — create a draft message.
     * @see https://learn.microsoft.com/en-us/graph/api/user-post-messages
     */
    async createMessage(body) {
        return this._post({
            url: this.baseUrl + this.URLs.messages,
            body,
        });
    }

    /**
     * PATCH /me/messages/{id}
     * @see https://learn.microsoft.com/en-us/graph/api/message-update
     */
    async updateMessage(messageId, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.message(messageId),
            body,
        });
    }

    /**
     * DELETE /me/messages/{id}
     * @see https://learn.microsoft.com/en-us/graph/api/message-delete
     */
    async deleteMessage(messageId) {
        return this._delete({
            url: this.baseUrl + this.URLs.message(messageId),
        });
    }

    /**
     * POST /me/sendMail — send a new message (optionally save to Sent Items).
     * @see https://learn.microsoft.com/en-us/graph/api/user-sendmail
     */
    async sendMail(body) {
        return this._post({
            url: this.baseUrl + this.URLs.sendMail,
            body,
        });
    }

    // ---- Mail folders ------------------------------------------------------

    /**
     * GET /me/mailFolders
     * @see https://learn.microsoft.com/en-us/graph/api/user-list-mailfolders
     */
    async listMailFolders(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.mailFolders,
            query,
        });
    }

    /**
     * GET /me/mailFolders/{id}
     * @see https://learn.microsoft.com/en-us/graph/api/mailfolder-get
     */
    async getMailFolder(folderId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.mailFolder(folderId),
            query,
        });
    }

    // ---- Calendars ---------------------------------------------------------

    /**
     * GET /me/calendars
     * @see https://learn.microsoft.com/en-us/graph/api/user-list-calendars
     */
    async listCalendars(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.calendars,
            query,
        });
    }

    /**
     * GET /me/calendars/{id}
     * @see https://learn.microsoft.com/en-us/graph/api/calendar-get
     */
    async getCalendar(calendarId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.calendar(calendarId),
            query,
        });
    }

    // ---- Events ------------------------------------------------------------

    /**
     * GET /me/events
     * @see https://learn.microsoft.com/en-us/graph/api/user-list-events
     */
    async listEvents(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.events,
            query,
        });
    }

    /**
     * GET /me/events/{id}
     * @see https://learn.microsoft.com/en-us/graph/api/event-get
     */
    async getEvent(eventId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.event(eventId),
            query,
        });
    }

    /**
     * POST /me/events
     * @see https://learn.microsoft.com/en-us/graph/api/user-post-events
     */
    async createEvent(body) {
        return this._post({
            url: this.baseUrl + this.URLs.events,
            body,
        });
    }

    /**
     * PATCH /me/events/{id}
     * @see https://learn.microsoft.com/en-us/graph/api/event-update
     */
    async updateEvent(eventId, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.event(eventId),
            body,
        });
    }

    /**
     * DELETE /me/events/{id}
     * @see https://learn.microsoft.com/en-us/graph/api/event-delete
     */
    async deleteEvent(eventId) {
        return this._delete({
            url: this.baseUrl + this.URLs.event(eventId),
        });
    }

    /**
     * GET /me/calendarView — expanded occurrences in a time range.
     * Requires `startDateTime` and `endDateTime` query params.
     * @see https://learn.microsoft.com/en-us/graph/api/user-list-calendarview
     */
    async listCalendarView(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.calendarView,
            query,
        });
    }

    // ---- Change notification subscriptions (webhooks) ----------------------

    /**
     * POST /subscriptions
     * @see https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions
     */
    async createSubscription(body) {
        return this._post({
            url: this.baseUrl + this.URLs.subscriptions,
            body,
        });
    }

    /**
     * GET /subscriptions
     * @see https://learn.microsoft.com/en-us/graph/api/subscription-list
     */
    async listSubscriptions(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.subscriptions,
            query,
        });
    }

    /**
     * GET /subscriptions/{id}
     * @see https://learn.microsoft.com/en-us/graph/api/subscription-get
     */
    async getSubscription(subscriptionId) {
        return this._get({
            url: this.baseUrl + this.URLs.subscription(subscriptionId),
        });
    }

    /**
     * PATCH /subscriptions/{id} — typically to renew expirationDateTime.
     * @see https://learn.microsoft.com/en-us/graph/api/subscription-update
     */
    async renewSubscription(subscriptionId, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.subscription(subscriptionId),
            body,
        });
    }

    /**
     * DELETE /subscriptions/{id}
     * @see https://learn.microsoft.com/en-us/graph/api/subscription-delete
     */
    async deleteSubscription(subscriptionId) {
        return this._delete({
            url: this.baseUrl + this.URLs.subscription(subscriptionId),
        });
    }

    /**
     * Validate a Graph change-notification `clientState` against the expected
     * secret. Graph does not HMAC-sign webhook bodies; `clientState` is the
     * documented authenticity check.
     *
     * @see https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks
     * @param {Object} args
     * @param {string} [args.clientState] - clientState from a notification item
     * @param {string} [args.expected] - expected secret (defaults to api.webhookClientState)
     * @returns {{ valid: boolean, reason?: string }}
     */
    verifyWebhookClientState({ clientState, expected } = {}) {
        const want =
            expected !== undefined && expected !== null
                ? expected
                : this.webhookClientState;
        if (!want || typeof want !== 'string') {
            return { valid: false, reason: 'missing expected clientState' };
        }
        if (clientState === undefined || clientState === null) {
            return { valid: false, reason: 'missing notification clientState' };
        }
        if (String(clientState) !== String(want)) {
            return { valid: false, reason: 'clientState mismatch' };
        }
        return { valid: true };
    }
}

module.exports = { Api, GRAPH_BASE_URL, DEFAULT_SCOPE, DEFAULT_TENANT };
