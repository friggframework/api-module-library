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
        // Persisted account identifiers (see calendly.capabilities.json `account`)
        this.organization = get(params, 'organization', null);
        this.user = get(params, 'user', null);
    }

    /**
     * Extract a Calendly resource UUID from a full URI or pass-through a bare uuid.
     * e.g. https://api.calendly.com/scheduled_events/ABC → ABC
     */
    _uuidFromUri(uriOrUuid) {
        if (!uriOrUuid) return uriOrUuid;
        const s = String(uriOrUuid);
        if (!s.includes('/')) return s;
        const parts = s.replace(/\/$/, '').split('/');
        return parts[parts.length - 1];
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
        const user = response.resource;
        // Mirror account fields onto the instance for apiPropertiesToPersist.
        if (user?.uri) this.user = user.uri;
        if (user?.current_organization) {
            this.organization = user.current_organization;
        }
        return user;
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
     * Accepts a bare UUID or a full scheduled-event URI.
     */
    async getScheduledEvent(uriOrUuid) {
        const uuid = this._uuidFromUri(uriOrUuid);
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
            url: this.baseUrl + this.URLs.eventInvitees(this._uuidFromUri(uuid)),
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
                this.URLs.eventInviteeByUuid(
                    this._uuidFromUri(eventUuid),
                    this._uuidFromUri(inviteeUuid)
                ),
        });
    }

    /**
     * Capability alias for `invitee.get`.
     * Accepts a full invitee URI:
     *   https://api.calendly.com/scheduled_events/{event_uuid}/invitees/{invitee_uuid}
     * and GETs that invitee (required scope: scheduled_events:read).
     */
    async getInvitee(uri) {
        const s = String(uri || '');
        const match = s.match(
            /\/scheduled_events\/([^/]+)\/invitees\/([^/]+)\/?$/
        );
        if (!match) {
            throw new Error(
                'getInvitee: expected a Calendly invitee URI of the form ' +
                    'https://api.calendly.com/scheduled_events/{event_uuid}/invitees/{invitee_uuid}'
            );
        }
        return this.getEventInvitee(match[1], match[2]);
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
            url:
                this.baseUrl +
                this.URLs.webhookSubscriptionByUuid(
                    this._uuidFromUri(webhookUuid)
                ),
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
     * Accepts a bare UUID or a full webhook-subscription URI.
     */
    async deleteWebhookSubscription(uriOrUuid) {
        const uuid = this._uuidFromUri(uriOrUuid);
        return this._delete({
            url: this.baseUrl + this.URLs.webhookSubscriptionByUuid(uuid),
        });
    }

    /**
     * Capability / webhook.verify entry point.
     * Delegates to the Tier 3 signature verifier (Calendly-Webhook-Signature).
     *
     * @param {Object} args
     * @param {import('express').Request|Object} [args.req]
     * @param {string} [args.signingKey] - defaults to CALENDLY_WEBHOOK_SIGNING_KEY
     * @returns {{ valid: boolean, reason?: string }}
     */
    verifyWebhookSignature(args = {}) {
        const {
            verifyCalendlySignature,
        } = require('./extensions/webhooks/signature-verifier');
        return verifyCalendlySignature({
            req: args.req,
            signingKey:
                args.signingKey || process.env.CALENDLY_WEBHOOK_SIGNING_KEY,
            maxSkewSec: args.maxSkewSec,
            now: args.now,
        });
    }
}

module.exports = { Api };
