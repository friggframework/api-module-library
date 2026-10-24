const { OAuth2Requester, get } = require('@friggframework/core');

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
const DEFAULT_TENANT = 'common';
const DEFAULT_SCOPE = [
    'openid',
    'offline_access',
    'User.Read',
    'Organization.Read.All',
    'Team.ReadBasic.All',
    'Channel.ReadBasic.All',
    'Channel.Create',
    'ChannelSettings.ReadWrite.All',
    'ChannelMessage.Read.All',
    'ChannelMessage.Send',
    'Chat.Read',
    'Chat.ReadWrite',
].join(' ');

/**
 * Microsoft Teams API client (Microsoft Graph v1.0).
 *
 * Auth: OAuth 2.0 authorization-code (delegated) against the Microsoft identity
 * platform. Optional client-credentials (application) via
 * `getTokenFromClientCredentials` for daemon scenarios.
 *
 * Base URL: https://graph.microsoft.com/v1.0
 *
 * Docs:
 *   https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview
 *   https://learn.microsoft.com/en-us/graph/auth-v2-user
 * Change notifications:
 *   https://learn.microsoft.com/en-us/graph/change-notifications-overview
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.tenant_id =
            get(params, 'tenant_id', null) ||
            process.env.TEAMS_TENANT_ID ||
            DEFAULT_TENANT;

        this.scope =
            this.scope ||
            process.env.TEAMS_SCOPE ||
            DEFAULT_SCOPE;

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'base_url', null) ||
            GRAPH_BASE_URL;

        this.webhookClientState =
            get(params, 'webhookClientState', null) ||
            process.env.TEAMS_WEBHOOK_CLIENT_STATE ||
            null;

        this.forceConsent = get(params, 'forceConsent', true);

        this._setAuthUrls();

        this.URLs = {
            me: '/me',
            organization: '/organization',
            joinedTeams: '/me/joinedTeams',
            team: (teamId) => `/teams/${teamId}`,
            channels: (teamId) => `/teams/${teamId}/channels`,
            channel: (teamId, channelId) =>
                `/teams/${teamId}/channels/${channelId}`,
            channelMessages: (teamId, channelId) =>
                `/teams/${teamId}/channels/${channelId}/messages`,
            channelMessage: (teamId, channelId, messageId) =>
                `/teams/${teamId}/channels/${channelId}/messages/${messageId}`,
            chats: '/chats',
            chat: (chatId) => `/chats/${chatId}`,
            chatMessages: (chatId) => `/chats/${chatId}/messages`,
            teamMembers: (teamId) => `/teams/${teamId}/members`,
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
     * Exchange an authorization code for tokens (form body with client secret).
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

    // ---- Teams -------------------------------------------------------------

    /**
     * GET /me/joinedTeams
     * @see https://learn.microsoft.com/en-us/graph/api/user-list-joinedteams
     */
    async listJoinedTeams(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.joinedTeams,
            query,
        });
    }

    /**
     * GET /teams/{team-id}
     * @see https://learn.microsoft.com/en-us/graph/api/team-get
     */
    async getTeam(teamId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.team(teamId),
            query,
        });
    }

    // ---- Channels ----------------------------------------------------------

    /**
     * GET /teams/{team-id}/channels
     * @see https://learn.microsoft.com/en-us/graph/api/channel-list
     */
    async listChannels(teamId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.channels(teamId),
            query,
        });
    }

    /**
     * GET /teams/{team-id}/channels/{channel-id}
     * @see https://learn.microsoft.com/en-us/graph/api/channel-get
     */
    async getChannel(teamId, channelId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.channel(teamId, channelId),
            query,
        });
    }

    /**
     * POST /teams/{team-id}/channels
     * @see https://learn.microsoft.com/en-us/graph/api/channel-post
     */
    async createChannel(teamId, body) {
        return this._post({
            url: this.baseUrl + this.URLs.channels(teamId),
            body,
        });
    }

    /**
     * PATCH /teams/{team-id}/channels/{channel-id}
     * @see https://learn.microsoft.com/en-us/graph/api/channel-patch
     */
    async updateChannel(teamId, channelId, body) {
        return this._patch({
            url: this.baseUrl + this.URLs.channel(teamId, channelId),
            body,
        });
    }

    // ---- Channel messages --------------------------------------------------

    /**
     * GET /teams/{team-id}/channels/{channel-id}/messages
     * @see https://learn.microsoft.com/en-us/graph/api/channel-list-messages
     */
    async listChannelMessages(teamId, channelId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.channelMessages(teamId, channelId),
            query,
        });
    }

    /**
     * GET /teams/{team-id}/channels/{channel-id}/messages/{message-id}
     * @see https://learn.microsoft.com/en-us/graph/api/chatmessage-get
     */
    async getChannelMessage(teamId, channelId, messageId, query = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.channelMessage(teamId, channelId, messageId),
            query,
        });
    }

    /**
     * POST /teams/{team-id}/channels/{channel-id}/messages
     * @see https://learn.microsoft.com/en-us/graph/api/chatmessage-post
     */
    async sendChannelMessage(teamId, channelId, body) {
        return this._post({
            url: this.baseUrl + this.URLs.channelMessages(teamId, channelId),
            body,
        });
    }

    // ---- Chats -------------------------------------------------------------

    /**
     * GET /chats
     * @see https://learn.microsoft.com/en-us/graph/api/chat-list
     */
    async listChats(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.chats,
            query,
        });
    }

    /**
     * GET /chats/{chat-id}
     * @see https://learn.microsoft.com/en-us/graph/api/chat-get
     */
    async getChat(chatId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.chat(chatId),
            query,
        });
    }

    /**
     * GET /chats/{chat-id}/messages
     * @see https://learn.microsoft.com/en-us/graph/api/chat-list-messages
     */
    async listChatMessages(chatId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.chatMessages(chatId),
            query,
        });
    }

    /**
     * POST /chats/{chat-id}/messages
     * @see https://learn.microsoft.com/en-us/graph/api/chatmessage-post
     */
    async sendChatMessage(chatId, body) {
        return this._post({
            url: this.baseUrl + this.URLs.chatMessages(chatId),
            body,
        });
    }

    // ---- Members -----------------------------------------------------------

    /**
     * GET /teams/{team-id}/members
     * @see https://learn.microsoft.com/en-us/graph/api/team-list-members
     */
    async listTeamMembers(teamId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.teamMembers(teamId),
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
