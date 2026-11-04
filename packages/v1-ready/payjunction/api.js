const { OAuth2Requester, get } = require('@friggframework/core');

/**
 * PayJunction REST API client.
 *
 * Auth (ported Left Hook module / partner Trinity OAuth notes):
 *   - Authorization-code OAuth2 against www.payjunction.com/trinity/oauth/*
 *   - Token exchange + refresh use HTTP Basic (client_id:client_secret)
 *   - API calls send `Authorization: Bearer <access_token>` plus
 *     `X-PJ-Application-Key: <app_key>`
 *
 * Public developer portal documents HTTP Basic (apiLogin:apiPassword) +
 * Application Key instead of Bearer OAuth. See open questions in the PR.
 *
 * Base URL (production): https://api.payjunction.com
 * Labs (sandbox):        https://api.payjunctionlabs.com
 *
 * Official docs: https://developer.payjunction.com/
 */
class Api extends OAuth2Requester {
    constructor(params = {}) {
        super(params);

        this.client_id =
            get(params, 'client_id', null) ||
            process.env.PAYJUNCTION_CLIENT_ID;
        this.client_secret =
            get(params, 'client_secret', null) ||
            process.env.PAYJUNCTION_CLIENT_SECRET;
        this.redirect_uri =
            get(params, 'redirect_uri', null) ||
            process.env.PAYJUNCTION_REDIRECT_URI ||
            (process.env.REDIRECT_URI
                ? `${process.env.REDIRECT_URI}/payjunction`
                : null);
        this.app_key =
            get(params, 'app_key', null) ||
            get(params, 'application_key', null) ||
            process.env.PAYJUNCTION_APP_KEY;
        this.scope =
            get(params, 'scope', null) ||
            process.env.PAYJUNCTION_SCOPE ||
            'read write';

        const sandbox =
            get(params, 'sandbox', null) === true ||
            String(process.env.PAYJUNCTION_SANDBOX || '').toLowerCase() ===
                'true';

        // Official Labs host is payjunctionlabs.com (not sandbox.payjunction.com).
        this.authBaseUrl =
            get(params, 'authBaseUrl', null) ||
            process.env.PAYJUNCTION_AUTH_BASE_URL ||
            (sandbox
                ? 'https://www.payjunctionlabs.com'
                : 'https://www.payjunction.com');

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'base_url', null) ||
            process.env.PAYJUNCTION_BASE_URL ||
            (sandbox
                ? 'https://api.payjunctionlabs.com'
                : 'https://api.payjunction.com');

        // Keep OAuth2Requester's baseURL field in sync for core helpers.
        this.baseURL = this.baseUrl;

        this.tokenUri = `${this.authBaseUrl}/trinity/oauth/token`;
        this.authorizationUri = `${this.authBaseUrl}/trinity/oauth/authorize`;

        this.URLs = {
            merchant: '/merchant',
            transactions: '/transactions',
            transactionById: (id) => `/transactions/${id}`,
            transactionReceipt: (id) => `/transactions/${id}/receipts/latest`,
            customers: '/customers',
            customerById: (id) => `/customers/${id}`,
            invoices: '/invoices',
            invoiceById: (id) => `/invoices/${id}`,
            settlements: '/settlements',
            settlementById: (id) => `/settlements/${id}`,
            deposits: '/deposits',
            depositById: (id) => `/deposits/${id}`,
            terminals: '/terminals',
            smartTerminals: '/smartterminals',
            webhooks: '/webhooks',
            webhookById: (id) => `/webhooks/${id}`,
        };
    }

    getAuthorizationUri() {
        const params = new URLSearchParams({
            client_id: this.client_id || '',
            redirect_uri: this.redirect_uri || '',
            response_type: 'code',
        });
        if (this.scope) params.set('scope', this.scope);
        if (this.state) params.set('state', this.state);
        return `${this.authorizationUri}?${params.toString()}`;
    }

    getAuthUri() {
        return this.getAuthorizationUri();
    }

    /**
     * Exchange authorization code for tokens.
     * PayJunction token endpoint expects HTTP Basic client credentials
     * (same shape as OAuth2Requester.getTokenFromCodeBasicAuthHeader).
     */
    async getTokenFromCode(code) {
        return this.getTokenFromCodeBasicAuthHeader(code);
    }

    async refreshAccessToken(refreshTokenObject) {
        this.access_token = undefined;
        const refreshToken =
            typeof refreshTokenObject === 'string'
                ? refreshTokenObject
                : refreshTokenObject.refresh_token;

        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refreshToken);

        const options = {
            body: params,
            url: this.tokenUri,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(
                    `${this.client_id}:${this.client_secret}`
                ).toString('base64')}`,
            },
        };
        const response = await this._post(options, false);
        await this.setTokens(response);
        return response;
    }

    async addAuthHeaders(headers = {}) {
        const next = await super.addAuthHeaders(headers);
        if (this.app_key) {
            next['X-PJ-Application-Key'] = this.app_key;
        }
        if (!next.Accept) {
            next.Accept = 'application/json';
        }
        return next;
    }

    _formBody(data = {}) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(data)) {
            if (value === undefined || value === null) continue;
            if (typeof value === 'object' && !Array.isArray(value)) {
                // PayJunction nested form keys: metadata[externalId]=...
                for (const [nestedKey, nestedValue] of Object.entries(value)) {
                    if (nestedValue === undefined || nestedValue === null) {
                        continue;
                    }
                    params.append(`${key}[${nestedKey}]`, String(nestedValue));
                }
            } else {
                params.append(key, String(value));
            }
        }
        return params;
    }

    // ---- Merchant / identity -----------------------------------------------

    /**
     * GET /merchant
     * Returns companyLegal, companyDba, address, and `id` (Pj-Merchant UUID).
     * @see https://developer.payjunction.com/hc/en-us/articles/12090782110619-GET-merchant
     */
    async getMerchant() {
        return this._get({ url: this.baseUrl + this.URLs.merchant });
    }

    // ---- Transactions ------------------------------------------------------

    /**
     * GET /transactions
     * @see https://developer.payjunction.com/hc/en-us/articles/1260802694490-GET-transactions-query-parameters
     */
    async listTransactions(params = {}) {
        const { limit = 50, offset = 0, ...filters } = params;
        return this._get({
            url: this.baseUrl + this.URLs.transactions,
            query: { limit, offset, ...filters },
        });
    }

    /** GET /transactions/{transactionId} */
    async getTransaction(transactionId) {
        return this._get({
            url: this.baseUrl + this.URLs.transactionById(transactionId),
        });
    }

    /**
     * POST /transactions — form-urlencoded CHARGE / REFUND / VERIFY / etc.
     * @see https://developer.payjunction.com/hc/en-us/articles/216477407-POST-transactions
     */
    async createTransaction(data) {
        return this._post(
            {
                url: this.baseUrl + this.URLs.transactions,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: this._formBody(data),
            },
            false
        );
    }

    /**
     * GET /transactions/{transactionId}/receipts/latest
     * Optional query: format=HTML|PDF|...
     */
    async getTransactionReceipt(transactionId, format = 'HTML') {
        return this._get({
            url: this.baseUrl + this.URLs.transactionReceipt(transactionId),
            query: { format },
        });
    }

    // ---- Customers ---------------------------------------------------------

    /**
     * GET /customers
     * @see https://developer.payjunction.com/hc/en-us/articles/232222208-GET-customers-query-parameters
     */
    async listCustomers(params = {}) {
        const { limit = 50, offset = 0, ...filters } = params;
        return this._get({
            url: this.baseUrl + this.URLs.customers,
            query: { limit, offset, ...filters },
        });
    }

    /** GET /customers/{customerId} */
    async getCustomer(customerId) {
        return this._get({
            url: this.baseUrl + this.URLs.customerById(customerId),
        });
    }

    /** POST /customers — form-urlencoded */
    async createCustomer(data) {
        return this._post(
            {
                url: this.baseUrl + this.URLs.customers,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: this._formBody(data),
            },
            false
        );
    }

    /** PUT /customers/{customerId} — form-urlencoded */
    async updateCustomer(customerId, data) {
        return this._put(
            {
                url: this.baseUrl + this.URLs.customerById(customerId),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: this._formBody(data),
            },
            false
        );
    }

    // ---- Invoices ----------------------------------------------------------

    /** GET /invoices */
    async listInvoices(params = {}) {
        const { limit = 50, offset = 0, ...filters } = params;
        return this._get({
            url: this.baseUrl + this.URLs.invoices,
            query: { limit, offset, ...filters },
        });
    }

    /** GET /invoices/{invoiceId} */
    async getInvoice(invoiceId) {
        return this._get({
            url: this.baseUrl + this.URLs.invoiceById(invoiceId),
        });
    }

    /**
     * POST /invoices — form-urlencoded (not JSON).
     * @see https://developer.payjunction.com/hc/en-us/articles/1260800368569-POST-invoices
     */
    async createInvoice(data) {
        return this._post(
            {
                url: this.baseUrl + this.URLs.invoices,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: this._formBody(data),
            },
            false
        );
    }

    // ---- Settlements / deposits / terminals --------------------------------

    /**
     * GET /settlements
     * @see https://developer.payjunction.com/hc/en-us/articles/360008644993-GET-settlements-offset-index
     */
    async listSettlements(params = {}) {
        const { limit = 50, offset = 0, ...filters } = params;
        return this._get({
            url: this.baseUrl + this.URLs.settlements,
            query: { limit, offset, ...filters },
        });
    }

    /** GET /settlements/{settlementId} */
    async getSettlement(settlementId) {
        return this._get({
            url: this.baseUrl + this.URLs.settlementById(settlementId),
        });
    }

    /** GET /deposits */
    async listDeposits(params = {}) {
        const { limit = 50, offset = 0, ...filters } = params;
        return this._get({
            url: this.baseUrl + this.URLs.deposits,
            query: { limit, offset, ...filters },
        });
    }

    /**
     * GET /deposits/{depositId}
     * @see https://developer.payjunction.com/hc/en-us/articles/360009731153-GET-deposits-depositId
     */
    async getDeposit(depositId) {
        return this._get({
            url: this.baseUrl + this.URLs.depositById(depositId),
        });
    }

    /**
     * GET /terminals
     * @see https://developer.payjunction.com/hc/en-us/articles/360005458674-GET-terminals
     */
    async listTerminals(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.terminals,
            query: params,
        });
    }

    /**
     * GET /smartterminals
     * @see https://developer.payjunction.com/hc/en-us/articles/221121127-GET-smartterminals
     */
    async listSmartTerminals(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.smartTerminals,
            query: params,
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * GET /webhooks
     * @see https://developer.payjunction.com/hc/en-us/articles/115004486287-Available-Webhooks
     */
    async listWebhooks() {
        return this._get({ url: this.baseUrl + this.URLs.webhooks });
    }

    /**
     * POST /webhooks — form-urlencoded { event, url, secret? }
     * Events: CUSTOMER | DEPOSIT | SETTLEMENT | SMARTTERMINAL_REQUEST |
     *         TRANSACTION | TRANSACTION_SIGNATURE
     * @see https://developer.payjunction.com/hc/en-us/articles/219594068-POST-webhooks
     */
    async createWebhook(data) {
        // Back-compat with the ported (event, url, secret?) call shape.
        let body = data;
        if (typeof data === 'string') {
            body = {
                event: data,
                url: arguments[1],
                secret: arguments[2],
            };
        }
        return this._post(
            {
                url: this.baseUrl + this.URLs.webhooks,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: this._formBody(body),
            },
            false
        );
    }

    /**
     * PUT /webhooks/{webhookId}
     * @see https://developer.payjunction.com/hc/en-us/articles/219594268-PUT-webhooks-webhookId
     */
    async updateWebhook(webhookId, data) {
        return this._put(
            {
                url: this.baseUrl + this.URLs.webhookById(webhookId),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: this._formBody(data),
            },
            false
        );
    }

    /** DELETE /webhooks/{webhookId} */
    async deleteWebhook(webhookId) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
        });
    }
}

module.exports = { Api };
