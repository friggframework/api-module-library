const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Figma REST API client.
 *
 * Auth: OAuth 2 authorization-code (recommended for multi-user apps). Token
 * exchange and refresh use HTTP Basic (`client_id:client_secret`) against
 * `https://api.figma.com/v1/oauth/{token,refresh}`. Personal / plan access
 * tokens are also accepted as a Bearer `access_token` for local tooling.
 *
 * Base URL: https://api.figma.com
 * Docs: https://developers.figma.com/docs/rest-api/
 * Official OpenAPI: https://github.com/figma/rest-api-spec
 *
 * Method names match OpenAPI operationIds 1:1 (see figma.openapi.yaml).
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://api.figma.com';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        // OAuth 2 (authorization code). Scopes are space- or comma-separated
        // per https://developers.figma.com/docs/rest-api/oauth-apps/
        this.authorizationUri = encodeURI(
            `https://www.figma.com/oauth` +
                `?client_id=${this.client_id}` +
                `&redirect_uri=${this.redirect_uri}` +
                `&scope=${this.scope}` +
                `&state=${this.state}` +
                `&response_type=code`
        );
        this.tokenUri = 'https://api.figma.com/v1/oauth/token';
        this.refreshUri = 'https://api.figma.com/v1/oauth/refresh';

        this.URLs = {
            me: '/v1/me',
            file: (fileKey) => `/v1/files/${fileKey}`,
            fileMeta: (fileKey) => `/v1/files/${fileKey}/meta`,
            comments: (fileKey) => `/v1/files/${fileKey}/comments`,
            comment: (fileKey, commentId) =>
                `/v1/files/${fileKey}/comments/${commentId}`,
            teamProjects: (teamId) => `/v1/teams/${teamId}/projects`,
            projectFiles: (projectId) => `/v1/projects/${projectId}/files`,
            projectMeta: (projectId) => `/v1/projects/${projectId}/meta`,
            teamFolders: (teamId) => `/v2/teams/${teamId}/folders`,
            folderFiles: (folderId) => `/v2/folders/${folderId}/files`,
            folderMeta: (folderId) => `/v2/folders/${folderId}/meta`,
            webhooks: '/v2/webhooks',
            webhook: (webhookId) => `/v2/webhooks/${webhookId}`,
            teamWebhooks: (teamId) => `/v2/teams/${teamId}/webhooks`,
            webhookRequests: (webhookId) =>
                `/v2/webhooks/${webhookId}/requests`,
        };
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    /**
     * Exchange an authorization code for tokens.
     * Figma requires HTTP Basic client credentials on the token endpoint.
     * Auth codes expire 30 seconds after issue.
     */
    async getTokenFromCode(code) {
        delete this.access_token;
        return this.getTokenFromCodeBasicAuthHeader(code);
    }

    /**
     * Refresh an access token.
     * Figma uses a dedicated refresh URL (not the token URL) and Basic auth.
     * Body is only `refresh_token` (no grant_type).
     * Docs: https://developers.figma.com/docs/rest-api/oauth-apps/
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const refreshToken =
            get(refreshTokenObject, 'refresh_token', null) || this.refresh_token;
        if (!refreshToken) {
            throw new Error(
                'Figma refreshAccessToken requires a refresh_token'
            );
        }

        const params = new URLSearchParams();
        params.append('refresh_token', refreshToken);

        const options = {
            url: this.refreshUri,
            body: params,
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

    // ---- Users -------------------------------------------------------------

    /** GET /v1/me — current user (id, handle, img_url, email). */
    async getMe() {
        return this._get({ url: this.baseUrl + this.URLs.me });
    }

    // ---- Files -------------------------------------------------------------

    /**
     * GET /v1/files/{file_key}
     * Optional query: version, ids, depth, geometry, plugin_data, branch_data
     */
    async getFile(fileKey, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.file(fileKey),
            query,
        });
    }

    /** GET /v1/files/{file_key}/meta */
    async getFileMeta(fileKey) {
        return this._get({
            url: this.baseUrl + this.URLs.fileMeta(fileKey),
        });
    }

    // ---- Comments ----------------------------------------------------------

    /**
     * GET /v1/files/{file_key}/comments
     * Optional query: as_md (boolean)
     */
    async getComments(fileKey, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.comments(fileKey),
            query,
        });
    }

    /**
     * POST /v1/files/{file_key}/comments
     * Body: { message, client_meta?, comment_id? }
     * There is no update-comment endpoint in the public REST API.
     */
    async postComment(fileKey, data) {
        return this._post({
            url: this.baseUrl + this.URLs.comments(fileKey),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** DELETE /v1/files/{file_key}/comments/{comment_id} */
    async deleteComment(fileKey, commentId) {
        return this._delete({
            url: this.baseUrl + this.URLs.comment(fileKey, commentId),
        });
    }

    // ---- Projects (legacy; prefer folders) ---------------------------------

    /** GET /v1/teams/{team_id}/projects */
    async getTeamProjects(teamId) {
        return this._get({
            url: this.baseUrl + this.URLs.teamProjects(teamId),
        });
    }

    /**
     * GET /v1/projects/{project_id}/files
     * Optional query: branch_data
     */
    async getProjectFiles(projectId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.projectFiles(projectId),
            query,
        });
    }

    /** GET /v1/projects/{project_id}/meta */
    async getProjectMeta(projectId) {
        return this._get({
            url: this.baseUrl + this.URLs.projectMeta(projectId),
        });
    }

    // ---- Folders (replaces projects) ---------------------------------------

    /** GET /v2/teams/{team_id}/folders */
    async getTeamFolders(teamId) {
        return this._get({
            url: this.baseUrl + this.URLs.teamFolders(teamId),
        });
    }

    /** GET /v2/folders/{folder_id}/files */
    async getFolderFiles(folderId) {
        return this._get({
            url: this.baseUrl + this.URLs.folderFiles(folderId),
        });
    }

    /** GET /v2/folders/{folder_id}/meta */
    async getFolderMeta(folderId) {
        return this._get({
            url: this.baseUrl + this.URLs.folderMeta(folderId),
        });
    }

    // ---- Webhooks V2 -------------------------------------------------------

    /**
     * GET /v2/webhooks
     * Query: context + context_id, or plan_api_id (+ optional cursor)
     */
    async getWebhooks(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.webhooks,
            query,
        });
    }

    /**
     * POST /v2/webhooks
     * Body requires event_type, endpoint, passcode, context, context_id.
     */
    async postWebhook(data) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** GET /v2/webhooks/{webhook_id} */
    async getWebhook(webhookId) {
        return this._get({
            url: this.baseUrl + this.URLs.webhook(webhookId),
        });
    }

    /** PUT /v2/webhooks/{webhook_id} */
    async putWebhook(webhookId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.webhook(webhookId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /** DELETE /v2/webhooks/{webhook_id} */
    async deleteWebhook(webhookId) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhook(webhookId),
        });
    }

    /** GET /v2/teams/{team_id}/webhooks */
    async getTeamWebhooks(teamId) {
        return this._get({
            url: this.baseUrl + this.URLs.teamWebhooks(teamId),
        });
    }

    /** GET /v2/webhooks/{webhook_id}/requests */
    async getWebhookRequests(webhookId) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookRequests(webhookId),
        });
    }
}

module.exports = { Api };
