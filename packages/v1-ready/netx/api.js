const fs = require('fs');
const path = require('path');
const { OAuth2Requester, get } = require('@friggframework/core');
const { v4: uuidv4 } = require('uuid');
const FormData = require('form-data');

/**
 * NetX Digital Asset Management API client.
 *
 * Auth: OAuth 2 authorization-code (or a UI-minted API token). Every request
 * sends `Authorization: apiToken <access_token>` — not Bearer. See
 * https://developer.netx.net/ (Authentication / OAuth 2).
 *
 * Base URL: per-tenant NetX instance root, e.g. `https://acme.netx.net`.
 * JSON-RPC methods POST to `{baseUrl}/api/rpc`. File import uses
 * `{baseUrl}/api/import/asset` (multipart).
 *
 * There is no vendor-published OpenAPI; `netx.openapi.yaml` is Left Hook's
 * curated subset of the documented JSON-RPC / import surface.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.client_id = get(params, 'client_id', null);
        this.client_secret = get(params, 'client_secret', null);
        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
        this.scope = get(params, 'scope', null) || 'api';
        this.state = get(params, 'state', null);
        this.redirect_uri =
            get(params, 'redirect_uri', null) ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/netx`
                : null);

        const baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'base_url', null) ||
            get(params, 'baseURL', null) ||
            null;
        if (baseUrl) {
            this.setBaseUrl(baseUrl);
        } else {
            // Placeholder used by OpenAPI / offline tests until setBaseUrl runs.
            this.baseUrl = 'https://example.netx.net';
            this.baseURL = this.baseUrl;
            this._rebuildAuthUrls();
        }

        this.URLs = {
            rpc: '/api/rpc',
            importAsset: '/api/import/asset',
        };
    }

    /**
     * Set the tenant NetX instance root and rebuild OAuth URLs.
     * @param {string} baseUrl e.g. https://acme.netx.net (no trailing slash)
     */
    setBaseUrl(baseUrl) {
        if (!baseUrl) return;
        this.baseUrl = String(baseUrl).replace(/\/+$/, '');
        this.baseURL = this.baseUrl;
        this._rebuildAuthUrls();
    }

    _rebuildAuthUrls() {
        if (!this.baseUrl) return;
        this.tokenUri = `${this.baseUrl}/a/t`;
        // Docs: /app?response_type=code&client_id=...&redirect_uri=...&state=...&scope=...#access/
        // Prior v1 module used fragment `#access/api`; keep that proven value.
        const q = new URLSearchParams({
            response_type: 'code',
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            state: this.state || '',
            scope: this.scope || 'api',
        });
        this.authorizationUri = `${this.baseUrl}/app?${q.toString()}#access/api`;
    }

    getAuthorizationUri() {
        this._rebuildAuthUrls();
        return this.authorizationUri;
    }

    getAuthorizationRequirements() {
        return {
            url: this.getAuthorizationUri(),
            type: 'oauth2',
            data: {
                jsonSchema: {
                    title: 'NetX Authentication',
                    type: 'object',
                    required: ['baseUrl'],
                    properties: {
                        baseUrl: {
                            type: 'string',
                            title: 'NetX Instance URL',
                        },
                    },
                },
                uiSchema: {
                    baseUrl: {
                        'ui:help':
                            'Your NetX site root, e.g. https://acme.netx.net. Used for OAuth and JSON-RPC.',
                        'ui:placeholder': 'https://your-instance.netx.net',
                    },
                },
            },
        };
    }

    /**
     * NetX requires `Authorization: apiToken <token>`, not Bearer.
     * @see https://developer.netx.net/ Authentication
     */
    async addAuthHeaders(headers = {}) {
        const next = { ...headers };
        delete next.Authorization;
        if (this.access_token) {
            next.Authorization = `apiToken ${this.access_token}`;
        }
        return next;
    }

    /**
     * JSON-RPC 2.0 call to `{baseUrl}/api/rpc`.
     * NetX does not support named params or batched calls.
     * Auth failures may arrive as JSON-RPC error code 10000 (v1 observation);
     * on that code we attempt one token refresh and retry.
     */
    async _rpc(method, params = [], { retryOnAuthError = true } = {}) {
        const body = {
            jsonrpc: '2.0',
            id: uuidv4(),
            method,
            params,
        };
        const options = {
            url: this.baseUrl + this.URLs.rpc,
            headers: { 'Content-Type': 'application/json' },
            body,
        };
        const response = await this._post(options);

        if (response && response.error) {
            const code = response.error.code;
            if (code === 10000 && retryOnAuthError && this.isRefreshable) {
                await this.refreshAuth();
                return this._rpc(method, params, { retryOnAuthError: false });
            }
            const err = new Error(
                `NetX JSON-RPC error ${code}: ${
                    response.error.message || JSON.stringify(response.error)
                }`
            );
            err.netxError = response.error;
            throw err;
        }

        return response;
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * getSelf — user object for the token owner.
     * Params: [null]
     * @see https://developer.netx.net/ getSelf
     */
    async getSelf() {
        return this._rpc('getSelf', [null]);
    }

    // ---- Assets ------------------------------------------------------------

    /**
     * getAssets — one or more assets by id.
     * Params: [assetIds[], options]
     * @param {number|number[]} assetIds
     * @param {object} [options] e.g. { data: ['asset.base', 'asset.file'] }
     */
    async getAssets(assetIds, options = { data: ['asset.base', 'asset.file'] }) {
        const ids = Array.isArray(assetIds) ? assetIds : [assetIds];
        return this._rpc('getAssets', [ids, options]);
    }

    /**
     * getAssetsByFolder — assets in a folder (optionally recursive).
     * Params: [folderId, recursive, options]
     * @param {number} folderId
     * @param {boolean} [recursive=false]
     * @param {object} [options]
     */
    async getAssetsByFolder(
        folderId,
        recursive = false,
        options = {
            page: { startIndex: 0, size: 100 },
            data: ['asset.id', 'asset.base'],
        }
    ) {
        return this._rpc('getAssetsByFolder', [folderId, recursive, options]);
    }

    /**
     * getAssetsByQuery — search assets with a clause query.
     * Params: [{ query }, options]
     * @param {object|Array} query Query clauses (or { query } wrapper)
     * @param {object} [options]
     */
    async getAssetsByQuery(
        query,
        options = {
            sort: { field: 'name', order: 'asc' },
            data: ['asset.id', 'asset.base', 'asset.attributes'],
        }
    ) {
        const queryParam =
            query && typeof query === 'object' && !Array.isArray(query) && query.query
                ? query
                : { query };
        return this._rpc('getAssetsByQuery', [queryParam, options]);
    }

    /**
     * updateAsset — update asset name and/or fileName.
     * Params: [{ id, name?, fileName? }, options]
     * @param {object} asset Writable asset fields including id
     * @param {object} [options]
     */
    async updateAsset(asset, options = { data: ['asset.base'] }) {
        return this._rpc('updateAsset', [asset, options]);
    }

    /**
     * Import a new asset via multipart POST /api/import/asset.
     * Fields: file, folderId, fileName (documented at developer.netx.net).
     * @param {{ filePath: string, fileName?: string }} asset
     * @param {number} folderId
     */
    async importAsset(asset, folderId) {
        const form = new FormData();
        const stats = fs.statSync(asset.filePath);
        const fileStream = fs.createReadStream(asset.filePath);
        const fileName = asset.fileName || path.basename(asset.filePath);
        form.append('file', fileStream, {
            filename: fileName,
            knownLength: stats.size,
        });
        form.append('folderId', String(folderId));
        form.append('fileName', fileName);

        const options = {
            url: this.baseUrl + this.URLs.importAsset,
            method: 'POST',
            headers: form.getHeaders(),
            body: form,
        };
        return this._request(options.url, options);
    }

    // ---- Folders -----------------------------------------------------------

    /**
     * createFolder — Params: [{ parentId, name, description? }, options]
     */
    async createFolder(
        folder,
        options = { data: ['folder.id', 'folder.base'] }
    ) {
        return this._rpc('createFolder', [folder, options]);
    }

    /**
     * getFolderById — Params: [folderId, options]
     */
    async getFolderById(
        folderId,
        options = { data: ['folder.id', 'folder.base'] }
    ) {
        return this._rpc('getFolderById', [folderId, options]);
    }

    /**
     * getFoldersByParent — Params: [parentId, options]
     */
    async getFoldersByParent(
        parentId,
        options = {
            page: { startIndex: 0, size: 100 },
            data: ['folder.id', 'folder.base'],
        }
    ) {
        return this._rpc('getFoldersByParent', [parentId, options]);
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * setWebhook — create (id 0 / omitted) or update a webhook.
     * Params: [webhookObject]
     * actions: asset.create, asset.addToFolder, asset.checkin, asset.checkout,
     *   asset.delete, asset.expire, asset.updateAttributes, folder.create,
     *   folder.delete, folder.update, user.create, user.expire, user.update
     * status: ACTIVE | USER_DISABLED
     */
    async setWebhook(webhook) {
        return this._rpc('setWebhook', [webhook]);
    }

    /**
     * getWebhooks — page of webhooks. Params: [options]
     * Signing secrets are never included in the response.
     */
    async getWebhooks(
        options = { page: { startIndex: 0, size: 100 } }
    ) {
        return this._rpc('getWebhooks', [options]);
    }

    /**
     * deleteWebhook — Params: [webhookId]
     */
    async deleteWebhook(webhookId) {
        return this._rpc('deleteWebhook', [webhookId]);
    }
}

module.exports = { Api };
