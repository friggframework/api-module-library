const { ApiKeyRequester, get } = require('@friggframework/core');

/**
 * ActiveCampaign API v3 client.
 *
 * Auth: API key sent in the `Api-Token` request header.
 *   curl -H "Api-Token: YOUR_KEY" https://{account}.api-us1.com/api/3/users/me
 *
 * Base URL is account-specific (Developer tab → API Access URL) plus `/api/3`.
 * Docs never guarantee `api-us1.com` for every account — always use the URL
 * the user pastes from Settings → Developer.
 *
 * Docs: https://developers.activecampaign.com/reference/authentication
 *       https://developers.activecampaign.com/reference/url
 */
const DEFAULT_API_HOST = 'https://youraccountname.api-us1.com';
const DEFAULT_BASE_URL = `${DEFAULT_API_HOST}/api/3`;

function normalizeApiUrl(apiUrl) {
    if (!apiUrl) return null;
    let url = String(apiUrl).trim().replace(/\/+$/, '');
    // Accept either the Developer-tab host or a host already ending in /api/3.
    url = url.replace(/\/api\/3$/i, '');
    return url;
}

class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        // ApiKeyRequester puts `headers[this.api_key_name] = this.api_key`
        this.api_key_name = 'Api-Token';
        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'apiKey', null) ||
            get(params, 'access_token', null);

        this.api_url =
            normalizeApiUrl(
                get(params, 'api_url', null) ||
                    get(params, 'apiUrl', null) ||
                    get(params, 'baseUrl', null)
            ) || DEFAULT_API_HOST;

        this.baseUrl = `${this.api_url}/api/3`;

        this.URLs = {
            usersMe: '/users/me',
            contacts: '/contacts',
            contactById: (id) => `/contacts/${id}`,
            accounts: '/accounts',
            accountById: (id) => `/accounts/${id}`,
            accountsBulkDelete: '/accounts/bulk_delete',
            accountContacts: '/accountContacts',
            accountContactById: (id) => `/accountContacts/${id}`,
            tags: '/tags',
            tagById: (id) => `/tags/${id}`,
            contactTags: '/contactTags',
            contactTagById: (id) => `/contactTags/${id}`,
            webhooks: '/webhooks',
            webhookById: (id) => `/webhooks/${id}`,
            bulkImport: '/import/bulk_import',
        };
    }

    /**
     * Point the client at a Developer-tab API Access URL.
     * @param {string} apiUrl e.g. https://acme.api-us1.com
     */
    setApiUrl(apiUrl) {
        this.api_url = normalizeApiUrl(apiUrl) || DEFAULT_API_HOST;
        this.baseUrl = `${this.api_url}/api/3`;
    }

    // ---- Identity ----------------------------------------------------------

    /**
     * Retrieve the logged-in user for this API key.
     * GET /users/me
     * https://developers.activecampaign.com/reference/get-user-loggedin
     */
    async getUser() {
        return this._get({
            url: this.baseUrl + this.URLs.usersMe,
        });
    }

    // ---- Contacts ----------------------------------------------------------

    /**
     * List, search, and filter contacts.
     * GET /contacts
     * https://developers.activecampaign.com/reference/list-all-contacts
     *
     * Common query params: email, search, status, listid, tagid, segmentid,
     * limit (≤100, default 20), offset, id_greater, orders[id], filters[…].
     */
    async listContacts(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.contacts,
            query,
        });
    }

    /**
     * Retrieve a contact by id.
     * GET /contacts/{id}
     * https://developers.activecampaign.com/reference/get-contact
     */
    async getContact(id, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.contactById(id),
            query,
        });
    }

    /**
     * Create a brand-new contact.
     * POST /contacts
     * https://developers.activecampaign.com/reference/create-a-new-contact
     *
     * Body: { contact: { email, firstName?, lastName?, phone?, fieldValues?, tags? } }
     * Duplicate email → 422. Use contact sync / bulk import to upsert.
     */
    async createContact(body) {
        return this._post({
            url: this.baseUrl + this.URLs.contacts,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update an existing contact.
     * PUT /contacts/{id}
     * https://developers.activecampaign.com/reference/update-a-contact-new
     * (PATCH on this path behaves the same as PUT.)
     */
    async updateContact(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.contactById(id),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Delete a contact by id.
     * DELETE /contacts/{id}
     * https://developers.activecampaign.com/reference/delete-contact
     */
    async deleteContact(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.contactById(id),
        });
    }

    /**
     * Bulk import up to 250 contacts (async; poll GET /import/info with batchId).
     * POST /import/bulk_import
     * https://developers.activecampaign.com/reference/bulk-import-contacts
     */
    async bulkContactImport(body) {
        return this._post({
            url: this.baseUrl + this.URLs.bulkImport,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Accounts (CRM company records) ------------------------------------

    /**
     * List CRM accounts.
     * GET /accounts
     * https://developers.activecampaign.com/reference/list-all-accounts
     */
    async listAccounts(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.accounts,
            query,
        });
    }

    /**
     * Retrieve a CRM account by id.
     * GET /accounts/{id}
     * https://developers.activecampaign.com/reference/retrieve-an-account
     */
    async getAccount(id) {
        return this._get({
            url: this.baseUrl + this.URLs.accountById(id),
        });
    }

    /**
     * Create a CRM account.
     * POST /accounts
     * https://developers.activecampaign.com/reference/create-an-account-new
     * Body: { account: { name, accountUrl?, owner?, fields? } }
     */
    async createAccount(body) {
        return this._post({
            url: this.baseUrl + this.URLs.accounts,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update a CRM account.
     * PUT /accounts/{id}
     * https://developers.activecampaign.com/reference/update-an-account-new
     */
    async updateAccount(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.accountById(id),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Bulk-delete CRM accounts.
     * DELETE is not offered for a single account; the documented endpoint is
     * POST /accounts/bulk_delete?ids[]=…
     * https://developers.activecampaign.com/reference/bulk-delete-accounts
     *
     * @param {Array<string|number>} ids account ids to delete
     */
    async bulkDeleteAccounts(ids = []) {
        // Official docs: POST /accounts/bulk_delete?ids[]=123&ids[]=456
        const usp = new URLSearchParams();
        for (const id of ids) {
            if (id === undefined || id === null) continue;
            usp.append('ids[]', String(id));
        }
        const qs = usp.toString();
        return this._post({
            url:
                this.baseUrl +
                this.URLs.accountsBulkDelete +
                (qs ? `?${qs}` : ''),
            headers: { 'Content-Type': 'application/json' },
            body: {},
        });
    }

    // ---- Account ↔ contact associations ------------------------------------

    /**
     * List account–contact associations.
     * GET /accountContacts
     * https://developers.activecampaign.com/reference/list-all-associations-1
     */
    async listAccountContacts(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.accountContacts,
            query,
        });
    }

    /**
     * Retrieve one account–contact association.
     * GET /accountContacts/{id}
     * https://developers.activecampaign.com/reference/retrieve-an-association
     */
    async getAccountContact(id) {
        return this._get({
            url: this.baseUrl + this.URLs.accountContactById(id),
        });
    }

    /**
     * Associate a contact with an account (one account per contact).
     * POST /accountContacts
     * https://developers.activecampaign.com/reference/create-an-account-1
     * Body: { accountContact: { account, contact, jobTitle? } }
     */
    async createAccountContact(body) {
        return this._post({
            url: this.baseUrl + this.URLs.accountContacts,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update an account–contact association.
     * PUT /accountContacts/{id}
     * https://developers.activecampaign.com/reference/update-an-association-1
     */
    async updateAccountContact(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.accountContactById(id),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Delete an account–contact association.
     * DELETE /accountContacts/{id}
     * https://developers.activecampaign.com/reference/delete-an-association-1
     */
    async deleteAccountContact(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.accountContactById(id),
        });
    }

    // ---- Tags --------------------------------------------------------------

    /**
     * List tag definitions.
     * GET /tags
     * https://developers.activecampaign.com/reference/retrieve-all-tags
     */
    async listTags(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.tags,
            query,
        });
    }

    /**
     * Create a tag definition (does not apply it to a contact).
     * POST /tags
     * https://developers.activecampaign.com/reference/create-a-new-tag
     * Body: { tag: { tag, tagType: 'contact'|'template', description? } }
     */
    async createTag(body) {
        return this._post({
            url: this.baseUrl + this.URLs.tags,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Delete a tag definition.
     * DELETE /tags/{id}
     * https://developers.activecampaign.com/reference/delete-a-tag
     */
    async deleteTag(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.tagById(id),
        });
    }

    /**
     * Apply an existing tag to an existing contact.
     * POST /contactTags
     * https://developers.activecampaign.com/reference/create-contact-tag
     * Body: { contactTag: { contact, tag } }  // both are ids
     */
    async createContactTag(body) {
        return this._post({
            url: this.baseUrl + this.URLs.contactTags,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Remove a tag from a contact (by contactTag association id).
     * DELETE /contactTags/{id}
     * https://developers.activecampaign.com/reference/remove-a-contacts-tag
     */
    async deleteContactTag(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.contactTagById(id),
        });
    }

    // ---- Webhooks (subscription management) --------------------------------

    /**
     * List webhook subscriptions.
     * GET /webhooks
     * https://developers.activecampaign.com/reference/get-a-list-of-webhooks
     */
    async listWebhooks(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.webhooks,
            query,
        });
    }

    /**
     * Retrieve a webhook by id.
     * GET /webhooks/{id}
     * https://developers.activecampaign.com/reference/get-webhook
     */
    async getWebhook(id) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookById(id),
        });
    }

    /**
     * Create a webhook subscription.
     * POST /webhooks
     * https://developers.activecampaign.com/reference/create-webhook
     * Body: { webhook: { name, url, events[], sources[], listid?, headers? } }
     */
    async createWebhook(body) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Update a webhook subscription.
     * PUT /webhooks/{id}
     * https://developers.activecampaign.com/reference/update-webhook
     */
    async updateWebhook(id, body) {
        return this._put({
            url: this.baseUrl + this.URLs.webhookById(id),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Delete a webhook subscription.
     * DELETE /webhooks/{id}
     * https://developers.activecampaign.com/reference/delete-webhook
     */
    async deleteWebhook(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(id),
        });
    }
}

module.exports = { Api, DEFAULT_BASE_URL, DEFAULT_API_HOST };
