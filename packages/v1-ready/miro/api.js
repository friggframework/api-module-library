const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Miro REST API client (Developer Platform v2).
 *
 * Auth: OAuth 2.0 authorization-code. Access tokens are sent as
 * `Authorization: Bearer <token>`. Apps may use expiring tokens (1h access +
 * 60d refresh) or non-expiring tokens — chosen at app creation and immutable.
 *
 * Base URL: https://api.miro.com
 * REST:     /v2/...
 * Token context: GET /v1/oauth-token
 * OAuth authorize: https://miro.com/oauth/authorize
 * OAuth token:     https://api.miro.com/v1/oauth/token
 *
 * Official OpenAPI: https://github.com/miroapp/api-clients/blob/main/packages/generator/spec.json
 * Docs: https://developers.miro.com/reference/overview
 * OAuth: https://developers.miro.com/docs/getting-started-with-oauth
 *
 * Experimental board webhooks (`/v2-experimental/webhooks/board_subscriptions`)
 * were retired effective 2025-12-05 and are intentionally not implemented.
 * https://developers.miro.com/changelog/removed-experimental-webhooks-support
 */

const API_BASE = 'https://api.miro.com';
const AUTH_BASE = 'https://miro.com/oauth/authorize';
const TOKEN_URI = 'https://api.miro.com/v1/oauth/token';

const DEFAULT_SCOPES = ['boards:read', 'boards:write'].join(' ');

class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = API_BASE;
        this.tokenUri = TOKEN_URI;

        this.scope =
            this.scope || process.env.MIRO_SCOPE || DEFAULT_SCOPES;

        this.client_id =
            this.client_id || process.env.MIRO_CLIENT_ID || null;
        this.client_secret =
            this.client_secret || process.env.MIRO_CLIENT_SECRET || null;
        this.redirect_uri =
            this.redirect_uri ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/miro`
                : null);

        // Miro supports expiring tokens with refresh; enable refresh by default.
        // Non-expiring apps simply never receive a refresh_token.
        this.isRefreshable = true;

        this.access_token =
            get(params, 'access_token', null) || this.access_token || null;
        this.refresh_token =
            get(params, 'refresh_token', null) || this.refresh_token || null;

        this.URLs = {
            tokenInfo: '/v1/oauth-token',
            boards: '/v2/boards',
            boardById: (boardId) => `/v2/boards/${boardId}`,
            boardItems: (boardId) => `/v2/boards/${boardId}/items`,
            boardItemById: (boardId, itemId) =>
                `/v2/boards/${boardId}/items/${itemId}`,
            stickyNotes: (boardId) => `/v2/boards/${boardId}/sticky_notes`,
            stickyNoteById: (boardId, itemId) =>
                `/v2/boards/${boardId}/sticky_notes/${itemId}`,
            boardMembers: (boardId) => `/v2/boards/${boardId}/members`,
        };

        this.authorizationUri = this._buildAuthorizationUri();
    }

    _buildAuthorizationUri() {
        const clientId = this.client_id || '';
        const redirect = this.redirect_uri || '';
        const state = this.state || '';
        // Miro scopes are selected in the app settings UI; the authorize URL
        // does not take a scope query param in the documented flow.
        return encodeURI(
            `${AUTH_BASE}?response_type=code` +
                `&client_id=${clientId}` +
                `&redirect_uri=${redirect}` +
                (state ? `&state=${state}` : '')
        );
    }

    getAuthUri() {
        return this.authorizationUri;
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
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    async _patch(options, stringify) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    async _put(options, stringify) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    // ---- Auth / identity ---------------------------------------------------

    /**
     * Get access token context (user, team, organization, scopes).
     * GET /v1/oauth-token
     * Official operationId: token-info
     */
    async getTokenInfo() {
        return this._get({
            url: this.baseUrl + this.URLs.tokenInfo,
        });
    }

    // ---- Boards ------------------------------------------------------------

    /**
     * List boards the token can access.
     * GET /v2/boards
     * Official operationId: get-boards
     *
     * Optional query: team_id, project_id, query, owner, limit, offset, sort
     */
    async listBoards(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.boards,
            query,
        });
    }

    /**
     * Create a board.
     * POST /v2/boards
     * Official operationId: create-board
     *
     * body: BoardChanges — { name?, description?, teamId?, policy?, ... }
     */
    async createBoard(body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.boards,
            body,
        });
    }

    /**
     * Get a specific board.
     * GET /v2/boards/{board_id}
     * Official operationId: get-specific-board
     */
    async getBoard(boardId) {
        return this._get({
            url: this.baseUrl + this.URLs.boardById(boardId),
        });
    }

    /**
     * Update a board.
     * PATCH /v2/boards/{board_id}
     * Official operationId: update-board
     */
    async updateBoard(boardId, body = {}) {
        return this._patch({
            url: this.baseUrl + this.URLs.boardById(boardId),
            body,
        });
    }

    /**
     * Delete a board.
     * DELETE /v2/boards/{board_id}
     * Official operationId: delete-board
     */
    async deleteBoard(boardId) {
        return this._delete({
            url: this.baseUrl + this.URLs.boardById(boardId),
        });
    }

    // ---- Board items -------------------------------------------------------

    /**
     * List items on a board (cursor-paginated).
     * GET /v2/boards/{board_id}/items
     * Official operationId: get-items
     *
     * Optional query: limit, type, cursor
     */
    async listBoardItems(boardId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.boardItems(boardId),
            query,
        });
    }

    /**
     * Get a specific item on a board.
     * GET /v2/boards/{board_id}/items/{item_id}
     * Official operationId: get-specific-item
     */
    async getBoardItem(boardId, itemId) {
        return this._get({
            url: this.baseUrl + this.URLs.boardItemById(boardId, itemId),
        });
    }

    // ---- Sticky notes ------------------------------------------------------

    /**
     * Create a sticky note item on a board.
     * POST /v2/boards/{board_id}/sticky_notes
     * Official operationId: create-sticky-note-item
     *
     * body: StickyNoteCreateRequest — { data?, style?, position?, geometry?, parent? }
     */
    async createStickyNote(boardId, body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.stickyNotes(boardId),
            body,
        });
    }

    /**
     * Get a sticky note item.
     * GET /v2/boards/{board_id}/sticky_notes/{item_id}
     * Official operationId: get-sticky-note-item
     */
    async getStickyNote(boardId, itemId) {
        return this._get({
            url: this.baseUrl + this.URLs.stickyNoteById(boardId, itemId),
        });
    }

    /**
     * Update a sticky note item.
     * PATCH /v2/boards/{board_id}/sticky_notes/{item_id}
     * Official operationId: update-sticky-note-item
     */
    async updateStickyNote(boardId, itemId, body = {}) {
        return this._patch({
            url: this.baseUrl + this.URLs.stickyNoteById(boardId, itemId),
            body,
        });
    }

    /**
     * Delete a sticky note item.
     * DELETE /v2/boards/{board_id}/sticky_notes/{item_id}
     * Official operationId: delete-sticky-note-item
     */
    async deleteStickyNote(boardId, itemId) {
        return this._delete({
            url: this.baseUrl + this.URLs.stickyNoteById(boardId, itemId),
        });
    }

    // ---- Board members -----------------------------------------------------

    /**
     * List members of a board.
     * GET /v2/boards/{board_id}/members
     * Official operationId: get-board-members
     *
     * Optional query: limit, offset
     */
    async listBoardMembers(boardId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.boardMembers(boardId),
            query,
        });
    }
}

module.exports = { Api };
