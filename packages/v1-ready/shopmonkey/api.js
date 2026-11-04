const { ApiKeyRequester, get } = require('@friggframework/core');

/**
 * Shopmonkey API v3 client.
 *
 * Auth: API key created in Settings → Integration → API Keys, sent as:
 *   Authorization: Bearer <key>
 *
 * Base URL: https://api.shopmonkey.cloud/v3
 *
 * Docs: https://shopmonkey.dev/overview
 *
 * The canonical machine-readable contract lives in ./shopmonkey.openapi.yaml —
 * this client mirrors it 1:1 (one method per operationId). Keep them in sync.
 *
 * Ported from Left Hook–owned Shopmonkey module code (generic Api surface only),
 * then re-verified against the official v3 resource docs. Client-specific paths
 * and coupling were stripped; endpoints that could not be confirmed on
 * shopmonkey.dev were omitted.
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        const raw =
            get(params, 'api_key', null) ||
            get(params, 'access_token', null) ||
            get(params, 'apiKey', null);
        // Persist the bare key in `api_key` (apiPropertiesToPersist); format
        // Bearer in addAuthHeaders so credentials never store a prefix.
        this.api_key = raw
            ? String(raw).replace(/^Bearer\s+/i, '').trim()
            : null;
        this.api_key_name = 'Authorization';

        this.baseUrl = 'https://api.shopmonkey.cloud/v3';

        this.URLs = {
            apiKeyStatus: '/auth/api_key/status',
            userMe: '/user/me',
            users: '/user',
            userById: (id) => `/user/${id}`,
            companyById: (id) => `/company/${id}`,
            customers: '/customer',
            customerSearch: '/customer/search',
            customerById: (id) => `/customer/${id}`,
            customerAction: (id, action) => `/customer/${id}/${action}`,
            customerOrders: (id) => `/customer/${id}/order`,
            customerVehicles: (id) => `/customer/${id}/vehicle`,
            vehicles: '/vehicle',
            vehicleById: (id) => `/vehicle/${id}`,
            vehicleAction: (id, action) => `/vehicle/${id}/${action}`,
            vehicleOrders: (id) => `/vehicle/${id}/order`,
            orders: '/order',
            orderById: (id) => `/order/${id}`,
            orderAction: (id, action) => `/order/${id}/${action}`,
            orderPdf: (id) => `/order/${id}/pdf`,
            paymentSearch: '/integration/payment/search',
            paymentManualCharge: '/integration/payment/manual/charge',
            paymentManualById: (id) => `/integration/payment/manual/${id}`,
            inventoryPartSearch: '/inventory_part/search',
            inventoryParts: '/inventory_part',
            inventoryPartById: (id) => `/inventory_part/${id}`,
            appointments: '/appointment',
            appointmentById: (id) => `/appointment/${id}`,
            webhooks: '/webhook',
            webhookById: (id) => `/webhook/${id}`,
        };
    }

    /**
     * Emit `Authorization: Bearer <key>`. The stored credential is the bare
     * API key; the Bearer wrapper is added here.
     */
    async addAuthHeaders(headers) {
        const h = headers || {};
        if (this.api_key) {
            h[this.api_key_name] = `Bearer ${this.api_key}`;
        }
        return h;
    }

    setApiKey(apiKey) {
        this.api_key = apiKey
            ? String(apiKey).replace(/^Bearer\s+/i, '').trim()
            : null;
    }

    // ---- Auth / identity ---------------------------------------------------

    /**
     * Check that the API key is valid and bearer auth is correct.
     * GET /auth/api_key/status
     * Docs: https://shopmonkey.dev/overview
     */
    async getApiKeyStatus() {
        return this._get({ url: this.baseUrl + this.URLs.apiKeyStatus });
    }

    /**
     * Logged-in user for the API key (identity).
     * GET /user/me
     */
    async getCurrentUser() {
        return this._get({ url: this.baseUrl + this.URLs.userMe });
    }

    /**
     * List users.
     * GET /user
     * Query: limit, skip, where, orderby, ids, collate, params
     */
    async listUsers(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.users,
            query,
        });
    }

    /**
     * Find one user by id.
     * GET /user/{id}
     */
    async getUser(userId) {
        return this._get({
            url: this.baseUrl + this.URLs.userById(userId),
        });
    }

    // ---- Company -----------------------------------------------------------

    /**
     * Find one company by id.
     * GET /company/{id}
     */
    async getCompany(companyId) {
        return this._get({
            url: this.baseUrl + this.URLs.companyById(companyId),
        });
    }

    /**
     * Update a company.
     * PUT /company/{id}
     */
    async updateCompany(companyId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.companyById(companyId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Customers ---------------------------------------------------------

    /**
     * Search customers.
     * POST /customer/search
     * Body: filter/pagination fields per docs (limit, skip, where, …).
     */
    async searchCustomers(data = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.customerSearch,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Find one customer by id.
     * GET /customer/{id}
     */
    async getCustomer(customerId) {
        return this._get({
            url: this.baseUrl + this.URLs.customerById(customerId),
        });
    }

    /**
     * Create a customer.
     * POST /customer
     */
    async createCustomer(data) {
        return this._post({
            url: this.baseUrl + this.URLs.customers,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a customer.
     * PUT /customer/{id}
     */
    async updateCustomer(customerId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.customerById(customerId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Soft-delete (or other action) a customer.
     * PATCH /customer/{id}/{action}
     */
    async softDeleteCustomer(customerId, action = 'delete', data = {}) {
        return this._patch({
            url: this.baseUrl + this.URLs.customerAction(customerId, action),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * List orders for a customer.
     * GET /customer/{id}/order
     */
    async listCustomerOrders(customerId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.customerOrders(customerId),
            query,
        });
    }

    /**
     * List vehicles for a customer.
     * GET /customer/{id}/vehicle
     */
    async listCustomerVehicles(customerId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.customerVehicles(customerId),
            query,
        });
    }

    // ---- Vehicles ----------------------------------------------------------

    /**
     * Find one vehicle by id.
     * GET /vehicle/{id}
     */
    async getVehicle(vehicleId) {
        return this._get({
            url: this.baseUrl + this.URLs.vehicleById(vehicleId),
        });
    }

    /**
     * Create a vehicle.
     * POST /vehicle
     */
    async createVehicle(data) {
        return this._post({
            url: this.baseUrl + this.URLs.vehicles,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a vehicle.
     * PUT /vehicle/{id}
     */
    async updateVehicle(vehicleId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.vehicleById(vehicleId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Soft-delete (or other action) a vehicle.
     * PATCH /vehicle/{id}/{action}
     */
    async softDeleteVehicle(vehicleId, action = 'delete', data = {}) {
        return this._patch({
            url: this.baseUrl + this.URLs.vehicleAction(vehicleId, action),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * List orders for a vehicle.
     * GET /vehicle/{id}/order
     */
    async listVehicleOrders(vehicleId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.vehicleOrders(vehicleId),
            query,
        });
    }

    // ---- Orders (work orders) ----------------------------------------------

    /**
     * List orders.
     * GET /order
     * Query: limit, skip, where, orderby, ids, collate, params
     */
    async listOrders(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.orders,
            query,
        });
    }

    /**
     * Find one order by id.
     * GET /order/{id}
     */
    async getOrder(orderId) {
        return this._get({
            url: this.baseUrl + this.URLs.orderById(orderId),
        });
    }

    /**
     * Create an order.
     * POST /order
     */
    async createOrder(data) {
        return this._post({
            url: this.baseUrl + this.URLs.orders,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update an order.
     * PUT /order/{id}
     */
    async updateOrder(orderId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.orderById(orderId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Soft-delete (or other action) an order.
     * PATCH /order/{id}/{action}
     */
    async softDeleteOrder(orderId, action = 'delete', data = {}) {
        return this._patch({
            url: this.baseUrl + this.URLs.orderAction(orderId, action),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Download an order PDF.
     * GET /order/{id}/pdf
     */
    async getOrderPdf(orderId, query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.orderPdf(orderId),
            query,
        });
    }

    // ---- Payments (integration paths) --------------------------------------

    /**
     * Search payments.
     * POST /integration/payment/search
     */
    async searchPayments(data = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.paymentSearch,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Record a manual payment charge.
     * POST /integration/payment/manual/charge
     */
    async recordManualPayment(data) {
        return this._post({
            url: this.baseUrl + this.URLs.paymentManualCharge,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Delete a manual payment.
     * DELETE /integration/payment/manual/{id}
     */
    async deleteManualPayment(paymentId) {
        return this._delete({
            url: this.baseUrl + this.URLs.paymentManualById(paymentId),
        });
    }

    // ---- Inventory parts ---------------------------------------------------

    /**
     * Search inventory parts.
     * POST /inventory_part/search
     */
    async searchInventoryParts(data = {}) {
        return this._post({
            url: this.baseUrl + this.URLs.inventoryPartSearch,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Find one inventory part by id.
     * GET /inventory_part/{id}
     */
    async getInventoryPart(partId) {
        return this._get({
            url: this.baseUrl + this.URLs.inventoryPartById(partId),
        });
    }

    /**
     * Create an inventory part.
     * POST /inventory_part
     */
    async createInventoryPart(data) {
        return this._post({
            url: this.baseUrl + this.URLs.inventoryParts,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update an inventory part.
     * PUT /inventory_part/{id}
     */
    async updateInventoryPart(partId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.inventoryPartById(partId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Appointments ------------------------------------------------------

    /**
     * List appointments.
     * GET /appointment
     */
    async listAppointments(query = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.appointments,
            query,
        });
    }

    /**
     * Find one appointment by id.
     * GET /appointment/{id}
     */
    async getAppointment(appointmentId) {
        return this._get({
            url: this.baseUrl + this.URLs.appointmentById(appointmentId),
        });
    }

    /**
     * Create an appointment.
     * POST /appointment
     */
    async createAppointment(data) {
        return this._post({
            url: this.baseUrl + this.URLs.appointments,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update an appointment.
     * PUT /appointment/{id}
     */
    async updateAppointment(appointmentId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.appointmentById(appointmentId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Delete an appointment.
     * DELETE /appointment/{id}
     */
    async deleteAppointment(appointmentId) {
        return this._delete({
            url: this.baseUrl + this.URLs.appointmentById(appointmentId),
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /**
     * Find one webhook by id.
     * GET /webhook/{id}
     * Note: no list-all webhook endpoint is documented on shopmonkey.dev.
     */
    async getWebhook(webhookId) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
        });
    }

    /**
     * Create a webhook.
     * POST /webhook
     * Body (required): name, url. Optional: triggers, enabled, secret, version.
     */
    async createWebhook(data) {
        return this._post({
            url: this.baseUrl + this.URLs.webhooks,
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a webhook.
     * PUT /webhook/{id}
     */
    async updateWebhook(webhookId, data) {
        return this._put({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Delete a webhook.
     * DELETE /webhook/{id}
     */
    async deleteWebhook(webhookId) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
        });
    }
}

module.exports = { Api };
