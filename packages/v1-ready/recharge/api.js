const { ApiKeyRequester, get } = require('@friggframework/core');

class Api extends ApiKeyRequester {
    constructor(params) {
        super(params);
        this.baseUrl = 'https://api.rechargeapps.com';
        
        // API key is expected to be passed as a parameter
        this.api_key = get(params, 'api_key', null);
        
        // API version header constant
        this.API_VERSION = '2021-11';
        
        // URL endpoints
        this.URLs = {
            // Customers endpoints
            customers: '/customers',
            customerById: (customerId) => `/customers/${customerId}`,
            customerAddresses: (customerId) => `/customers/${customerId}/addresses`,
            customerPaymentMethods: (customerId) => `/customers/${customerId}/payment_methods`,
            customerSubscriptions: (customerId) => `/customers/${customerId}/subscriptions`,
            
            // Subscriptions endpoints
            subscriptions: '/subscriptions',
            subscriptionById: (subscriptionId) => `/subscriptions/${subscriptionId}`,
            subscriptionCancel: (subscriptionId) => `/subscriptions/${subscriptionId}/cancel`,
            subscriptionActivate: (subscriptionId) => `/subscriptions/${subscriptionId}/activate`,
            subscriptionSkip: (subscriptionId) => `/subscriptions/${subscriptionId}/skip`,
            subscriptionUnskip: (subscriptionId) => `/subscriptions/${subscriptionId}/unskip`,
            subscriptionPause: (subscriptionId) => `/subscriptions/${subscriptionId}/pause`,
            subscriptionUnpause: (subscriptionId) => `/subscriptions/${subscriptionId}/unpause`,
            
            // Orders endpoints
            orders: '/orders',
            orderById: (orderId) => `/orders/${orderId}`,
            orderCharges: (orderId) => `/orders/${orderId}/charges`,
            
            // Charges endpoints
            charges: '/charges',
            chargeById: (chargeId) => `/charges/${chargeId}`,
            chargeCapture: (chargeId) => `/charges/${chargeId}/capture`,
            chargeRefund: (chargeId) => `/charges/${chargeId}/refund`,
            
            // Products endpoints
            products: '/products',
            productById: (productId) => `/products/${productId}`,
            
            // Addresses endpoints
            addresses: '/addresses',
            addressById: (addressId) => `/addresses/${addressId}`,
            
            // Payment methods endpoints
            paymentMethods: '/payment_methods',
            paymentMethodById: (paymentMethodId) => `/payment_methods/${paymentMethodId}`,
            
            // Webhooks endpoints
            webhooks: '/webhooks',
            webhookById: (webhookId) => `/webhooks/${webhookId}`,
            
            // Metafields endpoints
            metafields: '/metafields',
            metafieldById: (metafieldId) => `/metafields/${metafieldId}`,
            
            // Shop endpoint
            shop: '/shop',
            
            // Discounts endpoints
            discounts: '/discounts',
            discountById: (discountId) => `/discounts/${discountId}`,
            
            // Collections endpoints
            collections: '/collections',
            collectionById: (collectionId) => `/collections/${collectionId}`,
            collectionProducts: (collectionId) => `/collections/${collectionId}/products`,
            
            // Async batch endpoints
            asyncBatches: '/async_batches',
            asyncBatchById: (batchId) => `/async_batches/${batchId}`,
            asyncBatchTasks: (batchId) => `/async_batches/${batchId}/tasks`,
            
            // Checkout endpoints
            checkouts: '/checkouts',
            checkoutById: (checkoutToken) => `/checkouts/${checkoutToken}`,
            checkoutCharge: (checkoutToken) => `/checkouts/${checkoutToken}/charge`,
            
            // Notification endpoints
            notifications: '/notifications',
            notificationById: (notificationId) => `/notifications/${notificationId}`,
            notificationSend: (notificationId) => `/notifications/${notificationId}/send`
        };
    }
    
    // Override addAuthHeaders to include Recharge-specific headers
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
    
    // Helper method to handle pagination parameters
    _buildPaginationParams(options = {}) {
        const params = {};
        
        if (options.page) params.page = options.page;
        if (options.limit) params.limit = options.limit;
        if (options.sort_by) params.sort_by = options.sort_by;
        if (options.direction) params.direction = options.direction;
        
        return params;
    }
    
    // Helper method to handle common query parameters
    _buildQueryParams(options = {}) {
        const params = this._buildPaginationParams(options);
        
        // Add any additional query parameters
        Object.keys(options).forEach(key => {
            if (!['page', 'limit', 'sort_by', 'direction'].includes(key) && options[key] !== undefined) {
                params[key] = options[key];
            }
        });
        
        return params;
    }
    
    // Override base request methods to ensure headers are always included
    async _get(options) {
        return super._get({
            ...options,
            headers: this.addAuthHeaders(options.headers)
        });
    }
    
    async _post(options) {
        return super._post({
            ...options,
            headers: this.addAuthHeaders(options.headers)
        });
    }
    
    async _put(options) {
        return super._put({
            ...options,
            headers: this.addAuthHeaders(options.headers)
        });
    }
    
    async _delete(options) {
        return super._delete({
            ...options,
            headers: this.addAuthHeaders(options.headers)
        });
    }
    
    // Test authentication endpoint
    async testAuth() {
        try {
            const response = await this._get({
                url: `${this.baseUrl}${this.URLs.shop}`
            });
            return { success: true, data: response };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // Shop endpoint - get shop details
    async getShop() {
        return this._get({
            url: `${this.baseUrl}${this.URLs.shop}`
        });
    }
    
    // Customer endpoints
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
    
    // Subscription endpoints
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
    
    // Order endpoints
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
    
    // Charge endpoints
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
    
    // Product endpoints
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
    
    // Webhook endpoints
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
    
    // Address endpoints
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

module.exports = { Api };