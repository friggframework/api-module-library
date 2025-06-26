const { Requester, get } = require('@friggframework/core');

class Api extends Requester {
    constructor(params) {
        super(params);
        this.apiKey = get(params, 'api_key', process.env.CHARGEBEE_API_KEY);
        this.siteName = get(params, 'site_name', process.env.CHARGEBEE_SITE_NAME);
        this.baseUrl = `https://${this.siteName}.chargebee.com/api/v2`;
        
        this.URLs = {
            // Customers
            customers: '/customers',
            customerById: (customerId) => `/customers/${customerId}`,
            
            // Subscriptions
            subscriptions: '/subscriptions',
            subscriptionById: (subscriptionId) => `/subscriptions/${subscriptionId}`,
            subscriptionPause: (subscriptionId) => `/subscriptions/${subscriptionId}/pause`,
            subscriptionResume: (subscriptionId) => `/subscriptions/${subscriptionId}/resume`,
            subscriptionCancel: (subscriptionId) => `/subscriptions/${subscriptionId}/cancel`,
            
            // Plans
            plans: '/plans',
            planById: (planId) => `/plans/${planId}`,
            
            // Addons
            addons: '/addons',
            addonById: (addonId) => `/addons/${addonId}`,
            
            // Coupons
            coupons: '/coupons',
            couponById: (couponId) => `/coupons/${couponId}`,
            
            // Invoices
            invoices: '/invoices',
            invoiceById: (invoiceId) => `/invoices/${invoiceId}`,
            invoiceCollect: (invoiceId) => `/invoices/${invoiceId}/collect_payment`,
            
            // Transactions
            transactions: '/transactions',
            transactionById: (transactionId) => `/transactions/${transactionId}`,
            
            // Events
            events: '/events',
            eventById: (eventId) => `/events/${eventId}`,
            
            // Payment Sources
            paymentSources: '/payment_sources',
            paymentSourceById: (paymentSourceId) => `/payment_sources/${paymentSourceId}`,
            
            // Credit Notes
            creditNotes: '/credit_notes',
            creditNoteById: (creditNoteId) => `/credit_notes/${creditNoteId}`,
            
            // Hosted Pages
            hostedPages: '/hosted_pages',
            hostedPageById: (hostedPageId) => `/hosted_pages/${hostedPageId}`,
            
            // Estimates
            estimates: '/estimates',
            
            // Portal Sessions
            portalSessions: '/portal_sessions'
        };
    }
    
    addAuthHeaders(options) {
        // Chargebee uses Basic Auth with API key as username
        const credentials = Buffer.from(`${this.apiKey}:`).toString('base64');
        const authHeaders = {
            'Authorization': `Basic ${credentials}`,
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        options.headers = {
            ...authHeaders,
            ...options.headers,
        };
    }
    
    // Helper to convert object to URL-encoded string for Chargebee API
    objectToUrlEncoded(obj, prefix = '') {
        const str = [];
        for (const p in obj) {
            if (obj.hasOwnProperty(p)) {
                const k = prefix ? `${prefix}[${p}]` : p;
                const v = obj[p];
                str.push((v !== null && typeof v === 'object') ?
                    this.objectToUrlEncoded(v, k) :
                    `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
            }
        }
        return str.join('&');
    }
    
    async _get(options) {
        this.addAuthHeaders(options);
        return super._get(options);
    }
    
    async _post(options, stringify = true) {
        this.addAuthHeaders(options);
        // Convert body to URL-encoded format for Chargebee
        if (options.body && typeof options.body === 'object') {
            options.body = this.objectToUrlEncoded(options.body);
        }
        return super._post(options, false);
    }
    
    async _put(options, stringify = true) {
        this.addAuthHeaders(options);
        if (options.body && typeof options.body === 'object') {
            options.body = this.objectToUrlEncoded(options.body);
        }
        return super._put(options, false);
    }
    
    async _delete(options) {
        this.addAuthHeaders(options);
        return super._delete(options);
    }
    
    // **************************   Customers   **********************************
    
    async createCustomer(customerData) {
        const options = {
            url: this.baseUrl + this.URLs.customers,
            body: customerData,
        };
        return this._post(options);
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
        const options = {
            url: this.baseUrl + this.URLs.customerById(customerId),
            body: customerData,
        };
        return this._post(options);
    }
    
    async deleteCustomer(customerId) {
        const options = {
            url: this.baseUrl + this.URLs.customerById(customerId) + '/delete',
        };
        return this._post(options, false);
    }
    
    // **************************   Subscriptions   **********************************
    
    async createSubscription(subscriptionData) {
        const options = {
            url: this.baseUrl + this.URLs.subscriptions,
            body: subscriptionData,
        };
        return this._post(options);
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
        const options = {
            url: this.baseUrl + this.URLs.subscriptionById(subscriptionId),
            body: subscriptionData,
        };
        return this._post(options);
    }
    
    async pauseSubscription(subscriptionId, pauseData = {}) {
        const options = {
            url: this.baseUrl + this.URLs.subscriptionPause(subscriptionId),
            body: pauseData,
        };
        return this._post(options);
    }
    
    async resumeSubscription(subscriptionId, resumeData = {}) {
        const options = {
            url: this.baseUrl + this.URLs.subscriptionResume(subscriptionId),
            body: resumeData,
        };
        return this._post(options);
    }
    
    async cancelSubscription(subscriptionId, cancelData = {}) {
        const options = {
            url: this.baseUrl + this.URLs.subscriptionCancel(subscriptionId),
            body: cancelData,
        };
        return this._post(options);
    }
    
    // **************************   Plans   **********************************
    
    async createPlan(planData) {
        const options = {
            url: this.baseUrl + this.URLs.plans,
            body: planData,
        };
        return this._post(options);
    }
    
    async listPlans(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.plans,
            query: params
        };
        return this._get(options);
    }
    
    async getPlanById(planId) {
        const options = {
            url: this.baseUrl + this.URLs.planById(planId),
        };
        return this._get(options);
    }
    
    async updatePlan(planId, planData) {
        const options = {
            url: this.baseUrl + this.URLs.planById(planId),
            body: planData,
        };
        return this._post(options);
    }
    
    async deletePlan(planId) {
        const options = {
            url: this.baseUrl + this.URLs.planById(planId) + '/delete',
        };
        return this._post(options, false);
    }
    
    // **************************   Invoices   **********************************
    
    async listInvoices(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.invoices,
            query: params
        };
        return this._get(options);
    }
    
    async getInvoiceById(invoiceId) {
        const options = {
            url: this.baseUrl + this.URLs.invoiceById(invoiceId),
        };
        return this._get(options);
    }
    
    async collectPayment(invoiceId, paymentData = {}) {
        const options = {
            url: this.baseUrl + this.URLs.invoiceCollect(invoiceId),
            body: paymentData,
        };
        return this._post(options);
    }
    
    // **************************   Events   **********************************
    
    async listEvents(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.events,
            query: params
        };
        return this._get(options);
    }
    
    async getEventById(eventId) {
        const options = {
            url: this.baseUrl + this.URLs.eventById(eventId),
        };
        return this._get(options);
    }
    
    // **************************   Hosted Pages   **********************************
    
    async createHostedPage(pageData) {
        const options = {
            url: this.baseUrl + this.URLs.hostedPages,
            body: pageData,
        };
        return this._post(options);
    }
    
    async getHostedPageById(hostedPageId) {
        const options = {
            url: this.baseUrl + this.URLs.hostedPageById(hostedPageId),
        };
        return this._get(options);
    }
}

module.exports = { Api };
