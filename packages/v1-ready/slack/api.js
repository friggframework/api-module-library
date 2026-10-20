const crypto = require('crypto');
const { FetchError, get, OAuth2Requester } = require('@friggframework/core');

const BASE_URL = 'https://slack.com/api';
const AUTHORIZE_URL = 'https://slack.com/oauth/v2/authorize';
const TOKEN_URI = 'https://slack.com/api/oauth.v2.access';

// ---- webhook signature helpers (used by verifyWebhookSignature) ------------
function whHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return undefined;
    const want = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === want) {
            const v = headers[key];
            return Array.isArray(v) ? v[0] : v;
        }
    }
    return undefined;
}

/** The bytes Slack signed: rawBody when given, else the body (JSON-stringified if parsed). */
function whPayload(rawBody, body) {
    if (rawBody !== undefined && rawBody !== null) {
        return Buffer.isBuffer(rawBody)
            ? rawBody
            : Buffer.from(String(rawBody), 'utf8');
    }
    if (body === undefined || body === null) return Buffer.alloc(0);
    if (Buffer.isBuffer(body)) return body;
    if (typeof body === 'string') return Buffer.from(body, 'utf8');
    return Buffer.from(JSON.stringify(body), 'utf8');
}

/** Constant-time string comparison; false (not a throw) when the lengths differ. */
function whSafeEqual(a, b) {
    const x = Buffer.from(String(a), 'utf8');
    const y = Buffer.from(String(b), 'utf8');
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function whNowMs(now) {
    if (now instanceof Date) return now.getTime();
    return typeof now === 'number' ? now : Date.now();
}

/**
 * Slack Web API client.
 *
 * Auth: OAuth 2.0 (authorization code) via oauth.v2.access. Prefer the bot
 * `access_token` (`xoxb-…`) for workspace integrations. Optional user scopes
 * arrive under `authed_user` when `user_scope` is requested.
 *
 * Base URL: https://slack.com/api
 * Methods return JSON with an `ok` boolean; HTTP status is often 200 even on
 * method errors — this client treats `ok: false` as failure.
 *
 * Docs: https://docs.slack.dev/apis/web-api
 * Methods: https://docs.slack.dev/reference/methods/
 * OAuth: https://docs.slack.dev/authentication/installing-with-oauth
 * Signing: https://docs.slack.dev/authentication/verifying-requests-from-slack
 * Official OpenAPI (subset source): https://github.com/slackapi/slack-api-specs
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = BASE_URL;
        this.client_id =
            get(params, 'client_id', null) || process.env.SLACK_CLIENT_ID;
        this.client_secret =
            get(params, 'client_secret', null) ||
            process.env.SLACK_CLIENT_SECRET;
        this.scope = get(params, 'scope', null) || process.env.SLACK_SCOPE || '';
        this.user_scope =
            get(params, 'user_scope', null) ||
            process.env.SLACK_USER_SCOPE ||
            '';
        this.redirect_uri = get(
            params,
            'redirect_uri',
            `${process.env.REDIRECT_URI}/slack`
        );
        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
        this.team_id = get(params, 'team_id', null);
        this.team_name = get(params, 'team_name', null);
        this.authed_user = get(params, 'authed_user', null);
        this.webhookSecret =
            get(params, 'webhookSecret', null) ||
            process.env.SLACK_SIGNING_SECRET ||
            null;

        this.tokenUri = TOKEN_URI;
        this.authorizationUri = this._buildAuthorizationUri();

        this.URLs = {
            authorize: AUTHORIZE_URL,
            accessToken: '/oauth.v2.access',
            authTest: '/auth.test',
            listTeams: '/auth.teams.list',
            listConversations: '/conversations.list',
            getConversation: '/conversations.info',
            createConversation: '/conversations.create',
            inviteToConversation: '/conversations.invite',
            getConversationHistory: '/conversations.history',
            getConversationMembers: '/conversations.members',
            renameConversation: '/conversations.rename',
            archiveConversation: '/conversations.archive',
            postMessage: '/chat.postMessage',
            updateMessage: '/chat.update',
            deleteMessage: '/chat.delete',
            postEphemeral: '/chat.postEphemeral',
            getMessagePermalink: '/chat.getPermalink',
            listUsers: '/users.list',
            getUser: '/users.info',
            lookupUserByEmail: '/users.lookupByEmail',
            getUserProfile: '/users.profile.get',
            listFiles: '/files.list',
            getFile: '/files.info',
            listEventAuthorizations: '/apps.event.authorizations.list',
            openView: '/views.open',
            publishView: '/views.publish',
            updateView: '/views.update',
            pushView: '/views.push',
        };
    }

    _buildAuthorizationUri() {
        const params = new URLSearchParams({
            client_id: this.client_id || '',
            scope: this.scope || '',
            redirect_uri: this.redirect_uri || '',
            state: this.state || '',
        });
        if (this.user_scope) {
            params.set('user_scope', this.user_scope);
        }
        return `${AUTHORIZE_URL}?${params.toString()}`;
    }

    getAuthorizationUri() {
        this.authorizationUri = this._buildAuthorizationUri();
        return this.authorizationUri;
    }

    /** @deprecated Use getAuthorizationUri */
    getAuthUri() {
        return this.getAuthorizationUri();
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri(),
            type: 'oauth2',
        };
    }

    /**
     * Slack oauth.v2.access accepts client_id/client_secret in the form body
     * (not HTTP Basic). Parent getTokenFromCode does that.
     * @see https://docs.slack.dev/reference/methods/oauth.v2.access
     */
    async getTokenFromCode(code) {
        const response = await super.getTokenFromCode(code);
        this._applySlackInstallMetadata(response);
        return response;
    }

    _applySlackInstallMetadata(response = {}) {
        const team = response.team || {};
        if (team.id) {
            this.team_id = team.id;
            this.team_name = team.name || this.team_name;
        }
        if (response.authed_user) {
            this.authed_user = response.authed_user;
        }
        // Bot token is top-level access_token; do not swap to authed_user.access_token.
    }

    async setTokens(params) {
        await super.setTokens(params);
        this._applySlackInstallMetadata(params);
    }

    async addAuthHeaders(headers = {}) {
        const next = { ...headers };
        if (this.access_token) {
            next.Authorization = `Bearer ${this.access_token}`;
        }
        if (!next.Accept) next.Accept = 'application/json';
        return next;
    }

    /**
     * Slack returns HTTP 200 with `{ ok: false, error }` for most method failures.
     * Treat that as an error so callers don't silently proceed.
     */
    async _request(url, options, i = 0) {
        let encodedUrl = encodeURI(url);
        if (options.query) {
            let queryBuild = '?';
            for (const key in options.query) {
                if (
                    options.query[key] === undefined ||
                    options.query[key] === null
                ) {
                    continue;
                }
                queryBuild += `${encodeURIComponent(key)}=${encodeURIComponent(
                    options.query[key]
                )}&`;
            }
            encodedUrl += queryBuild.slice(0, -1);
        }

        options.headers = await this.addAuthHeaders(options.headers || {});

        const response = await this.fetch(encodedUrl, options);
        const parsedResponse = await this.parsedBody(response);
        const { status } = response;
        const { ok, error } = parsedResponse || {};

        if ((status === 429 || status >= 500) && i < this.backOff.length) {
            const delay = this.backOff[i] * 1000;
            await new Promise((resolve) => setTimeout(resolve, delay));
            return this._request(url, options, i + 1);
        }

        if (
            error === 'invalid_auth' ||
            error === 'auth_expired' ||
            error === 'token_expired' ||
            error === 'token_revoked'
        ) {
            if (!this.isRefreshable || this.refreshCount > 0) {
                await this.notify(this.DLGT_INVALID_AUTH);
            } else {
                this.refreshCount++;
                await this.refreshAuth();
                return this._request(url, options, i + 1);
            }
        }

        if (parsedResponse && ok === false) {
            throw await FetchError.create({
                resource: encodedUrl,
                init: options,
                response,
                body: parsedResponse,
            });
        }

        return parsedResponse;
    }

    _jsonPost(path, body) {
        return this._post({
            url: this.baseUrl + path,
            body,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
            },
        });
    }

    _getQuery(path, query = {}) {
        return this._get({
            url: this.baseUrl + path,
            query,
        });
    }

    // ---- Auth / identity ---------------------------------------------------

    /**
     * Checks authentication and identity.
     * POST https://slack.com/api/auth.test
     * @see https://docs.slack.dev/reference/methods/auth.test
     */
    async authTest() {
        return this._jsonPost(this.URLs.authTest, {});
    }

    /**
     * List workspaces an org-wide app is approved for.
     * POST https://slack.com/api/auth.teams.list
     * @see https://docs.slack.dev/reference/methods/auth.teams.list
     */
    async listTeams(query = {}) {
        return this._getQuery(this.URLs.listTeams, query);
    }

    // ---- Conversations -----------------------------------------------------

    /**
     * List conversations the token can access.
     * GET https://slack.com/api/conversations.list
     * @see https://docs.slack.dev/reference/methods/conversations.list
     */
    async listConversations(query = {}) {
        return this._getQuery(this.URLs.listConversations, query);
    }

    /**
     * Retrieve information about a conversation.
     * GET https://slack.com/api/conversations.info
     * @see https://docs.slack.dev/reference/methods/conversations.info
     */
    async getConversation(query) {
        return this._getQuery(this.URLs.getConversation, query);
    }

    /**
     * Create a public or private channel.
     * POST https://slack.com/api/conversations.create
     * @see https://docs.slack.dev/reference/methods/conversations.create
     */
    async createConversation(body) {
        return this._jsonPost(this.URLs.createConversation, body);
    }

    /**
     * Invite users to a conversation.
     * POST https://slack.com/api/conversations.invite
     * @see https://docs.slack.dev/reference/methods/conversations.invite
     */
    async inviteToConversation(body) {
        return this._jsonPost(this.URLs.inviteToConversation, body);
    }

    /**
     * Fetch message history for a conversation.
     * GET https://slack.com/api/conversations.history
     * @see https://docs.slack.dev/reference/methods/conversations.history
     */
    async getConversationHistory(query) {
        return this._getQuery(this.URLs.getConversationHistory, query);
    }

    /**
     * List members of a conversation.
     * GET https://slack.com/api/conversations.members
     * @see https://docs.slack.dev/reference/methods/conversations.members
     */
    async getConversationMembers(query) {
        return this._getQuery(this.URLs.getConversationMembers, query);
    }

    /**
     * Rename a conversation.
     * POST https://slack.com/api/conversations.rename
     * @see https://docs.slack.dev/reference/methods/conversations.rename
     */
    async renameConversation(body) {
        return this._jsonPost(this.URLs.renameConversation, body);
    }

    /**
     * Archive a conversation.
     * POST https://slack.com/api/conversations.archive
     * @see https://docs.slack.dev/reference/methods/conversations.archive
     */
    async archiveConversation(body) {
        return this._jsonPost(this.URLs.archiveConversation, body);
    }

    // ---- Chat --------------------------------------------------------------

    /**
     * Post a message to a channel.
     * POST https://slack.com/api/chat.postMessage
     * @see https://docs.slack.dev/reference/methods/chat.postMessage
     */
    async postMessage(body) {
        return this._jsonPost(this.URLs.postMessage, body);
    }

    /**
     * Update a message.
     * POST https://slack.com/api/chat.update
     * @see https://docs.slack.dev/reference/methods/chat.update
     */
    async updateMessage(body) {
        return this._jsonPost(this.URLs.updateMessage, body);
    }

    /**
     * Delete a message.
     * POST https://slack.com/api/chat.delete
     * @see https://docs.slack.dev/reference/methods/chat.delete
     */
    async deleteMessage(body) {
        return this._jsonPost(this.URLs.deleteMessage, body);
    }

    /**
     * Post an ephemeral message visible to one user.
     * POST https://slack.com/api/chat.postEphemeral
     * @see https://docs.slack.dev/reference/methods/chat.postEphemeral
     */
    async postEphemeral(body) {
        return this._jsonPost(this.URLs.postEphemeral, body);
    }

    /**
     * Retrieve a permalink URL for a message.
     * GET https://slack.com/api/chat.getPermalink
     * @see https://docs.slack.dev/reference/methods/chat.getPermalink
     */
    async getMessagePermalink(query) {
        return this._getQuery(this.URLs.getMessagePermalink, query);
    }

    // ---- Users -------------------------------------------------------------

    /**
     * List users in a workspace.
     * GET https://slack.com/api/users.list
     * @see https://docs.slack.dev/reference/methods/users.list
     */
    async listUsers(query = {}) {
        return this._getQuery(this.URLs.listUsers, query);
    }

    /**
     * Get information about a user.
     * GET https://slack.com/api/users.info
     * @see https://docs.slack.dev/reference/methods/users.info
     */
    async getUser(query) {
        return this._getQuery(this.URLs.getUser, query);
    }

    /**
     * Find a user by email address.
     * GET https://slack.com/api/users.lookupByEmail
     * @see https://docs.slack.dev/reference/methods/users.lookupByEmail
     */
    async lookupUserByEmail(query) {
        return this._getQuery(this.URLs.lookupUserByEmail, query);
    }

    /**
     * Retrieve a user's profile.
     * GET https://slack.com/api/users.profile.get
     * @see https://docs.slack.dev/reference/methods/users.profile.get
     */
    async getUserProfile(query = {}) {
        return this._getQuery(this.URLs.getUserProfile, query);
    }

    // ---- Files -------------------------------------------------------------

    /**
     * List files.
     * GET https://slack.com/api/files.list
     * @see https://docs.slack.dev/reference/methods/files.list
     */
    async listFiles(query = {}) {
        return this._getQuery(this.URLs.listFiles, query);
    }

    /**
     * Get information about a file.
     * GET https://slack.com/api/files.info
     * @see https://docs.slack.dev/reference/methods/files.info
     */
    async getFile(query) {
        return this._getQuery(this.URLs.getFile, query);
    }

    // ---- Events authorizations --------------------------------------------

    /**
     * Get installations that can see a given Events API event context.
     * GET https://slack.com/api/apps.event.authorizations.list
     * @see https://docs.slack.dev/reference/methods/apps.event.authorizations.list
     */
    async listEventAuthorizations(query) {
        return this._getQuery(this.URLs.listEventAuthorizations, query);
    }

    // ---- Views (Block Kit) -------------------------------------------------

    /**
     * Open a modal view.
     * POST https://slack.com/api/views.open
     * @see https://docs.slack.dev/reference/methods/views.open
     */
    async openView(body) {
        return this._jsonPost(this.URLs.openView, body);
    }

    /**
     * Publish a view to the App Home.
     * POST https://slack.com/api/views.publish
     * @see https://docs.slack.dev/reference/methods/views.publish
     */
    async publishView(body) {
        return this._jsonPost(this.URLs.publishView, body);
    }

    /**
     * Update an existing view.
     * POST https://slack.com/api/views.update
     * @see https://docs.slack.dev/reference/methods/views.update
     */
    async updateView(body) {
        return this._jsonPost(this.URLs.updateView, body);
    }

    /**
     * Push a new view onto the modal stack.
     * POST https://slack.com/api/views.push
     * @see https://docs.slack.dev/reference/methods/views.push
     */
    async pushView(body) {
        return this._jsonPost(this.URLs.pushView, body);
    }

    /**
     * Verify a Slack request using the app's signing secret.
     * Docs: https://docs.slack.dev/authentication/verifying-requests-from-slack
     *
     * `v0=` + hex HMAC-SHA256 of `v0:{X-Slack-Request-Timestamp}:{raw body}`;
     * requests more than 5 minutes from now are rejected. Interactivity
     * payloads are form-encoded — pass `rawBody`. Never throws; returns true
     * only for a genuine delivery.
     */
    async verifyWebhookSignature({ headers, body, rawBody, now } = {}) {
        try {
            const secret =
                this.webhookSecret || process.env.SLACK_SIGNING_SECRET;
            if (!secret) return false;
            const signature = whHeader(headers, 'x-slack-signature');
            const timestamp = whHeader(headers, 'x-slack-request-timestamp');
            if (!signature || !timestamp) return false;
            const ts = Number(timestamp);
            if (!Number.isFinite(ts)) return false;
            if (Math.abs(whNowMs(now) / 1000 - ts) > 5 * 60) return false;
            const payload = whPayload(rawBody, body);
            const basestring = Buffer.concat([
                Buffer.from(`v0:${timestamp}:`, 'utf8'),
                payload,
            ]);
            const expected =
                'v0=' +
                crypto
                    .createHmac('sha256', secret)
                    .update(basestring)
                    .digest('hex');
            return whSafeEqual(expected, signature);
        } catch (_e) {
            return false;
        }
    }
}

module.exports = { Api, BASE_URL, AUTHORIZE_URL, TOKEN_URI };
