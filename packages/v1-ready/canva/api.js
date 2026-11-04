const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Canva Connect API client.
 *
 * Auth: OAuth 2.0 authorization code + PKCE (S256) + refresh tokens.
 *   Authorize: https://www.canva.com/api/oauth/authorize
 *   Token:     POST https://api.canva.com/rest/v1/oauth/token  (Basic Auth recommended)
 *
 * Base URL: https://api.canva.com/rest  (paths are /v1/...)
 * Official OpenAPI: https://www.canva.dev/sources/connect/api/latest/api.yml
 * Docs: https://www.canva.dev/docs/connect/
 *
 * China region: use https://api.canva.cn/rest and https://www.canva.cn/api
 * via CANVA_BASE_URL / CANVA_AUTH_BASE_URL if needed.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'base_url', null) ||
            'https://api.canva.com/rest';

        this.authBaseUrl =
            get(params, 'authBaseUrl', null) ||
            get(params, 'auth_base_url', null) ||
            'https://www.canva.com/api';

        this.tokenUri = `${this.baseUrl}/v1/oauth/token`;

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
        this.code_verifier = get(params, 'code_verifier', null);

        // Default scopes cover identity + core objects used by Left Hook's v1
        // canva-connect module (comments/imports/brand templates included).
        // Callers should override via env CANVA_SCOPE / CANVA_CONNECT_SCOPE.
        if (!this.scope) {
            this.scope =
                'openid profile email profile:read design:meta:read design:content:read design:content:write folder:read folder:write asset:read asset:write comment:read comment:write brandtemplate:meta:read collaboration:event';
        }

        this.URLs = {
            usersMe: '/v1/users/me',
            userProfile: '/v1/users/me/profile',
            userCapabilities: '/v1/users/me/capabilities',
            userInfo: '/v1/oidc/userinfo',
            designs: '/v1/designs',
            designById: (designId) => `/v1/designs/${designId}`,
            designComments: (designId) => `/v1/designs/${designId}/comments`,
            designThread: (designId, threadId) =>
                `/v1/designs/${designId}/comments/${threadId}`,
            designReplies: (designId, threadId) =>
                `/v1/designs/${designId}/comments/${threadId}/replies`,
            designReply: (designId, threadId, replyId) =>
                `/v1/designs/${designId}/comments/${threadId}/replies/${replyId}`,
            exports: '/v1/exports',
            exportById: (exportId) => `/v1/exports/${exportId}`,
            imports: '/v1/imports',
            importById: (jobId) => `/v1/imports/${jobId}`,
            generations: '/v1/generations',
            generationById: (jobId) => `/v1/generations/${jobId}`,
            folders: '/v1/folders',
            folderById: (folderId) => `/v1/folders/${folderId}`,
            folderItems: (folderId) => `/v1/folders/${folderId}/items`,
            folderMove: '/v1/folders/move',
            assetById: (assetId) => `/v1/assets/${assetId}`,
            assetUploads: '/v1/asset-uploads',
            assetUploadById: (jobId) => `/v1/asset-uploads/${jobId}`,
            comments: '/v1/comments',
            brandTemplates: '/v1/brand-templates',
            brandTemplateById: (id) => `/v1/brand-templates/${id}`,
            oauthToken: '/v1/oauth/token',
            oauthIntrospect: '/v1/oauth/introspect',
            oauthRevoke: '/v1/oauth/revoke',
            connectKeys: '/v1/connect/keys',
        };

        this._rebuildAuthorizationUri();
    }

    _rebuildAuthorizationUri(codeChallenge) {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            scope: this.scope || '',
            code_challenge_method: 'S256',
        });
        if (this.state) params.set('state', this.state);
        if (codeChallenge) params.set('code_challenge', codeChallenge);
        this.authorizationUri = `${this.authBaseUrl}/oauth/authorize?${params.toString()}`;
        return this.authorizationUri;
    }

    /**
     * Generate a PKCE code_verifier / code_challenge pair (S256).
     * Stores code_verifier on the instance for a subsequent token exchange.
     * Docs: https://www.canva.dev/docs/connect/authentication/
     */
    generatePkce() {
        const codeVerifier = crypto.randomBytes(96).toString('base64url');
        const codeChallenge = crypto
            .createHash('sha256')
            .update(codeVerifier)
            .digest('base64url');
        this.code_verifier = codeVerifier;
        return { codeVerifier, codeChallenge };
    }

    /**
     * Build the authorization URL. Generates PKCE if no code_challenge given.
     * @param {object} [params]
     * @param {string} [params.code_challenge] - Precomputed S256 challenge
     * @param {string} [params.code_verifier] - Store for later token exchange
     * @param {string} [params.state]
     */
    getAuthUri(params = {}) {
        if (params.state) this.state = params.state;
        if (params.code_verifier) this.code_verifier = params.code_verifier;

        let codeChallenge = params.code_challenge;
        if (!codeChallenge) {
            codeChallenge = this.generatePkce().codeChallenge;
        }
        return this._rebuildAuthorizationUri(codeChallenge);
    }

    getAuthorizationUri() {
        return this.getAuthUri();
    }

    getAuthorizationRequirements() {
        const url = this.getAuthUri();
        return {
            url,
            type: 'oauth2',
            // Caller must persist code_verifier alongside state for the callback.
            code_verifier: this.code_verifier,
        };
    }

    _basicAuthHeader() {
        return `Basic ${Buffer.from(
            `${this.client_id}:${this.client_secret}`
        ).toString('base64')}`;
    }

    /**
     * Exchange an authorization code for tokens (PKCE + Basic Auth).
     * Official operationId: exchangeAccessToken (grant_type=authorization_code)
     *
     * @param {string} code
     * @param {string} [codeVerifier] - Defaults to this.code_verifier
     */
    async getTokenFromCode(code, codeVerifier) {
        const verifier = codeVerifier || this.code_verifier;
        if (!verifier) {
            throw new Error(
                'Canva OAuth requires code_verifier (PKCE). Pass it to getTokenFromCode or set api.code_verifier from the authorize step.'
            );
        }
        // Don't send a stale Bearer token on the token endpoint.
        delete this.access_token;

        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('code_verifier', verifier);
        params.append('redirect_uri', this.redirect_uri);

        const response = await this._post(
            {
                url: this.tokenUri,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: this._basicAuthHeader(),
                },
                body: params,
            },
            false
        );
        await this.setTokens(response);
        return response;
    }

    /**
     * Refresh the access token (Basic Auth). Each refresh_token is single-use.
     * Official operationId: exchangeAccessToken (grant_type=refresh_token)
     */
    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append(
            'refresh_token',
            refreshTokenObject.refresh_token || this.refresh_token
        );

        const response = await this._post(
            {
                url: this.tokenUri,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: this._basicAuthHeader(),
                },
                body: params,
            },
            false
        );
        await this.setTokens(response);
        return response;
    }

    /**
     * Alias matching the OpenAPI operationId exchangeAccessToken.
     * Body must include grant_type=authorization_code|refresh_token.
     */
    async exchangeAccessToken(body = {}) {
        if (body.grant_type === 'refresh_token') {
            return this.refreshAccessToken(body);
        }
        return this.getTokenFromCode(body.code, body.code_verifier);
    }

    addJsonHeaders(options) {
        options.headers = {
            Accept: 'application/json',
            ...options.headers,
        };
        if (
            options.body &&
            !(options.body instanceof URLSearchParams) &&
            !Buffer.isBuffer(options.body) &&
            typeof options.body !== 'string'
        ) {
            options.headers['Content-Type'] =
                options.headers['Content-Type'] || 'application/json';
        }
    }

    async _get(options) {
        this.addJsonHeaders(options);
        return super._get(options);
    }

    async _post(options, stringify) {
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    async _patch(options, stringify) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    async _delete(options) {
        this.addJsonHeaders(options);
        return super._delete(options);
    }

    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                // Canva folder item_types uses a comma-delimited list.
                usp.append(key, value.join(','));
            } else {
                usp.append(key, String(value));
            }
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Get the current user + team summary.
     * GET /v1/users/me — operationId usersMe
     * Response: { team_user: { user_id, team_id } }
     */
    async usersMe() {
        return this._get({ url: this.baseUrl + this.URLs.usersMe });
    }

    /**
     * Get the current user's profile display name.
     * GET /v1/users/me/profile — operationId getUserProfile
     * Scope: profile:read
     */
    async getUserProfile() {
        return this._get({ url: this.baseUrl + this.URLs.userProfile });
    }

    /**
     * OIDC userinfo (sub, name, email, …).
     * GET /v1/oidc/userinfo — operationId userInfo
     * Scopes: openid + profile and/or email
     */
    async userInfo() {
        return this._get({ url: this.baseUrl + this.URLs.userInfo });
    }

    /**
     * v1 Lefthook alias: return team_user from usersMe.
     */
    async getMe() {
        const me = await this.usersMe();
        return me?.team_user || me;
    }

    /**
     * GET /v1/users/me/capabilities — operationId getUserCapabilities
     * Scope: profile:read
     */
    async getUserCapabilities() {
        return this._get({ url: this.baseUrl + this.URLs.userCapabilities });
    }

    /**
     * Identity used by Left Hook's v1 Manager (`getTokenIdentity`):
     * introspect the access token and take `sub` as the stable external id.
     */
    async getTokenIdentity() {
        const user = await this.introspectToken(this.access_token);
        if (!user?.sub) {
            throw new Error(
                'Canva: introspectToken did not return sub for token identity.'
            );
        }
        return { identifier: user.sub, name: user.sub, user };
    }

    /**
     * Prefer v1-compatible introspect `sub`, enrich with usersMe team + profile.
     * Falls back to usersMe / OIDC userInfo if introspect is unavailable.
     */
    async getUserDetails() {
        let fromIntrospect = null;
        try {
            const identity = await this.getTokenIdentity();
            fromIntrospect = {
                id: identity.identifier,
                user_id: identity.identifier,
                sub: identity.identifier,
                name: identity.name,
                introspect: identity.user,
            };
        } catch (e) {
            // fall through
        }

        try {
            const me = await this.usersMe();
            const teamUser = me?.team_user;
            if (teamUser?.user_id) {
                let displayName;
                try {
                    const profile = await this.getUserProfile();
                    displayName = profile?.profile?.display_name;
                } catch (e) {
                    // profile:read may not be granted
                }
                return {
                    id: fromIntrospect?.id || teamUser.user_id,
                    user_id: fromIntrospect?.id || teamUser.user_id,
                    sub: fromIntrospect?.sub,
                    team_id: teamUser.team_id,
                    name:
                        displayName ||
                        fromIntrospect?.name ||
                        teamUser.user_id,
                    team_user: teamUser,
                    introspect: fromIntrospect?.introspect,
                };
            }
        } catch (e) {
            // fall through
        }

        if (fromIntrospect) return fromIntrospect;

        const info = await this.userInfo();
        return {
            id: info.sub,
            user_id: info.sub,
            sub: info.sub,
            name: info.name || info.email || info.sub,
            email: info.email,
            ...info,
        };
    }

    async _basicAuthFormPost(url, params) {
        // Temporarily clear Bearer so only Basic Auth is sent (token endpoints).
        const saved = this.access_token;
        this.access_token = undefined;
        try {
            return await this._post(
                {
                    url,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        Authorization: this._basicAuthHeader(),
                    },
                    body: params,
                },
                false
            );
        } finally {
            this.access_token = saved;
        }
    }

    /**
     * Introspect an access or refresh token.
     * POST /v1/oauth/introspect — operationId introspectToken
     * @param {string} [token] - defaults to current access_token
     */
    async introspectToken(token) {
        const params = new URLSearchParams();
        params.append('token', token || this.access_token);
        return this._basicAuthFormPost(
            this.baseUrl + this.URLs.oauthIntrospect,
            params
        );
    }

    /** @deprecated typo alias from Left Hook v1 */
    async instrospectToken(token) {
        return this.introspectToken(token);
    }

    /**
     * Revoke an access or refresh token.
     * POST /v1/oauth/revoke — operationId revokeTokens
     * @param {string} [token] - defaults to refresh_token (v1 behavior)
     */
    async revokeTokens(token) {
        const params = new URLSearchParams();
        params.append('token', token || this.refresh_token);
        return this._basicAuthFormPost(
            this.baseUrl + this.URLs.oauthRevoke,
            params
        );
    }

    /** v1 alias */
    async revokeToken(token) {
        return this.revokeTokens(token);
    }

    /** v1 alias for getTokenFromCode */
    async getTokenFromCodeVerifier(code, codeVerifier) {
        return this.getTokenFromCode(code, codeVerifier);
    }

    // ---- Designs -----------------------------------------------------------

    /**
     * List designs.
     * GET /v1/designs — operationId listDesigns
     * Scope: design:meta:read
     * Query: query, continuation, ownership, sort_by, limit
     */
    async listDesigns(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.designs + this._buildQuery(params),
        });
    }

    /**
     * Get a design by id.
     * GET /v1/designs/{designId} — operationId getDesign
     * Scope: design:meta:read
     */
    async getDesign(designId) {
        return this._get({
            url: this.baseUrl + this.URLs.designById(designId),
        });
    }

    /**
     * Create a design.
     * POST /v1/designs — operationId createDesign
     * Scope: design:content:write
     * Body: CreateDesignRequest (type_and_asset | design | brand_template)
     */
    async createDesign(data) {
        return this._post({
            url: this.baseUrl + this.URLs.designs,
            body: data,
        });
    }

    /**
     * Start a design export job.
     * POST /v1/exports — operationId createDesignExportJob
     * Scope: design:content:read
     * Body: { design_id, format }
     */
    async createDesignExportJob(data) {
        return this._post({
            url: this.baseUrl + this.URLs.exports,
            body: data,
        });
    }

    /**
     * Get a design export job (poll until success/failed).
     * GET /v1/exports/{exportId} — operationId getDesignExportJob
     * Scope: design:content:read
     */
    async getDesignExportJob(exportId) {
        return this._get({
            url: this.baseUrl + this.URLs.exportById(exportId),
        });
    }

    // ---- Folders -----------------------------------------------------------

    /**
     * Create a folder.
     * POST /v1/folders — operationId createFolder
     * Scope: folder:write
     * Body: { name, parent_folder_id }  (use "root" for Projects top-level)
     */
    async createFolder(data) {
        return this._post({
            url: this.baseUrl + this.URLs.folders,
            body: data,
        });
    }

    /**
     * Get a folder by id.
     * GET /v1/folders/{folderId} — operationId getFolder
     * Scope: folder:read
     */
    async getFolder(folderId) {
        return this._get({
            url: this.baseUrl + this.URLs.folderById(folderId),
        });
    }

    /**
     * Update a folder (rename).
     * PATCH /v1/folders/{folderId} — operationId updateFolder
     * Scope: folder:write
     * Body: { name }
     */
    async updateFolder(folderId, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.folderById(folderId),
            body: data,
        });
    }

    /**
     * Delete a folder.
     * DELETE /v1/folders/{folderId} — operationId deleteFolder
     * Scope: folder:write
     */
    async deleteFolder(folderId) {
        return this._delete({
            url: this.baseUrl + this.URLs.folderById(folderId),
        });
    }

    /**
     * List items in a folder.
     * GET /v1/folders/{folderId}/items — operationId listFolderItems
     * Scope: folder:read
     * Query: continuation, limit, item_types, sort_by, pin_status
     */
    async listFolderItems(folderId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.folderItems(folderId) +
                this._buildQuery(params),
        });
    }

    /**
     * Move a folder item (design/folder/asset) into another folder.
     * POST /v1/folders/move — operationId moveFolderItem
     * Scope: folder:write
     * Body: { to_folder_id, item_id }
     */
    async moveFolderItem(data) {
        return this._post({
            url: this.baseUrl + this.URLs.folderMove,
            body: data,
        });
    }

    // ---- Assets ------------------------------------------------------------

    /**
     * Get asset metadata.
     * GET /v1/assets/{assetId} — operationId getAsset
     * Scope: asset:read
     */
    async getAsset(assetId) {
        return this._get({
            url: this.baseUrl + this.URLs.assetById(assetId),
        });
    }

    /**
     * Update asset name/tags.
     * PATCH /v1/assets/{assetId} — operationId updateAsset
     * Scope: asset:write
     * Body: { name?, tags? }
     */
    async updateAsset(assetId, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.assetById(assetId),
            body: data,
        });
    }

    /**
     * Delete an asset.
     * DELETE /v1/assets/{assetId} — operationId deleteAsset
     * Scope: asset:write
     */
    async deleteAsset(assetId) {
        return this._delete({
            url: this.baseUrl + this.URLs.assetById(assetId),
        });
    }

    /**
     * Create an asset upload job (binary body + Asset-Upload-Metadata header).
     * POST /v1/asset-uploads — operationId createAssetUploadJob
     * Scope: asset:write
     *
     * @param {Buffer|string} binary - File bytes
     * @param {object} metadata - JSON for Asset-Upload-Metadata header.
     *   Official schema requires `name_base64` only
     *   (https://www.canva.dev/sources/connect/api/latest/api.yml AssetUploadMetadata).
     */
    async createAssetUploadJob(binary, metadata) {
        const metaHeader =
            typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
        return this._post(
            {
                url: this.baseUrl + this.URLs.assetUploads,
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Asset-Upload-Metadata': metaHeader,
                },
                body: binary,
            },
            false
        );
    }

    /**
     * Get an asset upload job.
     * GET /v1/asset-uploads/{jobId} — operationId getAssetUploadJob
     * Scope: asset:read
     */
    async getAssetUploadJob(jobId) {
        return this._get({
            url: this.baseUrl + this.URLs.assetUploadById(jobId),
        });
    }

    // ---- Design import (v1 importDesign / getDesignImportJob) ---------------

    /**
     * Create a design import job (binary + Import-Metadata header).
     * POST /v1/imports — operationId createDesignImportJob
     * Scope: design:content:write
     *
     * @param {Buffer|string} binary
     * @param {object|string} metadata - Import-Metadata JSON or object
     *   (official ImportMetadata; v1 passed `{ title_base64 }`)
     */
    async createDesignImportJob(binary, metadata) {
        const metaHeader =
            typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
        return this._post(
            {
                url: this.baseUrl + this.URLs.imports,
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Import-Metadata': metaHeader,
                },
                body: binary,
            },
            false
        );
    }

    /**
     * Get a design import job.
     * GET /v1/imports/{jobId} — operationId getDesignImportJob
     * Scope: design:content:write
     */
    async getDesignImportJob(jobId) {
        return this._get({
            url: this.baseUrl + this.URLs.importById(jobId),
        });
    }

    /**
     * v1 helper: import a file with a plain title (Base64-encoded into metadata).
     */
    async importDesign(buffer, title) {
        return this.createDesignImportJob(buffer, {
            title_base64: Buffer.from(String(title)).toString('base64'),
        });
    }

    // ---- Design generation (v1 /v1/designs/generate → official /v1/generations)

    /**
     * Create a design generation job (preview API).
     * POST /v1/generations — operationId createDesignGenerationJobV2
     * Scope: design:content:write
     */
    async createDesignGenerationJobV2(data) {
        return this._post({
            url: this.baseUrl + this.URLs.generations,
            body: data,
        });
    }

    /**
     * Get a design generation job (preview API).
     * GET /v1/generations/{jobId} — operationId getDesignGenerationJobV2
     */
    async getDesignGenerationJobV2(jobId) {
        return this._get({
            url: this.baseUrl + this.URLs.generationById(jobId),
        });
    }

    /** v1 alias: generateDesign({ query }) → createDesignGenerationJobV2 */
    async generateDesign(body) {
        return this.createDesignGenerationJobV2(body);
    }

    /** v1 alias: getGenerateDesignJobStatus({ jobId }) */
    async getGenerateDesignJobStatus(params = {}) {
        return this.getDesignGenerationJobV2(params.jobId || params);
    }

    // ---- Comments (v1 createComment / replies; official thread model) -------

    /**
     * Create a comment (preview API).
     * POST /v1/comments — operationId createComment
     * Scope: comment:write
     */
    async createComment(data) {
        return this._post({
            url: this.baseUrl + this.URLs.comments,
            body: data,
        });
    }

    /**
     * Create a comment thread on a design (preview API).
     * POST /v1/designs/{designId}/comments — operationId createThread
     */
    async createThread(designId, data) {
        return this._post({
            url: this.baseUrl + this.URLs.designComments(designId),
            body: data,
        });
    }

    /**
     * Get a comment thread (preview API).
     * GET /v1/designs/{designId}/comments/{threadId} — operationId getThread
     * Replaces v1 getDesignCommentByCommentId.
     */
    async getThread(designId, threadId) {
        return this._get({
            url: this.baseUrl + this.URLs.designThread(designId, threadId),
        });
    }

    /** v1 alias */
    async getDesignCommentByCommentId(designId, commentId) {
        return this.getThread(designId, commentId);
    }

    /**
     * List replies on a thread (preview API).
     * GET .../replies — operationId listReplies
     */
    async listReplies(designId, threadId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.designReplies(designId, threadId) +
                this._buildQuery(params),
        });
    }

    /**
     * Create a reply on a thread (preview API).
     * POST .../replies — operationId createReply
     * Replaces v1 createCommentReply (which posted to /v1/comments/{id}/replies).
     */
    async createReply(designId, threadId, data) {
        return this._post({
            url: this.baseUrl + this.URLs.designReplies(designId, threadId),
            body: data,
        });
    }

    /**
     * Get a reply (preview API).
     * GET .../replies/{replyId} — operationId getReply
     */
    async getReply(designId, threadId, replyId) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.designReply(designId, threadId, replyId),
        });
    }

    /**
     * v1-shaped reply helper. Requires designId (official path); pass as
     * data.design_id or data.attached_to.design_id when only commentId known.
     */
    async createCommentReply(body, commentId) {
        const designId =
            body?.design_id ||
            body?.attached_to?.design_id ||
            body?.designId;
        if (!designId) {
            throw new Error(
                'Canva createCommentReply requires design_id (official path is /v1/designs/{designId}/comments/{threadId}/replies).'
            );
        }
        const { design_id, designId: _d, attached_to, ...rest } = body || {};
        return this.createReply(designId, commentId, rest);
    }

    // ---- Brand templates (successor to v1 POST /v1/templates/search) -------

    /**
     * List brand templates.
     * GET /v1/brand-templates — operationId listBrandTemplates
     * Scope: brandtemplate:meta:read
     */
    async listBrandTemplates(params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.brandTemplates +
                this._buildQuery(params),
        });
    }

    /**
     * Get a brand template.
     * GET /v1/brand-templates/{brandTemplateId} — operationId getBrandTemplate
     */
    async getBrandTemplate(brandTemplateId) {
        return this._get({
            url: this.baseUrl + this.URLs.brandTemplateById(brandTemplateId),
        });
    }

    /**
     * v1 listCanvaTemplates({ query, limit }) → listBrandTemplates.
     * Official API has no POST /v1/templates/search.
     */
    async listCanvaTemplates(body = {}) {
        return this.listBrandTemplates({
            query: body.query,
            limit: body.limit,
            continuation: body.continuation,
            ownership: body.ownership,
            sort_by: body.sort_by || body.sortBy,
            dataset: body.dataset,
        });
    }

    // ---- v1 method-name aliases (behavior ports; not OpenAPI operationIds) --

    async getListDesigns(params = {}) {
        const mapped = { ...params };
        if (mapped.sortBy && !mapped.sort_by) mapped.sort_by = mapped.sortBy;
        delete mapped.sortBy;
        return this.listDesigns(mapped);
    }

    async getDesignById(designId) {
        return this.getDesign(designId);
    }

    async getListFolderItems(folderId, continuation = null) {
        const params =
            continuation && typeof continuation === 'object'
                ? continuation
                : continuation
                  ? { continuation }
                  : {};
        return this.listFolderItems(folderId, params);
    }

    async getFolderById(folderId) {
        return this.getFolder(folderId);
    }

    async getAssetById(assetId) {
        return this.getAsset(assetId);
    }

    /**
     * v1 uploadAsset → createAssetUploadJob.
     * Official path is POST /v1/asset-uploads (not /v1/assets/upload).
     * Metadata must use name_base64 (AssetUploadMetadata).
     */
    async uploadAsset(buffer, metadata = {}) {
        let meta = { ...metadata };
        if (meta.name && !meta.name_base64) {
            meta.name_base64 = Buffer.from(String(meta.name)).toString(
                'base64'
            );
            delete meta.name;
        }
        // parent_folder_id / tags are not part of AssetUploadMetadata in the
        // current official OpenAPI — strip so we don't invent header fields.
        delete meta.parent_folder_id;
        delete meta.tags;
        return this.createAssetUploadJob(buffer, meta);
    }

    // ---- Webhook verification (no subscription CRUD in Connect API) --------

    /**
     * Get Canva's public JWKS used to verify webhook signatures.
     * GET /v1/connect/keys — operationId getSigningPublicKeys
     * No OAuth required. Preview API per official OpenAPI warning.
     *
     * Canva does not offer programmatic webhook subscription CRUD; outbound
     * webhooks are configured in the Developer Portal and delivered when the
     * collaboration:event (+ related) scopes are granted.
     * Docs: https://www.canva.dev/docs/connect/webhooks/
     */
    async getSigningPublicKeys() {
        return this._get({ url: this.baseUrl + this.URLs.connectKeys });
    }
}

module.exports = { Api };
