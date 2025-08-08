const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.sandbox = get(params, 'sandbox', false);
        this.baseUrl = this.sandbox 
            ? 'https://api-m.sandbox.paypal.com' 
            : 'https://api-m.paypal.com';
        
        this.authBaseUrl = this.sandbox
            ? 'https://www.sandbox.paypal.com'
            : 'https://www.paypal.com';
        
        this.URLs = {
            authorization: '/connect',
            access_token: '/v1/oauth2/token',
            
            // Identity
            userInfo: '/v1/identity/oauth2/userinfo',
            
            // Payments
            payments: '/v2/payments',
            paymentById: (paymentId) => `/v2/payments/payment/${paymentId}`,
            
            // Orders
            orders: '/v2/checkout/orders',
            orderById: (orderId) => `/v2/checkout/orders/${orderId}`,
            orderCapture: (orderId) => `/v2/checkout/orders/${orderId}/capture`,
            orderAuthorize: (orderId) => `/v2/checkout/orders/${orderId}/authorize`,
            
            // Invoicing
            invoices: '/v2/invoicing/invoices',
            invoiceById: (invoiceId) => `/v2/invoicing/invoices/${invoiceId}`,
            invoiceSend: (invoiceId) => `/v2/invoicing/invoices/${invoiceId}/send`,
            invoiceCancel: (invoiceId) => `/v2/invoicing/invoices/${invoiceId}/cancel`,
            
            // Subscriptions
            subscriptions: '/v1/billing/subscriptions',
            subscriptionById: (subscriptionId) => `/v1/billing/subscriptions/${subscriptionId}`,
            subscriptionActivate: (subscriptionId) => `/v1/billing/subscriptions/${subscriptionId}/activate`,
            subscriptionCancel: (subscriptionId) => `/v1/billing/subscriptions/${subscriptionId}/cancel`,
            subscriptionSuspend: (subscriptionId) => `/v1/billing/subscriptions/${subscriptionId}/suspend`,
            
            // Plans
            plans: '/v1/billing/plans',
            planById: (planId) => `/v1/billing/plans/${planId}`,
            planActivate: (planId) => `/v1/billing/plans/${planId}/activate`,
            planDeactivate: (planId) => `/v1/billing/plans/${planId}/deactivate`,
            
            // Products
            products: '/v1/catalogs/products',
            productById: (productId) => `/v1/catalogs/products/${productId}`,
            
            // Webhooks
            webhooks: '/v1/notifications/webhooks',
            webhookById: (webhookId) => `/v1/notifications/webhooks/${webhookId}`,
            webhookEventTypes: '/v1/notifications/webhooks-event-types',
            
            // Disputes
            disputes: '/v1/customer/disputes',
            disputeById: (disputeId) => `/v1/customer/disputes/${disputeId}`,
            
            // Partner Referrals
            partnerReferrals: '/v1/customer/partner-referrals',
            
            // Payouts
            payouts: '/v1/payments/payouts',
            payoutById: (payoutBatchId) => `/v1/payments/payouts/${payoutBatchId}`,
            payoutItem: (payoutItemId) => `/v1/payments/payouts-item/${payoutItemId}`,
        };

        // OAuth2 URLs for PayPal are different
        this.authorizationUri = encodeURI(
            `${this.authBaseUrl}/connect?flowEntry=static&client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&scope=${this.scope}&response_type=code&state=${this.state}`
        );
        this.tokenUri = this.baseUrl + '/v1/oauth2/token';

        this.access_token = get(params, 'access_token', null);
        this.refresh_token = get(params, 'refresh_token', null);
    }

    getAuthUri() {
        return this.authorizationUri;
    }

    addJsonHeaders(options) {
        const jsonHeaders = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
        options.headers = {
            ...jsonHeaders,
            ...options.headers,
        };
    }

    async _post(options, stringify = true) {
        this.addJsonHeaders(options);
        return super._post(options, stringify);
    }

    async _patch(options, stringify = true) {
        this.addJsonHeaders(options);
        return super._patch(options, stringify);
    }

    async _put(options, stringify = true) {
        this.addJsonHeaders(options);
        return super._put(options, stringify);
    }

    // **************************   Identity Methods   **********************************

    async getUserInfo() {
        const options = {
            url: this.baseUrl + this.URLs.userInfo,
            query: {
                schema: 'paypalv1.1'
            }
        };
        return this._get(options);
    }

    // **************************   Orders Methods   **********************************

    async createOrder(orderData) {
        const options = {
            url: this.baseUrl + this.URLs.orders,
            body: orderData,
        };
        return this._post(options);
    }

    async getOrder(orderId) {
        const options = {
            url: this.baseUrl + this.URLs.orderById(orderId),
        };
        return this._get(options);
    }

    async updateOrder(orderId, patchData) {
        const options = {
            url: this.baseUrl + this.URLs.orderById(orderId),
            body: patchData,
        };
        return this._patch(options);
    }

    async captureOrder(orderId, captureData = {}) {
        const options = {
            url: this.baseUrl + this.URLs.orderCapture(orderId),
            body: captureData,
        };
        return this._post(options);
    }

    async authorizeOrder(orderId, authorizeData = {}) {
        const options = {
            url: this.baseUrl + this.URLs.orderAuthorize(orderId),
            body: authorizeData,
        };
        return this._post(options);
    }

    // **************************   Payments Methods   **********************************

    async getPayment(paymentId) {
        const options = {
            url: this.baseUrl + this.URLs.paymentById(paymentId),
        };
        return this._get(options);
    }

    // **************************   Invoicing Methods   **********************************

    async getInvoices(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.invoices,
            query: params,
        };
        return this._get(options);
    }

    async createInvoice(invoiceData) {
        const options = {
            url: this.baseUrl + this.URLs.invoices,
            body: invoiceData,
        };
        return this._post(options);
    }

    async getInvoice(invoiceId) {
        const options = {
            url: this.baseUrl + this.URLs.invoiceById(invoiceId),
        };
        return this._get(options);
    }

    async updateInvoice(invoiceId, invoiceData) {
        const options = {
            url: this.baseUrl + this.URLs.invoiceById(invoiceId),
            body: invoiceData,
        };
        return this._put(options);
    }

    async deleteInvoice(invoiceId) {
        const options = {
            url: this.baseUrl + this.URLs.invoiceById(invoiceId),
        };
        return this._delete(options);
    }

    async sendInvoice(invoiceId, sendData = {}) {
        const options = {
            url: this.baseUrl + this.URLs.invoiceSend(invoiceId),
            body: sendData,
        };
        return this._post(options);
    }

    async cancelInvoice(invoiceId, cancelData) {
        const options = {
            url: this.baseUrl + this.URLs.invoiceCancel(invoiceId),
            body: cancelData,
        };
        return this._post(options);
    }

    // **************************   Subscriptions Methods   **********************************

    async createSubscription(subscriptionData) {
        const options = {
            url: this.baseUrl + this.URLs.subscriptions,
            body: subscriptionData,
        };
        return this._post(options);
    }

    async getSubscription(subscriptionId) {
        const options = {
            url: this.baseUrl + this.URLs.subscriptionById(subscriptionId),
        };
        return this._get(options);
    }

    async updateSubscription(subscriptionId, patchData) {
        const options = {
            url: this.baseUrl + this.URLs.subscriptionById(subscriptionId),
            body: patchData,
        };
        return this._patch(options);
    }

    async activateSubscription(subscriptionId, reason) {
        const options = {
            url: this.baseUrl + this.URLs.subscriptionActivate(subscriptionId),
            body: { reason },
        };
        return this._post(options);
    }

    async cancelSubscription(subscriptionId, reason) {
        const options = {
            url: this.baseUrl + this.URLs.subscriptionCancel(subscriptionId),
            body: { reason },
        };
        return this._post(options);
    }

    async suspendSubscription(subscriptionId, reason) {
        const options = {
            url: this.baseUrl + this.URLs.subscriptionSuspend(subscriptionId),
            body: { reason },
        };
        return this._post(options);
    }

    // **************************   Plans Methods   **********************************

    async getPlans(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.plans,
            query: params,
        };
        return this._get(options);
    }

    async createPlan(planData) {
        const options = {
            url: this.baseUrl + this.URLs.plans,
            body: planData,
        };
        return this._post(options);
    }

    async getPlan(planId) {
        const options = {
            url: this.baseUrl + this.URLs.planById(planId),
        };
        return this._get(options);
    }

    async updatePlan(planId, patchData) {
        const options = {
            url: this.baseUrl + this.URLs.planById(planId),
            body: patchData,
        };
        return this._patch(options);
    }

    async activatePlan(planId) {
        const options = {
            url: this.baseUrl + this.URLs.planActivate(planId),
        };
        return this._post(options);
    }

    async deactivatePlan(planId) {
        const options = {
            url: this.baseUrl + this.URLs.planDeactivate(planId),
        };
        return this._post(options);
    }

    // **************************   Products Methods   **********************************

    async getProducts(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.products,
            query: params,
        };
        return this._get(options);
    }

    async createProduct(productData) {
        const options = {
            url: this.baseUrl + this.URLs.products,
            body: productData,
        };
        return this._post(options);
    }

    async getProduct(productId) {
        const options = {
            url: this.baseUrl + this.URLs.productById(productId),
        };
        return this._get(options);
    }

    async updateProduct(productId, patchData) {
        const options = {
            url: this.baseUrl + this.URLs.productById(productId),
            body: patchData,
        };
        return this._patch(options);
    }

    // **************************   Webhooks Methods   **********************************

    async getWebhooks() {
        const options = {
            url: this.baseUrl + this.URLs.webhooks,
        };
        return this._get(options);
    }

    async createWebhook(webhookData) {
        const options = {
            url: this.baseUrl + this.URLs.webhooks,
            body: webhookData,
        };
        return this._post(options);
    }

    async getWebhook(webhookId) {
        const options = {
            url: this.baseUrl + this.URLs.webhookById(webhookId),
        };
        return this._get(options);
    }

    async updateWebhook(webhookId, patchData) {
        const options = {
            url: this.baseUrl + this.URLs.webhookById(webhookId),
            body: patchData,
        };
        return this._patch(options);
    }

    async deleteWebhook(webhookId) {
        const options = {
            url: this.baseUrl + this.URLs.webhookById(webhookId),
        };
        return this._delete(options);
    }

    async getWebhookEventTypes() {
        const options = {
            url: this.baseUrl + this.URLs.webhookEventTypes,
        };
        return this._get(options);
    }

    // **************************   Disputes Methods   **********************************

    async getDisputes(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.disputes,
            query: params,
        };
        return this._get(options);
    }

    async getDispute(disputeId) {
        const options = {
            url: this.baseUrl + this.URLs.disputeById(disputeId),
        };
        return this._get(options);
    }

    // **************************   Payouts Methods   **********************************

    async createPayout(payoutData) {
        const options = {
            url: this.baseUrl + this.URLs.payouts,
            body: payoutData,
        };
        return this._post(options);
    }

    async getPayout(payoutBatchId) {
        const options = {
            url: this.baseUrl + this.URLs.payoutById(payoutBatchId),
        };
        return this._get(options);
    }

    async getPayoutItem(payoutItemId) {
        const options = {
            url: this.baseUrl + this.URLs.payoutItem(payoutItemId),
        };
        return this._get(options);
    }

    // **************************   Helper Methods   **********************************

    async createSimpleOrder(amount, currency = 'USD', description = '') {
        const orderData = {
            intent: 'CAPTURE',
            purchase_units: [
                {
                    amount: {
                        currency_code: currency,
                        value: amount.toString()
                    },
                    description: description
                }
            ]
        };

        return this.createOrder(orderData);
    }
}

module.exports = { Api };