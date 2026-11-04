const crypto = require('crypto');
const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Box Platform API client (OAuth 2.0).
 *
 * Auth: Bearer access token from Box's authorization-code OAuth flow.
 * Token exchange uses application/x-www-form-urlencoded (OAuth2Requester default).
 *
 * Base URL: https://api.box.com/2.0
 * Upload URL: https://upload.box.com/api/2.0 (multipart uploads only)
 * Authorize: https://account.box.com/api/oauth2/authorize
 * Token: https://api.box.com/oauth2/token
 *
 * Official sources:
 *   https://developer.box.com/reference
 *   https://github.com/box/box-openapi (openapi.json)
 *   https://developer.box.com/guides/authentication/oauth2
 *   https://developer.box.com/guides/webhooks/v2/signatures-v2/
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://api.box.com/2.0';
        this.uploadBaseUrl = 'https://upload.box.com/api/2.0';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        const scope =
            this.scope ||
            process.env.BOX_SCOPE ||
            'root_readwrite manage_webhook';

        const authParams = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            scope,
        });
        if (this.state) authParams.set('state', this.state);

        this.authorizationUri = `https://account.box.com/api/oauth2/authorize?${authParams.toString()}`;
        this.tokenUri = 'https://api.box.com/oauth2/token';

        this.URLs = {
            currentUser: '/users/me',
            folders: '/folders',
            folderById: (folderId) => `/folders/${folderId}`,
            folderItems: (folderId) => `/folders/${folderId}/items`,
            fileById: (fileId) => `/files/${fileId}`,
            fileContent: (fileId) => `/files/${fileId}/content`,
            uploadContent: '/files/content',
            search: '/search',
            webhooks: '/webhooks',
            webhookById: (webhookId) => `/webhooks/${webhookId}`,
        };
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    addJsonHeaders(options) {
        options.headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...options.headers,
        };
    }

    async _post(options, stringify) {
        // Token endpoint stays form-urlencoded (OAuth2Requester). JSON API bodies
        // (and multipart uploads that set their own Content-Type) skip this.
        const url = options.url ? String(options.url) : '';
        const contentType = options.headers && options.headers['Content-Type'];
        if (
            url &&
            !url.includes('/oauth2/') &&
            !(contentType && String(contentType).startsWith('multipart/'))
        ) {
            this.addJsonHeaders(options);
        }
        return super._post(options, stringify);
    }

    async _put(options, stringify) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Get current user — GET /users/me
     * Official operationId: get_users_me
     * Optional query: fields
     */
    async getCurrentUser(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.currentUser,
            params,
        });
    }

    // ---- Folders -----------------------------------------------------------

    /**
     * Get folder information — GET /folders/{folder_id}
     * Official operationId: get_folders_id
     * Root folder id is `"0"`.
     */
    async getFolder(folderId, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.folderById(folderId),
            params,
        });
    }

    /**
     * List items in folder — GET /folders/{folder_id}/items
     * Official operationId: get_folders_id_items
     * Pagination: offset/limit or marker/usemarker.
     */
    async listFolderItems(folderId, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.folderItems(folderId),
            params,
        });
    }

    /**
     * Create folder — POST /folders
     * Official operationId: post_folders
     * Body: { name, parent: { id } }
     */
    async createFolder(data) {
        return this._post({
            url: this.baseUrl + this.URLs.folders,
            body: data,
        });
    }

    /**
     * Update folder — PUT /folders/{folder_id}
     * Official operationId: put_folders_id
     */
    async updateFolder(folderId, data, params = {}) {
        return this._put({
            url: this.baseUrl + this.URLs.folderById(folderId),
            body: data,
            params,
        });
    }

    /**
     * Delete folder — DELETE /folders/{folder_id}
     * Official operationId: delete_folders_id
     * Optional query: recursive
     */
    async deleteFolder(folderId, params = {}) {
        return this._delete({
            url: this.baseUrl + this.URLs.folderById(folderId),
            params,
        });
    }

    // ---- Files -------------------------------------------------------------

    /**
     * Get file information — GET /files/{file_id}
     * Official operationId: get_files_id
     */
    async getFile(fileId, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.fileById(fileId),
            params,
        });
    }

    /**
     * Update file — PUT /files/{file_id}
     * Official operationId: put_files_id
     */
    async updateFile(fileId, data, params = {}) {
        return this._put({
            url: this.baseUrl + this.URLs.fileById(fileId),
            body: data,
            params,
        });
    }

    /**
     * Delete file — DELETE /files/{file_id}
     * Official operationId: delete_files_id
     */
    async deleteFile(fileId, params = {}) {
        return this._delete({
            url: this.baseUrl + this.URLs.fileById(fileId),
            params,
        });
    }

    /**
     * Download file — GET /files/{file_id}/content
     * Official operationId: get_files_id_content
     * Box responds with a redirect to the binary download URL.
     */
    async downloadFile(fileId, params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.fileContent(fileId),
            params,
        });
    }

    /**
     * Upload file — POST https://upload.box.com/api/2.0/files/content
     * Official operationId: post_files_content
     *
     * Multipart form fields (per Box OpenAPI):
     *   attributes — JSON string { name, parent: { id } }
     *   file — file bytes
     *
     * @param {Object} args
     * @param {Object} args.attributes - Upload attributes (name + parent required)
     * @param {Buffer|string} args.file - File contents
     * @param {string} [args.filename] - Filename for the multipart part
     * @param {string} [args.contentType='application/octet-stream']
     * @param {Object} [args.params] - Optional query (e.g. fields)
     */
    async uploadFile({
        attributes,
        file,
        filename,
        contentType = 'application/octet-stream',
        params = {},
    } = {}) {
        const boundary = `----FriggBoxFormBoundary${crypto
            .randomBytes(12)
            .toString('hex')}`;
        const name =
            filename ||
            (attributes && attributes.name) ||
            'upload.bin';
        const attrsJson = JSON.stringify(attributes || {});
        const fileBuf = Buffer.isBuffer(file)
            ? file
            : Buffer.from(file == null ? '' : file);

        const preamble = Buffer.from(
            `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="attributes"\r\n` +
                `Content-Type: application/json\r\n\r\n` +
                `${attrsJson}\r\n` +
                `--${boundary}\r\n` +
                `Content-Disposition: form-data; name="file"; filename="${String(
                    name
                ).replace(/"/g, '')}"\r\n` +
                `Content-Type: ${contentType}\r\n\r\n`,
            'utf8'
        );
        const closing = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
        const body = Buffer.concat([preamble, fileBuf, closing]);

        const qs = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null) continue;
            qs.append(key, String(value));
        }
        const query = qs.toString();
        const url =
            this.uploadBaseUrl +
            this.URLs.uploadContent +
            (query ? `?${query}` : '');

        // Pass stringify=false so the multipart Buffer is not JSON.stringified.
        return this._post(
            {
                url,
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    Accept: 'application/json',
                },
                body,
            },
            false
        );
    }

    // ---- Search ------------------------------------------------------------

    /**
     * Search for content — GET /search
     * Official operationId: get_search
     */
    async searchContent(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.search,
            params,
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * List all webhooks — GET /webhooks
     * Official operationId: get_webhooks
     */
    async listWebhooks(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.webhooks,
            params,
        });
    }

    /**
     * Create webhook — POST /webhooks
     * Official operationId: post_webhooks
     * Body: { target: { id, type: 'file'|'folder' }, address, triggers: [...] }
     */
    async createWebhook(data) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks,
            body: data,
        });
    }

    /**
     * Get webhook — GET /webhooks/{webhook_id}
     * Official operationId: get_webhooks_id
     */
    async getWebhook(webhookId) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
        });
    }

    /**
     * Update webhook — PUT /webhooks/{webhook_id}
     * Official operationId: put_webhooks_id
     */
    async updateWebhook(webhookId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
            body: data,
        });
    }

    /**
     * Remove webhook — DELETE /webhooks/{webhook_id}
     * Official operationId: delete_webhooks_id
     */
    async deleteWebhook(webhookId) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
        });
    }

    /**
     * Verify a Box V2 webhook signature (local; not an HTTP call).
     *
     * Box signs `body bytes + BOX-DELIVERY-TIMESTAMP bytes` with HMAC-SHA256
     * using the app's primary and/or secondary signature keys, then Base64-
     * encodes the digest into BOX-SIGNATURE-PRIMARY / BOX-SIGNATURE-SECONDARY.
     * Reject deliveries older than 10 minutes.
     *
     * Docs: https://developer.box.com/guides/webhooks/v2/signatures-v2/
     *
     * @param {Object} args
     * @param {import('express').Request|Object} args.req
     * @param {string} [args.primaryKey]
     * @param {string} [args.secondaryKey]
     * @returns {{ valid: boolean, reason?: string }}
     */
    verifyWebhookSignature({
        req,
        primaryKey = process.env.BOX_WEBHOOK_PRIMARY_KEY,
        secondaryKey = process.env.BOX_WEBHOOK_SECONDARY_KEY,
    } = {}) {
        return Api.verifyWebhookSignature({
            req,
            primaryKey,
            secondaryKey,
        });
    }

    static verifyWebhookSignature({ req, primaryKey, secondaryKey }) {
        if (!primaryKey && !secondaryKey) {
            return { valid: false, reason: 'missing signature key' };
        }
        if (!req || typeof req !== 'object') {
            return { valid: false, reason: 'missing request' };
        }

        const headers = req.headers || {};
        const timestamp = getHeader(headers, 'box-delivery-timestamp');
        if (!timestamp) {
            return {
                valid: false,
                reason: 'missing BOX-DELIVERY-TIMESTAMP header',
            };
        }

        const deliveredAt = Date.parse(timestamp);
        if (Number.isNaN(deliveredAt)) {
            return { valid: false, reason: 'invalid delivery timestamp' };
        }
        if (Date.now() - deliveredAt > 10 * 60 * 1000) {
            return { valid: false, reason: 'delivery timestamp expired' };
        }

        const body = extractBodyString(req);
        const primarySig = getHeader(headers, 'box-signature-primary');
        const secondarySig = getHeader(headers, 'box-signature-secondary');

        const matches = (key, received) => {
            if (!key || !received) return false;
            const digest = crypto
                .createHmac('sha256', key)
                .update(body)
                .update(String(timestamp))
                .digest('base64');
            return timingSafeEqualBase64(digest, received);
        };

        if (
            matches(primaryKey, primarySig) ||
            matches(secondaryKey, secondarySig)
        ) {
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

function extractBodyString(req) {
    if (typeof req.rawBody === 'string') return req.rawBody;
    if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8');
    if (req.body === undefined || req.body === null) return '';
    if (typeof req.body === 'string') return req.body;
    if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
    return JSON.stringify(req.body);
}

function timingSafeEqualBase64(expected, received) {
    try {
        const a = Buffer.from(String(expected), 'base64');
        const b = Buffer.from(String(received), 'base64');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch (e) {
        return false;
    }
}

module.exports = { Api };
