const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * monday.com Platform GraphQL API client.
 *
 * Auth: OAuth 2.0 authorization-code (marketplace / connected apps). Access
 * tokens are sent as `Authorization: Bearer <token>`. Personal API tokens are
 * also accepted when passed as `access_token` / `api_token` (monday's docs send
 * personal tokens without the Bearer prefix; we detect and strip a duplicated
 * "Bearer " if present, then apply Bearer for OAuth-shaped tokens).
 *
 * GraphQL endpoint (single): POST https://api.monday.com/v2
 * Version header: API-Version (default 2026-07 — current as of docs).
 *
 * Docs:
 *   https://developer.monday.com/api-reference/docs
 *   https://developer.monday.com/api-reference/docs/authentication
 *   https://developer.monday.com/apps/docs/oauth
 *   https://developer.monday.com/api-reference/reference/webhooks
 */

const DEFAULT_API_VERSION = '2026-07';
const DEFAULT_SCOPES = [
    'me:read',
    'account:read',
    'boards:read',
    'boards:write',
    'webhooks:read',
    'webhooks:write',
].join(' ');

const AUTH_BASE = 'https://auth.monday.com/oauth2/authorize';
const TOKEN_URI = 'https://auth.monday.com/oauth2/token';
const GRAPHQL_BASE = 'https://api.monday.com/v2';

function base64UrlEncode(buf) {
    return Buffer.from(buf)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function base64UrlDecodeToBuffer(str) {
    const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
    return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/**
 * Verify an HS256 JWT with the app Signing Secret (no external jwt dep).
 * Returns { valid, payload?, reason? }.
 */
function verifyHs256Jwt(token, secret) {
    if (!token || !secret) {
        return { valid: false, reason: 'missing_token_or_secret' };
    }
    const parts = String(token).replace(/^Bearer\s+/i, '').split('.');
    if (parts.length !== 3) {
        return { valid: false, reason: 'malformed_jwt' };
    }
    const [headerB64, payloadB64, signatureB64] = parts;
    let header;
    try {
        header = JSON.parse(base64UrlDecodeToBuffer(headerB64).toString('utf8'));
    } catch (_e) {
        return { valid: false, reason: 'invalid_header' };
    }
    if (header.alg && header.alg !== 'HS256') {
        return { valid: false, reason: `unsupported_alg:${header.alg}` };
    }
    const data = `${headerB64}.${payloadB64}`;
    const expected = base64UrlEncode(
        crypto.createHmac('sha256', secret).update(data).digest()
    );
    const actual = signatureB64;
    const a = Buffer.from(actual);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return { valid: false, reason: 'bad_signature' };
    }
    let payload;
    try {
        payload = JSON.parse(base64UrlDecodeToBuffer(payloadB64).toString('utf8'));
    } catch (_e) {
        return { valid: false, reason: 'invalid_payload' };
    }
    return { valid: true, payload };
}

function getHeader(headers, name) {
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

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = GRAPHQL_BASE;
        this.tokenUri = TOKEN_URI;

        this.apiVersion =
            get(params, 'apiVersion', null) ||
            process.env.MONDAY_API_VERSION ||
            DEFAULT_API_VERSION;

        this.scope =
            this.scope ||
            process.env.MONDAY_SCOPE ||
            DEFAULT_SCOPES;

        this.client_id =
            this.client_id || process.env.MONDAY_CLIENT_ID || null;
        this.client_secret =
            this.client_secret || process.env.MONDAY_CLIENT_SECRET || null;
        this.redirect_uri =
            this.redirect_uri ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/monday`
                : null);

        // Legacy monday OAuth tokens do not expire / refresh (until uninstall).
        // OAuth 2.1 refresh is an open question — see PR.
        this.isRefreshable = false;

        this.signingSecret =
            get(params, 'signingSecret', null) ||
            process.env.MONDAY_SIGNING_SECRET ||
            null;

        this.access_token =
            get(params, 'access_token', null) ||
            get(params, 'api_token', null) ||
            get(params, 'api_key', null) ||
            this.access_token ||
            null;

        this.authorizationUri = this._buildAuthorizationUri();
    }

    _buildAuthorizationUri() {
        const clientId = this.client_id || '';
        const redirect = this.redirect_uri || '';
        const scope = this.scope || DEFAULT_SCOPES;
        const state = this.state || '';
        return encodeURI(
            `${AUTH_BASE}?client_id=${clientId}` +
                `&redirect_uri=${redirect}` +
                `&response_type=code` +
                `&scope=${scope}` +
                (state ? `&state=${state}` : '')
        );
    }

    /**
     * monday accepts OAuth tokens as Bearer. Personal tokens are often sent
     * raw; OAuth2Requester's default Bearer prefix matches marketplace apps.
     */
    async addAuthHeaders(headers = {}) {
        const h = await super.addAuthHeaders(headers);
        if (this.access_token && !h.Authorization && !h.authorization) {
            const raw = String(this.access_token).replace(/^Bearer\s+/i, '');
            h.Authorization = `Bearer ${raw}`;
        }
        return h;
    }

    // ---- GraphQL transport -------------------------------------------------

    /**
     * POST `{ query, variables }` to the single GraphQL endpoint.
     * Unwraps `data`; throws when GraphQL returns a non-empty `errors` array.
     */
    async graphql(query, variables = {}) {
        const options = {
            url: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'API-Version': this.apiVersion,
            },
            body: { query, variables },
        };
        const response = await this._post(options);
        if (response && Array.isArray(response.errors) && response.errors.length) {
            const message = response.errors
                .map((e) => e.message)
                .filter(Boolean)
                .join('; ');
            throw new Error(`monday GraphQL error: ${message}`);
        }
        return response ? response.data : undefined;
    }

    // ---- Auth / identity ---------------------------------------------------

    /**
     * Authenticated user for the token (`me` query).
     * Scope: me:read
     * Docs: https://developer.monday.com/api-reference/reference/me
     */
    async getMe() {
        const query = `query {
            me {
                id
                name
                email
                is_guest
                is_admin
                account {
                    id
                    name
                    slug
                }
            }
        }`;
        const data = await this.graphql(query);
        return data ? data.me : undefined;
    }

    /**
     * Account metadata for the token (`account` query at root).
     * Scope: account:read
     * Docs: https://developer.monday.com/api-reference/reference/account
     */
    async getAccount() {
        const query = `query {
            account {
                id
                name
                slug
                tier
            }
        }`;
        const data = await this.graphql(query);
        return data ? data.account : undefined;
    }

    // ---- Boards ------------------------------------------------------------

    /**
     * List boards.
     * Scope: boards:read
     * Docs: https://developer.monday.com/api-reference/reference/boards
     *
     * @param {object} [params]
     * @param {string[]} [params.ids]
     * @param {number} [params.limit]
     * @param {number} [params.page]
     * @param {string} [params.state] - active | all | archived | deleted
     * @param {string} [params.board_kind] - private | public | share
     * @param {string[]} [params.workspace_ids]
     */
    async listBoards(params = {}) {
        const query = `query ListBoards(
            $ids: [ID!]
            $limit: Int
            $page: Int
            $state: State
            $boardKind: BoardKind
            $workspaceIds: [ID]
        ) {
            boards(
                ids: $ids
                limit: $limit
                page: $page
                state: $state
                board_kind: $boardKind
                workspace_ids: $workspaceIds
            ) {
                id
                name
                state
                board_kind
                description
                workspace_id
                updated_at
            }
        }`;
        const variables = {
            ids: params.ids,
            limit: params.limit,
            page: params.page,
            state: params.state,
            boardKind: params.board_kind,
            workspaceIds: params.workspace_ids,
        };
        const data = await this.graphql(query, variables);
        return data ? data.boards : undefined;
    }

    /**
     * Get one board by id (includes columns + groups).
     * Scope: boards:read
     */
    async getBoard(boardId) {
        const query = `query GetBoard($ids: [ID!]) {
            boards(ids: $ids) {
                id
                name
                state
                board_kind
                description
                workspace_id
                columns {
                    id
                    title
                    type
                    description
                }
                groups {
                    id
                    title
                }
            }
        }`;
        const data = await this.graphql(query, { ids: [String(boardId)] });
        const boards = data ? data.boards : [];
        return Array.isArray(boards) ? boards[0] : undefined;
    }

    /**
     * Create a board.
     * Scope: boards:write
     * Docs: https://developer.monday.com/api-reference/reference/boards
     *
     * @param {object} params
     * @param {string} params.board_name
     * @param {string} params.board_kind - private | public | share
     * @param {string} [params.description]
     * @param {string|number} [params.workspace_id]
     * @param {string|number} [params.folder_id]
     * @param {string|number} [params.template_id]
     * @param {boolean} [params.empty]
     */
    async createBoard(params = {}) {
        const query = `mutation CreateBoard(
            $boardName: String!
            $boardKind: BoardKind!
            $description: String
            $workspaceId: ID
            $folderId: ID
            $templateId: ID
            $empty: Boolean
        ) {
            create_board(
                board_name: $boardName
                board_kind: $boardKind
                description: $description
                workspace_id: $workspaceId
                folder_id: $folderId
                template_id: $templateId
                empty: $empty
            ) {
                id
                name
                board_kind
            }
        }`;
        const variables = {
            boardName: params.board_name || params.name,
            boardKind: params.board_kind || params.kind,
            description: params.description,
            workspaceId: params.workspace_id,
            folderId: params.folder_id,
            templateId: params.template_id,
            empty: params.empty,
        };
        const data = await this.graphql(query, variables);
        return data ? data.create_board : undefined;
    }

    /**
     * Create a column on a board.
     * Scope: boards:write
     * Docs: https://developer.monday.com/api-reference/reference/columns
     *
     * @param {object} params
     * @param {string|number} params.board_id
     * @param {string} params.title
     * @param {string} params.column_type - ColumnType enum (e.g. status, text, date)
     * @param {string} [params.description]
     * @param {object|string} [params.defaults]
     * @param {string} [params.id] - optional caller-chosen column id
     * @param {string} [params.after_column_id]
     */
    async createColumn(params = {}) {
        const query = `mutation CreateColumn(
            $boardId: ID!
            $title: String!
            $columnType: ColumnType!
            $description: String
            $defaults: JSON
            $id: String
            $afterColumnId: ID
        ) {
            create_column(
                board_id: $boardId
                title: $title
                column_type: $columnType
                description: $description
                defaults: $defaults
                id: $id
                after_column_id: $afterColumnId
            ) {
                id
                title
                type
                description
            }
        }`;
        let defaults = params.defaults;
        if (defaults && typeof defaults === 'object') {
            defaults = JSON.stringify(defaults);
        }
        const variables = {
            boardId: String(params.board_id),
            title: params.title,
            columnType: params.column_type || params.type,
            description: params.description,
            defaults,
            id: params.id,
            afterColumnId: params.after_column_id,
        };
        const data = await this.graphql(query, variables);
        return data ? data.create_column : undefined;
    }

    /**
     * List columns for a board.
     * Scope: boards:read
     */
    async listColumns(boardId) {
        const query = `query ListColumns($ids: [ID!]) {
            boards(ids: $ids) {
                columns {
                    id
                    title
                    type
                    description
                }
            }
        }`;
        const data = await this.graphql(query, { ids: [String(boardId)] });
        const boards = data ? data.boards : [];
        return Array.isArray(boards) && boards[0] ? boards[0].columns : [];
    }

    // ---- Items -------------------------------------------------------------

    /**
     * Get items by id (up to 100).
     * Scope: boards:read
     * Docs: https://developer.monday.com/api-reference/reference/items
     *
     * @param {object} params
     * @param {Array<string|number>} params.ids
     * @param {number} [params.limit]
     */
    async listItems(params = {}) {
        const query = `query ListItems($ids: [ID!], $limit: Int) {
            items(ids: $ids, limit: $limit) {
                id
                name
                state
                created_at
                updated_at
                board { id }
                group { id title }
                column_values {
                    id
                    type
                    text
                    value
                }
            }
        }`;
        const variables = {
            ids: (params.ids || []).map(String),
            limit: params.limit,
        };
        const data = await this.graphql(query, variables);
        return data ? data.items : undefined;
    }

    /**
     * Page items on a board via `items_page` (cursor pagination).
     * Scope: boards:read
     * Docs: https://developer.monday.com/api-reference/reference/items_page
     *
     * @param {object} params
     * @param {string|number} params.board_id
     * @param {number} [params.limit] - default 25, max 500
     * @param {string} [params.cursor]
     * @param {object} [params.query_params]
     */
    async listBoardItems(params = {}) {
        const query = `query ListBoardItems(
            $ids: [ID!]
            $limit: Int!
            $cursor: String
            $queryParams: ItemsQuery
        ) {
            boards(ids: $ids) {
                id
                items_page(
                    limit: $limit
                    cursor: $cursor
                    query_params: $queryParams
                ) {
                    cursor
                    items {
                        id
                        name
                        state
                        created_at
                        updated_at
                        group { id title }
                        column_values {
                            id
                            type
                            text
                            value
                        }
                    }
                }
            }
        }`;
        const variables = {
            ids: [String(params.board_id)],
            limit: params.limit == null ? 25 : params.limit,
            cursor: params.cursor,
            queryParams: params.query_params,
        };
        const data = await this.graphql(query, variables);
        const boards = data ? data.boards : [];
        return Array.isArray(boards) && boards[0] ? boards[0].items_page : undefined;
    }

    /**
     * Create an item.
     * Scope: boards:write
     * Docs: https://developer.monday.com/api-reference/reference/items
     *
     * `column_values` may be an object (stringified here) or a JSON string —
     * matching monday's `JSON!` argument.
     *
     * @param {object} params
     * @param {string|number} params.board_id
     * @param {string} params.item_name
     * @param {string} [params.group_id]
     * @param {object|string} [params.column_values]
     * @param {boolean} [params.create_labels_if_missing]
     */
    async createItem(params = {}) {
        const query = `mutation CreateItem(
            $boardId: ID!
            $itemName: String!
            $groupId: String
            $columnValues: JSON
            $createLabelsIfMissing: Boolean
        ) {
            create_item(
                board_id: $boardId
                item_name: $itemName
                group_id: $groupId
                column_values: $columnValues
                create_labels_if_missing: $createLabelsIfMissing
            ) {
                id
                name
            }
        }`;
        let columnValues = params.column_values;
        if (columnValues && typeof columnValues === 'object') {
            columnValues = JSON.stringify(columnValues);
        }
        const variables = {
            boardId: String(params.board_id),
            itemName: params.item_name || params.name,
            groupId: params.group_id,
            columnValues,
            createLabelsIfMissing: params.create_labels_if_missing,
        };
        const data = await this.graphql(query, variables);
        return data ? data.create_item : undefined;
    }

    /**
     * Update multiple column values on an item.
     * Scope: boards:write
     * Docs: https://developer.monday.com/api-reference/reference/columns
     *
     * @param {object} params
     * @param {string|number} params.board_id
     * @param {string|number} params.item_id
     * @param {object|string} params.column_values
     * @param {boolean} [params.create_labels_if_missing]
     */
    async changeMultipleColumnValues(params = {}) {
        const query = `mutation ChangeMultipleColumnValues(
            $boardId: ID!
            $itemId: ID!
            $columnValues: JSON!
            $createLabelsIfMissing: Boolean
        ) {
            change_multiple_column_values(
                board_id: $boardId
                item_id: $itemId
                column_values: $columnValues
                create_labels_if_missing: $createLabelsIfMissing
            ) {
                id
                name
            }
        }`;
        let columnValues = params.column_values;
        if (columnValues && typeof columnValues === 'object') {
            columnValues = JSON.stringify(columnValues);
        }
        const variables = {
            boardId: String(params.board_id),
            itemId: String(params.item_id),
            columnValues,
            createLabelsIfMissing: params.create_labels_if_missing,
        };
        const data = await this.graphql(query, variables);
        return data ? data.change_multiple_column_values : undefined;
    }

    /**
     * Delete an item.
     * Scope: boards:write
     * Docs: https://developer.monday.com/api-reference/reference/items
     */
    async deleteItem(itemId) {
        const query = `mutation DeleteItem($itemId: ID!) {
            delete_item(item_id: $itemId) {
                id
            }
        }`;
        const data = await this.graphql(query, { itemId: String(itemId) });
        return data ? data.delete_item : undefined;
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * List webhooks for a board.
     * Scope: webhooks:read
     * Docs: https://developer.monday.com/api-reference/reference/webhooks
     *
     * @param {object} params
     * @param {string|number} params.board_id
     * @param {boolean} [params.app_webhooks_only]
     */
    async listWebhooks(params = {}) {
        const query = `query ListWebhooks($boardId: ID!, $appWebhooksOnly: Boolean) {
            webhooks(board_id: $boardId, app_webhooks_only: $appWebhooksOnly) {
                id
                board_id
                event
                config
            }
        }`;
        const variables = {
            boardId: String(params.board_id),
            appWebhooksOnly: params.app_webhooks_only,
        };
        const data = await this.graphql(query, variables);
        return data ? data.webhooks : undefined;
    }

    /**
     * Create a board webhook.
     * Scope: webhooks:write
     * Docs: https://developer.monday.com/api-reference/reference/webhooks
     *
     * monday POSTs a `{ challenge }` JSON body to `url` for verification —
     * the receiver must echo `{ challenge }` back.
     *
     * @param {object} params
     * @param {string|number} params.board_id
     * @param {string} params.url
     * @param {string} params.event - WebhookEventType enum
     * @param {object|string} [params.config]
     */
    async createWebhook(params = {}) {
        const query = `mutation CreateWebhook(
            $boardId: ID!
            $url: String!
            $event: WebhookEventType!
            $config: JSON
        ) {
            create_webhook(
                board_id: $boardId
                url: $url
                event: $event
                config: $config
            ) {
                id
                board_id
                event
                config
            }
        }`;
        let config = params.config;
        if (config && typeof config === 'object') {
            config = JSON.stringify(config);
        }
        const variables = {
            boardId: String(params.board_id),
            url: params.url,
            event: params.event,
            config,
        };
        const data = await this.graphql(query, variables);
        return data ? data.create_webhook : undefined;
    }

    /**
     * Delete a webhook by id.
     * Scope: webhooks:write
     */
    async deleteWebhook(webhookId) {
        const query = `mutation DeleteWebhook($id: ID!) {
            delete_webhook(id: $id) {
                id
                board_id
            }
        }`;
        const data = await this.graphql(query, { id: String(webhookId) });
        return data ? data.delete_webhook : undefined;
    }

    /**
     * Verify a monday integration webhook JWT (Authorization header) against
     * the app Signing Secret. Challenge POSTs have no JWT — callers should
     * handle `{ challenge }` before calling this.
     *
     * Docs: https://developer.monday.com/api-reference/reference/webhooks
     *       ("Authenticating requests")
     *
     * @param {object} args
     * @param {object} [args.headers]
     * @param {string} [args.authorization] - raw Authorization header value
     * @param {string} [args.signingSecret]
     * @returns {{ valid: boolean, payload?: object, reason?: string }}
     */
    verifyWebhookSignature({
        headers,
        authorization,
        signingSecret,
    } = {}) {
        const secret = signingSecret || this.signingSecret;
        const auth =
            authorization ||
            getHeader(headers, 'Authorization') ||
            getHeader(headers, 'authorization');
        return verifyHs256Jwt(auth, secret);
    }
}

module.exports = { Api, verifyHs256Jwt };
