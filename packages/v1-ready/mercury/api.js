const { ApiKeyRequester, get } = require('@friggframework/core');

/**
 * Mercury Banking API v1 client.
 *
 * Auth: API token sent as `Authorization: Bearer <token>`. Mercury also accepts
 * HTTP Basic with the token as username and an empty password; this client uses
 * Bearer to match the documented convenience form and the ported module.
 *
 *   curl https://api.mercury.com/api/v1/accounts \
 *     -H "Authorization: Bearer secret-token:mercury_…"
 *
 * Base URL: https://api.mercury.com/api/v1
 * Docs: https://docs.mercury.com/docs/getting-started
 *
 * The canonical machine-readable contract lives in ./mercury.openapi.yaml —
 * this client mirrors it 1:1 (one method per operationId). Keep them in sync.
 *
 * Ported from Left Hook-owned Mercury module code (accounts + transactions);
 * webhook subscription management added from the official Webhooks API.
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        // Accept friendly aliases + the persisted raw field; strip a
        // pre-existing "Bearer " so we never double-prefix. Persist the raw
        // token as `api_key_raw`; Authorization header value is Bearer-prefixed.
        const raw =
            get(params, 'api_key_raw', null) ||
            get(params, 'api_key', null) ||
            get(params, 'apiKey', null) ||
            get(params, 'access_token', null);
        const token = raw ? String(raw).replace(/^Bearer\s+/i, '').trim() : null;

        this.api_key_raw = token;
        // ApiKeyRequester.addAuthHeaders() sets headers[api_key_name] = api_key.
        this.api_key_name = 'Authorization';
        this.api_key = token ? `Bearer ${token}` : null;

        this.baseUrl = 'https://api.mercury.com/api/v1';

        this.URLs = {
            accounts: '/accounts',
            accountById: (accountId) => `/account/${accountId}`,
            accountTransactions: (accountId) =>
                `/account/${accountId}/transactions`,
            accountTransactionById: (accountId, transactionId) =>
                `/account/${accountId}/transaction/${transactionId}`,
            transactions: '/transactions',
            webhooks: '/webhooks',
            webhookById: (webhookEndpointId) =>
                `/webhooks/${webhookEndpointId}`,
        };
    }

    /**
     * Apply a raw API token (strips optional Bearer prefix).
     * @param {string} token
     */
    setApiToken(token) {
        const raw = token
            ? String(token).replace(/^Bearer\s+/i, '').trim()
            : null;
        this.api_key_raw = raw;
        if (raw) {
            this.setApiKey(`Bearer ${raw}`);
        } else {
            this.api_key = null;
        }
    }

    // ---- Accounts ----------------------------------------------------------

    /**
     * List accounts.
     * GET /accounts
     * operationId: getAccounts
     *
     * Query (all optional): limit (1–1000), order (asc|desc),
     * start_after, end_before.
     * Response: { accounts: [Account], page: { nextPage?, previousPage? } }
     */
    async getAccounts(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.accounts,
            query,
        });
    }

    /**
     * Get one account by id.
     * GET /account/{accountId}
     * operationId: getAccount
     */
    async getAccount(accountId) {
        return this._get({
            url: this.baseUrl + this.URLs.accountById(accountId),
        });
    }

    // ---- Transactions ------------------------------------------------------

    /**
     * List transactions for one account.
     * GET /account/{accountId}/transactions
     * operationId: listAccountTransactions
     *
     * Query (all optional): limit, start, end, search, status, offset, order,
     * requestId, mercuryCategory, categoryId.
     */
    async listAccountTransactions(accountId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.accountTransactions(accountId),
            query,
        });
    }

    /**
     * Get one transaction for an account.
     * GET /account/{accountId}/transaction/{transactionId}
     * operationId: getTransaction
     */
    async getTransaction(accountId, transactionId) {
        return this._get({
            url:
                this.baseUrl +
                this.URLs.accountTransactionById(accountId, transactionId),
        });
    }

    /**
     * List transactions across all accounts.
     * GET /transactions
     * operationId: listTransactions
     *
     * Query (all optional): status[], search, start, end, postedStart,
     * postedEnd, accountId[], cardId[], mercuryCategory, categoryId,
     * start_at, start_after, end_before, limit, order.
     */
    async listTransactions(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.transactions,
            query,
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * List webhook endpoints.
     * GET /webhooks
     * operationId: getWebhooks
     *
     * Query (all optional): status[], limit, start_after, end_before, order.
     * Response: { webhooks: [ApiWebhookResponse], page: { … } }
     */
    async getWebhooks(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.webhooks,
            query,
        });
    }

    /**
     * Get one webhook endpoint by id.
     * GET /webhooks/{webhookEndpointId}
     * operationId: getWebhook
     */
    async getWebhook(webhookEndpointId) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookById(webhookEndpointId),
        });
    }

    /**
     * Create a webhook endpoint.
     * POST /webhooks
     * operationId: createWebhook
     *
     * body: { url (required), eventTypes?, filterPaths? }
     * Response includes `secret` once (signing key for Mercury-Signature).
     * Note: webhooks are not available in Mercury's sandbox environment.
     */
    async createWebhook(data) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a webhook endpoint.
     * POST /webhooks/{webhookEndpointId}  (Mercury documents POST, not PATCH)
     * operationId: updateWebhook
     *
     * body (all optional): url, eventTypes, filterPaths, status (active|paused)
     */
    async updateWebhook(webhookEndpointId, data) {
        return this._post({
            url: this.baseUrl + this.URLs.webhookById(webhookEndpointId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Delete a webhook endpoint.
     * DELETE /webhooks/{webhookEndpointId}
     * operationId: deleteWebhook
     */
    async deleteWebhook(webhookEndpointId) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(webhookEndpointId),
        });
    }
}

module.exports = { Api };
