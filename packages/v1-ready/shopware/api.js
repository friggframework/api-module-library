const { ApiKeyRequester, get } = require('@friggframework/core');

/**
 * Shop-Ware (shop-ware.com) Partner API client.
 *
 * Auth (official): every request must include both partner headers:
 *   X-Api-Partner-Id: <partner id>
 *   X-Api-Secret: <api secret>
 * Credentials are issued by Shop-Ware support. Access is granted per tenant.
 *
 * Base URL: https://api.shop-ware.com/api/v1
 * Docs: https://shop-ware.stoplight.io/docs/public-api
 * OpenAPI source: https://api.shop-ware.com/api-docs/public/v1/swagger.yaml
 *
 * Most resources are tenant-scoped under /tenants/{tenant_id}/...
 * Webhooks are partner-scoped under /webhooks.
 *
 * The curated OpenAPI subset lives in ./shopware.openapi.yaml — this client
 * mirrors it 1:1 (one method per operationId). Keep them in sync.
 *
 * Note: an earlier Left Hook-owned port used `Authorization: Bearer <key>`.
 * That does not match the current official Partner API contract; this module
 * follows the published Stoplight / swagger.yaml auth scheme.
 */
class Api extends ApiKeyRequester {
    constructor(params = {}) {
        super(params);

        this.api_partner_id =
            get(params, 'api_partner_id', null) ||
            get(params, 'apiPartnerId', null);
        this.api_secret =
            get(params, 'api_secret', null) ||
            get(params, 'apiSecret', null) ||
            get(params, 'api_key', null) ||
            get(params, 'apiKey', null);

        // ApiKeyRequester persists api_key; keep it aligned with the secret
        // so isAuthenticated() / setApiKey() still behave.
        this.api_key = this.api_secret;
        this.api_key_name = 'X-Api-Secret';

        this.tenant_id =
            get(params, 'tenant_id', null) ||
            get(params, 'tenantId', null);

        this.baseUrl = 'https://api.shop-ware.com/api/v1';

        this.URLs = {
            tenants: '/tenants',
            tenantById: (id) => `/tenants/${id}`,
            customers: (tenantId) => `/tenants/${tenantId}/customers`,
            customerById: (tenantId, id) =>
                `/tenants/${tenantId}/customers/${id}`,
            vehicles: (tenantId) => `/tenants/${tenantId}/vehicles`,
            vehicleById: (tenantId, id) =>
                `/tenants/${tenantId}/vehicles/${id}`,
            repairOrders: (tenantId) => `/tenants/${tenantId}/repair_orders`,
            repairOrderById: (tenantId, id) =>
                `/tenants/${tenantId}/repair_orders/${id}`,
            shops: (tenantId) => `/tenants/${tenantId}/shops`,
            shopById: (tenantId, id) => `/tenants/${tenantId}/shops/${id}`,
            staffs: (tenantId) => `/tenants/${tenantId}/staffs`,
            staffById: (tenantId, id) => `/tenants/${tenantId}/staffs/${id}`,
            payments: (tenantId) => `/tenants/${tenantId}/payments`,
            paymentById: (tenantId, id) =>
                `/tenants/${tenantId}/payments/${id}`,
            inventories: (tenantId) => `/tenants/${tenantId}/inventories`,
            inventoryById: (tenantId, id) =>
                `/tenants/${tenantId}/inventories/${id}`,
            webhooks: '/webhooks',
            webhookById: (id) => `/webhooks/${id}`,
        };
    }

    async addAuthHeaders(headers = {}) {
        if (this.api_partner_id) {
            headers['X-Api-Partner-Id'] = this.api_partner_id;
        }
        if (this.api_secret) {
            headers['X-Api-Secret'] = this.api_secret;
        }
        return headers;
    }

    isAuthenticated() {
        return Boolean(
            this.api_partner_id &&
                String(this.api_partner_id).trim() &&
                this.api_secret &&
                String(this.api_secret).trim()
        );
    }

    setApiPartnerId(apiPartnerId) {
        this.api_partner_id = apiPartnerId;
    }

    setApiSecret(apiSecret) {
        this.api_secret = apiSecret;
        this.api_key = apiSecret;
    }

    setApiKey(apiKey) {
        // Alias for setApiSecret — ApiKeyRequester / auth forms call this.
        this.setApiSecret(apiKey);
    }

    setTenantId(tenantId) {
        this.tenant_id = tenantId;
    }

    _resolveTenantId(tenantId) {
        const id = tenantId ?? this.tenant_id;
        if (id === undefined || id === null || id === '') {
            throw new Error(
                'Shop-Ware: tenant_id is required (pass it to the method or set api.tenant_id / SHOPWARE_TENANT_ID).'
            );
        }
        return id;
    }

    _buildQuery(params = {}) {
        const usp = new URLSearchParams();
        for (const [key, value] of Object.entries(params || {})) {
            if (value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                for (const v of value) {
                    if (v === undefined || v === null) continue;
                    usp.append(key, String(v));
                }
            } else {
                usp.append(key, String(value));
            }
        }
        const qs = usp.toString();
        return qs ? `?${qs}` : '';
    }

    // ---- Tenants (identity) ------------------------------------------------

    /**
     * List tenants this partner is authorized to access.
     * GET /tenants
     * Query: page, per_page, updated_after
     */
    async listTenants(params = {}) {
        return this._get({
            url: this.baseUrl + this.URLs.tenants + this._buildQuery(params),
        });
    }

    /**
     * Get a tenant by id.
     * GET /tenants/{id}
     */
    async getTenant(tenantId) {
        const id = this._resolveTenantId(tenantId);
        return this._get({
            url: this.baseUrl + this.URLs.tenantById(id),
        });
    }

    // ---- Customers ---------------------------------------------------------

    /**
     * List customers for a tenant.
     * GET /tenants/{tenant_id}/customers
     * Query: last_name, email, phone_number, phone_number_preferred_only,
     *        type, page, per_page, updated_after
     */
    async listCustomers(params = {}) {
        const { tenant_id, tenantId, ...query } = params;
        const tid = this._resolveTenantId(tenant_id ?? tenantId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.customers(tid) +
                this._buildQuery(query),
        });
    }

    /**
     * Get a customer by id.
     * GET /tenants/{tenant_id}/customers/{id}
     */
    async getCustomer(customerId, params = {}) {
        const tid = this._resolveTenantId(
            params.tenant_id ?? params.tenantId
        );
        return this._get({
            url: this.baseUrl + this.URLs.customerById(tid, customerId),
        });
    }

    /**
     * Create a customer.
     * POST /tenants/{tenant_id}/customers
     */
    async createCustomer(data, params = {}) {
        const tid = this._resolveTenantId(
            params.tenant_id ?? params.tenantId ?? data?.tenant_id
        );
        return this._post({
            url: this.baseUrl + this.URLs.customers(tid),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a customer.
     * PUT /tenants/{tenant_id}/customers/{id}
     */
    async updateCustomer(customerId, data, params = {}) {
        const tid = this._resolveTenantId(
            params.tenant_id ?? params.tenantId
        );
        return this._put({
            url: this.baseUrl + this.URLs.customerById(tid, customerId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Vehicles ----------------------------------------------------------

    /**
     * List vehicles for a tenant.
     * GET /tenants/{tenant_id}/vehicles
     * Query: vin, customer_id, page, per_page, updated_after
     */
    async listVehicles(params = {}) {
        const { tenant_id, tenantId, ...query } = params;
        const tid = this._resolveTenantId(tenant_id ?? tenantId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.vehicles(tid) +
                this._buildQuery(query),
        });
    }

    /**
     * Get a vehicle by id.
     * GET /tenants/{tenant_id}/vehicles/{id}
     */
    async getVehicle(vehicleId, params = {}) {
        const tid = this._resolveTenantId(
            params.tenant_id ?? params.tenantId
        );
        return this._get({
            url: this.baseUrl + this.URLs.vehicleById(tid, vehicleId),
        });
    }

    /**
     * Create a vehicle.
     * POST /tenants/{tenant_id}/vehicles
     */
    async createVehicle(data, params = {}) {
        const tid = this._resolveTenantId(
            params.tenant_id ?? params.tenantId ?? data?.tenant_id
        );
        return this._post({
            url: this.baseUrl + this.URLs.vehicles(tid),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a vehicle.
     * PUT /tenants/{tenant_id}/vehicles/{id}
     */
    async updateVehicle(vehicleId, data, params = {}) {
        const tid = this._resolveTenantId(
            params.tenant_id ?? params.tenantId
        );
        return this._put({
            url: this.baseUrl + this.URLs.vehicleById(tid, vehicleId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Repair orders -----------------------------------------------------

    /**
     * List repair orders for a tenant.
     * GET /tenants/{tenant_id}/repair_orders
     * Query: page, per_page, shop_id, customer_id, vehicle_id, status, number,
     *        closed_after, technician_id, associations[], updated_after
     */
    async listRepairOrders(params = {}) {
        const { tenant_id, tenantId, ...query } = params;
        const tid = this._resolveTenantId(tenant_id ?? tenantId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.repairOrders(tid) +
                this._buildQuery(query),
        });
    }

    /**
     * Get a repair order by id.
     * GET /tenants/{tenant_id}/repair_orders/{id}
     * Query: associations[]
     */
    async getRepairOrder(repairOrderId, params = {}) {
        const { tenant_id, tenantId, ...query } = params;
        const tid = this._resolveTenantId(tenant_id ?? tenantId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.repairOrderById(tid, repairOrderId) +
                this._buildQuery(query),
        });
    }

    /**
     * Create a repair order.
     * POST /tenants/{tenant_id}/repair_orders
     */
    async createRepairOrder(data, params = {}) {
        const tid = this._resolveTenantId(
            params.tenant_id ?? params.tenantId ?? data?.tenant_id
        );
        return this._post({
            url: this.baseUrl + this.URLs.repairOrders(tid),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    /**
     * Update a repair order.
     * PUT /tenants/{tenant_id}/repair_orders/{id}
     */
    async updateRepairOrder(repairOrderId, data, params = {}) {
        const tid = this._resolveTenantId(
            params.tenant_id ?? params.tenantId
        );
        return this._put({
            url: this.baseUrl + this.URLs.repairOrderById(tid, repairOrderId),
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
    }

    // ---- Shops / locations -------------------------------------------------

    /**
     * List shops (locations) for a tenant.
     * GET /tenants/{tenant_id}/shops
     */
    async listShops(params = {}) {
        const { tenant_id, tenantId, ...query } = params;
        const tid = this._resolveTenantId(tenant_id ?? tenantId);
        return this._get({
            url: this.baseUrl + this.URLs.shops(tid) + this._buildQuery(query),
        });
    }

    /**
     * Get a shop by id.
     * GET /tenants/{tenant_id}/shops/{id}
     */
    async getShop(shopId, params = {}) {
        const tid = this._resolveTenantId(
            params.tenant_id ?? params.tenantId
        );
        return this._get({
            url: this.baseUrl + this.URLs.shopById(tid, shopId),
        });
    }

    // ---- Staff -------------------------------------------------------------

    /**
     * List staff members for a tenant.
     * GET /tenants/{tenant_id}/staffs
     * Query: page, per_page, is_active, assigned_shop_id, updated_after
     */
    async listStaffs(params = {}) {
        const { tenant_id, tenantId, ...query } = params;
        const tid = this._resolveTenantId(tenant_id ?? tenantId);
        return this._get({
            url:
                this.baseUrl + this.URLs.staffs(tid) + this._buildQuery(query),
        });
    }

    /**
     * Get a staff member by id.
     * GET /tenants/{tenant_id}/staffs/{id}
     */
    async getStaff(staffId, params = {}) {
        const tid = this._resolveTenantId(
            params.tenant_id ?? params.tenantId
        );
        return this._get({
            url: this.baseUrl + this.URLs.staffById(tid, staffId),
        });
    }

    // ---- Payments ----------------------------------------------------------

    /**
     * List payments for a tenant.
     * GET /tenants/{tenant_id}/payments
     * Query: page, per_page, updated_after
     */
    async listPayments(params = {}) {
        const { tenant_id, tenantId, ...query } = params;
        const tid = this._resolveTenantId(tenant_id ?? tenantId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.payments(tid) +
                this._buildQuery(query),
        });
    }

    /**
     * Get a payment by id.
     * GET /tenants/{tenant_id}/payments/{id}
     */
    async getPayment(paymentId, params = {}) {
        const tid = this._resolveTenantId(
            params.tenant_id ?? params.tenantId
        );
        return this._get({
            url: this.baseUrl + this.URLs.paymentById(tid, paymentId),
        });
    }

    // ---- Inventory (parts) -------------------------------------------------

    /**
     * List inventory (parts) records for a tenant.
     * GET /tenants/{tenant_id}/inventories
     * Query: on_hand, in_stock, page, per_page, updated_after
     */
    async listInventories(params = {}) {
        const { tenant_id, tenantId, ...query } = params;
        const tid = this._resolveTenantId(tenant_id ?? tenantId);
        return this._get({
            url:
                this.baseUrl +
                this.URLs.inventories(tid) +
                this._buildQuery(query),
        });
    }

    /**
     * Get an inventory record by id.
     * GET /tenants/{tenant_id}/inventories/{id}
     */
    async getInventory(inventoryId, params = {}) {
        const tid = this._resolveTenantId(
            params.tenant_id ?? params.tenantId
        );
        return this._get({
            url: this.baseUrl + this.URLs.inventoryById(tid, inventoryId),
        });
    }

    // ---- Webhooks (partner-scoped) -----------------------------------------

    /**
     * List registered webhooks for this partner.
     * GET /webhooks
     */
    async listWebhooks() {
        return this._get({
            url: this.baseUrl + this.URLs.webhooks,
        });
    }

    /**
     * Get a webhook by id.
     * GET /webhooks/{id}
     */
    async getWebhook(webhookId) {
        return this._get({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
        });
    }

    /**
     * Create a webhook.
     * POST /webhooks
     * body: { url (https), events: ['customer.created', ...], format? }
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
     * PUT /webhooks/{id}
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
     * DELETE /webhooks/{id}
     */
    async deleteWebhook(webhookId) {
        return this._delete({
            url: this.baseUrl + this.URLs.webhookById(webhookId),
        });
    }

    /**
     * Verify an inbound Shop-Ware webhook by comparing the X-Api-Secret
     * request header to the partner API secret.
     * Docs: https://shop-ware.stoplight.io/docs/public-api/dgrb4a8slxf6k-webhooks
     *
     * Local helper — not an OpenAPI operation.
     */
    verifyWebhookSecret({ headers = {}, secret } = {}) {
        const expected = secret || this.api_secret;
        if (!expected) {
            return { valid: false, reason: 'missing api secret' };
        }
        const incoming =
            headers['x-api-secret'] ||
            headers['X-Api-Secret'] ||
            headers['X-API-SECRET'];
        if (!incoming) {
            return { valid: false, reason: 'missing X-Api-Secret header' };
        }
        if (String(incoming) !== String(expected)) {
            return { valid: false, reason: 'X-Api-Secret mismatch' };
        }
        return { valid: true };
    }
}

module.exports = { Api };
