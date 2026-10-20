const { ApiKeyRequester, get } = require('@friggframework/core');

/**
 * Terminus ABM Platform — Account Lists API client.
 *
 * Product: Terminus (now DemandScience ABM Platform). This module covers the
 * Account Lists surface used to organize target accounts into folders and lists.
 *
 * Auth: API key issued via DemandScience / Terminus CSM support ticket, sent as
 *   Authorization: Bearer <api_key>
 * Base URL: https://api.terminusplatform.com/accountLists/v2
 *
 * Official OpenAPI lives behind login on the Redocly developer portal
 * (https://developer.terminus.com/openapi/accountlists/ …). The methods below
 * are the subset previously exercised against the live host by the v1 module
 * integration tests (list/create folders & account lists; add/remove accounts).
 * Do not invent endpoints that are not verified against that surface.
 *
 * Sources:
 *   https://developer.terminus.com/ (login-gated OpenAPI; AccountListService_*)
 *   https://api.terminusplatform.com/ (live host; anonymous → 401)
 *   Legacy package: packages/needs-updating/terminus (moved here)
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        // Accept the key under common aliases; strip a pre-existing "Bearer "
        // prefix so setApiKey never double-prefixes. Persist the raw token as
        // `api_token` (see definition.apiPropertiesToPersist).
        const raw =
            get(params, 'api_token', null) ||
            get(params, 'api_key', null) ||
            get(params, 'apiKey', null) ||
            get(params, 'access_token', null);
        const token = raw ? String(raw).replace(/^Bearer\s+/i, '').trim() : null;

        this.api_token = token;
        // ApiKeyRequester.addAuthHeaders() sets headers[api_key_name] = api_key.
        this.api_key_name = 'Authorization';
        this.api_key = token ? `Bearer ${token}` : null;

        this.baseUrl = 'https://api.terminusplatform.com/accountLists/v2';

        this.URLs = {
            accountLists: '/accountLists',
            folders: '/folders',
            addAccountsToList: (listId) =>
                `/accountLists/${listId}/accounts/add`,
            removeAccountsFromList: (listId) =>
                `/accountLists/${listId}/accounts/remove`,
        };
    }

    /**
     * Re-hydrate the Bearer credential after form auth / credential load.
     * Stores the raw token and sets Authorization to `Bearer <token>`.
     */
    setApiKey(apiKey) {
        const token = apiKey
            ? String(apiKey).replace(/^Bearer\s+/i, '').trim()
            : null;
        this.api_token = token;
        this.api_key = token ? `Bearer ${token}` : null;
    }

    // ---- Folders -----------------------------------------------------------

    /**
     * List account-list folders.
     * GET /accountLists/v2/folders
     *
     * Response (verified via live integration tests):
     *   { folders: [{ uuid, name, orgUuid, folderAccess, createdMomentUtc }],
     *     nextPageToken }
     */
    async listFolders(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.folders,
            query: params,
        });
    }

    /**
     * Create a folder.
     * POST /accountLists/v2/folders
     *
     * body (verified): { folderName, folderAccess }  // folderAccess e.g. 'PUBLIC'
     * Response: { folderId, displayName, folderAccess }
     */
    async createFolder(body) {
        return this._post({
            url: this.baseUrl + this.URLs.folders,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Account lists -----------------------------------------------------

    /**
     * List account lists.
     * GET /accountLists/v2/accountLists
     *
     * Response (verified):
     *   { lists: [{ id, displayName, createTime, estimatedAccountsCount, folderId }],
     *     nextPageToken }
     */
    async listAccountLists(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.accountLists,
            query: params,
        });
    }

    /**
     * Create an account list in a folder.
     * POST /accountLists/v2/accountLists
     *
     * body (verified): { listName, folderId }
     * Response: { listId, listName, folderId }
     */
    async createAccountList(body) {
        return this._post({
            url: this.baseUrl + this.URLs.accountLists,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Add accounts to an account list.
     * POST /accountLists/v2/accountLists/{listId}/accounts/add
     *
     * body (verified): { accounts: [{ id, crmOrgId?, crmType? }] }
     * Response: { listId, successfulAccounts, accountsNotFound,
     *             addedAccounts, duplicateAccounts }
     */
    async addAccountsToList(listId, body) {
        return this._post({
            url: this.baseUrl + this.URLs.addAccountsToList(listId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Remove accounts from an account list.
     * POST /accountLists/v2/accountLists/{listId}/accounts/remove
     *
     * body (verified): { accounts: [{ id, crmOrgId?, crmType? }] }
     * Response: { listId, accounts }
     */
    async removeAccountsFromList(listId, body) {
        return this._post({
            url: this.baseUrl + this.URLs.removeAccountsFromList(listId),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Auth check --------------------------------------------------------

    /**
     * Lightweight authenticated request used to validate the API key.
     * Mirrors the v1 Manager.testAuth path (listFolders).
     */
    async testAuth() {
        return this.listFolders();
    }
}

module.exports = { Api };
