const {
    Requester,
    ModuleConstants,
    get,
} = require('@friggframework/core');

/**
 * Airwallex Client API.
 *
 * Auth: exchange `x-client-id` + `x-api-key` for a short-lived bearer token via
 * `POST /api/v1/authentication/login`, then send `Authorization: Bearer <token>`
 * on every subsequent call. Tokens last ~30 minutes; reuse until `expires_at`.
 *
 * Extends Requester (not OAuth2Requester): credentials are API-key style, even
 * though authenticated calls use a bearer token. `requesterType` is `apiKey` so
 * Frigg auth/validate treat this as an API-key module (setAuthParams form).
 *
 * Base URLs (official OpenAPI servers):
 *   Production: https://api.airwallex.com
 *   Sandbox:    https://api.sandbox.airwallex.com
 *
 * Docs: https://www.airwallex.com/docs/api
 * OpenAPI: https://github.com/airwallex/airwallex-openapi
 *
 * The curated contract in ./airwallex.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Keep them in sync.
 */
class Api extends Requester {
    static requesterType = ModuleConstants.authType.apiKey;

    constructor(params = {}) {
        super(params);

        this.DLGT_TOKEN_UPDATE = 'TOKEN_UPDATE';
        this.delegateTypes.push(this.DLGT_TOKEN_UPDATE);

        this.api_key =
            get(params, 'api_key', null) || get(params, 'apiKey', null);
        this.client_id =
            get(params, 'client_id', null) || get(params, 'clientId', null);
        this.login_as =
            get(params, 'login_as', null) || get(params, 'loginAs', null);

        this.baseUrl =
            get(params, 'base_url', null) ||
            get(params, 'baseUrl', null) ||
            process.env.AIRWALLEX_BASE_URL ||
            'https://api.airwallex.com';
        // Alias for apiPropertiesToPersist (snake_case credential fields).
        this.base_url = this.baseUrl;

        // Bearer token may already be persisted from a prior login.
        this.access_token = get(params, 'access_token', null);
        const expiresAt =
            get(params, 'expires_at', null) ||
            get(params, 'accessTokenExpire', null);
        if (expiresAt) {
            this.accessTokenExpire =
                expiresAt instanceof Date
                    ? expiresAt
                    : new Date(Api._normalizeIso(expiresAt));
            this.expires_at =
                expiresAt instanceof Date
                    ? expiresAt.toISOString()
                    : String(expiresAt);
        }

        // Airwallex has no OAuth refresh_token; re-login with api_key + client_id.
        this.isRefreshable = true;

        this.URLs = {
            login: '/api/v1/authentication/login',
            account: '/api/v1/account',
            currentBalances: '/api/v1/balances/current',
            balanceHistory: '/api/v1/balances/history',
            financialTransactions: '/api/v1/financial_transactions',
            financialTransactionById: (id) =>
                `/api/v1/financial_transactions/${id}`,
            beneficiaries: '/api/v1/beneficiaries',
            beneficiaryCreate: '/api/v1/beneficiaries/create',
            beneficiaryById: (id) => `/api/v1/beneficiaries/${id}`,
            beneficiaryUpdate: (id) => `/api/v1/beneficiaries/${id}/update`,
            transfers: '/api/v1/transfers',
            transferCreate: '/api/v1/transfers/create',
            transferById: (id) => `/api/v1/transfers/${id}`,
            customers: '/api/v1/pa/customers',
            customerCreate: '/api/v1/pa/customers/create',
            customerById: (id) => `/api/v1/pa/customers/${id}`,
            customerUpdate: (id) => `/api/v1/pa/customers/${id}/update`,
            paymentAttempts: '/api/v1/pa/payment_attempts',
            paymentAttemptById: (id) => `/api/v1/pa/payment_attempts/${id}`,
            paymentLinkCreate: '/api/v1/pa/payment_links/create',
            paymentLinkById: (id) => `/api/v1/pa/payment_links/${id}`,
            paymentLinkNotify: (id) =>
                `/api/v1/pa/payment_links/${id}/notify_shopper`,
            charges: '/api/v1/charges',
            chargeById: (id) => `/api/v1/charges/${id}`,
            cards: '/api/v1/issuing/cards',
            cardCreate: '/api/v1/issuing/cards/create',
            cardById: (id) => `/api/v1/issuing/cards/${id}`,
            cardLimits: (id) => `/api/v1/issuing/cards/${id}/limits`,
            cardholderCreate: '/api/v1/issuing/cardholders/create',
            webhooks: '/api/v1/webhooks',
            webhookCreate: '/api/v1/webhooks/create',
            webhookById: (id) => `/api/v1/webhooks/${id}`,
            webhookUpdate: (id) => `/api/v1/webhooks/${id}/update`,
            webhookDelete: (id) => `/api/v1/webhooks/${id}/delete`,
        };
    }

    /**
     * Airwallex returns `+0000` (no colon). Normalize so `Date` parses reliably.
     */
    static _normalizeIso(value) {
        const s = String(value);
        return s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
    }

    isAuthenticated() {
        const hasToken =
            typeof this.access_token === 'string' &&
            this.access_token.trim().length > 0;
        const hasKeys =
            typeof this.api_key === 'string' &&
            this.api_key.trim().length > 0 &&
            typeof this.client_id === 'string' &&
            this.client_id.trim().length > 0;
        return hasToken || hasKeys;
    }

    async addAuthHeaders(headers = {}) {
        // Bearer only — never call login() here. _post/_get always invoke
        // addAuthHeaders; login itself uses _post, so auto-login would recurse.
        // Tokens are obtained via login() (setAuthParams / refreshAuth).
        delete headers.Authorization;
        if (this.access_token) {
            headers.Authorization = `Bearer ${this.access_token}`;
        }
        return headers;
    }

    /**
     * Obtain an access token.
     * POST /api/v1/authentication/login
     * Headers: x-api-key, x-client-id, optional x-login-as.
     * Response 201: { token, expires_at }
     */
    async login() {
        if (!this.api_key || !this.client_id) {
            throw new Error(
                'Airwallex login requires api_key and client_id'
            );
        }

        // Clear any stale bearer so addAuthHeaders does not attach it to login.
        this.access_token = undefined;

        const headers = {
            'x-api-key': this.api_key,
            'x-client-id': this.client_id,
            'Content-Type': 'application/json',
        };
        if (this.login_as) {
            headers['x-login-as'] = this.login_as;
        }

        // stringify=false: no JSON body (OpenAPI documents header-only login).
        const res = await this._post(
            {
                url: this.baseUrl + this.URLs.login,
                headers,
                body: undefined,
            },
            false
        );

        this.access_token = res.token;
        this.expires_at = res.expires_at || null;
        if (res.expires_at) {
            this.accessTokenExpire = new Date(
                Api._normalizeIso(res.expires_at)
            );
        } else {
            // Docs: ~30 minutes when expires_at is omitted.
            this.accessTokenExpire = new Date(Date.now() + 30 * 60 * 1000);
        }

        await this.notify(this.DLGT_TOKEN_UPDATE);
        return res;
    }

    /** @deprecated Prefer login(); kept for callers of the v1 module. */
    async getTokenFromApiKey() {
        return this.login();
    }

    /**
     * Re-login with stored api_key + client_id when the bearer token expires.
     * Airwallex does not issue refresh tokens for API-key auth.
     */
    async refreshAuth() {
        try {
            await this.login();
            return true;
        } catch (error) {
            const moduleName = this.delegate?.name ?? 'airwallex';
            await this.notify(this.DLGT_INVALID_AUTH, {
                message: `Airwallex auth refresh failed for ${moduleName}: ${error?.message}`,
            });
            return false;
        }
    }

    // ---- Account / identity ------------------------------------------------

    /**
     * Retrieve the authenticated account.
     * GET /api/v1/account
     */
    async getAccount() {
        return this._get({ url: this.baseUrl + this.URLs.account });
    }

    // ---- Balances ----------------------------------------------------------

    /**
     * List current wallet balances.
     * GET /api/v1/balances/current
     */
    async listCurrentBalances(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.currentBalances,
            query: params,
        });
    }

    /**
     * Retrieve balance history.
     * GET /api/v1/balances/history
     */
    async listBalanceHistory(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.balanceHistory,
            query: params,
        });
    }

    // ---- Financial transactions --------------------------------------------

    /**
     * List financial transactions.
     * GET /api/v1/financial_transactions
     */
    async listFinancialTransactions(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.financialTransactions,
            query: params,
        });
    }

    /**
     * Retrieve a financial transaction.
     * GET /api/v1/financial_transactions/{id}
     */
    async getFinancialTransaction(id) {
        return this._get({
            url: this.baseUrl + this.URLs.financialTransactionById(id),
        });
    }

    // ---- Beneficiaries -----------------------------------------------------

    /**
     * List beneficiaries.
     * GET /api/v1/beneficiaries
     */
    async listBeneficiaries(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.beneficiaries,
            query: params,
        });
    }

    /**
     * Retrieve a beneficiary.
     * GET /api/v1/beneficiaries/{id}
     */
    async getBeneficiary(id) {
        return this._get({
            url: this.baseUrl + this.URLs.beneficiaryById(id),
        });
    }

    /**
     * Create a beneficiary.
     * POST /api/v1/beneficiaries/create
     */
    async createBeneficiary(data) {
        return this._post({
            url: this.baseUrl + this.URLs.beneficiaryCreate,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a beneficiary.
     * POST /api/v1/beneficiaries/{id}/update
     */
    async updateBeneficiary(id, data) {
        return this._post({
            url: this.baseUrl + this.URLs.beneficiaryUpdate(id),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Transfers ---------------------------------------------------------

    /**
     * List transfers.
     * GET /api/v1/transfers
     */
    async listTransfers(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.transfers,
            query: params,
        });
    }

    /**
     * Retrieve a transfer.
     * GET /api/v1/transfers/{id}
     */
    async getTransfer(id) {
        return this._get({
            url: this.baseUrl + this.URLs.transferById(id),
        });
    }

    /**
     * Create a transfer.
     * POST /api/v1/transfers/create
     */
    async createTransfer(data) {
        return this._post({
            url: this.baseUrl + this.URLs.transferCreate,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Payment Acceptance: customers -------------------------------------

    /**
     * List PA customers.
     * GET /api/v1/pa/customers
     */
    async listCustomers(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.customers,
            query: params,
        });
    }

    /**
     * Retrieve a PA customer.
     * GET /api/v1/pa/customers/{id}
     */
    async getCustomer(id) {
        return this._get({
            url: this.baseUrl + this.URLs.customerById(id),
        });
    }

    /**
     * Create a PA customer.
     * POST /api/v1/pa/customers/create
     */
    async createCustomer(data) {
        return this._post({
            url: this.baseUrl + this.URLs.customerCreate,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a PA customer.
     * POST /api/v1/pa/customers/{id}/update
     */
    async updateCustomer(id, data) {
        return this._post({
            url: this.baseUrl + this.URLs.customerUpdate(id),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Payment attempts / links / charges --------------------------------

    /**
     * List payment attempts.
     * GET /api/v1/pa/payment_attempts
     */
    async listPaymentAttempts(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.paymentAttempts,
            query: params,
        });
    }

    /**
     * Retrieve a payment attempt.
     * GET /api/v1/pa/payment_attempts/{id}
     */
    async getPaymentAttempt(id) {
        return this._get({
            url: this.baseUrl + this.URLs.paymentAttemptById(id),
        });
    }

    /**
     * Create a payment link.
     * POST /api/v1/pa/payment_links/create
     */
    async createPaymentLink(data) {
        return this._post({
            url: this.baseUrl + this.URLs.paymentLinkCreate,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Retrieve a payment link.
     * GET /api/v1/pa/payment_links/{id}
     */
    async getPaymentLink(id) {
        return this._get({
            url: this.baseUrl + this.URLs.paymentLinkById(id),
        });
    }

    /**
     * Notify the shopper about a payment link.
     * POST /api/v1/pa/payment_links/{id}/notify_shopper
     */
    async notifyPaymentLinkShopper(id, data = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.paymentLinkNotify(id),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * List charges.
     * GET /api/v1/charges
     */
    async listCharges(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.charges,
            query: params,
        });
    }

    /**
     * Retrieve a charge.
     * GET /api/v1/charges/{id}
     */
    async getCharge(id) {
        return this._get({
            url: this.baseUrl + this.URLs.chargeById(id),
        });
    }

    // ---- Issuing -----------------------------------------------------------

    /**
     * List issuing cards.
     * GET /api/v1/issuing/cards
     */
    async listCards(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.cards,
            query: params,
        });
    }

    /**
     * Retrieve an issuing card.
     * GET /api/v1/issuing/cards/{id}
     */
    async getCard(id) {
        return this._get({
            url: this.baseUrl + this.URLs.cardById(id),
        });
    }

    /**
     * Create an issuing card.
     * POST /api/v1/issuing/cards/create
     */
    async createCard(data) {
        return this._post({
            url: this.baseUrl + this.URLs.cardCreate,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * List remaining limits for a card.
     * GET /api/v1/issuing/cards/{id}/limits
     */
    async listCardLimits(id) {
        return this._get({
            url: this.baseUrl + this.URLs.cardLimits(id),
        });
    }

    /**
     * Create a cardholder.
     * POST /api/v1/issuing/cardholders/create
     */
    async createCardholder(data) {
        return this._post({
            url: this.baseUrl + this.URLs.cardholderCreate,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * List webhooks.
     * GET /api/v1/webhooks
     */
    async listWebhooks(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.webhooks,
            query: params,
        });
    }

    /**
     * Retrieve a webhook.
     * GET /api/v1/webhooks/{id}
     */
    async getWebhook(id) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookById(id),
        });
    }

    /**
     * Create a webhook.
     * POST /api/v1/webhooks/create
     * Body: { url, version, events[], request_id }
     */
    async createWebhook(data) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookCreate,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a webhook.
     * POST /api/v1/webhooks/{id}/update
     */
    async updateWebhook(id, data) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookUpdate(id),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Delete a webhook.
     * POST /api/v1/webhooks/{id}/delete
     */
    async deleteWebhook(id) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookDelete(id),
            headers: { 'Content-Type': 'application/json' },
            body: {},
        });
    }
}

module.exports = { Api };
