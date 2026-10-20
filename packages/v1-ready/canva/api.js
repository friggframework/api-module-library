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

        // Default scopes cover identity + core design/folder/asset objects.
        // Callers should override via env CANVA_SCOPE to match Developer Portal.
        if (!this.scope) {
            this.scope =
                'openid profile email profile:read design:meta:read design:content:read design:content:write folder:read folder:write asset:read asset:write collaboration:event';
        }

        this.URLs = {
            usersMe: '/v1/users/me',
            userProfile: '/v1/users/me/profile',
            userInfo: '/v1/oidc/userinfo',
            designs: '/v1/designs',
            designById: (designId) => `/v1/designs/${designId}`,
            exports: '/v1/exports',
            exportById: (exportId) => `/v1/exports/${exportId}`,
            folders: '/v1/folders',
            folderById: (folderId) => `/v1/folders/${folderId}`,
            folderItems: (folderId) => `/v1/folders/${folderId}/items`,
            folderMove: '/v1/folders/move',
            assetById: (assetId) => `/v1/assets/${assetId}`,
            assetUploads: '/v1/asset-uploads',
            assetUploadById: (jobId) => `/v1/asset-uploads/${jobId}`,
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
     * Convenience: prefer usersMe identity; fall back to OIDC userInfo.
     */
    async getUserDetails() {
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
                    id: teamUser.user_id,
                    user_id: teamUser.user_id,
                    team_id: teamUser.team_id,
                    name: displayName || teamUser.user_id,
                    team_user: teamUser,
                };
            }
        } catch (e) {
            // fall through to OIDC
        }
        const info = await this.userInfo();
        return {
            id: info.sub,
            user_id: info.sub,
            name: info.name || info.email || info.sub,
            email: info.email,
            ...info,
        };
    }

    /**
     * Introspect an access or refresh token.
     * POST /v1/oauth/introspect — operationId introspectToken
     */
    async introspectToken(token) {
        const params = new URLSearchParams();
        params.append('token', token);
        delete this.access_token;
        return this._post(
            {
                url: this.baseUrl + this.URLs.oauthIntrospect,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: this._basicAuthHeader(),
                },
                body: params,
            },
            false
        );
    }

    /**
     * Revoke an access or refresh token.
     * POST /v1/oauth/revoke — operationId revokeTokens
     */
    async revokeTokens(token) {
        const params = new URLSearchParams();
        params.append('token', token);
        delete this.access_token;
        return this._post(
            {
                url: this.baseUrl + this.URLs.oauthRevoke,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: this._basicAuthHeader(),
                },
                body: params,
            },
            false
        );
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
     * @param {object} metadata - JSON for Asset-Upload-Metadata header
     *   (e.g. { name_base64, parent_folder_id })
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
