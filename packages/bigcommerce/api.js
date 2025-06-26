const { OAuth2Requester, get } = require('@friggframework/core');
const crypto = require('crypto');

// BigCommerce REST API v3 client
// Supports OAuth2 and Access Token authentication
// Documentation: https://developer.bigcommerce.com/api-reference

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.storeHash = get(params, 'storeHash', null);
        this.accessToken = get(params, 'accessToken', null);
        this.clientId = get(params, 'clientId', process.env.BIGCOMMERCE_CLIENT_ID);
        this.clientSecret = get(params, 'clientSecret', process.env.BIGCOMMERCE_CLIENT_SECRET);
        
        // Use provided access_token or accessToken parameter
        this.access_token = get(params, 'access_token', this.accessToken);
        
        this.baseUrl = `https://api.bigcommerce.com/stores/${this.storeHash}`;
        this.version = get(params, 'version', 'v3');

        this.URLs = {
            // Catalog - Products
            products: '/v3/catalog/products',
            productById: (productId) => `/v3/catalog/products/${productId}`,
            productVariants: (productId) => `/v3/catalog/products/${productId}/variants`,
            productVariantById: (productId, variantId) => `/v3/catalog/products/${productId}/variants/${variantId}`,
            productImages: (productId) => `/v3/catalog/products/${productId}/images`,
            productImageById: (productId, imageId) => `/v3/catalog/products/${productId}/images/${imageId}`,
            productVideos: (productId) => `/v3/catalog/products/${productId}/videos`,
            productReviews: (productId) => `/v3/catalog/products/${productId}/reviews`,
            productMetafields: (productId) => `/v3/catalog/products/${productId}/metafields`,

            // Catalog - Categories
            categories: '/v3/catalog/categories',
            categoryById: (categoryId) => `/v3/catalog/categories/${categoryId}`,
            categoryTree: '/v3/catalog/categories/tree',
            categoryMetafields: (categoryId) => `/v3/catalog/categories/${categoryId}/metafields`,

            // Catalog - Brands
            brands: '/v3/catalog/brands',
            brandById: (brandId) => `/v3/catalog/brands/${brandId}`,
            brandMetafields: (brandId) => `/v3/catalog/brands/${brandId}/metafields`,

            // Orders
            orders: '/v2/orders',
            orderById: (orderId) => `/v2/orders/${orderId}`,
            orderProducts: (orderId) => `/v2/orders/${orderId}/products`,
            orderShippingAddresses: (orderId) => `/v2/orders/${orderId}/shipping_addresses`,
            orderCoupons: (orderId) => `/v2/orders/${orderId}/coupons`,
            orderMessages: (orderId) => `/v2/orders/${orderId}/messages`,
            orderStatuses: '/v2/order_statuses',
            orderRefunds: (orderId) => `/v3/orders/${orderId}/payment_actions/refunds`,

            // Customers
            customers: '/v3/customers',
            customerById: (customerId) => `/v3/customers/${customerId}`,
            customerAddresses: (customerId) => `/v3/customers/${customerId}/addresses`,
            customerAddressById: (customerId, addressId) => `/v3/customers/${customerId}/addresses/${addressId}`,
            customerAttributes: (customerId) => `/v3/customers/${customerId}/attributes`,
            customerFormFields: (customerId) => `/v3/customers/${customerId}/form-field-values`,

            // Customer Groups
            customerGroups: '/v2/customer_groups',
            customerGroupById: (groupId) => `/v2/customer_groups/${groupId}`,

            // Coupons
            coupons: '/v2/coupons',
            couponById: (couponId) => `/v2/coupons/${couponId}`,

            // Marketing
            banners: '/v2/banners',
            bannerById: (bannerId) => `/v2/banners/${bannerId}`,
            giftCertificates: '/v2/gift_certificates',
            giftCertificateById: (giftCertId) => `/v2/gift_certificates/${giftCertId}`,

            // Store Information
            storeInfo: '/v2/store',
            time: '/v2/time',
            timezone: '/v2/timezone',

            // Webhooks
            webhooks: '/v3/hooks',
            webhookById: (webhookId) => `/v3/hooks/${webhookId}`,

            // Themes
            themes: '/v3/themes',
            themeById: (themeId) => `/v3/themes/${themeId}`,
            themeActions: (themeId) => `/v3/themes/${themeId}/actions`,
            themeConfigurations: (themeId) => `/v3/themes/${themeId}/configurations`,

            // Store Content
            pages: '/v2/pages',
            pageById: (pageId) => `/v2/pages/${pageId}`,
            blog: '/v2/blog',
            blogPosts: '/v2/blog/posts',
            blogPostById: (postId) => `/v2/blog/posts/${postId}`,
            blogTags: '/v2/blog/tags',

            // Settings
            settings: '/v3/settings',
            storeProfile: '/v3/settings/store-profile',
            analytics: '/v3/settings/analytics',

            // Shipping
            shippingZones: '/v2/shipping/zones',
            shippingMethods: '/v2/shipping/methods',

            // Tax
            taxClasses: '/v2/tax_classes',
            taxClassById: (taxClassId) => `/v2/tax_classes/${taxClassId}`,

            // Payment Methods
            paymentMethods: '/v2/payments/methods',

            // Scripts
            scripts: '/v3/content/scripts',
            scriptById: (scriptId) => `/v3/content/scripts/${scriptId}`,

            // Currencies
            currencies: '/v2/currencies',
            currencyById: (currencyId) => `/v2/currencies/${currencyId}`,

            // Countries and States
            countries: '/v2/countries',
            countryById: (countryId) => `/v2/countries/${countryId}`,
            countryStates: (countryId) => `/v2/countries/${countryId}/states`,
        };

        // OAuth endpoints
        this.authorizationUri = 'https://login.bigcommerce.com/oauth2/authorize';
        this.tokenUri = 'https://login.bigcommerce.com/oauth2/token';
    }

    // Add authentication headers
    addAuthHeaders(options) {
        options.headers = {
            ...options.headers,
            'X-Auth-Token': this.access_token,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
    }

    async _get(options) {
        options.url = this.baseUrl + options.url;
        this.addAuthHeaders(options);
        return super._get(options);
    }

    async _post(options, stringify = true) {
        options.url = this.baseUrl + options.url;
        this.addAuthHeaders(options);
        return super._post(options, stringify);
    }

    async _put(options, stringify = true) {
        options.url = this.baseUrl + options.url;
        this.addAuthHeaders(options);
        return super._put(options, stringify);
    }

    async _patch(options, stringify = true) {
        options.url = this.baseUrl + options.url;
        this.addAuthHeaders(options);
        return super._patch(options, stringify);
    }

    async _delete(options) {
        options.url = this.baseUrl + options.url;
        this.addAuthHeaders(options);
        return super._delete(options);
    }

    // **************************   OAuth Methods   **********************************

    getAuthUri(scopes = ['store_v2_default'], context = 'stores/{store_hash}') {
        const params = new URLSearchParams({
            client_id: this.clientId,
            response_type: 'code',
            scope: scopes.join(' '),
            context: context,
            redirect_uri: this.redirect_uri,
        });
        
        return `${this.authorizationUri}?${params.toString()}`;
    }

    async getTokenFromCode(code, context, scope) {
        const tokenData = {
            client_id: this.clientId,
            client_secret: this.clientSecret,
            code: code,
            context: context,
            scope: scope,
            grant_type: 'authorization_code',
            redirect_uri: this.redirect_uri,
        };

        const options = {
            url: this.tokenUri,
            body: tokenData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
        };

        return this._post(options, false);
    }

    // **************************   Store Information   **********************************

    async getStoreInfo() {
        const options = {
            url: this.URLs.storeInfo,
        };
        return this._get(options);
    }

    async getTime() {
        const options = {
            url: this.URLs.time,
        };
        return this._get(options);
    }

    async getTimezone() {
        const options = {
            url: this.URLs.timezone,
        };
        return this._get(options);
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

    async getProductById(id, params = {}) {
        const options = {
            url: this.URLs.productById(id),
            query: params
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

    async deleteProduct(id) {
        const options = {
            url: this.URLs.productById(id),
        };
        return this._delete(options);
    }

    // Product Variants
    async createProductVariant(productId, variantData) {
        const options = {
            url: this.URLs.productVariants(productId),
            body: variantData,
        };
        return this._post(options);
    }

    async listProductVariants(productId, params = {}) {
        const options = {
            url: this.URLs.productVariants(productId),
            query: params
        };
        return this._get(options);
    }

    async getProductVariantById(productId, variantId, params = {}) {
        const options = {
            url: this.URLs.productVariantById(productId, variantId),
            query: params
        };
        return this._get(options);
    }

    async updateProductVariant(productId, variantId, variantData) {
        const options = {
            url: this.URLs.productVariantById(productId, variantId),
            body: variantData,
        };
        return this._put(options);
    }

    async deleteProductVariant(productId, variantId) {
        const options = {
            url: this.URLs.productVariantById(productId, variantId),
        };
        return this._delete(options);
    }

    // Product Images
    async createProductImage(productId, imageData) {
        const options = {
            url: this.URLs.productImages(productId),
            body: imageData,
        };
        return this._post(options);
    }

    async listProductImages(productId, params = {}) {
        const options = {
            url: this.URLs.productImages(productId),
            query: params
        };
        return this._get(options);
    }

    async updateProductImage(productId, imageId, imageData) {
        const options = {
            url: this.URLs.productImageById(productId, imageId),
            body: imageData,
        };
        return this._put(options);
    }

    async deleteProductImage(productId, imageId) {
        const options = {
            url: this.URLs.productImageById(productId, imageId),
        };
        return this._delete(options);
    }

    // **************************   Categories   **********************************

    async createCategory(categoryData) {
        const options = {
            url: this.URLs.categories,
            body: categoryData,
        };
        return this._post(options);
    }

    async listCategories(params = {}) {
        const options = {
            url: this.URLs.categories,
            query: params
        };
        return this._get(options);
    }

    async getCategoryById(id, params = {}) {
        const options = {
            url: this.URLs.categoryById(id),
            query: params
        };
        return this._get(options);
    }

    async updateCategory(id, categoryData) {
        const options = {
            url: this.URLs.categoryById(id),
            body: categoryData,
        };
        return this._put(options);
    }

    async deleteCategory(id) {
        const options = {
            url: this.URLs.categoryById(id),
        };
        return this._delete(options);
    }

    async getCategoryTree() {
        const options = {
            url: this.URLs.categoryTree,
        };
        return this._get(options);
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

    async getOrderById(id, params = {}) {
        const options = {
            url: this.URLs.orderById(id),
            query: params
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

    async deleteOrder(id) {
        const options = {
            url: this.URLs.orderById(id),
        };
        return this._delete(options);
    }

    async getOrderProducts(orderId, params = {}) {
        const options = {
            url: this.URLs.orderProducts(orderId),
            query: params
        };
        return this._get(options);
    }

    async getOrderShippingAddresses(orderId, params = {}) {
        const options = {
            url: this.URLs.orderShippingAddresses(orderId),
            query: params
        };
        return this._get(options);
    }

    async listOrderStatuses() {
        const options = {
            url: this.URLs.orderStatuses,
        };
        return this._get(options);
    }

    async createOrderRefund(orderId, refundData) {
        const options = {
            url: this.URLs.orderRefunds(orderId),
            body: refundData,
        };
        return this._post(options);
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

    async getCustomerById(id, params = {}) {
        const options = {
            url: this.URLs.customerById(id),
            query: params
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

    async deleteCustomer(id) {
        const options = {
            url: this.URLs.customerById(id),
        };
        return this._delete(options);
    }

    async getCustomerAddresses(customerId, params = {}) {
        const options = {
            url: this.URLs.customerAddresses(customerId),
            query: params
        };
        return this._get(options);
    }

    async createCustomerAddress(customerId, addressData) {
        const options = {
            url: this.URLs.customerAddresses(customerId),
            body: addressData,
        };
        return this._post(options);
    }

    async updateCustomerAddress(customerId, addressId, addressData) {
        const options = {
            url: this.URLs.customerAddressById(customerId, addressId),
            body: addressData,
        };
        return this._put(options);
    }

    async deleteCustomerAddress(customerId, addressId) {
        const options = {
            url: this.URLs.customerAddressById(customerId, addressId),
        };
        return this._delete(options);
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

    async deleteWebhook(id) {
        const options = {
            url: this.URLs.webhookById(id),
        };
        return this._delete(options);
    }

    // **************************   Themes   **********************************

    async listThemes() {
        const options = {
            url: this.URLs.themes,
        };
        return this._get(options);
    }

    async getThemeById(id) {
        const options = {
            url: this.URLs.themeById(id),
        };
        return this._get(options);
    }

    async uploadTheme(themeData) {
        const options = {
            url: this.URLs.themes,
            body: themeData,
        };
        return this._post(options);
    }

    async downloadTheme(id) {
        const options = {
            url: `${this.URLs.themeById(id)}/actions/download`,
            body: {},
        };
        return this._post(options);
    }

    async activateTheme(id, params = {}) {
        const options = {
            url: `${this.URLs.themeById(id)}/actions/activate`,
            body: params,
        };
        return this._post(options);
    }

    async deleteTheme(id) {
        const options = {
            url: this.URLs.themeById(id),
        };
        return this._delete(options);
    }

    async getThemeConfigurations(id) {
        const options = {
            url: this.URLs.themeConfigurations(id),
        };
        return this._get(options);
    }

    // **************************   Brands   **********************************

    async createBrand(brandData) {
        const options = {
            url: this.URLs.brands,
            body: brandData,
        };
        return this._post(options);
    }

    async listBrands(params = {}) {
        const options = {
            url: this.URLs.brands,
            query: params
        };
        return this._get(options);
    }

    async getBrandById(id, params = {}) {
        const options = {
            url: this.URLs.brandById(id),
            query: params
        };
        return this._get(options);
    }

    async updateBrand(id, brandData) {
        const options = {
            url: this.URLs.brandById(id),
            body: brandData,
        };
        return this._put(options);
    }

    async deleteBrand(id) {
        const options = {
            url: this.URLs.brandById(id),
        };
        return this._delete(options);
    }

    // **************************   Settings   **********************************

    async getSettings() {
        const options = {
            url: this.URLs.settings,
        };
        return this._get(options);
    }

    async getStoreProfile() {
        const options = {
            url: this.URLs.storeProfile,
        };
        return this._get(options);
    }

    async updateStoreProfile(profileData) {
        const options = {
            url: this.URLs.storeProfile,
            body: profileData,
        };
        return this._put(options);
    }

    // **************************   Webhook Verification   **********************************

    verifyWebhookSignature(payload, signature, clientSecret) {
        const hash = crypto.createHmac('sha256', clientSecret).update(payload, 'utf8').digest('base64');
        return hash === signature;
    }
}

module.exports = { Api };