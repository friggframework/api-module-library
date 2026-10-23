const { ApiKeyRequester, get } = require('@friggframework/core');

/**
 * Huggg API client.
 *
 * Auth (primary for this module): API key in the `X-Huggg-API-Key` header.
 *   https://docs.huggg.me/endpoints/authentication/api-keys/overview/
 *
 * Huggg also documents an OAuth password flow (client_credentials → password →
 * refresh_token) at https://docs.huggg.me/endpoints/authentication/overview/.
 * This client accepts an `access_token` Bearer as a secondary option so OAuth
 * tokens obtained outside the module still work; the Definition wires API-key
 * auth.
 *
 * Base URL: https://api.huggg.me (production) or https://beta.api.huggg.me (sandbox).
 * V2 paths live under /api/v2/*; V3 paths under /v3/* (official OpenAPI at
 * https://documentation.huggg.me/).
 *
 * Docs: https://docs.huggg.me/
 * V3 products/brands OpenAPI: https://documentation.huggg.me/
 *
 * The curated contract lives in ./huggg.openapi.yaml — this client mirrors it
 * 1:1 (one method per operationId). Keep them in sync.
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        this.api_key_name = 'X-Huggg-API-Key';
        // API key and OAuth Bearer are distinct credentials. Do not alias
        // access_token → api_key (that would send a Bearer token as X-Huggg-API-Key).
        this.api_key =
            get(params, 'api_key', null) || get(params, 'apiKey', null);
        this.access_token = get(params, 'access_token', null);

        this.isSandbox =
            get(params, 'isSandbox', false) === true ||
            get(params, 'is_sandbox', false) === true;

        this.baseUrl =
            get(params, 'base_url', null) ||
            (this.isSandbox
                ? 'https://beta.api.huggg.me'
                : 'https://api.huggg.me');

        this.tokenUri = `${this.baseUrl}/oauth/token`;

        this.client_id = get(params, 'client_id', null);
        this.client_secret = get(params, 'client_secret', null);
        this.refresh_token = get(params, 'refresh_token', null);
        this.username = get(params, 'username', null);
        this.password = get(params, 'password', null);

        this.URLs = {
            // V3 catalogue (official OpenAPI)
            products: '/v3/products/',
            productById: (id) => `/v3/products/${id}`,
            brands: '/v3/brands/',
            brandById: (id) => `/v3/brands/${id}`,

            // V2 gifts / wallets / transactions (docs.huggg.me)
            teamWallets: (teamId) => `/api/v2/teams/${teamId}/wallets`,
            transactions: '/api/v2/transactions',
            transactionById: (id) => `/api/v2/transactions/${id}`,
            cancelTransaction: (id) => `/api/v2/transactions/${id}/cancel`,
            hugggsFromTransaction: (id) =>
                `/api/v2/transactions/${id}/hugggs`,
            hugggById: (id) => `/api/v2/hugggs/${id}`,
            cancelHuggg: (id) => `/api/v2/hugggs/${id}/cancel`,
            productSegments: (id) => `/api/v2/products/${id}/segments`,

            // V3 search + bank payments
            searchHugggs: '/v3/searches/hugggs',
            bankPaymentOrders: '/v3/bank-payments/orders',
            bankPaymentOrderById: (id) => `/v3/bank-payments/orders/${id}`,
        };
    }

    /**
     * Prefer X-Huggg-API-Key when an API key is configured; otherwise send
     * Authorization: Bearer <access_token> for OAuth tokens.
     */
    async addAuthHeaders(headers = {}) {
        const next = { ...headers };
        if (this.api_key) {
            next[this.api_key_name] = this.api_key;
            return next;
        }
        if (this.access_token) {
            next.Authorization = `Bearer ${this.access_token}`;
        }
        return next;
    }

    isAuthenticated() {
        return !!(this.api_key || this.access_token);
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
            } else if (typeof value === 'object') {
                usp.append(key, JSON.stringify(value));
            } else {
                usp.append(key, String(value));
            }
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    // ---- OAuth helpers (documented; optional — Definition uses API key) ----

    /**
     * Client credentials grant.
     * POST /oauth/token  { grant_type: client_credentials, client_id, client_secret }
     * https://docs.huggg.me/endpoints/authentication/hugggoauth/oauth-token-client/
     */
    async getTokenFromClientCredentials() {
        // Token requests must not send X-Huggg-API-Key / Bearer.
        const savedKey = this.api_key;
        this.api_key = null;
        this.access_token = null;
        try {
            const response = await this._post(
                {
                    url: this.tokenUri,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        grant_type: 'client_credentials',
                        client_id: this.client_id,
                        client_secret: this.client_secret,
                    },
                },
                true
            );
            this.access_token = response.access_token;
            return response;
        } finally {
            // Restore API key only if we did not obtain a Bearer token.
            if (!this.access_token) this.api_key = savedKey;
        }
    }

    /**
     * Resource-owner password grant. Requires a valid client Bearer token
     * (call getTokenFromClientCredentials first).
     * POST /oauth/token  Authorization: Bearer <client>  { grant_type: password, ... }
     * https://docs.huggg.me/endpoints/authentication/hugggoauth/oauth-token-user/
     */
    async getTokenFromUsernamePassword() {
        const response = await this._post(
            {
                url: this.tokenUri,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    grant_type: 'password',
                    username: this.username,
                    password: this.password,
                },
            },
            true
        );
        this.api_key = null;
        this.access_token = response.access_token;
        if (response.refresh_token) {
            this.refresh_token = response.refresh_token;
        }
        return response;
    }

    /**
     * Refresh a user access token. Do not send Authorization (token is expired).
     * https://docs.huggg.me/endpoints/authentication/hugggoauth/oauth-token-refresh/
     */
    async refreshAccessToken(refreshTokenObject = {}) {
        const refreshToken =
            get(refreshTokenObject, 'refresh_token', null) || this.refresh_token;
        const previousAccess = this.access_token;
        const previousKey = this.api_key;
        // Ensure addAuthHeaders does not attach a stale Bearer / API key.
        this.access_token = null;
        this.api_key = null;
        try {
            const response = await this._post(
                {
                    url: this.tokenUri,
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        grant_type: 'refresh_token',
                        refresh_token: refreshToken,
                        client_id: this.client_id,
                        client_secret: this.client_secret,
                    },
                },
                true
            );
            this.access_token = response.access_token;
            if (response.refresh_token) {
                this.refresh_token = response.refresh_token;
            }
            return response;
        } catch (err) {
            this.access_token = previousAccess;
            this.api_key = previousKey;
            throw err;
        }
    }

    // ---- Products & brands (V3 OpenAPI) ------------------------------------

    /**
     * List products.
     * GET /v3/products/
     * Official OpenAPI: https://documentation.huggg.me/
     */
    async listProducts(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.products + this._buildQuery(params),
        });
    }

    /**
     * Get a product by id.
     * GET /v3/products/{id}
     */
    async getProduct(id) {
        return this._get({
            url: this.baseUrl + this.URLs.productById(id),
        });
    }

    /**
     * List brands.
     * GET /v3/brands/
     */
    async listBrands(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.brands + this._buildQuery(params),
        });
    }

    /**
     * Get a brand by id.
     * GET /v3/brands/{id}
     */
    async getBrand(id) {
        return this._get({
            url: this.baseUrl + this.URLs.brandById(id),
        });
    }

    /**
     * Get segments for a product.
     * GET /api/v2/products/{id}/segments
     * https://docs.huggg.me/endpoints/product-segments/
     */
    async getProductSegments(id) {
        return this._get({
            url: this.baseUrl + this.URLs.productSegments(id),
        });
    }

    // ---- Wallets -----------------------------------------------------------

    /**
     * Get a team's wallet(s). Response is an array; Huggg documents one wallet
     * per team.
     * GET /api/v2/teams/{teamId}/wallets
     * https://docs.huggg.me/endpoints/get-team-wallet/
     */
    async getTeamWallets(teamId) {
        return this._get({
            url: this.baseUrl + this.URLs.teamWallets(teamId),
        });
    }

    // ---- Transactions ------------------------------------------------------

    /**
     * Create a transaction (purchase huggg links from a wallet).
     * POST /api/v2/transactions  (optional ?embed[]=hugggs)
     * https://docs.huggg.me/endpoints/transactions/
     *
     * body.payment.method must be "walletCommitment"; payment.reference is the
     * wallet id. purchase.type is "huggg" or "bulkHugggs".
     */
    async createTransaction(body, params = {}) {
        const query = {};
        if (params.embed) {
            query['embed[]'] = params.embed;
        }
        return this._post({
            url:
                this.baseUrl +
                this.URLs.transactions +
                this._buildQuery(query),
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Get a transaction by id.
     * GET /api/v2/transactions/{transactionId}
     * https://docs.huggg.me/endpoints/get-transaction-by-id/
     */
    async getTransaction(transactionId) {
        return this._get({
            url: this.baseUrl + this.URLs.transactionById(transactionId),
        });
    }

    /**
     * Cancel all cancelable hugggs on a transaction.
     * POST /api/v2/transactions/{id}/cancel
     * https://docs.huggg.me/endpoints/transaction-cancel/
     */
    async cancelTransaction(transactionId) {
        return this._post({
            url: this.baseUrl + this.URLs.cancelTransaction(transactionId),
            headers: { 'Content-Type': 'application/json' },
            body: {},
        });
    }

    /**
     * List hugggs belonging to a transaction.
     * GET /api/v2/transactions/{transactionId}/hugggs
     * https://docs.huggg.me/endpoints/transactions-ID-hugggs/
     */
    async getHugggsFromTransaction(transactionId, params = {}) {
        const query = {};
        if (params.embed) {
            query['embed[]'] = params.embed;
        }
        return this._get({
            url:
                this.baseUrl +
                this.URLs.hugggsFromTransaction(transactionId) +
                this._buildQuery(query),
        });
    }

    // ---- Hugggs ------------------------------------------------------------

    /**
     * Get a huggg by id or shortcode.
     * GET /api/v2/hugggs/{hugggId}
     * https://docs.huggg.me/endpoints/hugggs-ID/
     */
    async getHuggg(hugggId, params = {}) {
        const query = {};
        if (params.embed) {
            query['embed[]'] = params.embed;
        }
        return this._get({
            url:
                this.baseUrl +
                this.URLs.hugggById(hugggId) +
                this._buildQuery(query),
        });
    }

    /**
     * Cancel a huggg by id or shortcode.
     * POST /api/v2/hugggs/{id}/cancel
     * https://docs.huggg.me/endpoints/huggg-cancel/
     */
    async cancelHuggg(hugggId) {
        return this._post({
            url: this.baseUrl + this.URLs.cancelHuggg(hugggId),
            headers: { 'Content-Type': 'application/json' },
            body: {},
        });
    }

    /**
     * Search hugggs (V3). Commonly used to poll recently updated hugggs or find
     * hugggs for a bank-payment order.
     * POST /v3/searches/hugggs
     * https://docs.huggg.me/endpoints/search/search-hugggs/
     */
    async searchHugggs(body = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.searchHugggs,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    // ---- Bank-payment orders -----------------------------------------------

    /**
     * Create a bank-payment order (1–1000 recipients, amounts in pence).
     * POST /v3/bank-payments/orders
     * https://docs.huggg.me/endpoints/bank-payments/create-order/
     */
    async createBankPaymentOrder(body) {
        return this._post({
            url: this.baseUrl + this.URLs.bankPaymentOrders,
            headers: { 'Content-Type': 'application/json' },
            body,
        });
    }

    /**
     * Get a bank-payment order by id.
     * GET /v3/bank-payments/orders/{orderId}
     * https://docs.huggg.me/endpoints/bank-payments/get-order/
     */
    async getBankPaymentOrder(orderId) {
        return this._get({
            url: this.baseUrl + this.URLs.bankPaymentOrderById(orderId),
        });
    }
}

module.exports = { Api };
