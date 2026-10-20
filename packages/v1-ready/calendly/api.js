const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Calendly API v2 client.
 *
 * Auth: OAuth 2.0 authorization-code (web clients exchange tokens with
 * HTTP Basic Auth using client_id:client_secret). Personal access tokens
 * are also accepted by the API as Bearer tokens but this module is wired
 * for the OAuth marketplace flow.
 *
 * Base URL: https://api.calendly.com
 * Token URL: https://auth.calendly.com/oauth/token
 * Authorize URL: https://auth.calendly.com/oauth/authorize
 *
 * Docs: https://developer.calendly.com/
 * OpenAPI: https://developer.calendly.com/openapi/calendly-api.yaml
 * OAuth OpenAPI: https://developer.calendly.com/openapi/calendly-oauth.yaml
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://api.calendly.com';

        this.URLs = {
            currentUser: '/users/me',
            eventTypes: '/event_types',
            eventTypeByUuid: (uuid) => `/event_types/${uuid}`,
            scheduledEvents: '/scheduled_events',
            scheduledEventByUuid: (uuid) => `/scheduled_events/${uuid}`,
            eventInvitees: (uuid) => `/scheduled_events/${uuid}/invitees`,
            eventInviteeByUuid: (eventUuid, inviteeUuid) =>
                `/scheduled_events/${eventUuid}/invitees/${inviteeUuid}`,
            webhookSubscriptions: '/webhook_subscriptions',
            webhookSubscriptionByUuid: (uuid) =>
                `/webhook_subscriptions/${uuid}`,
        };

        // Official OAuth OpenAPI servers: https://auth.calendly.com
        // (auth.calendly.com/oauth/authorize redirects to calendly.com).
        this.authorizationUri = encodeURI(
            `https://auth.calendly.com/oauth/authorize?client_id=${this.client_id}` +
                `&response_type=code&redirect_uri=${this.redirect_uri}` +
                `&state=${this.state}` +
                (this.scope ? `&scope=${this.scope}` : '')
        );
        this.tokenUri = 'https://auth.calendly.com/oauth/token';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    /**
     * Calendly web OAuth apps require Basic Auth on the token endpoint
     * (client_id as username, client_secret as password). See
     * https://developer.calendly.com/openapi/calendly-oauth.yaml
     */
    async getTokenFromCode(code) {
        delete this.access_token;
        return this.getTokenFromCodeBasicAuthHeader(code);
    }

    /**
     * Refresh also uses Basic Auth for web clients.
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refreshTokenObject.refresh_token);

        const options = {
            body: params,
            url: this.tokenUri,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(
                    `${this.client_id}:${this.client_secret}`
                ).toString('base64')}`,
            },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
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
        // Token endpoint posts are form-urlencoded; API posts are JSON.
        if (
            options.url === this.tokenUri ||
            (options.headers &&
                options.headers['Content-Type'] ===
                    'application/x-www-form-urlencoded')
        ) {
            return super._post(options, stringify);
        }
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    async _patch(options, stringify) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    // ---- Current user ------------------------------------------------------

    /**
     * GET /users/me
     * Required scope: users:read
     * Response: { resource: User }
     */
    async getCurrentUser() {
        return this._get({
            url: this.baseUrl + this.URLs.currentUser,
        });
    }

    /** Alias used by Definition auth methods. */
    async getUserDetails() {
        const response = await this.getCurrentUser();
        return response.resource;
    }

    async getTokenIdentity() {
        const user = await this.getUserDetails();
        return {
            identifier: user.uri,
            name: user.name,
            email: user.email,
            organization: user.current_organization,
        };
    }

    // ---- Event types -------------------------------------------------------

    /**
     * GET /event_types
     * Required scope: event_types:read
     * Either `organization` or `user` query param is required.
     */
    async listEventTypes(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.eventTypes,
            query,
        });
    }

    /**
     * GET /event_types/{uuid}
     * Required scope: event_types:read
     */
    async getEventType(uuid) {
        return this._get({
            url: this.baseUrl + this.URLs.eventTypeByUuid(uuid),
        });
    }

    // ---- Scheduled events --------------------------------------------------

    /**
     * GET /scheduled_events
     * Required scope: scheduled_events:read
     * Pass `user`, `organization`, and/or `group` per Calendly docs.
     */
    async listScheduledEvents(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.scheduledEvents,
            query,
        });
    }

    /**
     * GET /scheduled_events/{uuid}
     * Required scope: scheduled_events:read
     */
    async getScheduledEvent(uuid) {
        return this._get({
            url: this.baseUrl + this.URLs.scheduledEventByUuid(uuid),
        });
    }

    // ---- Invitees ----------------------------------------------------------

    /**
     * GET /scheduled_events/{uuid}/invitees
     * Required scope: scheduled_events:read
     */
    async listEventInvitees(uuid, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.eventInvitees(uuid),
            query,
        });
    }

    /**
     * GET /scheduled_events/{event_uuid}/invitees/{invitee_uuid}
     * Required scope: scheduled_events:read
     */
    async getEventInvitee(eventUuid, inviteeUuid) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.eventInviteeByUuid(eventUuid, inviteeUuid),
        });
    }

    // ---- Webhook subscriptions ---------------------------------------------

    /**
     * GET /webhook_subscriptions
     * Required scope: webhooks:read
     * Required query: organization, scope
     */
    async listWebhookSubscriptions(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookSubscriptions,
            query,
        });
    }

    /**
     * GET /webhook_subscriptions/{webhook_uuid}
     * Required scope: webhooks:read
     */
    async getWebhookSubscription(webhookUuid) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookSubscriptionByUuid(webhookUuid),
        });
    }

    /**
     * POST /webhook_subscriptions
     * Required scope: webhooks:write
     *
     * body: {
     *   url, events[], organization, scope,
     *   user?, group?, signing_key?
     * }
     * events: invitee.created | invitee.canceled | invitee_no_show.created |
     *   invitee_no_show.deleted | meeting_recap.* | routing_form_submission.created |
     *   contact.* (see OpenAPI)
     * scope: organization | user | group
     */
    async createWebhookSubscription(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookSubscriptions,
            body,
        });
    }

    /**
     * DELETE /webhook_subscriptions/{webhook_uuid}
     * Required scope: webhooks:write
     */
    async deleteWebhookSubscription(webhookUuid) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookSubscriptionByUuid(webhookUuid),
        });
    }
}

module.exports = { Api };
