const { BasicAuthRequester, ModuleConstants, get } = require('@friggframework/core');

/**
 * Chargebee Billing API v2 client (Product Catalog v2).
 *
 * Auth: HTTP Basic — API key as username, empty password.
 *   curl -u "$API_KEY": https://{site}.chargebee.com/api/v2/customers
 *
 * Base URL: https://{site}.chargebee.com/api/v2
 * Request bodies: application/x-www-form-urlencoded (Chargebee convention).
 *
 * Docs: https://apidocs.chargebee.com/docs/api
 * OpenAPI (official): https://github.com/chargebee/openapi
 *   spec/chargebee_api_v2_pc_v2_spec.yaml
 *
 * The curated contract in ./chargebee.openapi.yaml mirrors this client 1:1
 * (one method per operationId). Paths and auth match the official spec.
 */
const DEFAULT_SITE = 'demo';

class Api extends BasicAuthRequester {
    constructor(params = {}) {
        super(params);

        this.api_key =
            get(params, 'api_key', null) ||
            get(params, 'access_token', null) ||
            get(params, 'username', null);
        // Chargebee Basic auth uses an empty password; core's BasicAuthRequester
        // only emits Authorization when password is truthy, so we override
        // addAuthHeaders below.
        this.password = get(params, 'password', '') || '';

        this.site = this._normalizeSite(
            get(params, 'site', null) || DEFAULT_SITE
        );
        this.username = this.api_key;
        this.baseUrl = `https://${this.site}.chargebee.com/api/v2`;

        this.URLs = {
            customers: '/customers',
            customer: (id) => `/customers/${encodeURIComponent(id)}`,
            subscriptions: '/subscriptions',
            subscription: (id) => `/subscriptions/${encodeURIComponent(id)}`,
            invoices: '/invoices',
            invoice: (id) => `/invoices/${encodeURIComponent(id)}`,
            transactions: '/transactions',
            transaction: (id) => `/transactions/${encodeURIComponent(id)}`,
            items: '/items',
            item: (id) => `/items/${encodeURIComponent(id)}`,
            itemPrices: '/item_prices',
            itemPrice: (id) => `/item_prices/${encodeURIComponent(id)}`,
            events: '/events',
            event: (id) => `/events/${encodeURIComponent(id)}`,
            webhookEndpoints: '/webhook_endpoints',
            webhookEndpoint: (id) =>
                `/webhook_endpoints/${encodeURIComponent(id)}`,
            deleteWebhookEndpoint: (id) =>
                `/webhook_endpoints/${encodeURIComponent(id)}/delete`,
        };
    }

    _normalizeSite(site) {
        if (!site) return DEFAULT_SITE;
        let s = String(site).trim();
        // Allow pasting a full host or URL; keep only the subdomain label.
        s = s.replace(/^https?:\/\//i, '');
        s = s.replace(/\.chargebee\.com.*$/i, '');
        s = s.replace(/\/.*$/, '');
        return s || DEFAULT_SITE;
    }

    setSite(site) {
        this.site = this._normalizeSite(site);
        this.baseUrl = `https://${this.site}.chargebee.com/api/v2`;
    }

    setApiKey(apiKey) {
        this.api_key = apiKey;
        this.username = apiKey;
    }

    /**
     * Chargebee documents empty-password Basic auth (`-u api_key:`). Core's
     * BasicAuthRequester skips the header when password is falsy, so emit it
     * here whenever an API key/username is present.
     */
    async addAuthHeaders(headers = {}) {
        const key = this.api_key || this.username;
        if (key) {
            const pass = this.password == null ? '' : String(this.password);
            headers['Authorization'] =
                'Basic ' + Buffer.from(`${key}:${pass}`).toString('base64');
        }
        return headers;
    }

    isAuthenticated() {
        const key = this.api_key || this.username;
        return typeof key === 'string' && key.trim().length > 0;
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.basic,
            data: {
                jsonSchema: {
                    title: 'Chargebee Authentication',
                    type: 'object',
                    required: ['site', 'api_key'],
                    properties: {
                        site: {
                            type: 'string',
                            title: 'Site subdomain',
                        },
                        api_key: {
                            type: 'string',
                            title: 'API Key',
                        },
                    },
                },
                uiSchema: {
                    site: {
                        'ui:help':
                            'Your Chargebee site subdomain — the {site} in https://{site}.chargebee.com. Test sites are often named like acme-test.',
                        'ui:placeholder': 'acme-test',
                    },
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Create under Settings → Configure Chargebee → API Keys and Webhooks. Sent as HTTP Basic username with an empty password.',
                    },
                },
            },
        };
    }

    // ---- HTTP helpers ------------------------------------------------------

    _formBody(fields = {}) {
        const usp = new URLSearchParams();
        const flat = this._flattenForm(fields);
        for (const [key, value] of Object.entries(flat)) {
            usp.append(key, value);
        }
        return usp.toString();
    }

    _flattenForm(obj, prefix = '') {
        const out = {};
        if (obj == null || typeof obj !== 'object') return out;
        for (const [k, v] of Object.entries(obj)) {
            const key = prefix ? `${prefix}[${k}]` : k;
            if (v === undefined || v === null) continue;
            if (Array.isArray(v)) {
                v.forEach((item, i) => {
                    if (item !== null && typeof item === 'object') {
                        Object.assign(out, this._flattenForm(item, `${key}[${i}]`));
                    } else if (item !== undefined && item !== null) {
                        out[`${key}[${i}]`] = String(item);
                    }
                });
            } else if (typeof v === 'object') {
                Object.assign(out, this._flattenForm(v, key));
            } else {
                out[key] = String(v);
            }
        }
        return out;
    }

    async _formPost(url, fields = {}) {
        return this._post(
            {
                url,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: this._formBody(fields),
            },
            false
        );
    }

    // ---- Customers ---------------------------------------------------------

    /** GET /customers — official operationId: list_customers */
    async listCustomers(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.customers,
            query: params,
        });
    }

    /** GET /customers/{customer-id} — retrieve_a_customer */
    async getCustomer(customerId) {
        return this._get({
            url: this.baseUrl + this.URLs.customer(customerId),
        });
    }

    /** POST /customers — create_a_customer (form-urlencoded) */
    async createCustomer(fields = {}) {
        return this._formPost(this.baseUrl + this.URLs.customers, fields);
    }

    /** POST /customers/{customer-id} — update_a_customer (form-urlencoded) */
    async updateCustomer(customerId, fields = {}) {
        return this._formPost(
            this.baseUrl + this.URLs.customer(customerId),
            fields
        );
    }

    // ---- Subscriptions -----------------------------------------------------

    /** GET /subscriptions — list_subscriptions */
    async listSubscriptions(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.subscriptions,
            query: params,
        });
    }

    /** GET /subscriptions/{subscription-id} — retrieve_a_subscription */
    async getSubscription(subscriptionId) {
        return this._get({
            url: this.baseUrl + this.URLs.subscription(subscriptionId),
        });
    }

    // ---- Invoices ----------------------------------------------------------

    /** GET /invoices — list_invoices */
    async listInvoices(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.invoices,
            query: params,
        });
    }

    /** GET /invoices/{invoice-id} — retrieve_an_invoice */
    async getInvoice(invoiceId) {
        return this._get({
            url: this.baseUrl + this.URLs.invoice(invoiceId),
        });
    }

    // ---- Transactions (payments) -------------------------------------------

    /** GET /transactions — list_transactions */
    async listTransactions(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.transactions,
            query: params,
        });
    }

    /** GET /transactions/{transaction-id} — retrieve_a_transaction */
    async getTransaction(transactionId) {
        return this._get({
            url: this.baseUrl + this.URLs.transaction(transactionId),
        });
    }

    // ---- Catalog: items / item prices (PC v2) ------------------------------

    /** GET /items — list_items */
    async listItems(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.items,
            query: params,
        });
    }

    /** GET /items/{item-id} — retrieve_an_item */
    async getItem(itemId) {
        return this._get({
            url: this.baseUrl + this.URLs.item(itemId),
        });
    }

    /** GET /item_prices — list_item_prices */
    async listItemPrices(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.itemPrices,
            query: params,
        });
    }

    /** GET /item_prices/{item-price-id} — retrieve_an_item_price */
    async getItemPrice(itemPriceId) {
        return this._get({
            url: this.baseUrl + this.URLs.itemPrice(itemPriceId),
        });
    }

    // ---- Events ------------------------------------------------------------

    /** GET /events — list_events */
    async listEvents(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.events,
            query: params,
        });
    }

    /** GET /events/{event-id} — retrieve_an_event */
    async getEvent(eventId) {
        return this._get({
            url: this.baseUrl + this.URLs.event(eventId),
        });
    }

    // ---- Webhook endpoints -------------------------------------------------

    /** GET /webhook_endpoints — list_webhook_endpoints */
    async listWebhookEndpoints(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookEndpoints,
            query: params,
        });
    }

    /** GET /webhook_endpoints/{webhook-endpoint-id} — retrieve_a_webhook_endpoint */
    async getWebhookEndpoint(webhookEndpointId) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookEndpoint(webhookEndpointId),
        });
    }

    /** POST /webhook_endpoints — create_a_webhook_endpoint */
    async createWebhookEndpoint(fields = {}) {
        return this._formPost(
            this.baseUrl + this.URLs.webhookEndpoints,
            fields
        );
    }

    /** POST /webhook_endpoints/{id} — update_a_webhook_endpoint */
    async updateWebhookEndpoint(webhookEndpointId, fields = {}) {
        return this._formPost(
            this.baseUrl + this.URLs.webhookEndpoint(webhookEndpointId),
            fields
        );
    }

    /**
     * POST /webhook_endpoints/{id}/delete — delete_a_webhook_endpoint
     * Chargebee uses POST-to-delete for this resource.
     */
    async deleteWebhookEndpoint(webhookEndpointId) {
        return this._formPost(
            this.baseUrl + this.URLs.deleteWebhookEndpoint(webhookEndpointId),
            {}
        );
    }

    // ---- Auth check --------------------------------------------------------

    /**
     * Lightweight authenticated call used by testAuthRequest. Listing one page
     * of customers returns 200 for a valid key; invalid keys return 401.
     */
    async testAuth() {
        return this.listCustomers({ limit: 1 });
    }
}

module.exports = { Api, DEFAULT_SITE };
