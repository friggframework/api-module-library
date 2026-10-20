const { ApiKeyRequester, ModuleConstants, get } = require('@friggframework/core');

/**
 * Yotpo Core API (v3) client.
 *
 * Auth: exchange store_id (app key) + API secret for an access token, then send
 * it on every request as `X-Yotpo-Token`.
 *
 *   POST https://api.yotpo.com/core/v3/stores/{store_id}/access_tokens
 *   { "secret": "YOUR_SECRET" }  →  { "access_token": "..." }
 *
 * Base URL: https://api.yotpo.com
 * Store-scoped paths: /core/v3/stores/{store_id}/...
 * Rate limit: 5 requests/second per store (429 + RateLimit-* headers).
 *
 * Docs: https://core-api.yotpo.com/reference/welcome
 *
 * The canonical machine-readable contract lives in ./yotpo.openapi.yaml — this
 * client mirrors it 1:1 (one method per operationId). Keep them in sync.
 *
 * Scope note: this module covers the Core API (catalog, customers, orders,
 * fulfillments, webhook subscriptions). Loyalty & Referrals, UGC/Reviews, and
 * the App Developer OAuth surface are separate Yotpo products and are not
 * modeled here.
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        this.store_id =
            get(params, 'store_id', null) || get(params, 'app_key', null);
        this.secret =
            get(params, 'secret', null) || get(params, 'api_secret', null);

        // ApiKeyRequester puts `headers[this.api_key_name] = this.api_key`.
        // Persist as `access_token` (Yotpo's name); keep api_key in sync for the header.
        this.api_key_name = 'X-Yotpo-Token';
        this.access_token =
            get(params, 'access_token', null) ||
            get(params, 'api_key', null) ||
            null;
        this.api_key = this.access_token;

        this.baseUrl = 'https://api.yotpo.com';

        this.URLs = {
            accessTokens: () =>
                `/core/v3/stores/${this.store_id}/access_tokens`,
            products: () => `/core/v3/stores/${this.store_id}/products`,
            productById: (yotpoProductId) =>
                `/core/v3/stores/${this.store_id}/products/${yotpoProductId}`,
            orders: () => `/core/v3/stores/${this.store_id}/orders`,
            orderById: (yotpoOrderId) =>
                `/core/v3/stores/${this.store_id}/orders/${yotpoOrderId}`,
            orderFulfillments: (yotpoOrderId) =>
                `/core/v3/stores/${this.store_id}/orders/${yotpoOrderId}/fulfillments`,
            customers: () => `/core/v3/stores/${this.store_id}/customers`,
            webhookTargets: () =>
                `/core/v3/stores/${this.store_id}/webhooks/targets`,
            webhookFilters: () =>
                `/core/v3/stores/${this.store_id}/webhooks/filters`,
            webhookSubscriptions: () =>
                `/core/v3/stores/${this.store_id}/webhooks/subscriptions`,
            webhookSubscriptionById: (yotpoSubscriptionId) =>
                `/core/v3/stores/${this.store_id}/webhooks/subscriptions/${yotpoSubscriptionId}`,
        };
    }

    setApiKey(apiKey) {
        this.access_token = apiKey || null;
        super.setApiKey(apiKey);
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.apiKey,
            data: {
                jsonSchema: {
                    title: 'Yotpo Authentication',
                    type: 'object',
                    required: ['store_id', 'secret'],
                    properties: {
                        store_id: {
                            type: 'string',
                            title: 'Store ID (App Key)',
                        },
                        secret: {
                            type: 'string',
                            title: 'API Secret',
                        },
                    },
                },
                uiSchema: {
                    store_id: {
                        'ui:help':
                            'Yotpo admin → Profile → Store Settings → General Settings. Also called the app key.',
                        'ui:placeholder': 'Your Yotpo Store ID / App Key',
                    },
                    secret: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Yotpo admin → Store Settings → Get secret key. Exchanged for an X-Yotpo-Token access token.',
                        'ui:placeholder': 'Your Yotpo API Secret',
                    },
                },
            },
        };
    }

    _requireStoreId() {
        if (!this.store_id) {
            throw new Error(
                'Yotpo: store_id (app key) is required for Core API paths.'
            );
        }
    }

    // ---- Auth --------------------------------------------------------------

    /**
     * Generate an access token.
     * POST /core/v3/stores/{store_id}/access_tokens
     * Body: { secret }  →  { access_token }
     *
     * Official operationId: yotpo-authentication.
     * No X-Yotpo-Token header is required for this call.
     */
    async generateAccessToken() {
        this._requireStoreId();
        if (!this.secret) {
            throw new Error(
                'Yotpo: secret is required to generate an access token.'
            );
        }

        const previousKey = this.api_key;
        // Token minting must not send a (possibly expired) X-Yotpo-Token.
        this.api_key = null;
        try {
            const res = await this._post({
                url: this.baseUrl + this.URLs.accessTokens(),
                headers: { 'Content-Type': 'application/json' },
                body: { secret: this.secret },
            });
            const accessToken = res?.access_token;
            if (accessToken) {
                this.setApiKey(accessToken);
            } else if (previousKey) {
                this.api_key = previousKey;
            }
            return res;
        } catch (e) {
            this.api_key = previousKey;
            throw e;
        }
    }

    // ---- Products ----------------------------------------------------------

    /**
     * List products.
     * GET /core/v3/stores/{store_id}/products
     * Query: page_info, limit (1–100), external_ids (comma-separated).
     */
    async listProducts(params = {}) {
        this._requireStoreId();
        const query = {};
        if (params.page_info) query.page_info = params.page_info;
        if (params.limit !== undefined) query.limit = params.limit;
        if (params.external_ids) query.external_ids = params.external_ids;
        return this._get({
            url: this.baseUrl + this.URLs.products(),
            query,
        });
    }

    /**
     * Get a product by Yotpo product ID.
     * GET /core/v3/stores/{store_id}/products/{yotpo_product_id}
     */
    async getProduct(yotpoProductId) {
        this._requireStoreId();
        return this._get({
            url: this.baseUrl + this.URLs.productById(yotpoProductId),
        });
    }

    /**
     * Create a product.
     * POST /core/v3/stores/{store_id}/products
     * Body: { product: { external_id, name, ... } }
     */
    async createProduct(data) {
        this._requireStoreId();
        return this._post({
            url: this.baseUrl + this.URLs.products(),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a product.
     * PATCH /core/v3/stores/{store_id}/products/{yotpo_product_id}
     * Body: { product: { ... } }
     */
    async updateProduct(yotpoProductId, data) {
        this._requireStoreId();
        return this._patch({
            url: this.baseUrl + this.URLs.productById(yotpoProductId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Orders ------------------------------------------------------------

    /**
     * List orders.
     * GET /core/v3/stores/{store_id}/orders
     * Query: page_info, limit, external_ids, order_date_min, order_date_max.
     */
    async listOrders(params = {}) {
        this._requireStoreId();
        const query = {};
        if (params.page_info) query.page_info = params.page_info;
        if (params.limit !== undefined) query.limit = params.limit;
        if (params.external_ids) query.external_ids = params.external_ids;
        if (params.order_date_min) query.order_date_min = params.order_date_min;
        if (params.order_date_max) query.order_date_max = params.order_date_max;
        return this._get({
            url: this.baseUrl + this.URLs.orders(),
            query,
        });
    }

    /**
     * Get an order by Yotpo order ID.
     * GET /core/v3/stores/{store_id}/orders/{yotpo_order_id}
     */
    async getOrder(yotpoOrderId) {
        this._requireStoreId();
        return this._get({
            url: this.baseUrl + this.URLs.orderById(yotpoOrderId),
        });
    }

    /**
     * Create an order.
     * POST /core/v3/stores/{store_id}/orders
     * Body: { order: { external_id, order_date, customer, line_items, ... } }
     */
    async createOrder(data) {
        this._requireStoreId();
        return this._post({
            url: this.baseUrl + this.URLs.orders(),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update an order.
     * PATCH /core/v3/stores/{store_id}/orders/{yotpo_order_id}
     * Body: { order: { ... } }
     */
    async updateOrder(yotpoOrderId, data) {
        this._requireStoreId();
        return this._patch({
            url: this.baseUrl + this.URLs.orderById(yotpoOrderId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Order fulfillments ------------------------------------------------

    /**
     * Create an order fulfillment.
     * POST /core/v3/stores/{store_id}/orders/{yotpo_order_id}/fulfillments
     * Body: { fulfillment: { external_id, fulfillment_date, status, fulfilled_items, ... } }
     */
    async createOrderFulfillment(yotpoOrderId, data) {
        this._requireStoreId();
        return this._post({
            url: this.baseUrl + this.URLs.orderFulfillments(yotpoOrderId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * List fulfillments for an order.
     * GET /core/v3/stores/{store_id}/orders/{yotpo_order_id}/fulfillments
     */
    async listOrderFulfillments(yotpoOrderId, params = {}) {
        this._requireStoreId();
        const query = {};
        if (params.page_info) query.page_info = params.page_info;
        if (params.limit !== undefined) query.limit = params.limit;
        return this._get({
            url: this.baseUrl + this.URLs.orderFulfillments(yotpoOrderId),
            query,
        });
    }

    // ---- Customers ---------------------------------------------------------

    /**
     * Create or update a customer (upsert).
     * PATCH /core/v3/stores/{store_id}/customers
     * Body: { customer: { external_id?, email?, phone_number?, ... } }
     * Official operationId: create-customer.
     */
    async createCustomer(data) {
        this._requireStoreId();
        return this._patch({
            url: this.baseUrl + this.URLs.customers(),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * List customers.
     * GET /core/v3/stores/{store_id}/customers
     * Query: page_info, limit, external_ids, email, phone_number.
     */
    async listCustomers(params = {}) {
        this._requireStoreId();
        const query = {};
        if (params.page_info) query.page_info = params.page_info;
        if (params.limit !== undefined) query.limit = params.limit;
        if (params.external_ids) query.external_ids = params.external_ids;
        if (params.email) query.email = params.email;
        if (params.phone_number) query.phone_number = params.phone_number;
        return this._get({
            url: this.baseUrl + this.URLs.customers(),
            query,
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * Create a webhook target (callback URL).
     * POST /core/v3/stores/{store_id}/webhooks/targets
     * Body: { webhook_target: { url } }
     */
    async createWebhookTarget(data) {
        this._requireStoreId();
        return this._post({
            url: this.baseUrl + this.URLs.webhookTargets(),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * List webhook targets.
     * GET /core/v3/stores/{store_id}/webhooks/targets
     */
    async listWebhookTargets() {
        this._requireStoreId();
        return this._get({
            url: this.baseUrl + this.URLs.webhookTargets(),
        });
    }

    /**
     * Create a webhook filter (list of event topics).
     * POST /core/v3/stores/{store_id}/webhooks/filters
     * Body: { webhook_filter: { events: [...] } }
     */
    async createWebhookFilter(data) {
        this._requireStoreId();
        return this._post({
            url: this.baseUrl + this.URLs.webhookFilters(),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * List webhook filters.
     * GET /core/v3/stores/{store_id}/webhooks/filters
     */
    async listWebhookFilters() {
        this._requireStoreId();
        return this._get({
            url: this.baseUrl + this.URLs.webhookFilters(),
        });
    }

    /**
     * Create a webhook subscription (target + filter).
     * POST /core/v3/stores/{store_id}/webhooks/subscriptions
     * Body: { webhook_subscription: { target_id, filter_id?, active? } }
     */
    async createWebhookSubscription(data) {
        this._requireStoreId();
        return this._post({
            url: this.baseUrl + this.URLs.webhookSubscriptions(),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * List webhook subscriptions.
     * GET /core/v3/stores/{store_id}/webhooks/subscriptions
     */
    async listWebhookSubscriptions() {
        this._requireStoreId();
        return this._get({
            url: this.baseUrl + this.URLs.webhookSubscriptions(),
        });
    }

    /**
     * Delete a webhook subscription.
     * DELETE /core/v3/stores/{store_id}/webhooks/subscriptions/{yotpo_subscription_id}
     */
    async deleteWebhookSubscription(yotpoSubscriptionId) {
        this._requireStoreId();
        return this._delete({
            url:
                this.baseUrl +
                this.URLs.webhookSubscriptionById(yotpoSubscriptionId),
        });
    }
}

module.exports = { Api };
