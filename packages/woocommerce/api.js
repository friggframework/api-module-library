const { OAuth2Requester, get } = require('@friggframework/core');
const crypto = require('crypto');

// WooCommerce REST API v3 client
// Supports Consumer Key/Secret authentication
// Documentation: https://woocommerce.github.io/woocommerce-rest-api-docs/

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.baseUrl = get(params, 'baseUrl', null); // WooCommerce site URL
        this.consumer_key = get(params, 'consumer_key', null);
        this.consumer_secret = get(params, 'consumer_secret', null);
        this.version = get(params, 'version', 'v3');
        this.isHttps = this.baseUrl ? this.baseUrl.startsWith('https') : true;

        this.URLs = {
            // Products
            products: '/products',
            productById: (productId) => `/products/${productId}`,
            productVariations: (productId) => `/products/${productId}/variations`,
            productVariationById: (productId, variationId) => `/products/${productId}/variations/${variationId}`,
            productCategories: '/products/categories',
            productCategoryById: (categoryId) => `/products/categories/${categoryId}`,
            productTags: '/products/tags',
            productTagById: (tagId) => `/products/tags/${tagId}`,
            productAttributes: '/products/attributes',
            productAttributeById: (attributeId) => `/products/attributes/${attributeId}`,
            productAttributeTerms: (attributeId) => `/products/attributes/${attributeId}/terms`,
            productReviews: '/products/reviews',
            productReviewById: (reviewId) => `/products/reviews/${reviewId}`,

            // Orders
            orders: '/orders',
            orderById: (orderId) => `/orders/${orderId}`,
            orderNotes: (orderId) => `/orders/${orderId}/notes`,
            orderNoteById: (orderId, noteId) => `/orders/${orderId}/notes/${noteId}`,
            orderRefunds: (orderId) => `/orders/${orderId}/refunds`,
            orderRefundById: (orderId, refundId) => `/orders/${orderId}/refunds/${refundId}`,

            // Customers
            customers: '/customers',
            customerById: (customerId) => `/customers/${customerId}`,
            customerDownloads: (customerId) => `/customers/${customerId}/downloads`,

            // Coupons
            coupons: '/coupons',
            couponById: (couponId) => `/coupons/${couponId}`,

            // Reports
            reports: '/reports',
            reportsSales: '/reports/sales',
            reportsTopSellers: '/reports/top_sellers',

            // Tax
            taxes: '/taxes',
            taxById: (taxId) => `/taxes/${taxId}`,
            taxClasses: '/taxes/classes',

            // Shipping
            shippingZones: '/shipping/zones',
            shippingZoneById: (zoneId) => `/shipping/zones/${zoneId}`,
            shippingZoneLocations: (zoneId) => `/shipping/zones/${zoneId}/locations`,
            shippingZoneMethods: (zoneId) => `/shipping/zones/${zoneId}/methods`,

            // Settings
            settings: '/settings',
            settingsByGroup: (groupId) => `/settings/${groupId}`,
            settingById: (groupId, settingId) => `/settings/${groupId}/${settingId}`,

            // System Status
            systemStatus: '/system_status',
            systemStatusTools: '/system_status/tools',

            // Webhooks
            webhooks: '/webhooks',
            webhookById: (webhookId) => `/webhooks/${webhookId}`,
            webhookDeliveries: (webhookId) => `/webhooks/${webhookId}/deliveries`,
        };

        // Set API endpoint
        this.apiEndpoint = `${this.baseUrl}/wp-json/wc/${this.version}`;
    }

    // Generate OAuth 1.0a signature for WooCommerce
    generateOAuthSignature(method, url, params = {}) {
        const oauth_params = {
            oauth_consumer_key: this.consumer_key,
            oauth_nonce: crypto.randomBytes(16).toString('hex'),
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: Math.floor(Date.now() / 1000),
            oauth_version: '1.0',
            ...params
        };

        // Create parameter string
        const paramString = Object.keys(oauth_params)
            .sort()
            .map(key => `${key}=${encodeURIComponent(oauth_params[key])}`)
            .join('&');

        // Create signature base string
        const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;

        // Create signing key
        const signingKey = `${encodeURIComponent(this.consumer_secret)}&`;

        // Generate signature
        const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
        oauth_params.oauth_signature = signature;

        return oauth_params;
    }

    // Add authentication to request options
    addAuthHeaders(options, method = 'GET') {
        if (this.isHttps) {
            // For HTTPS, use basic auth with consumer key/secret
            const auth = Buffer.from(`${this.consumer_key}:${this.consumer_secret}`).toString('base64');
            options.headers = {
                ...options.headers,
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
            };
        } else {
            // For HTTP, use OAuth 1.0a
            const oauthParams = this.generateOAuthSignature(method, options.url);
            const authHeader = 'OAuth ' + Object.keys(oauthParams)
                .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
                .join(', ');
            
            options.headers = {
                ...options.headers,
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            };
        }
    }

    async _get(options) {
        options.url = this.apiEndpoint + options.url;
        this.addAuthHeaders(options, 'GET');
        return super._get(options);
    }

    async _post(options, stringify = true) {
        options.url = this.apiEndpoint + options.url;
        this.addAuthHeaders(options, 'POST');
        return super._post(options, stringify);
    }

    async _put(options, stringify = true) {
        options.url = this.apiEndpoint + options.url;
        this.addAuthHeaders(options, 'PUT');
        return super._put(options, stringify);
    }

    async _patch(options, stringify = true) {
        options.url = this.apiEndpoint + options.url;
        this.addAuthHeaders(options, 'PATCH');
        return super._patch(options, stringify);
    }

    async _delete(options) {
        options.url = this.apiEndpoint + options.url;
        this.addAuthHeaders(options, 'DELETE');
        return super._delete(options);
    }

    // **************************   Products   **********************************

    async createProduct(productData) {
        const options = {
            url: this.URLs.products,
            body: productData,
        };
        return this._post(options);
    }

    async listProducts(params = {}) {
        const options = {
            url: this.URLs.products,
            query: params
        };
        return this._get(options);
    }

    async getProductById(id) {
        const options = {
            url: this.URLs.productById(id),
        };
        return this._get(options);
    }

    async updateProduct(id, productData) {
        const options = {
            url: this.URLs.productById(id),
            body: productData,
        };
        return this._put(options);
    }

    async deleteProduct(id, force = false) {
        const options = {
            url: this.URLs.productById(id),
            query: { force }
        };
        return this._delete(options);
    }

    async batchUpdateProducts(data) {
        const options = {
            url: this.URLs.products + '/batch',
            body: data,
        };
        return this._post(options);
    }

    // Product Variations
    async createProductVariation(productId, variationData) {
        const options = {
            url: this.URLs.productVariations(productId),
            body: variationData,
        };
        return this._post(options);
    }

    async listProductVariations(productId, params = {}) {
        const options = {
            url: this.URLs.productVariations(productId),
            query: params
        };
        return this._get(options);
    }

    async getProductVariationById(productId, variationId) {
        const options = {
            url: this.URLs.productVariationById(productId, variationId),
        };
        return this._get(options);
    }

    async updateProductVariation(productId, variationId, variationData) {
        const options = {
            url: this.URLs.productVariationById(productId, variationId),
            body: variationData,
        };
        return this._put(options);
    }

    async deleteProductVariation(productId, variationId, force = false) {
        const options = {
            url: this.URLs.productVariationById(productId, variationId),
            query: { force }
        };
        return this._delete(options);
    }

    // Product Categories
    async createProductCategory(categoryData) {
        const options = {
            url: this.URLs.productCategories,
            body: categoryData,
        };
        return this._post(options);
    }

    async listProductCategories(params = {}) {
        const options = {
            url: this.URLs.productCategories,
            query: params
        };
        return this._get(options);
    }

    async getProductCategoryById(id) {
        const options = {
            url: this.URLs.productCategoryById(id),
        };
        return this._get(options);
    }

    async updateProductCategory(id, categoryData) {
        const options = {
            url: this.URLs.productCategoryById(id),
            body: categoryData,
        };
        return this._put(options);
    }

    async deleteProductCategory(id, force = false) {
        const options = {
            url: this.URLs.productCategoryById(id),
            query: { force }
        };
        return this._delete(options);
    }

    // Product Reviews
    async listProductReviews(params = {}) {
        const options = {
            url: this.URLs.productReviews,
            query: params
        };
        return this._get(options);
    }

    async getProductReviewById(id) {
        const options = {
            url: this.URLs.productReviewById(id),
        };
        return this._get(options);
    }

    async updateProductReview(id, reviewData) {
        const options = {
            url: this.URLs.productReviewById(id),
            body: reviewData,
        };
        return this._put(options);
    }

    async deleteProductReview(id, force = false) {
        const options = {
            url: this.URLs.productReviewById(id),
            query: { force }
        };
        return this._delete(options);
    }

    // **************************   Orders   **********************************

    async createOrder(orderData) {
        const options = {
            url: this.URLs.orders,
            body: orderData,
        };
        return this._post(options);
    }

    async listOrders(params = {}) {
        const options = {
            url: this.URLs.orders,
            query: params
        };
        return this._get(options);
    }

    async getOrderById(id) {
        const options = {
            url: this.URLs.orderById(id),
        };
        return this._get(options);
    }

    async updateOrder(id, orderData) {
        const options = {
            url: this.URLs.orderById(id),
            body: orderData,
        };
        return this._put(options);
    }

    async deleteOrder(id, force = false) {
        const options = {
            url: this.URLs.orderById(id),
            query: { force }
        };
        return this._delete(options);
    }

    async batchUpdateOrders(data) {
        const options = {
            url: this.URLs.orders + '/batch',
            body: data,
        };
        return this._post(options);
    }

    // Order Notes
    async createOrderNote(orderId, noteData) {
        const options = {
            url: this.URLs.orderNotes(orderId),
            body: noteData,
        };
        return this._post(options);
    }

    async listOrderNotes(orderId, params = {}) {
        const options = {
            url: this.URLs.orderNotes(orderId),
            query: params
        };
        return this._get(options);
    }

    async getOrderNoteById(orderId, noteId) {
        const options = {
            url: this.URLs.orderNoteById(orderId, noteId),
        };
        return this._get(options);
    }

    async deleteOrderNote(orderId, noteId, force = false) {
        const options = {
            url: this.URLs.orderNoteById(orderId, noteId),
            query: { force }
        };
        return this._delete(options);
    }

    // Order Refunds
    async createOrderRefund(orderId, refundData) {
        const options = {
            url: this.URLs.orderRefunds(orderId),
            body: refundData,
        };
        return this._post(options);
    }

    async listOrderRefunds(orderId, params = {}) {
        const options = {
            url: this.URLs.orderRefunds(orderId),
            query: params
        };
        return this._get(options);
    }

    async getOrderRefundById(orderId, refundId) {
        const options = {
            url: this.URLs.orderRefundById(orderId, refundId),
        };
        return this._get(options);
    }

    async deleteOrderRefund(orderId, refundId, force = false) {
        const options = {
            url: this.URLs.orderRefundById(orderId, refundId),
            query: { force }
        };
        return this._delete(options);
    }

    // **************************   Customers   **********************************

    async createCustomer(customerData) {
        const options = {
            url: this.URLs.customers,
            body: customerData,
        };
        return this._post(options);
    }

    async listCustomers(params = {}) {
        const options = {
            url: this.URLs.customers,
            query: params
        };
        return this._get(options);
    }

    async getCustomerById(id) {
        const options = {
            url: this.URLs.customerById(id),
        };
        return this._get(options);
    }

    async updateCustomer(id, customerData) {
        const options = {
            url: this.URLs.customerById(id),
            body: customerData,
        };
        return this._put(options);
    }

    async deleteCustomer(id, force = false) {
        const options = {
            url: this.URLs.customerById(id),
            query: { force }
        };
        return this._delete(options);
    }

    async batchUpdateCustomers(data) {
        const options = {
            url: this.URLs.customers + '/batch',
            body: data,
        };
        return this._post(options);
    }

    async getCustomerDownloads(customerId) {
        const options = {
            url: this.URLs.customerDownloads(customerId),
        };
        return this._get(options);
    }

    // **************************   Webhooks   **********************************

    async createWebhook(webhookData) {
        const options = {
            url: this.URLs.webhooks,
            body: webhookData,
        };
        return this._post(options);
    }

    async listWebhooks(params = {}) {
        const options = {
            url: this.URLs.webhooks,
            query: params
        };
        return this._get(options);
    }

    async getWebhookById(id) {
        const options = {
            url: this.URLs.webhookById(id),
        };
        return this._get(options);
    }

    async updateWebhook(id, webhookData) {
        const options = {
            url: this.URLs.webhookById(id),
            body: webhookData,
        };
        return this._put(options);
    }

    async deleteWebhook(id, force = false) {
        const options = {
            url: this.URLs.webhookById(id),
            query: { force }
        };
        return this._delete(options);
    }

    async getWebhookDeliveries(webhookId) {
        const options = {
            url: this.URLs.webhookDeliveries(webhookId),
        };
        return this._get(options);
    }

    // **************************   Inventory   **********************************

    async updateProductStock(productId, stockQuantity, manageStock = true) {
        const options = {
            url: this.URLs.productById(productId),
            body: {
                manage_stock: manageStock,
                stock_quantity: stockQuantity,
            },
        };
        return this._put(options);
    }

    async updateVariationStock(productId, variationId, stockQuantity, manageStock = true) {
        const options = {
            url: this.URLs.productVariationById(productId, variationId),
            body: {
                manage_stock: manageStock,
                stock_quantity: stockQuantity,
            },
        };
        return this._put(options);
    }

    // **************************   Reports   **********************************

    async getSalesReport(params = {}) {
        const options = {
            url: this.URLs.reportsSales,
            query: params
        };
        return this._get(options);
    }

    async getTopSellersReport(params = {}) {
        const options = {
            url: this.URLs.reportsTopSellers,
            query: params
        };
        return this._get(options);
    }

    // **************************   Settings   **********************************

    async getSettings(params = {}) {
        const options = {
            url: this.URLs.settings,
            query: params
        };
        return this._get(options);
    }

    async getSettingsByGroup(groupId) {
        const options = {
            url: this.URLs.settingsByGroup(groupId),
        };
        return this._get(options);
    }

    async updateSetting(groupId, settingId, value) {
        const options = {
            url: this.URLs.settingById(groupId, settingId),
            body: { value },
        };
        return this._put(options);
    }

    // **************************   System Status   **********************************

    async getSystemStatus() {
        const options = {
            url: this.URLs.systemStatus,
        };
        return this._get(options);
    }

    async getSystemStatusTools() {
        const options = {
            url: this.URLs.systemStatusTools,
        };
        return this._get(options);
    }

    // **************************   Webhook Verification   **********************************

    verifyWebhookSignature(payload, signature, secret) {
        const hash = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('base64');
        return hash === signature;
    }
}

module.exports = { Api };