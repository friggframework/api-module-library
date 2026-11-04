const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Dropbox HTTP API client (OAuth 2.0).
 *
 * Auth: Bearer access token from Dropbox's authorization-code OAuth flow.
 * Request `token_access_type=offline` on authorize to receive a refresh_token.
 * Token exchange uses application/x-www-form-urlencoded (OAuth2Requester default).
 *
 * RPC base:     https://api.dropboxapi.com/2
 * Content base: https://content.dropboxapi.com/2  (download / upload)
 * Authorize:    https://www.dropbox.com/oauth2/authorize
 * Token:        https://api.dropboxapi.com/oauth2/token
 *
 * Official sources:
 *   https://www.dropbox.com/developers/documentation/http/documentation
 *   https://github.com/dropbox/dropbox-api-spec (Stone)
 *   https://www.dropbox.com/developers/reference/oauth-guide
 *   https://www.dropbox.com/developers/reference/webhooks
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://api.dropboxapi.com/2';
        this.contentBaseUrl = 'https://content.dropboxapi.com/2';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        // Default scopes cover OpenID identity (v1 lefthookhq/dropbox--frigg),
        // account + files CRUD, and shared-folder listing. Override via
        // DROPBOX_SCOPE / constructor `scope`.
        const scope =
            this.scope ||
            process.env.DROPBOX_SCOPE ||
            [
                'openid',
                'profile',
                'email',
                'account_info.read',
                'files.metadata.read',
                'files.metadata.write',
                'files.content.read',
                'files.content.write',
                'sharing.read',
            ].join(' ');

        const authParams = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            // Offline access yields a long-lived refresh_token (Dropbox OAuth guide).
            // Refresh responses often omit refresh_token; OAuth2Requester.setTokens
            // already preserves the existing one (same intent as v1's custom refresh).
            token_access_type: 'offline',
            scope,
        });
        if (this.state) authParams.set('state', this.state);

        this.authorizationUri = `https://www.dropbox.com/oauth2/authorize?${authParams.toString()}`;
        this.tokenUri = 'https://api.dropboxapi.com/oauth2/token';

        this.URLs = {
            // OpenID (v1 identity) — Stone openid/userinfo, scope openid
            getUserDetails: '/openid/userinfo',
            getCurrentAccount: '/users/get_current_account',
            getSpaceUsage: '/users/get_space_usage',
            listFolder: '/files/list_folder',
            listFolderContinue: '/files/list_folder/continue',
            // Sharing (v1) — Stone sharing/list_folders*, scope sharing.read
            listSharedFolders: '/sharing/list_folders',
            listSharedFoldersContinue: '/sharing/list_folders/continue',
            getMetadata: '/files/get_metadata',
            createFolderV2: '/files/create_folder_v2',
            deleteV2: '/files/delete_v2',
            moveV2: '/files/move_v2',
            copyV2: '/files/copy_v2',
            searchV2: '/files/search_v2',
            download: '/files/download',
            upload: '/files/upload',
        };
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    addJsonHeaders(options) {
        options.headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
    }

    async _post(options, stringify) {
        // Token endpoint stays form-urlencoded (OAuth2Requester). Content
        // uploads set their own Content-Type (octet-stream) and skip JSON.
        const url = options.url ? String(options.url) : '';
        const contentType = options.headers && options.headers['Content-Type'];
        if (
            url &&
            !url.includes('/oauth2/') &&
            !(contentType && String(contentType).startsWith('application/octet-stream'))
        ) {
            this.addJsonHeaders(options);
        }
        return super._post(options, stringify);
    }

    /**
     * Dropbox RPC helper — POST JSON to api.dropboxapi.com/2/...
     * Void-arg routes send JSON `null` as the body (Dropbox convention).
     */
    async _rpc(path, body) {
        const options = {
            url: this.baseUrl + path,
            body: body === undefined ? null : body,
        };
        return this._post(options);
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * OpenID userinfo — POST /openid/userinfo
     * Official route: openid/userinfo (Stone; is_preview). Scope: openid.
     * Also request `profile` / `email` scopes for given_name, family_name, email.
     * Arg: empty UserInfoArgs — JSON null body.
     *
     * `sub` is the Dropbox account_id (stable identity). This was the v1
     * lefthookhq/dropbox--frigg identity path (getUserDetails / getTokenIdentity).
     */
    async getUserDetails() {
        return this._rpc(this.URLs.getUserDetails, null);
    }

    /**
     * Get current account — POST /users/get_current_account
     * Official route: users/get_current_account. Scope: account_info.read.
     * Arg: Void (JSON null body).
     */
    async getCurrentAccount() {
        return this._rpc(this.URLs.getCurrentAccount, null);
    }

    /**
     * Get space usage — POST /users/get_space_usage
     * Official route: users/get_space_usage. Scope: account_info.read.
     * Arg: Void (JSON null body).
     */
    async getSpaceUsage() {
        return this._rpc(this.URLs.getSpaceUsage, null);
    }

    // ---- Files / folders (metadata) ----------------------------------------

    /**
     * List folder contents — POST /files/list_folder
     * Official route: files/list_folder. Scope: files.metadata.read.
     * Body: ListFolderArg { path, recursive?, include_deleted?, limit?, … }
     * Root is path "". Defaults mirror the v1 module when callers pass overrides only.
     */
    async listFolder(data = {}) {
        const body = {
            path: '',
            include_deleted: false,
            include_has_explicit_shared_members: false,
            include_mounted_folders: true,
            include_non_downloadable_files: true,
            recursive: false,
            ...data,
        };
        return this._rpc(this.URLs.listFolder, body);
    }

    /**
     * Continue listing a folder — POST /files/list_folder/continue
     * Official route: files/list_folder/continue. Scope: files.metadata.read.
     * Accepts a cursor string (v1 signature) or `{ cursor }` object.
     */
    async listFolderContinue(data) {
        const body =
            typeof data === 'string' ? { cursor: data } : data || {};
        return this._rpc(this.URLs.listFolderContinue, body);
    }

    /**
     * List shared folders — POST /sharing/list_folders
     * Official route: sharing/list_folders. Scope: sharing.read.
     * Body: ListFoldersArgs (optional limit / actions). Empty `{}` lists all.
     */
    async listSharedFolders(data = {}) {
        return this._rpc(this.URLs.listSharedFolders, data);
    }

    /**
     * Continue listing shared folders — POST /sharing/list_folders/continue
     * Official route: sharing/list_folders/continue. Scope: sharing.read.
     * Accepts a cursor string (v1 signature) or `{ cursor }` object.
     */
    async listSharedFoldersContinue(data) {
        const body =
            typeof data === 'string' ? { cursor: data } : data || {};
        return this._rpc(this.URLs.listSharedFoldersContinue, body);
    }

    /**
     * Get file or folder metadata — POST /files/get_metadata
     * Official route: files/get_metadata. Scope: files.metadata.read.
     * Body: GetMetadataArg { path, include_media_info?, include_deleted?, … }
     * Note: metadata for the root folder is unsupported.
     */
    async getMetadata(data) {
        return this._rpc(this.URLs.getMetadata, data);
    }

    /**
     * Create folder — POST /files/create_folder_v2
     * Official route: files/create_folder:2. Scope: files.content.write.
     * Body: CreateFolderArg { path, autorename? }
     */
    async createFolderV2(data) {
        return this._rpc(this.URLs.createFolderV2, data);
    }

    /**
     * Delete file or folder — POST /files/delete_v2
     * Official route: files/delete:2. Scope: files.content.write.
     * Body: DeleteArg { path, parent_rev? }
     */
    async deleteV2(data) {
        return this._rpc(this.URLs.deleteV2, data);
    }

    /**
     * Move file or folder — POST /files/move_v2
     * Official route: files/move:2. Scope: files.content.write.
     * Body: RelocationArg { from_path, to_path, autorename?, … }
     */
    async moveV2(data) {
        return this._rpc(this.URLs.moveV2, data);
    }

    /**
     * Copy file or folder — POST /files/copy_v2
     * Official route: files/copy:2. Scope: files.content.write.
     * Body: RelocationArg { from_path, to_path, autorename?, … }
     */
    async copyV2(data) {
        return this._rpc(this.URLs.copyV2, data);
    }

    /**
     * Search files and folders — POST /files/search_v2
     * Official route: files/search:2. Scope: files.metadata.read.
     * Body: SearchV2Arg { query, options?, match_field_options? }
     */
    async searchV2(data) {
        return this._rpc(this.URLs.searchV2, data);
    }

    // ---- Content (download / upload) ---------------------------------------

    /**
     * Download a file — POST https://content.dropboxapi.com/2/files/download
     * Official route: files/download. Scope: files.content.read.
     * Args travel in the Dropbox-API-Arg header (DownloadArg { path }).
     * File bytes are the response body; metadata is in Dropbox-API-Result.
     *
     * @param {Object} arg - DownloadArg (at least { path })
     * @param {Object} [options]
     * @param {boolean} [options.returnFullRes=true] - return full HTTP response
     */
    async downloadFile(arg, { returnFullRes = true } = {}) {
        return this._post(
            {
                url: this.contentBaseUrl + this.URLs.download,
                headers: {
                    'Dropbox-API-Arg': JSON.stringify(arg || {}),
                    'Content-Type': 'application/octet-stream',
                },
                body: null,
                returnFullRes,
            },
            false
        );
    }

    /**
     * Upload a file — POST https://content.dropboxapi.com/2/files/upload
     * Official route: files/upload. Scope: files.content.write.
     * Commit info travels in Dropbox-API-Arg (UploadArg / CommitInfo:
     *   { path, mode?, autorename?, mute?, strict_conflict?, … }).
     * Body is raw file bytes (Content-Type: application/octet-stream).
     *
     * @param {Object} arg - UploadArg fields (path required)
     * @param {Buffer|string} contents - File bytes
     */
    async uploadFile(arg, contents) {
        const body = Buffer.isBuffer(contents)
            ? contents
            : Buffer.from(contents == null ? '' : contents);
        return this._post(
            {
                url: this.contentBaseUrl + this.URLs.upload,
                headers: {
                    'Dropbox-API-Arg': JSON.stringify(arg || {}),
                    'Content-Type': 'application/octet-stream',
                },
                body,
            },
            false
        );
    }

    // ---- Webhooks (App Console; no HTTP CRUD) ------------------------------

    /**
     * Echo a Dropbox webhook verification challenge (local; not an HTTP API call).
     *
     * Dropbox sends GET ?challenge=<random> when a webhook URI is registered in
     * the App Console. Respond with the challenge string as the body
     * (Content-Type: text/plain) within 10 seconds.
     *
     * Docs: https://www.dropbox.com/developers/reference/webhooks
     *
     * @param {string} challenge
     * @returns {{ challenge: string, contentType: string }}
     */
    handleWebhookChallenge(challenge) {
        return Api.handleWebhookChallenge(challenge);
    }

    static handleWebhookChallenge(challenge) {
        if (challenge === undefined || challenge === null || challenge === '') {
            throw new Error('Dropbox webhook challenge is required');
        }
        return {
            challenge: String(challenge),
            contentType: 'text/plain',
        };
    }

    /**
     * Verify a Dropbox webhook notification signature (local; not an HTTP call).
     *
     * Dropbox signs the raw POST body with HMAC-SHA256 using the app secret
     * and sends the hex digest in the X-Dropbox-Signature header.
     *
     * Docs: https://www.dropbox.com/developers/reference/webhooks
     *
     * @param {Object} args
     * @param {import('express').Request|Object} args.req
     * @param {string} [args.appSecret] - defaults to client_secret / DROPBOX_CLIENT_SECRET
     * @returns {{ valid: boolean, reason?: string }}
     */
    verifyWebhookSignature({
        req,
        appSecret = this.client_secret || process.env.DROPBOX_CLIENT_SECRET,
    } = {}) {
        return Api.verifyWebhookSignature({ req, appSecret });
    }

    static verifyWebhookSignature({ req, appSecret }) {
        if (!appSecret) {
            return { valid: false, reason: 'missing app secret' };
        }
        if (!req || typeof req !== 'object') {
            return { valid: false, reason: 'missing request' };
        }

        const headers = req.headers || {};
        const received = getHeader(headers, 'x-dropbox-signature');
        if (!received) {
            return {
                valid: false,
                reason: 'missing X-Dropbox-Signature header',
            };
        }

        const body = extractRawBody(req);
        const digest = crypto
            .createHmac('sha256', appSecret)
            .update(body)
            .digest('hex');

        if (timingSafeEqualHex(digest, String(received))) {
            return { valid: true };
        }
        return { valid: false, reason: 'signature mismatch' };
    }
}

function getHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return undefined;
    if (headers[name] !== undefined) return headers[name];
    const lower = name.toLowerCase();
    if (headers[lower] !== undefined) return headers[lower];
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lower) return headers[key];
    }
    return undefined;
}

function extractRawBody(req) {
    if (typeof req.rawBody === 'string') return req.rawBody;
    if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
    if (req.body === undefined || req.body === null) return Buffer.from('');
    if (typeof req.body === 'string') return Buffer.from(req.body);
    if (Buffer.isBuffer(req.body)) return req.body;
    return Buffer.from(JSON.stringify(req.body));
}

function timingSafeEqualHex(expected, received) {
    try {
        const a = Buffer.from(String(expected), 'hex');
        const b = Buffer.from(String(received), 'hex');
        if (a.length === 0 || a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch (e) {
        return false;
    }
}

module.exports = { Api };
