"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Api = void 0;
const core_1 = require("@friggframework/core");
class Api extends core_1.ApiKeyRequester {
    constructor(params) {
        super(params);
        this.API_VERSION = '2021-11';
        this.baseUrl = 'https://api.rechargeapps.com';
        this.api_key = (0, core_1.get)(params, 'api_key', null);
        this.URLs = {
            customers: '/customers',
            customerById: (customerId) => `/customers/${customerId}`,
            customerAddresses: (customerId) => `/customers/${customerId}/addresses`,
            customerPaymentMethods: (customerId) => `/customers/${customerId}/payment_methods`,
            customerSubscriptions: (customerId) => `/customers/${customerId}/subscriptions`,
            subscriptions: '/subscriptions',
            subscriptionById: (subscriptionId) => `/subscriptions/${subscriptionId}`,
            subscriptionCancel: (subscriptionId) => `/subscriptions/${subscriptionId}/cancel`,
            subscriptionActivate: (subscriptionId) => `/subscriptions/${subscriptionId}/activate`,
            subscriptionSkip: (subscriptionId) => `/subscriptions/${subscriptionId}/skip`,
            subscriptionUnskip: (subscriptionId) => `/subscriptions/${subscriptionId}/unskip`,
            subscriptionPause: (subscriptionId) => `/subscriptions/${subscriptionId}/pause`,
            subscriptionUnpause: (subscriptionId) => `/subscriptions/${subscriptionId}/unpause`,
            orders: '/orders',
            orderById: (orderId) => `/orders/${orderId}`,
            orderCharges: (orderId) => `/orders/${orderId}/charges`,
            charges: '/charges',
            chargeById: (chargeId) => `/charges/${chargeId}`,
            chargeCapture: (chargeId) => `/charges/${chargeId}/capture`,
            chargeRefund: (chargeId) => `/charges/${chargeId}/refund`,
            products: '/products',
            productById: (productId) => `/products/${productId}`,
            addresses: '/addresses',
            addressById: (addressId) => `/addresses/${addressId}`,
            paymentMethods: '/payment_methods',
            paymentMethodById: (paymentMethodId) => `/payment_methods/${paymentMethodId}`,
            webhooks: '/webhooks',
            webhookById: (webhookId) => `/webhooks/${webhookId}`,
            metafields: '/metafields',
            metafieldById: (metafieldId) => `/metafields/${metafieldId}`,
            shop: '/shop',
            discounts: '/discounts',
            discountById: (discountId) => `/discounts/${discountId}`,
            collections: '/collections',
            collectionById: (collectionId) => `/collections/${collectionId}`,
            collectionProducts: (collectionId) => `/collections/${collectionId}/products`,
            asyncBatches: '/async_batches',
            asyncBatchById: (batchId) => `/async_batches/${batchId}`,
            asyncBatchTasks: (batchId) => `/async_batches/${batchId}/tasks`,
            checkouts: '/checkouts',
            checkoutById: (checkoutToken) => `/checkouts/${checkoutToken}`,
            checkoutCharge: (checkoutToken) => `/checkouts/${checkoutToken}/charge`,
            notifications: '/notifications',
            notificationById: (notificationId) => `/notifications/${notificationId}`,
            notificationSend: (notificationId) => `/notifications/${notificationId}/send`
        };
    }
    addAuthHeaders(headers = {}) {
        if (!this.api_key) {
            throw new Error('API key is required for Recharge API requests');
        }
        return {
            ...headers,
            'X-Recharge-Access-Token': this.api_key,
            'X-Recharge-Version': this.API_VERSION,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }
    _cleanParams(params) {
        const cleaned = {};
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                cleaned[key] = params[key];
            }
        });
        return cleaned;
    }
    _buildPaginationParams(options = {}) {
        const params = {};
        if (options.page)
            params.page = options.page;
        if (options.limit)
            params.limit = options.limit;
        if (options.sort_by)
            params.sort_by = options.sort_by;
        if (options.direction)
            params.direction = options.direction;
        return params;
    }
    _buildQueryParams(options = {}) {
        const params = this._buildPaginationParams(options);
        Object.keys(options).forEach(key => {
            if (!['page', 'limit', 'sort_by', 'direction'].includes(key) && options[key] !== undefined) {
                params[key] = options[key];
            }
        });
        return this._cleanParams(params);
    }
    async testAuth() {
        try {
            const response = await this._get({
                url: `${this.baseUrl}${this.URLs.shop}`
            });
            return { success: true, data: response };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    async getShop() {
        return this._get({
            url: `${this.baseUrl}${this.URLs.shop}`
        });
    }
    async listCustomers(options = {}) {
        const query = this._buildQueryParams(options);
        return this._get({
            url: `${this.baseUrl}${this.URLs.customers}`,
            query
        });
    }
    async getCustomer(customerId) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.customerById(customerId)}`
        });
    }
    async createCustomer(customerData) {
        return this._post({
            url: `${this.baseUrl}${this.URLs.customers}`,
            body: customerData
        });
    }
    async updateCustomer(customerId, customerData) {
        return this._put({
            url: `${this.baseUrl}${this.URLs.customerById(customerId)}`,
            body: customerData
        });
    }
    async deleteCustomer(customerId) {
        return this._delete({
            url: `${this.baseUrl}${this.URLs.customerById(customerId)}`
        });
    }
    async listSubscriptions(options = {}) {
        const query = this._buildQueryParams(options);
        return this._get({
            url: `${this.baseUrl}${this.URLs.subscriptions}`,
            query
        });
    }
    async getSubscription(subscriptionId) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.subscriptionById(subscriptionId)}`
        });
    }
    async createSubscription(subscriptionData) {
        return this._post({
            url: `${this.baseUrl}${this.URLs.subscriptions}`,
            body: subscriptionData
        });
    }
    async updateSubscription(subscriptionId, subscriptionData) {
        return this._put({
            url: `${this.baseUrl}${this.URLs.subscriptionById(subscriptionId)}`,
            body: subscriptionData
        });
    }
    async cancelSubscription(subscriptionId, cancelData = {}) {
        return this._post({
            url: `${this.baseUrl}${this.URLs.subscriptionCancel(subscriptionId)}`,
            body: cancelData
        });
    }
    async activateSubscription(subscriptionId) {
        return this._post({
            url: `${this.baseUrl}${this.URLs.subscriptionActivate(subscriptionId)}`,
            body: {}
        });
    }
    async listOrders(options = {}) {
        const query = this._buildQueryParams(options);
        return this._get({
            url: `${this.baseUrl}${this.URLs.orders}`,
            query
        });
    }
    async getOrder(orderId) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.orderById(orderId)}`
        });
    }
    async updateOrder(orderId, orderData) {
        return this._put({
            url: `${this.baseUrl}${this.URLs.orderById(orderId)}`,
            body: orderData
        });
    }
    async listCharges(options = {}) {
        const query = this._buildQueryParams(options);
        return this._get({
            url: `${this.baseUrl}${this.URLs.charges}`,
            query
        });
    }
    async getCharge(chargeId) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.chargeById(chargeId)}`
        });
    }
    async listProducts(options = {}) {
        const query = this._buildQueryParams(options);
        return this._get({
            url: `${this.baseUrl}${this.URLs.products}`,
            query
        });
    }
    async getProduct(productId) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.productById(productId)}`
        });
    }
    async listWebhooks(options = {}) {
        const query = this._buildQueryParams(options);
        return this._get({
            url: `${this.baseUrl}${this.URLs.webhooks}`,
            query
        });
    }
    async getWebhook(webhookId) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.webhookById(webhookId)}`
        });
    }
    async createWebhook(webhookData) {
        return this._post({
            url: `${this.baseUrl}${this.URLs.webhooks}`,
            body: webhookData
        });
    }
    async updateWebhook(webhookId, webhookData) {
        return this._put({
            url: `${this.baseUrl}${this.URLs.webhookById(webhookId)}`,
            body: webhookData
        });
    }
    async deleteWebhook(webhookId) {
        return this._delete({
            url: `${this.baseUrl}${this.URLs.webhookById(webhookId)}`
        });
    }
    async listAddresses(options = {}) {
        const query = this._buildQueryParams(options);
        return this._get({
            url: `${this.baseUrl}${this.URLs.addresses}`,
            query
        });
    }
    async getAddress(addressId) {
        return this._get({
            url: `${this.baseUrl}${this.URLs.addressById(addressId)}`
        });
    }
    async createAddress(addressData) {
        return this._post({
            url: `${this.baseUrl}${this.URLs.addresses}`,
            body: addressData
        });
    }
    async updateAddress(addressId, addressData) {
        return this._put({
            url: `${this.baseUrl}${this.URLs.addressById(addressId)}`,
            body: addressData
        });
    }
    async deleteAddress(addressId) {
        return this._delete({
            url: `${this.baseUrl}${this.URLs.addressById(addressId)}`
        });
    }
}
exports.Api = Api;
//# sourceMappingURL=api.js.map