import { ApiKeyRequester, get } from '@friggframework/core';

// Type definitions for parameters and responses
interface RechargeApiParams {
    api_key: string;
}

interface PaginationOptions {
    page?: number;
    limit?: number;
    sort_by?: string;
    direction?: 'asc' | 'desc';
}

interface QueryOptions extends PaginationOptions {
    [key: string]: any;
}

// RequestOptions interface removed - using the one from @friggframework/core

class Api extends ApiKeyRequester {
    private api_key: string;
    private readonly API_VERSION = '2021-11';
    
    public URLs: {
        // Customers endpoints
        customers: string;
        customerById: (customerId: string | number) => string;
        customerAddresses: (customerId: string | number) => string;
        customerPaymentMethods: (customerId: string | number) => string;
        customerSubscriptions: (customerId: string | number) => string;
        
        // Subscriptions endpoints
        subscriptions: string;
        subscriptionById: (subscriptionId: string | number) => string;
        subscriptionCancel: (subscriptionId: string | number) => string;
        subscriptionActivate: (subscriptionId: string | number) => string;
        subscriptionSkip: (subscriptionId: string | number) => string;
        subscriptionUnskip: (subscriptionId: string | number) => string;
        subscriptionPause: (subscriptionId: string | number) => string;
        subscriptionUnpause: (subscriptionId: string | number) => string;
        
        // Orders endpoints
        orders: string;
        orderById: (orderId: string | number) => string;
        orderCharges: (orderId: string | number) => string;
        
        // Charges endpoints
        charges: string;
        chargeById: (chargeId: string | number) => string;
        chargeCapture: (chargeId: string | number) => string;
        chargeRefund: (chargeId: string | number) => string;
        
        // Products endpoints
        products: string;
        productById: (productId: string | number) => string;
        
        // Addresses endpoints
        addresses: string;
        addressById: (addressId: string | number) => string;
        
        // Payment methods endpoints
        paymentMethods: string;
        paymentMethodById: (paymentMethodId: string | number) => string;
        
        // Webhooks endpoints
        webhooks: string;
        webhookById: (webhookId: string | number) => string;
        
        // Metafields endpoints
        metafields: string;
        metafieldById: (metafieldId: string | number) => string;
        
        // Shop endpoint
        shop: string;
        
        // Discounts endpoints
        discounts: string;
        discountById: (discountId: string | number) => string;
        
        // Collections endpoints
        collections: string;
        collectionById: (collectionId: string | number) => string;
        collectionProducts: (collectionId: string | number) => string;
        
        // Async batch endpoints
        asyncBatches: string;
        asyncBatchById: (batchId: string | number) => string;
        asyncBatchTasks: (batchId: string | number) => string;
        
        // Checkout endpoints
        checkouts: string;
        checkoutById: (checkoutToken: string) => string;
        checkoutCharge: (checkoutToken: string) => string;
        
        // Notification endpoints
        notifications: string;
        notificationById: (notificationId: string | number) => string;
        notificationSend: (notificationId: string | number) => string;
    };

    constructor(params: RechargeApiParams) {
        super(params);
        this.baseUrl = 'https://api.rechargeapps.com';
        
        // API key is expected to be passed as a parameter
        this.api_key = get(params, 'api_key', null);
        
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
    addAuthHeaders(headers: Record<string, string> = {}): Record<string, string> {
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
    
    // Helper method to clean parameters
    private _cleanParams(params: Record<string, any>): Record<string, any> {
        const cleaned: Record<string, any> = {};
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                cleaned[key] = params[key];
            }
        });
        return cleaned;
    }
    
    // Helper method to handle pagination parameters
    private _buildPaginationParams(options: PaginationOptions = {}): Record<string, any> {
        const params: Record<string, any> = {};
        
        if (options.page) params.page = options.page;
        if (options.limit) params.limit = options.limit;
        if (options.sort_by) params.sort_by = options.sort_by;
        if (options.direction) params.direction = options.direction;
        
        return params;
    }
    
    // Helper method to handle common query parameters
    private _buildQueryParams(options: QueryOptions = {}): Record<string, any> {
        const params = this._buildPaginationParams(options);
        
        // Add any additional query parameters
        Object.keys(options).forEach(key => {
            if (!['page', 'limit', 'sort_by', 'direction'].includes(key) && options[key] !== undefined) {
                params[key] = options[key];
            }
        });
        
        return this._cleanParams(params);
    }
    
    // Test authentication endpoint
    async testAuth(): Promise<{ success: boolean; data?: any; error?: string }> {
        try {
            const response = await this._get({
                url: `${this.baseUrl}${this.URLs.shop}`
            });
            return { success: true, data: response };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
    
    // Shop endpoint - get shop details
    async getShop(): Promise<any> {
        return this._get({
            url: `${this.baseUrl}${this.URLs.shop}`
        });
    }
    
    // Customer endpoints
    async listCustomers(options: QueryOptions = {}): Promise<any> {
        const query = this._buildQueryParams(options);
        return this._get({
            url: `${this.baseUrl}${this.URLs.customers}`,
            query
        });
    }
    
    async getCustomer(customerId: string | number): Promise<any> {
        return this._get({
            url: `${this.baseUrl}${this.URLs.customerById(customerId)}`
        });
    }
    
    async createCustomer(customerData: any): Promise<any> {
        return this._post({
            url: `${this.baseUrl}${this.URLs.customers}`,
            body: customerData
        });
    }
    
    async updateCustomer(customerId: string | number, customerData: any): Promise<any> {
        return this._put({
            url: `${this.baseUrl}${this.URLs.customerById(customerId)}`,
            body: customerData
        });
    }
    
    async deleteCustomer(customerId: string | number): Promise<any> {
        return this._delete({
            url: `${this.baseUrl}${this.URLs.customerById(customerId)}`
        });
    }
    
    // Subscription endpoints
    async listSubscriptions(options: QueryOptions = {}): Promise<any> {
        const query = this._buildQueryParams(options);
        return this._get({
            url: `${this.baseUrl}${this.URLs.subscriptions}`,
            query
        });
    }
    
    async getSubscription(subscriptionId: string | number): Promise<any> {
        return this._get({
            url: `${this.baseUrl}${this.URLs.subscriptionById(subscriptionId)}`
        });
    }
    
    async createSubscription(subscriptionData: any): Promise<any> {
        return this._post({
            url: `${this.baseUrl}${this.URLs.subscriptions}`,
            body: subscriptionData
        });
    }
    
    async updateSubscription(subscriptionId: string | number, subscriptionData: any): Promise<any> {
        return this._put({
            url: `${this.baseUrl}${this.URLs.subscriptionById(subscriptionId)}`,
            body: subscriptionData
        });
    }
    
    async cancelSubscription(subscriptionId: string | number, cancelData: any = {}): Promise<any> {
        return this._post({
            url: `${this.baseUrl}${this.URLs.subscriptionCancel(subscriptionId)}`,
            body: cancelData
        });
    }
    
    async activateSubscription(subscriptionId: string | number): Promise<any> {
        return this._post({
            url: `${this.baseUrl}${this.URLs.subscriptionActivate(subscriptionId)}`,
            body: {}
        });
    }
    
    // Order endpoints
    async listOrders(options: QueryOptions = {}): Promise<any> {
        const query = this._buildQueryParams(options);
        return this._get({
            url: `${this.baseUrl}${this.URLs.orders}`,
            query
        });
    }
    
    async getOrder(orderId: string | number): Promise<any> {
        return this._get({
            url: `${this.baseUrl}${this.URLs.orderById(orderId)}`
        });
    }
    
    async updateOrder(orderId: string | number, orderData: any): Promise<any> {
        return this._put({
            url: `${this.baseUrl}${this.URLs.orderById(orderId)}`,
            body: orderData
        });
    }
    
    // Charge endpoints
    async listCharges(options: QueryOptions = {}): Promise<any> {
        const query = this._buildQueryParams(options);
        return this._get({
            url: `${this.baseUrl}${this.URLs.charges}`,
            query
        });
    }
    
    async getCharge(chargeId: string | number): Promise<any> {
        return this._get({
            url: `${this.baseUrl}${this.URLs.chargeById(chargeId)}`
        });
    }
    
    // Product endpoints
    async listProducts(options: QueryOptions = {}): Promise<any> {
        const query = this._buildQueryParams(options);
        return this._get({
            url: `${this.baseUrl}${this.URLs.products}`,
            query
        });
    }
    
    async getProduct(productId: string | number): Promise<any> {
        return this._get({
            url: `${this.baseUrl}${this.URLs.productById(productId)}`
        });
    }
    
    // Webhook endpoints
    async listWebhooks(options: QueryOptions = {}): Promise<any> {
        const query = this._buildQueryParams(options);
        return this._get({
            url: `${this.baseUrl}${this.URLs.webhooks}`,
            query
        });
    }
    
    async getWebhook(webhookId: string | number): Promise<any> {
        return this._get({
            url: `${this.baseUrl}${this.URLs.webhookById(webhookId)}`
        });
    }
    
    async createWebhook(webhookData: any): Promise<any> {
        return this._post({
            url: `${this.baseUrl}${this.URLs.webhooks}`,
            body: webhookData
        });
    }
    
    async updateWebhook(webhookId: string | number, webhookData: any): Promise<any> {
        return this._put({
            url: `${this.baseUrl}${this.URLs.webhookById(webhookId)}`,
            body: webhookData
        });
    }
    
    async deleteWebhook(webhookId: string | number): Promise<any> {
        return this._delete({
            url: `${this.baseUrl}${this.URLs.webhookById(webhookId)}`
        });
    }
    
    // Address endpoints
    async listAddresses(options: QueryOptions = {}): Promise<any> {
        const query = this._buildQueryParams(options);
        return this._get({
            url: `${this.baseUrl}${this.URLs.addresses}`,
            query
        });
    }
    
    async getAddress(addressId: string | number): Promise<any> {
        return this._get({
            url: `${this.baseUrl}${this.URLs.addressById(addressId)}`
        });
    }
    
    async createAddress(addressData: any): Promise<any> {
        return this._post({
            url: `${this.baseUrl}${this.URLs.addresses}`,
            body: addressData
        });
    }
    
    async updateAddress(addressId: string | number, addressData: any): Promise<any> {
        return this._put({
            url: `${this.baseUrl}${this.URLs.addressById(addressId)}`,
            body: addressData
        });
    }
    
    async deleteAddress(addressId: string | number): Promise<any> {
        return this._delete({
            url: `${this.baseUrl}${this.URLs.addressById(addressId)}`
        });
    }
}

export { Api };