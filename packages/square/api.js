const { OAuth2Requester, get } = require('@friggframework/core');

class Api extends OAuth2Requester {
    constructor(params) {
        super(params);
        
        this.sandbox = get(params, 'sandbox', false);
        this.baseUrl = this.sandbox 
            ? 'https://connect.squareupsandbox.com' 
            : 'https://connect.squareup.com';
        
        this.URLs = {
            authorization: '/oauth2/authorize',
            access_token: '/oauth2/token',
            revoke_token: '/oauth2/revoke',
            
            // Merchants
            merchants: '/v2/merchants',
            
            // Locations
            locations: '/v2/locations',
            locationById: (locationId) => `/v2/locations/${locationId}`,
            
            // Payments
            payments: '/v2/payments',
            paymentById: (paymentId) => `/v2/payments/${paymentId}`,
            
            // Orders
            orders: '/v2/orders',
            createOrder: '/v2/orders',
            batchRetrieveOrders: '/v2/orders/batch-retrieve',
            searchOrders: '/v2/orders/search',
            updateOrder: (orderId) => `/v2/orders/${orderId}`,
            payOrder: (orderId) => `/v2/orders/${orderId}/pay`,
            
            // Catalog
            catalog: '/v2/catalog',
            catalogList: '/v2/catalog/list',
            catalogSearch: '/v2/catalog/search',
            catalogObject: (objectId) => `/v2/catalog/object/${objectId}`,
            catalogBatchUpsert: '/v2/catalog/batch-upsert',
            catalogBatchDelete: '/v2/catalog/batch-delete',
            catalogBatchRetrieve: '/v2/catalog/batch-retrieve',
            
            // Inventory
            inventory: '/v2/inventory',
            inventoryAdjustment: '/v2/inventory/adjustment',
            inventoryCount: '/v2/inventory/count',
            inventoryBatchChange: '/v2/inventory/batch-change',
            inventoryBatchRetrieveCount: '/v2/inventory/batch-retrieve-count',
            
            // Customers
            customers: '/v2/customers',
            customerById: (customerId) => `/v2/customers/${customerId}`,
            customerSearch: '/v2/customers/search',
            
            // Invoices
            invoices: '/v2/invoices',
            invoiceById: (invoiceId) => `/v2/invoices/${invoiceId}`,
            invoiceSearch: '/v2/invoices/search',
            invoiceSend: (invoiceId) => `/v2/invoices/${invoiceId}/send-invoice`,
            invoiceCancel: (invoiceId) => `/v2/invoices/${invoiceId}/cancel-invoice`,
            
            // Subscriptions
            subscriptions: '/v2/subscriptions',
            subscriptionById: (subscriptionId) => `/v2/subscriptions/${subscriptionId}`,
            subscriptionSearch: '/v2/subscriptions/search',
            subscriptionCancel: (subscriptionId) => `/v2/subscriptions/${subscriptionId}/cancel`,
            subscriptionPause: (subscriptionId) => `/v2/subscriptions/${subscriptionId}/pause`,
            subscriptionResume: (subscriptionId) => `/v2/subscriptions/${subscriptionId}/resume`,
            
            // Refunds
            refunds: '/v2/refunds',
            refundById: (refundId) => `/v2/refunds/${refundId}`,
            
            // Disputes
            disputes: '/v2/disputes',
            disputeById: (disputeId) => `/v2/disputes/${disputeId}`,
            
            // Webhooks
            webhookSubscriptions: '/v2/webhooks/subscriptions',
            webhookSubscriptionById: (subscriptionId) => `/v2/webhooks/subscriptions/${subscriptionId}`,
        };

        this.authorizationUri = encodeURI(
            `${this.baseUrl}/oauth2/authorize?client_id=${this.client_id}&redirect_uri=${this.redirect_uri}&response_type=code&scope=${this.scope}&state=${this.state}`
        );
        this.tokenUri = this.baseUrl + '/oauth2/token';

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

    // **************************   Merchants Methods   **********************************

    async listMerchants() {
        const options = {
            url: this.baseUrl + this.URLs.merchants,
        };
        return this._get(options);
    }

    // **************************   Locations Methods   **********************************

    async listLocations() {
        const options = {
            url: this.baseUrl + this.URLs.locations,
        };
        return this._get(options);
    }

    async getLocation(locationId) {
        const options = {
            url: this.baseUrl + this.URLs.locationById(locationId),
        };
        return this._get(options);
    }

    async updateLocation(locationId, locationData) {
        const options = {
            url: this.baseUrl + this.URLs.locationById(locationId),
            body: locationData,
        };
        return this._put(options);
    }

    // **************************   Payments Methods   **********************************

    async listPayments(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.payments,
            query: params,
        };
        return this._get(options);
    }

    async createPayment(paymentData) {
        const options = {
            url: this.baseUrl + this.URLs.payments,
            body: paymentData,
        };
        return this._post(options);
    }

    async getPayment(paymentId) {
        const options = {
            url: this.baseUrl + this.URLs.paymentById(paymentId),
        };
        return this._get(options);
    }

    async cancelPayment(paymentId) {
        const options = {
            url: this.baseUrl + this.URLs.paymentById(paymentId) + '/cancel',
            body: {},
        };
        return this._post(options);
    }

    async completePayment(paymentId) {
        const options = {
            url: this.baseUrl + this.URLs.paymentById(paymentId) + '/complete',
            body: {},
        };
        return this._post(options);
    }

    // **************************   Orders Methods   **********************************

    async createOrder(orderData) {
        const options = {
            url: this.baseUrl + this.URLs.createOrder,
            body: orderData,
        };
        return this._post(options);
    }

    async searchOrders(searchQuery) {
        const options = {
            url: this.baseUrl + this.URLs.searchOrders,
            body: searchQuery,
        };
        return this._post(options);
    }

    async batchRetrieveOrders(orderIds, locationId) {
        const options = {
            url: this.baseUrl + this.URLs.batchRetrieveOrders,
            body: {
                order_ids: orderIds,
                location_id: locationId,
            },
        };
        return this._post(options);
    }

    async updateOrder(orderId, orderData) {
        const options = {
            url: this.baseUrl + this.URLs.updateOrder(orderId),
            body: orderData,
        };
        return this._put(options);
    }

    async payOrder(orderId, paymentData) {
        const options = {
            url: this.baseUrl + this.URLs.payOrder(orderId),
            body: paymentData,
        };
        return this._post(options);
    }

    // **************************   Catalog Methods   **********************************

    async listCatalog(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.catalogList,
            query: params,
        };
        return this._get(options);
    }

    async searchCatalogObjects(searchQuery) {
        const options = {
            url: this.baseUrl + this.URLs.catalogSearch,
            body: searchQuery,
        };
        return this._post(options);
    }

    async getCatalogObject(objectId, includeRelatedObjects = false) {
        const options = {
            url: this.baseUrl + this.URLs.catalogObject(objectId),
            query: {
                include_related_objects: includeRelatedObjects,
            },
        };
        return this._get(options);
    }

    async batchUpsertCatalogObjects(objects) {
        const options = {
            url: this.baseUrl + this.URLs.catalogBatchUpsert,
            body: {
                idempotency_key: this._generateIdempotencyKey(),
                batches: [
                    {
                        objects: objects,
                    },
                ],
            },
        };
        return this._post(options);
    }

    async batchDeleteCatalogObjects(objectIds) {
        const options = {
            url: this.baseUrl + this.URLs.catalogBatchDelete,
            body: {
                object_ids: objectIds,
            },
        };
        return this._post(options);
    }

    // **************************   Inventory Methods   **********************************

    async adjustInventory(adjustmentData) {
        const options = {
            url: this.baseUrl + this.URLs.inventoryAdjustment,
            body: adjustmentData,
        };
        return this._post(options);
    }

    async batchChangeInventory(changes) {
        const options = {
            url: this.baseUrl + this.URLs.inventoryBatchChange,
            body: {
                idempotency_key: this._generateIdempotencyKey(),
                changes: changes,
            },
        };
        return this._post(options);
    }

    async batchRetrieveInventoryCount(catalogObjectIds, locationIds) {
        const options = {
            url: this.baseUrl + this.URLs.inventoryBatchRetrieveCount,
            body: {
                catalog_object_ids: catalogObjectIds,
                location_ids: locationIds,
            },
        };
        return this._post(options);
    }

    // **************************   Customers Methods   **********************************

    async listCustomers(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.customers,
            query: params,
        };
        return this._get(options);
    }

    async createCustomer(customerData) {
        const options = {
            url: this.baseUrl + this.URLs.customers,
            body: customerData,
        };
        return this._post(options);
    }

    async getCustomer(customerId) {
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
        return this._put(options);
    }

    async deleteCustomer(customerId) {
        const options = {
            url: this.baseUrl + this.URLs.customerById(customerId),
        };
        return this._delete(options);
    }

    async searchCustomers(searchQuery) {
        const options = {
            url: this.baseUrl + this.URLs.customerSearch,
            body: searchQuery,
        };
        return this._post(options);
    }

    // **************************   Invoices Methods   **********************************

    async listInvoices(params = {}) {
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

    async deleteInvoice(invoiceId, version) {
        const options = {
            url: this.baseUrl + this.URLs.invoiceById(invoiceId),
            body: { version },
        };
        return this._delete(options);
    }

    async sendInvoice(invoiceId, requestData) {
        const options = {
            url: this.baseUrl + this.URLs.invoiceSend(invoiceId),
            body: requestData,
        };
        return this._post(options);
    }

    async cancelInvoice(invoiceId, version) {
        const options = {
            url: this.baseUrl + this.URLs.invoiceCancel(invoiceId),
            body: { version },
        };
        return this._post(options);
    }

    // **************************   Refunds Methods   **********************************

    async listRefunds(params = {}) {
        const options = {
            url: this.baseUrl + this.URLs.refunds,
            query: params,
        };
        return this._get(options);
    }

    async createRefund(refundData) {
        const options = {
            url: this.baseUrl + this.URLs.refunds,
            body: refundData,
        };
        return this._post(options);
    }

    async getRefund(refundId) {
        const options = {
            url: this.baseUrl + this.URLs.refundById(refundId),
        };
        return this._get(options);
    }

    // **************************   Webhooks Methods   **********************************

    async listWebhookSubscriptions() {
        const options = {
            url: this.baseUrl + this.URLs.webhookSubscriptions,
        };
        return this._get(options);
    }

    async createWebhookSubscription(subscriptionData) {
        const options = {
            url: this.baseUrl + this.URLs.webhookSubscriptions,
            body: subscriptionData,
        };
        return this._post(options);
    }

    async getWebhookSubscription(subscriptionId) {
        const options = {
            url: this.baseUrl + this.URLs.webhookSubscriptionById(subscriptionId),
        };
        return this._get(options);
    }

    async updateWebhookSubscription(subscriptionId, subscriptionData) {
        const options = {
            url: this.baseUrl + this.URLs.webhookSubscriptionById(subscriptionId),
            body: subscriptionData,
        };
        return this._put(options);
    }

    async deleteWebhookSubscription(subscriptionId) {
        const options = {
            url: this.baseUrl + this.URLs.webhookSubscriptionById(subscriptionId),
        };
        return this._delete(options);
    }

    // **************************   Helper Methods   **********************************

    _generateIdempotencyKey() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    async createSimplePayment(amount, currency, sourceId, locationId) {
        const paymentData = {
            idempotency_key: this._generateIdempotencyKey(),
            amount_money: {
                amount: amount,
                currency: currency,
            },
            source_id: sourceId,
            location_id: locationId,
        };

        return this.createPayment(paymentData);
    }
}

module.exports = { Api };