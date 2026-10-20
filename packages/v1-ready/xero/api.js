const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * Xero Accounting API client.
 *
 * Auth: OAuth 2.0 authorization code + refresh tokens.
 *   Authorize: https://login.xero.com/identity/connect/authorize
 *   Token:     https://identity.xero.com/connect/token
 *   Tenants:   GET https://api.xero.com/Connections  (Identity API)
 *
 * Every Accounting API call must send `xero-tenant-id` (the connection's
 * `tenantId`, not the connection `id`). Set it via `setTenant(tenantId)` or
 * pass `tenantId` in the constructor / persisted entity.
 *
 * Base URL (Accounting): https://api.xero.com/api.xro/2.0
 * Official OpenAPI: https://github.com/XeroAPI/Xero-OpenAPI (xero_accounting.yaml)
 * Docs: https://developer.xero.com/documentation/api/accounting/overview
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl = 'https://api.xero.com/api.xro/2.0';
        this.identityBaseUrl = 'https://api.xero.com';

        this.tokenUri = 'https://identity.xero.com/connect/token';
        this.authorizationUri = encodeURI(
            `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&scope=${this.scope}&state=${this.state}`
        );

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
        this.tenantId =
            get(params, 'tenantId', null) ||
            get(params, 'tenant_id', null) ||
            null;

        this.URLs = {
            connections: '/Connections',
            connectionById: (id) => `/Connections/${id}`,
            organisation: '/Organisation',
            contacts: '/Contacts',
            contactById: (contactId) => `/Contacts/${contactId}`,
            invoices: '/Invoices',
            invoiceById: (invoiceId) => `/Invoices/${invoiceId}`,
            accounts: '/Accounts',
            accountById: (accountId) => `/Accounts/${accountId}`,
            payments: '/Payments',
            paymentById: (paymentId) => `/Payments/${paymentId}`,
            items: '/Items',
            itemById: (itemId) => `/Items/${itemId}`,
        };
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    /**
     * Persist the organisation tenant id used on subsequent Accounting calls.
     * @param {string} tenantId - The `tenantId` from GET /Connections.
     */
    setTenant(tenantId) {
        this.tenantId = tenantId || null;
    }

    /**
     * Alias used by the Frigg definition docs example.
     * @returns {Promise<Array>} Connections for the current access token.
     */
    async getTenants(params = {}) {
        return this.getConnections(params);
    }

    async addAuthHeaders(headers = {}) {
        const next = await super.addAuthHeaders(headers);
        if (this.tenantId) {
            next['xero-tenant-id'] = this.tenantId;
        }
        return next;
    }

    addJsonHeaders(options) {
        options.headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...options.headers,
        };
    }

    async _get(options) {
        this.addJsonHeaders(options);
        return super._get(options);
    }

    async _post(options, stringify) {
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    async _put(options, stringify) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    async _delete(options) {
        this.addJsonHeaders(options);
        return super._delete(options);
    }

    _assertTenant() {
        if (!this.tenantId) {
            throw new Error(
                'Xero: xero-tenant-id is required for Accounting API calls. Call setTenant(tenantId) after getConnections().'
            );
        }
    }

    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                for (const v of value) {
                    if (v === undefined || v === null) continue;
                    usp.append(key, String(v));
                }
            } else {
                usp.append(key, String(value));
            }
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    // ---- Identity / Connections --------------------------------------------

    /**
     * List authorised tenant connections for this access token.
     * GET https://api.xero.com/Connections  (Identity API — not Accounting)
     * Official OpenAPI: xero-identity.yaml operationId getConnections
     */
    async getConnections(params = {}) {
        return this._get({
            url:
                this.identityBaseUrl +
                this.URLs.connections +
                this._buildQuery(params),
        });
    }

    /**
     * Disconnect a tenant connection.
     * DELETE https://api.xero.com/Connections/{id}
     * Official OpenAPI: xero-identity.yaml operationId deleteConnection
     * @param {string} connectionId - The connection `id` (not tenantId).
     */
    async deleteConnection(connectionId) {
        return this._delete({
            url: this.identityBaseUrl + this.URLs.connectionById(connectionId),
        });
    }

    // ---- Organisation ------------------------------------------------------

    /**
     * Retrieve organisation details for the current tenant.
     * GET /Organisation — operationId getOrganisations
     */
    async getOrganisations() {
        this._assertTenant();
        return this._get({
            url: this.baseUrl + this.URLs.organisation,
        });
    }

    /**
     * Convenience: first Organisation from getOrganisations().
     */
    async getOrganisation() {
        const result = await this.getOrganisations();
        const orgs = result?.Organisations || result?.organisations || [];
        return Array.isArray(orgs) ? orgs[0] : null;
    }

    // ---- Contacts ----------------------------------------------------------

    /**
     * List contacts.
     * GET /Contacts — operationId getContacts
     * Optional query: where, order, IDs, page, includeArchived, summaryOnly, searchTerm
     * Optional header via params.ifModifiedSince (If-Modified-Since).
     */
    async getContacts(params = {}) {
        this._assertTenant();
        const { ifModifiedSince, ...query } = params;
        const options = {
            url: this.baseUrl + this.URLs.contacts + this._buildQuery(query),
            headers: {},
        };
        if (ifModifiedSince) {
            options.headers['If-Modified-Since'] = ifModifiedSince;
        }
        return this._get(options);
    }

    /**
     * Get one contact by ContactID.
     * GET /Contacts/{ContactID} — operationId getContact
     */
    async getContact(contactId) {
        this._assertTenant();
        return this._get({
            url: this.baseUrl + this.URLs.contactById(contactId),
        });
    }

    /**
     * Create contacts (bulk).
     * PUT /Contacts — operationId createContacts
     * @param {object} body - `{ Contacts: [ Contact, ... ] }`
     * @param {object} [opts] - Optional `{ idempotencyKey }`
     */
    async createContacts(body, opts = {}) {
        this._assertTenant();
        const options = {
            url: this.baseUrl + this.URLs.contacts,
            body,
            headers: {},
        };
        if (opts.idempotencyKey) {
            options.headers['Idempotency-Key'] = opts.idempotencyKey;
        }
        return this._put(options);
    }

    /**
     * Update a contact.
     * POST /Contacts/{ContactID} — operationId updateContact
     * @param {string} contactId
     * @param {object} body - `{ Contacts: [ Contact ] }`
     */
    async updateContact(contactId, body) {
        this._assertTenant();
        return this._post({
            url: this.baseUrl + this.URLs.contactById(contactId),
            body,
        });
    }

    // ---- Invoices ----------------------------------------------------------

    /**
     * List invoices.
     * GET /Invoices — operationId getInvoices
     */
    async getInvoices(params = {}) {
        this._assertTenant();
        const { ifModifiedSince, ...query } = params;
        const options = {
            url: this.baseUrl + this.URLs.invoices + this._buildQuery(query),
            headers: {},
        };
        if (ifModifiedSince) {
            options.headers['If-Modified-Since'] = ifModifiedSince;
        }
        return this._get(options);
    }

    /**
     * Get one invoice by InvoiceID.
     * GET /Invoices/{InvoiceID} — operationId getInvoice
     */
    async getInvoice(invoiceId) {
        this._assertTenant();
        return this._get({
            url: this.baseUrl + this.URLs.invoiceById(invoiceId),
        });
    }

    /**
     * Create invoices (bulk).
     * PUT /Invoices — operationId createInvoices
     * @param {object} body - `{ Invoices: [ Invoice, ... ] }`
     */
    async createInvoices(body, opts = {}) {
        this._assertTenant();
        const options = {
            url: this.baseUrl + this.URLs.invoices,
            body,
            headers: {},
        };
        if (opts.idempotencyKey) {
            options.headers['Idempotency-Key'] = opts.idempotencyKey;
        }
        return this._put(options);
    }

    /**
     * Update an invoice.
     * POST /Invoices/{InvoiceID} — operationId updateInvoice
     */
    async updateInvoice(invoiceId, body) {
        this._assertTenant();
        return this._post({
            url: this.baseUrl + this.URLs.invoiceById(invoiceId),
            body,
        });
    }

    // ---- Accounts (chart of accounts) --------------------------------------

    /**
     * List accounts.
     * GET /Accounts — operationId getAccounts
     */
    async getAccounts(params = {}) {
        this._assertTenant();
        const { ifModifiedSince, ...query } = params;
        const options = {
            url: this.baseUrl + this.URLs.accounts + this._buildQuery(query),
            headers: {},
        };
        if (ifModifiedSince) {
            options.headers['If-Modified-Since'] = ifModifiedSince;
        }
        return this._get(options);
    }

    /**
     * Get one account.
     * GET /Accounts/{AccountID} — operationId getAccount
     */
    async getAccount(accountId) {
        this._assertTenant();
        return this._get({
            url: this.baseUrl + this.URLs.accountById(accountId),
        });
    }

    /**
     * Create an account.
     * PUT /Accounts — operationId createAccount
     * @param {object} body - `{ Code, Name, Type, ... }` (Account object)
     */
    async createAccount(body, opts = {}) {
        this._assertTenant();
        const options = {
            url: this.baseUrl + this.URLs.accounts,
            body,
            headers: {},
        };
        if (opts.idempotencyKey) {
            options.headers['Idempotency-Key'] = opts.idempotencyKey;
        }
        return this._put(options);
    }

    /**
     * Update an account.
     * POST /Accounts/{AccountID} — operationId updateAccount
     */
    async updateAccount(accountId, body) {
        this._assertTenant();
        return this._post({
            url: this.baseUrl + this.URLs.accountById(accountId),
            body,
        });
    }

    // ---- Payments ----------------------------------------------------------

    /**
     * List payments.
     * GET /Payments — operationId getPayments
     */
    async getPayments(params = {}) {
        this._assertTenant();
        const { ifModifiedSince, ...query } = params;
        const options = {
            url: this.baseUrl + this.URLs.payments + this._buildQuery(query),
            headers: {},
        };
        if (ifModifiedSince) {
            options.headers['If-Modified-Since'] = ifModifiedSince;
        }
        return this._get(options);
    }

    /**
     * Get one payment.
     * GET /Payments/{PaymentID} — operationId getPayment
     */
    async getPayment(paymentId) {
        this._assertTenant();
        return this._get({
            url: this.baseUrl + this.URLs.paymentById(paymentId),
        });
    }

    /**
     * Create a single payment.
     * POST /Payments — operationId createPayment
     */
    async createPayment(body, opts = {}) {
        this._assertTenant();
        const options = {
            url: this.baseUrl + this.URLs.payments,
            body,
            headers: {},
        };
        if (opts.idempotencyKey) {
            options.headers['Idempotency-Key'] = opts.idempotencyKey;
        }
        return this._post(options);
    }

    // ---- Items -------------------------------------------------------------

    /**
     * List items.
     * GET /Items — operationId getItems
     */
    async getItems(params = {}) {
        this._assertTenant();
        const { ifModifiedSince, ...query } = params;
        const options = {
            url: this.baseUrl + this.URLs.items + this._buildQuery(query),
            headers: {},
        };
        if (ifModifiedSince) {
            options.headers['If-Modified-Since'] = ifModifiedSince;
        }
        return this._get(options);
    }

    /**
     * Get one item.
     * GET /Items/{ItemID} — operationId getItem
     */
    async getItem(itemId) {
        this._assertTenant();
        return this._get({
            url: this.baseUrl + this.URLs.itemById(itemId),
        });
    }

    /**
     * Create items (bulk).
     * PUT /Items — operationId createItems
     * @param {object} body - `{ Items: [ Item, ... ] }`
     */
    async createItems(body, opts = {}) {
        this._assertTenant();
        const options = {
            url: this.baseUrl + this.URLs.items,
            body,
            headers: {},
        };
        if (opts.idempotencyKey) {
            options.headers['Idempotency-Key'] = opts.idempotencyKey;
        }
        return this._put(options);
    }

    /**
     * Update an item.
     * POST /Items/{ItemID} — operationId updateItem
     */
    async updateItem(itemId, body) {
        this._assertTenant();
        return this._post({
            url: this.baseUrl + this.URLs.itemById(itemId),
            body,
        });
    }

    /**
     * Delete an item.
     * DELETE /Items/{ItemID} — operationId deleteItem
     */
    async deleteItem(itemId) {
        this._assertTenant();
        return this._delete({
            url: this.baseUrl + this.URLs.itemById(itemId),
        });
    }
}

module.exports = { Api };
