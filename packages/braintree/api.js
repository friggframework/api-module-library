const { Requester, get } = require('@friggframework/core');

class Api extends Requester {
    constructor(params) {
        super(params);
        this.merchantId = get(params, 'merchant_id', process.env.BRAINTREE_MERCHANT_ID);
        this.publicKey = get(params, 'public_key', process.env.BRAINTREE_PUBLIC_KEY);
        this.privateKey = get(params, 'private_key', process.env.BRAINTREE_PRIVATE_KEY);
        this.environment = get(params, 'environment', process.env.BRAINTREE_ENVIRONMENT || 'sandbox');
        
        // Set base URL based on environment
        this.baseUrl = this.environment === 'production' 
            ? 'https://api.braintreegateway.com'
            : 'https://api.sandbox.braintreegateway.com';
        
        this.URLs = {
            // Transactions
            transactions: '/merchants/*/transactions',
            transactionById: (transactionId) => `/merchants/*/transactions/${transactionId}`,
            transactionVoid: (transactionId) => `/merchants/*/transactions/${transactionId}/void`,
            transactionRefund: (transactionId) => `/merchants/*/transactions/${transactionId}/refund`,
            
            // Customers
            customers: '/merchants/*/customers',
            customerById: (customerId) => `/merchants/*/customers/${customerId}`,
            
            // Payment Methods
            paymentMethods: '/merchants/*/payment_methods',
            paymentMethodById: (token) => `/merchants/*/payment_methods/${token}`,
            
            // Subscriptions
            subscriptions: '/merchants/*/subscriptions',
            subscriptionById: (subscriptionId) => `/merchants/*/subscriptions/${subscriptionId}`,
            
            // Plans
            plans: '/merchants/*/plans',
            planById: (planId) => `/merchants/*/plans/${planId}`,
            
            // Discounts
            discounts: '/merchants/*/discounts',
            discountById: (discountId) => `/merchants/*/discounts/${discountId}`,
            
            // Webhooks
            webhooks: '/merchants/*/webhooks',
            webhookById: (webhookId) => `/merchants/*/webhooks/${webhookId}`,
            
            // Disputes
            disputes: '/merchants/*/disputes',
            disputeById: (disputeId) => `/merchants/*/disputes/${disputeId}`,
            
            // Settlement Batch Summary
            settlementBatch: '/merchants/*/settlement_batch_summary'
        };
    }
    
    addAuthHeaders(options) {
        // Braintree uses Basic Auth with public:private keys
        const credentials = Buffer.from(`${this.publicKey}:${this.privateKey}`).toString('base64');
        const authHeaders = {
            'Authorization': `Basic ${credentials}`,
            'Accept': 'application/xml',
            'Content-Type': 'application/xml'
        };
        options.headers = {
            ...authHeaders,
            ...options.headers,
        };
        
        // Replace merchant placeholder with actual merchant ID
        if (options.url.includes('/merchants/*')) {
            options.url = options.url.replace('/merchants/*', `/merchants/${this.merchantId}`);
        }
    }
    
    async _get(options) {
        this.addAuthHeaders(options);
        return super._get(options);
    }
    
    async _post(options, stringify = true) {
        this.addAuthHeaders(options);
        return super._post(options, stringify);
    }
    
    async _put(options, stringify = true) {
        this.addAuthHeaders(options);
        return super._put(options, stringify);
    }
    
    async _delete(options) {
        this.addAuthHeaders(options);
        return super._delete(options);
    }
    
    // Helper to convert JS object to XML for Braintree API
    objectToXml(obj, rootElement = 'transaction') {
        let xml = `<${rootElement}>`;
        
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'object' && value !== null) {
                xml += this.objectToXml(value, key);
            } else {
                xml += `<${key}>${value}</${key}>`;
            }
        }
        
        xml += `</${rootElement}>`;
        return xml;
    }
    
    // **************************   Transactions   **********************************
    
    async createTransaction(transactionData) {
        const xmlBody = this.objectToXml(transactionData, 'transaction');
        const options = {
            url: this.baseUrl + this.URLs.transactions,
            body: xmlBody,
        };
        return this._post(options, false);
    }
    
    async searchTransactions(searchCriteria) {
        const options = {
            url: this.baseUrl + this.URLs.transactions + '/advanced_search',
            query: searchCriteria
        };
        return this._get(options);
    }
    
    async getTransactionById(transactionId) {
        const options = {
            url: this.baseUrl + this.URLs.transactionById(transactionId),
        };
        return this._get(options);
    }
    
    async voidTransaction(transactionId) {
        const options = {
            url: this.baseUrl + this.URLs.transactionVoid(transactionId),
        };
        return this._put(options, false);
    }
    
    async refundTransaction(transactionId, amount = null) {
        const xmlBody = amount ? this.objectToXml({ amount }, 'transaction') : '';
        const options = {
            url: this.baseUrl + this.URLs.transactionRefund(transactionId),
            body: xmlBody,
        };
        return this._post(options, false);
    }
    
    // **************************   Customers   **********************************
    
    async createCustomer(customerData) {
        const xmlBody = this.objectToXml(customerData, 'customer');
        const options = {
            url: this.baseUrl + this.URLs.customers,
            body: xmlBody,
        };
        return this._post(options, false);
    }
    
    async listCustomers(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.customers,
            query: params
        };
        return this._get(options);
    }
    
    async getCustomerById(customerId) {
        const options = {
            url: this.baseUrl + this.URLs.customerById(customerId),
        };
        return this._get(options);
    }
    
    async updateCustomer(customerId, customerData) {
        const xmlBody = this.objectToXml(customerData, 'customer');
        const options = {
            url: this.baseUrl + this.URLs.customerById(customerId),
            body: xmlBody,
        };
        return this._put(options, false);
    }
    
    async deleteCustomer(customerId) {
        const options = {
            url: this.baseUrl + this.URLs.customerById(customerId),
        };
        return this._delete(options);
    }
    
    // **************************   Payment Methods   **********************************
    
    async createPaymentMethod(paymentMethodData) {
        const xmlBody = this.objectToXml(paymentMethodData, 'payment-method');
        const options = {
            url: this.baseUrl + this.URLs.paymentMethods,
            body: xmlBody,
        };
        return this._post(options, false);
    }
    
    async getPaymentMethod(token) {
        const options = {
            url: this.baseUrl + this.URLs.paymentMethodById(token),
        };
        return this._get(options);
    }
    
    async updatePaymentMethod(token, paymentMethodData) {
        const xmlBody = this.objectToXml(paymentMethodData, 'payment-method');
        const options = {
            url: this.baseUrl + this.URLs.paymentMethodById(token),
            body: xmlBody,
        };
        return this._put(options, false);
    }
    
    async deletePaymentMethod(token) {
        const options = {
            url: this.baseUrl + this.URLs.paymentMethodById(token),
        };
        return this._delete(options);
    }
    
    // **************************   Subscriptions   **********************************
    
    async createSubscription(subscriptionData) {
        const xmlBody = this.objectToXml(subscriptionData, 'subscription');
        const options = {
            url: this.baseUrl + this.URLs.subscriptions,
            body: xmlBody,
        };
        return this._post(options, false);
    }
    
    async listSubscriptions(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.subscriptions,
            query: params
        };
        return this._get(options);
    }
    
    async getSubscriptionById(subscriptionId) {
        const options = {
            url: this.baseUrl + this.URLs.subscriptionById(subscriptionId),
        };
        return this._get(options);
    }
    
    async updateSubscription(subscriptionId, subscriptionData) {
        const xmlBody = this.objectToXml(subscriptionData, 'subscription');
        const options = {
            url: this.baseUrl + this.URLs.subscriptionById(subscriptionId),
            body: xmlBody,
        };
        return this._put(options, false);
    }
    
    async cancelSubscription(subscriptionId) {
        const options = {
            url: this.baseUrl + this.URLs.subscriptionById(subscriptionId) + '/cancel',
        };
        return this._put(options, false);
    }
}

module.exports = { Api };
