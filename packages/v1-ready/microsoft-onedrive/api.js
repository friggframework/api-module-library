const { OAuth2Requester, get } = require('@friggframework/core');
const querystring = require('querystring');

/**
 * Encode a drive-relative path for Graph root:/{path}: addressing.
 * Each segment is URI-encoded; slashes are preserved as path separators.
 */
function encodeDriveItemPath(itemPath) {
    return String(itemPath)
        .replace(/^\/+/, '')
        .split('/')
        .filter((seg) => seg.length > 0)
        .map((seg) => encodeURIComponent(seg))
        .join('/');
}

/**
 * Microsoft OneDrive client via Microsoft Graph v1.0 (OAuth 2.0).
 *
 * Auth: Authorization code flow against the Microsoft identity platform.
 *   Authorize: https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize
 *   Token:     https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
 * Docs: https://learn.microsoft.com/en-us/graph/auth-v2-user
 *
 * Base URL: https://graph.microsoft.com/v1.0
 * OneDrive / files surface:
 *   https://learn.microsoft.com/en-us/graph/api/resources/onedrive
 *
 * This client covers the signed-in user's drive(s), driveItems (list/get/create
 * folder/update/delete/upload), search, and Graph change-notification
 * subscriptions for OneDrive folders (resource e.g. /me/drive/root).
 *
 * Path-addressed upload helpers (`uploadByPath`, `createUploadSessionByPath`)
 * follow Microsoft Learn (colon path templates) and are not in the vendor
 * OpenAPI — see README / x-frigg-docs-only paths.
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.backOff = [1, 3];
        this.baseUrl = 'https://graph.microsoft.com/v1.0';

        // 'common' accepts both work/school and personal Microsoft accounts.
        this.tenant_id = get(params, 'tenant_id', 'common');
        this.state = get(params, 'state', null);
        this.forceConsent = get(params, 'forceConsent', true);

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);

        this.URLs = {
            me: '/me',
            myDrive: '/me/drive',
            myDrives: '/me/drives',
            driveById: (driveId) => `/drives/${driveId}`,
            driveItemById: (driveId, itemId) =>
                `/drives/${driveId}/items/${itemId}`,
            driveItemChildren: (driveId, itemId) =>
                `/drives/${driveId}/items/${itemId}/children`,
            // Official OpenAPI: /drives/{drive-id}/items/{driveItem-id}/content
            driveItemContent: (driveId, driveItemId) =>
                `/drives/${driveId}/items/${driveItemId}/content`,
            // Official OpenAPI: /drives/{drive-id}/items/{driveItem-id}/createUploadSession
            createUploadSessionPath: (driveId, driveItemId) =>
                `/drives/${driveId}/items/${driveItemId}/createUploadSession`,
            // Learn docs (not in vendor OpenAPI): /drives/{drive-id}/root:/{path}:/content
            rootPathContent: (driveId, itemPath) =>
                `/drives/${driveId}/root:/${encodeDriveItemPath(itemPath)}:/content`,
            // Learn docs (not in vendor OpenAPI): /drives/{drive-id}/root:/{path}:/createUploadSession
            rootPathUploadSession: (driveId, itemPath) =>
                `/drives/${driveId}/root:/${encodeDriveItemPath(
                    itemPath
                )}:/createUploadSession`,
            // Official OpenAPI: /drives/{drive-id}/search(q='{q}')
            driveSearch: (driveId, q) =>
                `/drives/${driveId}/search(q='${String(q).replace(/'/g, "''")}')`,
            subscriptions: '/subscriptions',
            subscriptionById: (subscriptionId) =>
                `/subscriptions/${subscriptionId}`,
        };

        this.authorizationUri = `https://login.microsoftonline.com/${this.tenant_id}/oauth2/v2.0/authorize`;
        this.tokenUri = `https://login.microsoftonline.com/${this.tenant_id}/oauth2/v2.0/token`;
    }

    /**
     * Build the Microsoft identity platform authorize URL.
     * https://learn.microsoft.com/en-us/graph/auth-v2-user
     */
    getAuthUri() {
        const query = {
            client_id: this.client_id,
            response_type: 'code',
            redirect_uri: this.redirect_uri,
            scope: this.scope,
            response_mode: 'query',
        };
        if (this.state) query.state = this.state;
        if (this.forceConsent) query.prompt = 'select_account';
        return `${this.authorizationUri}?${querystring.stringify(query)}`;
    }

    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null) continue;
            usp.append(key, String(value));
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Get the signed-in user.
     * GET /me
     * https://learn.microsoft.com/en-us/graph/api/user-get
     */
    async getUser() {
        return this._get({ url: this.baseUrl + this.URLs.me });
    }

    /**
     * Get the signed-in user's default OneDrive.
     * GET /me/drive
     * https://learn.microsoft.com/en-us/graph/api/drive-get
     */
    async getMyDrive(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.myDrive + this._buildQuery(params),
        });
    }

    // ---- Drives ------------------------------------------------------------

    /**
     * List OneDrive drives available to the signed-in user.
     * GET /me/drives
     * https://learn.microsoft.com/en-us/graph/api/drive-list
     */
    async listMyDrives(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.myDrives + this._buildQuery(params),
        });
    }

    /**
     * Get a drive by id.
     * GET /drives/{drive-id}
     * https://learn.microsoft.com/en-us/graph/api/drive-get
     */
    async getDrive(driveId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.driveById(driveId) +
                this._buildQuery(params),
        });
    }

    // ---- Drive items -------------------------------------------------------

    /**
     * List children of a drive item (folder).
     * GET /drives/{drive-id}/items/{item-id}/children
     * https://learn.microsoft.com/en-us/graph/api/driveitem-list-children
     * Use itemId='root' for the drive root.
     */
    async listDriveItemChildren(driveId, itemId = 'root', params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.driveItemChildren(driveId, itemId) +
                this._buildQuery(params),
        });
    }

    /**
     * Get a drive item by id.
     * GET /drives/{drive-id}/items/{item-id}
     * https://learn.microsoft.com/en-us/graph/api/driveitem-get
     */
    async getDriveItem(driveId, itemId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.driveItemById(driveId, itemId) +
                this._buildQuery(params),
        });
    }

    /**
     * Create a folder (or other driveItem) under a parent.
     * POST /drives/{drive-id}/items/{parent-id}/children
     * https://learn.microsoft.com/en-us/graph/api/driveitem-post-children
     *
     * Optional `@microsoft.graph.conflictBehavior` (`fail` | `replace` | `rename`)
     * is documented on Learn for create-folder; not in the vendor OpenAPI.
     * Pass it on `data`, or via the optional 4th argument.
     *
     * @param {string} driveId
     * @param {string} parentId - parent item id (or `root`)
     * @param {object} data - driveItem body (name, folder, …)
     * @param {string} [conflictBehavior] - fail | replace | rename
     */
    async createFolder(driveId, parentId, data, conflictBehavior) {
        const body = { ...(data || {}) };
        if (conflictBehavior) {
            body['@microsoft.graph.conflictBehavior'] = conflictBehavior;
        }
        return this._post({
            url: this.baseUrl + this.URLs.driveItemChildren(driveId, parentId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update drive item metadata (name, parentReference, etc.).
     * PATCH /drives/{drive-id}/items/{item-id}
     * https://learn.microsoft.com/en-us/graph/api/driveitem-update
     */
    async updateDriveItem(driveId, itemId, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.driveItemById(driveId, itemId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Delete a drive item.
     * DELETE /drives/{drive-id}/items/{item-id}
     * https://learn.microsoft.com/en-us/graph/api/driveitem-delete
     */
    async deleteDriveItem(driveId, itemId) {
        return this._delete({
            url: this.baseUrl + this.URLs.driveItemById(driveId, itemId),
        });
    }

    /**
     * Upload / replace file content for a driveItem.
     * PUT /drives/{drive-id}/items/{driveItem-id}/content
     * Official OpenAPI operationId: drives.UpdateItemsContent
     * https://learn.microsoft.com/en-us/graph/api/driveitem-put-content
     *
     * To create a new file by path, pass a path-addressed driveItem-id such as
     * `root:/Documents/file.txt:` (Graph item addressing). Max ~250 MB; for
     * larger files use createUploadSession.
     *
     * @param {string} driveId
     * @param {string} driveItemId - item id or path-addressed id
     * @param {Buffer|string} content - file body
     * @param {string} [contentType='application/octet-stream']
     */
    async uploadDriveItemContent(
        driveId,
        driveItemId,
        content,
        contentType = 'application/octet-stream'
    ) {
        return this._put(
            {
                url:
                    this.baseUrl +
                    this.URLs.driveItemContent(driveId, driveItemId),
                headers: { 'Content-Type': contentType },
                body: content,
            },
            false
        );
    }

    /**
     * Create an upload session for large files.
     * POST /drives/{drive-id}/items/{driveItem-id}/createUploadSession
     * Official OpenAPI operationId: drives.drive.items.driveItem.createUploadSession
     * Request body is required (typically `{ item: { name, ... } }`).
     * https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession
     */
    async createUploadSession(driveId, driveItemId, data = {}) {
        return this._post({
            url:
                this.baseUrl +
                this.URLs.createUploadSessionPath(driveId, driveItemId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Upload / create a file by path under the drive root (Learn docs).
     * PUT /drives/{drive-id}/root:/{path}:/content
     * https://learn.microsoft.com/en-us/graph/api/driveitem-put-content
     *
     * Not in the vendor OpenAPI (colon path templates). Prefer this helper
     * when callers have a relative path rather than an item id.
     *
     * @param {string} driveId
     * @param {string} itemPath - path relative to root, e.g. `folder/file.txt`
     * @param {Buffer|string} content
     * @param {string} [contentType='application/octet-stream']
     */
    async uploadByPath(
        driveId,
        itemPath,
        content,
        contentType = 'application/octet-stream'
    ) {
        return this._put(
            {
                url: this.baseUrl + this.URLs.rootPathContent(driveId, itemPath),
                headers: { 'Content-Type': contentType },
                body: content,
            },
            false
        );
    }

    /**
     * Create an upload session by path under the drive root (Learn docs).
     * POST /drives/{drive-id}/root:/{path}:/createUploadSession
     * https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession
     *
     * Not in the vendor OpenAPI (colon path templates).
     *
     * @param {string} driveId
     * @param {string} itemPath - path relative to root, e.g. `folder/big.bin`
     * @param {object} [data={}] - typically `{ item: { name, ... } }`
     */
    async createUploadSessionByPath(driveId, itemPath, data = {}) {
        return this._post({
            url:
                this.baseUrl +
                this.URLs.rootPathUploadSession(driveId, itemPath),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Search for drive items in a drive.
     * GET /drives/{drive-id}/search(q='{search-text}')
     * Official OpenAPI operationId: drives.drive.search
     * https://learn.microsoft.com/en-us/graph/api/driveitem-search
     */
    async searchDriveItems(driveId, q, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.driveSearch(driveId, q) +
                this._buildQuery(params),
        });
    }

    // ---- Change notification subscriptions ---------------------------------

    /**
     * List Graph subscriptions for the app/user.
     * GET /subscriptions
     * https://learn.microsoft.com/en-us/graph/api/subscription-list
     * OneDrive resource examples: /me/drive/root or /drives/{drive-id}/root
     * https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/using-webhooks
     */
    async listSubscriptions() {
        return this._get({
            url: this.baseUrl + this.URLs.subscriptions,
        });
    }

    /**
     * Get a subscription by id.
     * GET /subscriptions/{id}
     * https://learn.microsoft.com/en-us/graph/api/subscription-get
     */
    async getSubscription(subscriptionId) {
        return this._get({
            url: this.baseUrl + this.URLs.subscriptionById(subscriptionId),
        });
    }

    /**
     * Create a change-notification subscription.
     * POST /subscriptions
     * https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions
     * For OneDrive set resource to `/me/drive/root` (or a personal subfolder).
     * OneDrive for Business supports root only.
     */
    async createSubscription(data) {
        return this._post({
            url: this.baseUrl + this.URLs.subscriptions,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a subscription (e.g. renew expirationDateTime).
     * PATCH /subscriptions/{id}
     * https://learn.microsoft.com/en-us/graph/api/subscription-update
     */
    async updateSubscription(subscriptionId, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.subscriptionById(subscriptionId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Delete a subscription.
     * DELETE /subscriptions/{id}
     * https://learn.microsoft.com/en-us/graph/api/subscription-delete
     */
    async deleteSubscription(subscriptionId) {
        return this._delete({
            url: this.baseUrl + this.URLs.subscriptionById(subscriptionId),
        });
    }
}

module.exports = { Api };
