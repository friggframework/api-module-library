const { OAuth2Requester, get } = require('@friggframework/core');
const querystring = require('querystring');

/**
 * Microsoft SharePoint client via Microsoft Graph v1.0 (OAuth 2.0).
 *
 * Auth: Authorization code flow against the Microsoft identity platform.
 *   Authorize: https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize
 *   Token:     https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
 * Docs: https://learn.microsoft.com/en-us/graph/auth-v2-user
 *
 * Base URL: https://graph.microsoft.com/v1.0
 * SharePoint surface: https://learn.microsoft.com/en-us/graph/api/resources/sharepoint
 *
 * This client covers sites, drives, driveItems, lists, listItems, and Graph
 * change-notification subscriptions for SharePoint lists. Sites are read-only
 * on Graph (no create-site). List/listItem/driveItem are read-write.
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
            organization: '/organization',
            sites: '/sites',
            siteById: (siteId) => `/sites/${siteId}`,
            drivesBySite: (siteId) => `/sites/${siteId}/drives`,
            driveById: (driveId) => `/drives/${driveId}`,
            driveItemById: (driveId, itemId) =>
                `/drives/${driveId}/items/${itemId}`,
            driveItemChildren: (driveId, itemId) =>
                `/drives/${driveId}/items/${itemId}/children`,
            driveItemContentByPath: (driveId, parentId, filename) =>
                `/drives/${driveId}/items/${parentId}:/${encodeURIComponent(
                    filename
                )}:/content`,
            createUploadSession: (driveId, parentId, filename) =>
                `/drives/${driveId}/items/${parentId}:/${encodeURIComponent(
                    filename
                )}:/createUploadSession`,
            listsBySite: (siteId) => `/sites/${siteId}/lists`,
            listById: (siteId, listId) => `/sites/${siteId}/lists/${listId}`,
            listItems: (siteId, listId) =>
                `/sites/${siteId}/lists/${listId}/items`,
            listItemById: (siteId, listId, itemId) =>
                `/sites/${siteId}/lists/${listId}/items/${itemId}`,
            listItemFields: (siteId, listId, itemId) =>
                `/sites/${siteId}/lists/${listId}/items/${itemId}/fields`,
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
     * Get the signed-in user's organization (first org in the collection).
     * GET /organization
     * https://learn.microsoft.com/en-us/graph/api/organization-get
     * Note: personal Microsoft accounts do not have an organization.
     */
    async getOrganization() {
        const response = await this._get({
            url: this.baseUrl + this.URLs.organization,
        });
        return Array.isArray(response?.value) ? response.value[0] : response;
    }

    // ---- Sites -------------------------------------------------------------

    /**
     * Search/list SharePoint sites.
     * GET /sites?search={query}
     * https://learn.microsoft.com/en-us/graph/api/site-search
     * Pass search='*' to enumerate accessible sites (common Graph pattern).
     */
    async listSites(params = {}) {
        const search = params.search !== undefined ? params.search : '*';
        const query = { search };
        if (params.$select) query.$select = params.$select;
        if (params.$top) query.$top = params.$top;
        return this._get({
            url: this.baseUrl + this.URLs.sites + this._buildQuery(query),
        });
    }

    /**
     * Get a site by id.
     * GET /sites/{site-id}
     * https://learn.microsoft.com/en-us/graph/api/site-get
     */
    async getSite(siteId) {
        return this._get({
            url: this.baseUrl + this.URLs.siteById(siteId),
        });
    }

    // ---- Drives ------------------------------------------------------------

    /**
     * List document libraries (drives) for a site.
     * GET /sites/{site-id}/drives
     * https://learn.microsoft.com/en-us/graph/api/drive-list
     */
    async listDrives(siteId) {
        return this._get({
            url: this.baseUrl + this.URLs.drivesBySite(siteId),
        });
    }

    /**
     * Get a drive by id.
     * GET /drives/{drive-id}
     * https://learn.microsoft.com/en-us/graph/api/drive-get
     */
    async getDrive(driveId) {
        return this._get({
            url: this.baseUrl + this.URLs.driveById(driveId),
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
     * Upload a small file (create or replace) by path under a parent item.
     * PUT /drives/{drive-id}/items/{parent-id}:/{filename}:/content
     * https://learn.microsoft.com/en-us/graph/api/driveitem-put-content
     * Max 250 MB. For larger files use createUploadSession.
     *
     * @param {string} driveId
     * @param {string} parentId - parent folder item id (or 'root')
     * @param {string} filename
     * @param {Buffer|string} content - file body
     * @param {string} [contentType='application/octet-stream']
     */
    async uploadDriveItemContent(
        driveId,
        parentId,
        filename,
        content,
        contentType = 'application/octet-stream'
    ) {
        return this._put(
            {
                url:
                    this.baseUrl +
                    this.URLs.driveItemContentByPath(
                        driveId,
                        parentId,
                        filename
                    ),
                headers: { 'Content-Type': contentType },
                body: content,
            },
            false
        );
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
     * Create an upload session for large files.
     * POST /drives/{drive-id}/items/{parent-id}:/{filename}:/createUploadSession
     * https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession
     */
    async createUploadSession(driveId, parentId, filename, data = {}) {
        const body =
            Object.keys(data).length > 0
                ? data
                : { item: { name: filename } };
        return this._post({
            url:
                this.baseUrl +
                this.URLs.createUploadSession(driveId, parentId, filename),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Lists -------------------------------------------------------------

    /**
     * List lists under a site.
     * GET /sites/{site-id}/lists
     * https://learn.microsoft.com/en-us/graph/api/list-list
     */
    async listLists(siteId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.listsBySite(siteId) +
                this._buildQuery(params),
        });
    }

    /**
     * Get a list by id.
     * GET /sites/{site-id}/lists/{list-id}
     * https://learn.microsoft.com/en-us/graph/api/list-get
     */
    async getList(siteId, listId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.listById(siteId, listId) +
                this._buildQuery(params),
        });
    }

    // ---- List items --------------------------------------------------------

    /**
     * List items in a list.
     * GET /sites/{site-id}/lists/{list-id}/items
     * https://learn.microsoft.com/en-us/graph/api/listitem-list
     */
    async listListItems(siteId, listId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.listItems(siteId, listId) +
                this._buildQuery(params),
        });
    }

    /**
     * Get a list item by id.
     * GET /sites/{site-id}/lists/{list-id}/items/{item-id}
     * https://learn.microsoft.com/en-us/graph/api/listitem-get
     */
    async getListItem(siteId, listId, itemId, params = {}) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.listItemById(siteId, listId, itemId) +
                this._buildQuery(params),
        });
    }

    /**
     * Create a list item.
     * POST /sites/{site-id}/lists/{list-id}/items
     * https://learn.microsoft.com/en-us/graph/api/listitem-create
     * Body typically: { fields: { Title: '...', ... } }
     */
    async createListItem(siteId, listId, data) {
        return this._post({
            url: this.baseUrl + this.URLs.listItems(siteId, listId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update list item column values.
     * PATCH /sites/{site-id}/lists/{list-id}/items/{item-id}/fields
     * https://learn.microsoft.com/en-us/graph/api/listitem-update
     */
    async updateListItemFields(siteId, listId, itemId, data) {
        return this._patch({
            url: this.baseUrl + this.URLs.listItemFields(siteId, listId, itemId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Change notification subscriptions ---------------------------------

    /**
     * List Graph subscriptions for the app/user.
     * GET /subscriptions
     * https://learn.microsoft.com/en-us/graph/api/subscription-list
     * SharePoint list resource path: /sites/{site-id}/lists/{list-id}
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
     * For SharePoint lists set resource to `/sites/{site-id}/lists/{list-id}`.
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
