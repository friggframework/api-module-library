const crypto = require('crypto');
const { BasicAuthRequester, ModuleConstants, get } = require('@friggframework/core');

/**
 * Clyde (joinclyde.com) public API client.
 *
 * Clyde is a product-protection / extended-warranty platform. Merchants sync
 * their product catalog, pull matched contract SKUs, record orders and
 * contract sales, and manage claims and vouchers.
 *
 * Auth: HTTP Basic using Client Key + Secret from the Clyde Dashboard
 * (Developers section), plus Clyde-required headers on every request:
 *   Authorization: Basic Base64(clientKey:secret)
 *   X-Auth-Timestamp: Unix timestamp (seconds)
 *   X-Auth-Nonce: random nonce
 *   Content-Type: application/vnd.api+json
 *
 * Base URL: https://api.joinclyde.com
 * Docs: https://docs.joinclyde.com/reference/authentication
 *
 * Official OpenAPI fragments are embedded in each reference page on
 * docs.joinclyde.com (Clyde API v2.0.6). The curated subset in
 * ./clyde.openapi.yaml is the source of truth this client mirrors 1:1
 * (one method per operationId). Keep them in sync.
 */
class Api extends BasicAuthRequester {
    constructor(params = {}) {
        super(params);

        // Clyde-native names → BasicAuthRequester username/password.
        this.clientKey =
            get(params, 'clientKey', null) || get(params, 'client_key', null);
        this.secret = get(params, 'secret', null);
        if (this.clientKey) this.username = this.clientKey;
        if (this.secret) this.password = this.secret;

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'base_url', null) ||
            process.env.CLYDE_API_BASE_URL ||
            'https://api.joinclyde.com';

        this.URLs = {
            products: '/products',
            productBySku: (sku) => `/products/${encodeURIComponent(sku)}`,
            contractsForProduct: (sku) =>
                `/products/${encodeURIComponent(sku)}/contracts`,
            bulkCreateProducts: '/products/bulk',
            contracts: '/contracts',
            orders: '/orders',
            orderById: (orderId) => `/orders/${encodeURIComponent(orderId)}`,
            orderHistoryEvent: (orderId, lineItemId) =>
                `/orders/${encodeURIComponent(orderId)}/lineItem/${encodeURIComponent(lineItemId)}`,
            cancelOrder: (orderId) =>
                `/orders/${encodeURIComponent(orderId)}`,
            contractSales: '/contract-sales',
            contractSaleById: (id) =>
                `/contract-sales/${encodeURIComponent(id)}`,
            claims: '/claims',
            claimById: (contractSaleId, claimId) =>
                `/contract-sales/${encodeURIComponent(contractSaleId)}/claims/${encodeURIComponent(claimId)}`,
            createClaim: (contractSaleId) =>
                `/contract-sales/${encodeURIComponent(contractSaleId)}/claims`,
            vouchers: '/vouchers',
            voucherByCode: (code) =>
                `/vouchers/${encodeURIComponent(code)}`,
            bulkCreateVouchers: '/vouchers/bulk',
        };
    }

    getAuthorizationRequirements() {
        return {
            url: null,
            type: ModuleConstants.authType.basic,
            data: {
                jsonSchema: {
                    type: 'object',
                    required: ['clientKey', 'secret'],
                    properties: {
                        clientKey: {
                            type: 'string',
                            title: 'Client Key',
                        },
                        secret: {
                            type: 'string',
                            title: 'Secret',
                        },
                    },
                },
                uiSchema: {
                    clientKey: {
                        'ui:help':
                            'Find your Client Key in the Clyde Dashboard under Developers. Sent as the Basic-auth username.',
                        'ui:placeholder': 'Client Key',
                    },
                    secret: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Your Client Secret from the same Developers section. Combined as Base64(clientKey:secret) in the Authorization header.',
                        'ui:placeholder': 'Secret',
                    },
                },
            },
        };
    }

    setClientKey(clientKey) {
        this.clientKey = clientKey;
        this.setUsername(clientKey);
    }

    setSecret(secret) {
        this.secret = secret;
        this.setPassword(secret);
    }

    /**
     * Clyde requires Basic auth plus X-Auth-Timestamp, X-Auth-Nonce, and
     * Content-Type: application/vnd.api+json on every request.
     * See https://docs.joinclyde.com/reference/authentication
     */
    async addAuthHeaders(headers = {}) {
        headers = await super.addAuthHeaders(headers);
        headers['X-Auth-Timestamp'] = String(Math.floor(Date.now() / 1000));
        headers['X-Auth-Nonce'] = crypto.randomBytes(16).toString('hex');
        headers['Content-Type'] = 'application/vnd.api+json';
        if (!headers['Accept']) {
            headers['Accept'] = 'application/vnd.api+json';
        }
        return headers;
    }

    _jsonApiHeaders() {
        return {
            'Content-Type': 'application/vnd.api+json',
            Accept: 'application/vnd.api+json',
        };
    }

    // ---- Products ----------------------------------------------------------

    /** GET /products — paginated product list (optional sku, page). */
    async getProducts(params = {}) {
        const query = {};
        if (params.sku !== undefined) query.sku = params.sku;
        if (params.page !== undefined) query.page = params.page;
        return this._get({
            url: this.baseUrl + this.URLs.products,
            query,
        });
    }

    /** GET /products/{sku} */
    async getProduct(sku) {
        return this._get({
            url: this.baseUrl + this.URLs.productBySku(sku),
        });
    }

    /** POST /products — body is the JSON:API CreateProductRequest. */
    async createProduct(data) {
        return this._post({
            url: this.baseUrl + this.URLs.products,
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /** PUT /products/{sku} */
    async updateProduct(sku, data) {
        return this._put({
            url: this.baseUrl + this.URLs.productBySku(sku),
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /** DELETE /products/{sku} — archives/deletes the product. */
    async deleteProduct(sku) {
        return this._delete({
            url: this.baseUrl + this.URLs.productBySku(sku),
        });
    }

    /** POST /products/bulk */
    async createProducts(data) {
        return this._post({
            url: this.baseUrl + this.URLs.bulkCreateProducts,
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /**
     * GET /products/{sku}/contracts
     * Optional query: price (product sale price for contract matching).
     */
    async getContractsProduct(sku, params = {}) {
        const query = {};
        if (params.price !== undefined) query.price = params.price;
        return this._get({
            url: this.baseUrl + this.URLs.contractsForProduct(sku),
            query,
        });
    }

    // ---- Contracts ---------------------------------------------------------

    /** GET /contracts — all contracts matched to the merchant's catalog. */
    async getContracts() {
        return this._get({
            url: this.baseUrl + this.URLs.contracts,
        });
    }

    // ---- Orders ------------------------------------------------------------

    /**
     * GET /orders
     * Query: email, phone, createdAtMin, createdAtMax, page.
     */
    async getOrders(params = {}) {
        const query = {};
        for (const key of [
            'email',
            'phone',
            'createdAtMin',
            'createdAtMax',
            'page',
        ]) {
            if (params[key] !== undefined) query[key] = params[key];
        }
        return this._get({
            url: this.baseUrl + this.URLs.orders,
            query,
        });
    }

    /** GET /orders/{orderId} */
    async getOrderById(orderId) {
        return this._get({
            url: this.baseUrl + this.URLs.orderById(orderId),
        });
    }

    /** POST /orders — JSON:API CreateOrderRequest. */
    async createOrder(data) {
        return this._post({
            url: this.baseUrl + this.URLs.orders,
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /** PUT /orders/{orderId} */
    async updateOrder(orderId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.orderById(orderId),
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /** DELETE /orders/{orderId} */
    async cancelOrder(orderId) {
        return this._delete({
            url: this.baseUrl + this.URLs.cancelOrder(orderId),
        });
    }

    /**
     * PUT /orders/{orderId}/lineItem/{lineItemId}
     * Add an order history event (Shipped, Delivered, Refunded, etc.).
     */
    async addOrderHistoryEvent(orderId, lineItemId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.orderHistoryEvent(orderId, lineItemId),
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    // ---- Contract sales ----------------------------------------------------

    /**
     * GET /contract-sales
     * Query: email, phone, page, createdAtMin, createdAtMax, cancelled,
     *        cancelledAtMin, cancelledAtMax.
     */
    async getContractSales(params = {}) {
        const query = {};
        for (const key of [
            'email',
            'phone',
            'page',
            'createdAtMin',
            'createdAtMax',
            'cancelled',
            'cancelledAtMin',
            'cancelledAtMax',
        ]) {
            if (params[key] !== undefined) query[key] = params[key];
        }
        return this._get({
            url: this.baseUrl + this.URLs.contractSales,
            query,
        });
    }

    /** GET /contract-sales/{id} */
    async getContractSaleById(id) {
        return this._get({
            url: this.baseUrl + this.URLs.contractSaleById(id),
        });
    }

    /** PUT /contract-sales/{id} */
    async updateContractSale(id, data) {
        return this._put({
            url: this.baseUrl + this.URLs.contractSaleById(id),
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /** DELETE /contract-sales/{id} */
    async cancelContractSale(id) {
        return this._delete({
            url: this.baseUrl + this.URLs.contractSaleById(id),
        });
    }

    // ---- Claims ------------------------------------------------------------

    /**
     * GET /claims
     * Official operationId is `GetClaims`; we expose camelCase `getClaims`.
     * Query: email, phone, page, status, createdAtMin, createdAtMax,
     *        resolvedAtMin, resolvedAtMax.
     */
    async getClaims(params = {}) {
        const query = {};
        for (const key of [
            'email',
            'phone',
            'page',
            'status',
            'createdAtMin',
            'createdAtMax',
            'resolvedAtMin',
            'resolvedAtMax',
        ]) {
            if (params[key] !== undefined) query[key] = params[key];
        }
        return this._get({
            url: this.baseUrl + this.URLs.claims,
            query,
        });
    }

    /** GET /contract-sales/{contractSaleId}/claims/{claimId} */
    async getClaimById(contractSaleId, claimId) {
        return this._get({
            url: this.baseUrl + this.URLs.claimById(contractSaleId, claimId),
        });
    }

    /** POST /contract-sales/{contractSaleId}/claims */
    async createClaim(contractSaleId, data) {
        return this._post({
            url: this.baseUrl + this.URLs.createClaim(contractSaleId),
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    // ---- Vouchers ----------------------------------------------------------

    /** GET /vouchers */
    async getVouchers() {
        return this._get({
            url: this.baseUrl + this.URLs.vouchers,
        });
    }

    /** GET /vouchers/{code} */
    async getVoucher(code) {
        return this._get({
            url: this.baseUrl + this.URLs.voucherByCode(code),
        });
    }

    /** POST /vouchers/bulk */
    async createVouchers(data) {
        return this._post({
            url: this.baseUrl + this.URLs.bulkCreateVouchers,
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /** PUT /vouchers/{code} */
    async updateVoucher(code, data) {
        return this._put({
            url: this.baseUrl + this.URLs.voucherByCode(code),
            headers: this._jsonApiHeaders(),
            body: data,
        });
    }

    /** DELETE /vouchers/{code} */
    async deleteVoucher(code) {
        return this._delete({
            url: this.baseUrl + this.URLs.voucherByCode(code),
        });
    }
}

module.exports = { Api };
