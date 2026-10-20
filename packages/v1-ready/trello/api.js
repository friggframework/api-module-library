const crypto = require('crypto');
const { Requester, ModuleConstants, get } = require('@friggframework/core');

const BASE_URL = 'https://api.trello.com/1';
const AUTHORIZE_URL = 'https://trello.com/1/authorize';
const SIGNATURE_HEADER = 'x-trello-webhook';

/**
 * Trello REST API client.
 *
 * Auth: API key + user token (Trello Auth / Power-Up key). Pass both as query
 * params (`key` + `token`) on every request — the documented primary method —
 * or equivalently via
 * `Authorization: OAuth oauth_consumer_key="…", oauth_token="…"`.
 * This client uses the Authorization header so URLs stay free of secrets.
 *
 *   - API key: Power-Up admin → Trello Auth (https://trello.com/apps/admin)
 *   - Token:   GET https://trello.com/1/authorize?…&key={APIKey}
 *   - Base URL: https://api.trello.com/1
 *
 * Official OpenAPI: https://developer.atlassian.com/cloud/trello/swagger.v3.json
 * Docs: https://developer.atlassian.com/cloud/trello/rest/
 * Auth: https://developer.atlassian.com/cloud/trello/guides/rest-api/authorization/
 *
 * The curated contract in ./trello.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Keep them in sync.
 */
class Api extends Requester {
    constructor(params = {}) {
        super(params);

        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'key', null) ||
            process.env.TRELLO_API_KEY ||
            null;
        this.token =
            get(params, 'token', null) ||
            get(params, 'access_token', null) ||
            process.env.TRELLO_TOKEN ||
            null;
        this.api_secret =
            get(params, 'api_secret', null) ||
            get(params, 'secret', null) ||
            process.env.TRELLO_API_SECRET ||
            null;

        this.baseUrl = get(params, 'baseUrl', null) || BASE_URL;

        this.URLs = {
            memberById: (id) => `/members/${id}`,
            memberBoards: (id) => `/members/${id}/boards`,
            memberOrganizations: (id) => `/members/${id}/organizations`,
            boards: '/boards/',
            boardById: (id) => `/boards/${id}`,
            boardLists: (id) => `/boards/${id}/lists`,
            boardCards: (id) => `/boards/${id}/cards`,
            boardLabels: (id) => `/boards/${id}/labels`,
            lists: '/lists',
            listById: (id) => `/lists/${id}`,
            listCards: (id) => `/lists/${id}/cards`,
            cards: '/cards',
            cardById: (id) => `/cards/${id}`,
            organizations: '/organizations',
            organizationById: (id) => `/organizations/${id}`,
            labels: '/labels',
            webhooks: '/webhooks/',
            webhookById: (id) => `/webhooks/${id}`,
            tokenWebhooks: (token) => `/tokens/${token}/webhooks`,
        };
    }

    // ---- Auth helpers ------------------------------------------------------

    getAuthorizationRequirements() {
        const key = this.api_key || process.env.TRELLO_API_KEY || '';
        const params = new URLSearchParams({
            expiration: 'never',
            scope: 'read,write,account',
            response_type: 'token',
            key,
        });
        const authorizeUrl = key
            ? `${AUTHORIZE_URL}?${params.toString()}`
            : null;

        return {
            url: authorizeUrl,
            type: ModuleConstants.authType.apiKey,
            data: {
                jsonSchema: {
                    title: 'Trello Authentication',
                    type: 'object',
                    required: ['api_key', 'token'],
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'API Key',
                        },
                        token: {
                            type: 'string',
                            title: 'User Token',
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:help':
                            'Generate under Power-Up admin → Trello Auth (https://trello.com/apps/admin).',
                        'ui:placeholder': '32-char hex API key',
                    },
                    token: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Authorize at https://trello.com/1/authorize?expiration=never&scope=read,write,account&response_type=token&key=YOUR_API_KEY then paste the token.',
                    },
                },
            },
        };
    }

    async addAuthHeaders(headers = {}) {
        if (this.api_key && this.token) {
            headers.Authorization = `OAuth oauth_consumer_key="${this.api_key}", oauth_token="${this.token}"`;
        }
        headers.Accept = headers.Accept || 'application/json';
        return headers;
    }

    isAuthenticated() {
        return (
            typeof this.api_key === 'string' &&
            this.api_key.trim().length > 0 &&
            typeof this.token === 'string' &&
            this.token.trim().length > 0
        );
    }

    setApiKey(apiKey) {
        this.api_key = apiKey;
    }

    setToken(token) {
        this.token = token;
    }

    addJsonHeaders(options = {}) {
        options.headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...options.headers,
        };
        return options;
    }

    // ---- Members / identity ------------------------------------------------

    /**
     * Get a member. Pass `me` for the authenticated member.
     * GET /members/{id}
     * @see https://developer.atlassian.com/cloud/trello/rest/api-group-members/#api-members-id-get
     */
    async getMember(id = 'me', params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.memberById(id),
            query: params,
        });
    }

    // ---- Boards ------------------------------------------------------------

    /**
     * List boards for a member (default: me).
     * GET /members/{id}/boards
     */
    async listBoards(memberId = 'me', params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.memberBoards(memberId),
            query: params,
        });
    }

    /**
     * Get a board by id.
     * GET /boards/{id}
     */
    async getBoard(id, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.boardById(id),
            query: params,
        });
    }

    /**
     * Create a board.
     * POST /boards/
     * Query params per official OpenAPI (name, desc, idOrganization, …).
     */
    async createBoard(params = {}) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.boards,
                query: params,
            })
        );
    }

    /**
     * Update a board.
     * PUT /boards/{id}
     */
    async updateBoard(id, params = {}) {
        return this._put(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.boardById(id),
                query: params,
            })
        );
    }

    // ---- Lists -------------------------------------------------------------

    /**
     * List lists on a board.
     * GET /boards/{id}/lists
     */
    async listLists(boardId, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.boardLists(boardId),
            query: params,
        });
    }

    /**
     * Get a list by id.
     * GET /lists/{id}
     */
    async getList(id, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.listById(id),
            query: params,
        });
    }

    /**
     * Create a list.
     * POST /lists
     */
    async createList(params = {}) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.lists,
                query: params,
            })
        );
    }

    /**
     * Update a list.
     * PUT /lists/{id}
     */
    async updateList(id, params = {}) {
        return this._put(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.listById(id),
                query: params,
            })
        );
    }

    // ---- Cards -------------------------------------------------------------

    /**
     * List cards on a board.
     * GET /boards/{id}/cards
     */
    async listCards(boardId, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.boardCards(boardId),
            query: params,
        });
    }

    /**
     * List cards on a list.
     * GET /lists/{id}/cards
     */
    async listListCards(listId, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.listCards(listId),
            query: params,
        });
    }

    /**
     * Get a card by id.
     * GET /cards/{id}
     */
    async getCard(id, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.cardById(id),
            query: params,
        });
    }

    /**
     * Create a card.
     * POST /cards
     */
    async createCard(params = {}) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.cards,
                query: params,
            })
        );
    }

    /**
     * Update a card.
     * PUT /cards/{id}
     */
    async updateCard(id, params = {}) {
        return this._put(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.cardById(id),
                query: params,
            })
        );
    }

    // ---- Organizations (workspaces) ----------------------------------------

    /**
     * List organizations for a member (default: me).
     * GET /members/{id}/organizations
     */
    async listOrganizations(memberId = 'me', params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.memberOrganizations(memberId),
            query: params,
        });
    }

    /**
     * Get an organization by id.
     * GET /organizations/{id}
     */
    async getOrganization(id, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.organizationById(id),
            query: params,
        });
    }

    // ---- Labels ------------------------------------------------------------

    /**
     * List labels on a board.
     * GET /boards/{id}/labels
     */
    async listLabels(boardId, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.boardLabels(boardId),
            query: params,
        });
    }

    /**
     * Create a label.
     * POST /labels
     */
    async createLabel(params = {}) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.labels,
                query: params,
            })
        );
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * Create a webhook (key/token auth).
     * POST /webhooks/
     *
     * Required: callbackURL, idModel. Optional: description, active.
     * Trello HEADs callbackURL and expects HTTP 200 before creating.
     *
     * @see https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/
     */
    async createWebhook(params = {}) {
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.webhooks,
                body: params,
            })
        );
    }

    /**
     * Get a webhook by id.
     * GET /webhooks/{id}
     */
    async getWebhook(id) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookById(id),
        });
    }

    /**
     * Update a webhook.
     * PUT /webhooks/{id}
     */
    async updateWebhook(id, params = {}) {
        return this._put(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.webhookById(id),
                body: params,
            })
        );
    }

    /**
     * Delete a webhook.
     * DELETE /webhooks/{id}
     */
    async deleteWebhook(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(id),
        });
    }

    /**
     * List webhooks for a token (defaults to this.token).
     * GET /tokens/{token}/webhooks
     */
    async listTokenWebhooks(token) {
        const t = token || this.token;
        return this._get({
            url: this.baseUrl + this.URLs.tokenWebhooks(t),
        });
    }

    /**
     * Create a webhook nested under a token.
     * POST /tokens/{token}/webhooks
     */
    async createTokenWebhook(params = {}, token) {
        const t = token || this.token;
        return this._post(
            this.addJsonHeaders({
                url: this.baseUrl + this.URLs.tokenWebhooks(t),
                body: params,
            })
        );
    }

    /**
     * Verify an inbound Trello webhook signature (X-Trello-Webhook).
     *
     * Algorithm (official docs):
     *   content   = rawBody + callbackURL   (exact callbackURL used at create)
     *   signature = base64(HMAC-SHA1(api_secret, content))
     *
     * @see https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/
     */
    verifyWebhookSignature({
        headers = {},
        rawBody,
        body,
        callbackURL,
        secret,
    } = {}) {
        const key = secret || this.api_secret;
        if (!key || typeof key !== 'string') {
            return { valid: false, reason: 'missing api secret' };
        }
        if (!callbackURL || typeof callbackURL !== 'string') {
            return { valid: false, reason: 'missing callbackURL' };
        }

        const signature = _header(headers, SIGNATURE_HEADER);
        if (!signature) {
            return { valid: false, reason: `missing ${SIGNATURE_HEADER}` };
        }

        const payload = _payloadString(rawBody, body);
        const expected = crypto
            .createHmac('sha1', key)
            .update(payload + callbackURL)
            .digest('base64');

        if (!_safeEqual(expected, signature)) {
            return { valid: false, reason: 'signature mismatch' };
        }
        return { valid: true };
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

function _payloadString(rawBody, body) {
    if (rawBody !== undefined && rawBody !== null) {
        return Buffer.isBuffer(rawBody)
            ? rawBody.toString('utf8')
            : String(rawBody);
    }
    if (body === undefined || body === null) return '';
    if (Buffer.isBuffer(body)) return body.toString('utf8');
    if (typeof body === 'string') return body;
    return JSON.stringify(body);
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
    BASE_URL,
    AUTHORIZE_URL,
};
