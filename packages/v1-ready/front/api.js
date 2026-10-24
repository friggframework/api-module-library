const crypto = require('crypto');
const { OAuth2Requester, FetchError, get } = require('@friggframework/core');

const BASE_URL = 'https://api2.frontapp.com';
const AUTHORIZE_URL = 'https://app.frontapp.com/oauth/authorize';
const TOKEN_URI = 'https://app.frontapp.com/oauth/token';

const SIGNATURE_HEADER = 'x-front-signature';
const TIMESTAMP_HEADER = 'x-front-request-timestamp';
const CHALLENGE_HEADER = 'x-front-challenge';

/**
 * Front Core API client.
 *
 * Auth: OAuth 2.0 authorization-code (public App Store integrations) or a
 * Bearer API token. Token exchange uses HTTP Basic
 * (`client_id:client_secret`). Access tokens expire in ~60 minutes; refresh
 * tokens are valid for 6 months and rotate in the last 24 hours of validity.
 *
 * Base URL: https://api2.frontapp.com
 * Official OpenAPI: https://github.com/frontapp/front-api-specs
 * Docs: https://dev.frontapp.com/reference/introduction
 * OAuth: https://dev.frontapp.com/docs/oauth
 *
 * The curated machine-readable contract lives in ./front.openapi.yaml — this
 * client mirrors it 1:1 (one method per operationId). Keep them in sync.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = get(params, 'baseUrl', null) || BASE_URL;
        this.tokenUri = TOKEN_URI;

        this.client_id =
            this.client_id ||
            get(params, 'client_id', null) ||
            process.env.FRONT_CLIENT_ID;
        this.client_secret =
            this.client_secret ||
            get(params, 'client_secret', null) ||
            process.env.FRONT_CLIENT_SECRET;
        this.redirect_uri =
            this.redirect_uri ||
            get(params, 'redirect_uri', null) ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/front`
                : null);

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        this.webhookSecret =
            get(params, 'webhookSecret', null) ||
            get(params, 'webhook_secret', null) ||
            process.env.FRONT_WEBHOOK_SECRET ||
            null;

        this.authorizationUri = this._buildAuthorizationUri();

        this.URLs = {
            me: '/me',
            conversations: '/conversations',
            conversationById: (id) => `/conversations/${id}`,
            conversationMessages: (id) => `/conversations/${id}/messages`,
            conversationComments: (id) => `/conversations/${id}/comments`,
            contacts: '/contacts',
            contactById: (id) => `/contacts/${id}`,
            channels: '/channels',
            channelById: (id) => `/channels/${id}`,
            teammates: '/teammates',
            teammateById: (id) => `/teammates/${id}`,
            inboxes: '/inboxes',
            inboxById: (id) => `/inboxes/${id}`,
            tags: '/tags',
            tagById: (id) => `/tags/${id}`,
            events: '/events',
            eventById: (id) => `/events/${id}`,
            messageById: (id) => `/messages/${id}`,
        };
    }

    _buildAuthorizationUri() {
        const q = new URLSearchParams();
        q.set('response_type', 'code');
        if (this.client_id) q.set('client_id', this.client_id);
        if (this.redirect_uri) q.set('redirect_uri', this.redirect_uri);
        if (this.state) q.set('state', this.state);
        // Front configures scopes on the OAuth app feature in the Developer
        // portal — they are not authorize-query params.
        return `${AUTHORIZE_URL}?${q.toString()}`;
    }

    getAuthUri() {
        this.authorizationUri = this._buildAuthorizationUri();
        return this.authorizationUri;
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthUri(),
            type: 'oauth2',
            data: {},
        };
    }

    /**
     * Front's token endpoint requires HTTP Basic with client_id:client_secret.
     * @see https://dev.frontapp.com/docs/oauth
     */
    async getTokenFromCode(code) {
        return this.getTokenFromCodeBasicAuthHeader(code);
    }

    addJsonHeaders(options = {}) {
        options.headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...options.headers,
        };
        return options;
    }

    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params || {})) {
            if (value === undefined || value === null) continue;
            if (typeof value === 'object' && !Array.isArray(value)) {
                // Front search criteria travel as `q[key]=value`.
                for (const [innerKey, innerVal] of Object.entries(value)) {
                    if (innerVal === undefined || innerVal === null) continue;
                    usp.append(`${key}[${innerKey}]`, String(innerVal));
                }
            } else if (Array.isArray(value)) {
                for (const v of value) {
                    if (v === undefined || v === null) continue;
                    usp.append(`${key}[]`, String(v));
                }
            } else {
                usp.append(key, String(value));
            }
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Fetch the company / token identity.
     * GET /me
     * Response: { id: "cmp_…", name, _links }
     * Required scope: none beyond a valid token.
     */
    async getMe() {
        return this._get({ url: this.baseUrl + this.URLs.me });
    }

    /** @deprecated Prefer getMe — kept as an alias used by older call sites. */
    async getTokenIdentity() {
        return this.getMe();
    }

    // ---- Conversations -----------------------------------------------------

    /**
     * List conversations (most recently updated first).
     * GET /conversations
     * Optional query: q, limit, page_token, sort_by, sort_order.
     * Required scope: conversations:read
     */
    async listConversations(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.conversations +
                this._buildQuery(params),
        });
    }

    /**
     * Fetch a conversation by id.
     * GET /conversations/{conversation_id}
     * Required scope: conversations:read
     */
    async getConversation(conversationId) {
        return this._get({
            url: this.baseUrl + this.URLs.conversationById(conversationId),
        });
    }

    /** @deprecated Prefer getConversation. */
    async getConversationById(id) {
        return this.getConversation(id);
    }

    /**
     * Create a discussion conversation.
     * POST /conversations
     * Body: { type, subject, inbox_id?, teammate_ids?, comment?, … }
     * Required scope: conversations:write
     */
    async createConversation(body) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.conversations,
                body,
            })
        );
    }

    /**
     * Update a conversation (assignee, status, tags, …).
     * PATCH /conversations/{conversation_id}
     * Required scope: conversations:write
     */
    async updateConversation(conversationId, body) {
        return this._patch(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.conversationById(conversationId),
                body,
            })
        );
    }

    // ---- Contacts ----------------------------------------------------------

    /**
     * List contacts.
     * GET /contacts
     * Optional query: q, limit, page_token, sort_by, sort_order.
     * Required scope: contacts:read
     */
    async listContacts(params = {}) {
        // Back-compat: previous module accepted a full next-page URL string.
        if (typeof params === 'string') {
            return this._get({ url: params });
        }
        return this._get({
            url: this.baseUrl + this.URLs.contacts + this._buildQuery(params),
        });
    }

    /**
     * Fetch a contact by id.
     * GET /contacts/{contact_id}
     * Required scope: contacts:read
     */
    async getContact(contactId) {
        return this._get({
            url: this.baseUrl + this.URLs.contactById(contactId),
        });
    }

    /** @deprecated Prefer getContact. */
    async getContactById(id) {
        return this.getContact(id);
    }

    /**
     * Create a company-level contact.
     * POST /contacts
     * Body must include handles: [{ handle, source }].
     * Required scope: contacts:write
     */
    async createContact(body) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.contacts,
                body,
            })
        );
    }

    /**
     * Update a contact. Front returns 204 No Content on success.
     * PATCH /contacts/{contact_id}
     * Required scope: contacts:write
     */
    async updateContact(contactId, body) {
        const url = this.baseUrl + this.URLs.contactById(contactId);
        const options = {
            credentials: 'include',
            method: 'PATCH',
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        };
        const response = await this._request(url, options);
        if (response.status === 204) {
            return '';
        }
        throw await FetchError.create({
            resource: url,
            init: options,
            response,
        });
    }

    /**
     * Delete a contact.
     * DELETE /contacts/{contact_id}
     * Required scope: contacts:delete
     */
    async deleteContact(contactId) {
        return this._delete({
            url: this.baseUrl + this.URLs.contactById(contactId),
        });
    }

    // ---- Channels ----------------------------------------------------------

    /**
     * List channels.
     * GET /channels
     * Required scope: channels:read
     */
    async listChannels(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.channels + this._buildQuery(params),
        });
    }

    /**
     * Fetch a channel by id.
     * GET /channels/{channel_id}
     * Required scope: channels:read
     */
    async getChannel(channelId) {
        return this._get({
            url: this.baseUrl + this.URLs.channelById(channelId),
        });
    }

    // ---- Teammates ---------------------------------------------------------

    /**
     * List teammates.
     * GET /teammates
     * Required scope: teammates:read
     */
    async listTeammates(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.teammates + this._buildQuery(params),
        });
    }

    /**
     * Fetch a teammate by id.
     * GET /teammates/{teammate_id}
     * Required scope: teammates:read
     */
    async getTeammate(teammateId) {
        return this._get({
            url: this.baseUrl + this.URLs.teammateById(teammateId),
        });
    }

    // ---- Inboxes -----------------------------------------------------------

    /**
     * List inboxes.
     * GET /inboxes
     * Required scope: inboxes:read
     */
    async listInboxes(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.inboxes + this._buildQuery(params),
        });
    }

    /**
     * Fetch an inbox by id.
     * GET /inboxes/{inbox_id}
     * Required scope: inboxes:read
     */
    async getInbox(inboxId) {
        return this._get({
            url: this.baseUrl + this.URLs.inboxById(inboxId),
        });
    }

    // ---- Tags --------------------------------------------------------------

    /**
     * List tags the token can access.
     * GET /tags
     * Required scope: tags:read (or equivalent resource permission)
     */
    async listTags(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.tags + this._buildQuery(params),
        });
    }

    /**
     * Fetch a tag by id.
     * GET /tags/{tag_id}
     */
    async getTag(tagId) {
        return this._get({
            url: this.baseUrl + this.URLs.tagById(tagId),
        });
    }

    /**
     * Create a tag (legacy company/team endpoint).
     * POST /tags
     */
    async createTag(body) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.tags,
                body,
            })
        );
    }

    /**
     * Update a tag.
     * PATCH /tags/{tag_id}
     */
    async updateTag(tagId, body) {
        return this._patch(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.tagById(tagId),
                body,
            })
        );
    }

    // ---- Events ------------------------------------------------------------

    /**
     * List events (activity feed). Useful to reconcile missed webhooks.
     * GET /events
     * Optional query: q, limit, page_token, sort_by, sort_order.
     */
    async listEvents(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.events + this._buildQuery(params),
        });
    }

    /**
     * Fetch an event by id.
     * GET /events/{event_id}
     */
    async getEvent(eventId) {
        return this._get({
            url: this.baseUrl + this.URLs.eventById(eventId),
        });
    }

    // ---- Messages & comments ----------------------------------------------

    /**
     * List messages in a conversation.
     * GET /conversations/{conversation_id}/messages
     */
    async listConversationMessages(conversationId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.conversationMessages(conversationId) +
                this._buildQuery(params),
        });
    }

    /**
     * Fetch a message by id.
     * GET /messages/{message_id}
     */
    async getMessage(messageId) {
        return this._get({
            url: this.baseUrl + this.URLs.messageById(messageId),
        });
    }

    /**
     * List comments on a conversation.
     * GET /conversations/{conversation_id}/comments
     */
    async listConversationComments(conversationId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.conversationComments(conversationId) +
                this._buildQuery(params),
        });
    }

    /**
     * Add a comment to a conversation.
     * POST /conversations/{conversation_id}/comments
     * Body: { author_id?, body, … }
     */
    async addComment(conversationId, body) {
        return this._post(
            this.addJsonHeaders({
                url:
                    this.baseUrl +
                    this.URLs.conversationComments(conversationId),
                body,
            })
        );
    }

    // ---- Application webhooks (local verify; subscriptions are app features)

    /**
     * Verify an application-webhook signature.
     *
     * Algorithm (https://dev.frontapp.com/docs/application-webhooks):
     *   baseString = `${timestamp}:` + rawBody
     *   signature  = base64(HMAC-SHA256(app_secret, utf8(baseString)))
     *   headers    = x-front-signature, x-front-request-timestamp
     *
     * Application webhook *subscriptions* are configured as app features in
     * the Developer portal — there is no Core API CRUD for them.
     *
     * @param {Object} args
     * @param {Object} [args.headers]
     * @param {string|Buffer} [args.rawBody]
     * @param {*} [args.body] - Parsed body fallback when rawBody is absent
     * @param {string} [args.secret] - Defaults to this.webhookSecret / env
     * @returns {{ valid: boolean, reason?: string, challenge?: string }}
     */
    verifyWebhookSignature({
        headers = {},
        rawBody,
        body,
        secret,
    } = {}) {
        const token = secret || this.webhookSecret;
        if (!token || typeof token !== 'string') {
            return { valid: false, reason: 'missing webhook secret' };
        }

        const signature = _header(headers, SIGNATURE_HEADER);
        const timestamp = _header(headers, TIMESTAMP_HEADER);
        const challenge = _header(headers, CHALLENGE_HEADER);

        if (!signature) {
            return { valid: false, reason: `missing ${SIGNATURE_HEADER}` };
        }
        if (!timestamp) {
            return { valid: false, reason: `missing ${TIMESTAMP_HEADER}` };
        }

        const payload = _payloadBuffer(rawBody, body);
        const baseString = Buffer.concat([
            Buffer.from(`${timestamp}:`, 'utf8'),
            payload,
        ]);
        const expected = crypto
            .createHmac('sha256', token)
            .update(baseString)
            .digest('base64');

        if (!_safeEqual(expected, signature)) {
            return { valid: false, reason: 'signature mismatch' };
        }
        return challenge
            ? { valid: true, challenge: String(challenge) }
            : { valid: true };
    }
}

function _header(headers, name) {
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

function _payloadBuffer(rawBody, body) {
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

function _safeEqual(a, b) {
    try {
        const x = Buffer.from(String(a), 'utf8');
        const y = Buffer.from(String(b), 'utf8');
        return x.length === y.length && crypto.timingSafeEqual(x, y);
    } catch (_e) {
        return false;
    }
}

module.exports = {
    Api,
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
    CHALLENGE_HEADER,
};
