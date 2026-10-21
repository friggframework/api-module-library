const { Requester, get } = require('@friggframework/core');

/**
 * ProcurementExpress API client (documented as "V1 API").
 *
 * Auth: `authentication_token` header (+ optional `app_company_id`).
 * Base URL default: https://app.procurementexpress.com/api/v1
 *   Override with PROCUREMENT_EXPRESS_BASE_URL / params.baseUrl.
 *
 * Official docs: https://docs.procurementexpress.com/
 *
 * Note: many resource examples in the vendor docs are illustrated under
 * `/api/v3/...` while identity (`/currentuser`) and several approval-flow
 * paths are documented under `/api/v1/...`. This client uses the v1 base
 * from the module brief; hosts can point `baseUrl` at v3 if needed.
 *
 * The curated contract in ./procurement-express.openapi.yaml mirrors this
 * client 1:1 (one method per operationId). Keep them in sync.
 */
const DEFAULT_BASE_URL = 'https://app.procurementexpress.com/api/v1';

class Api extends Requester {
    constructor(params = {}) {
        super(params);

        this.baseUrl =
            get(params, 'baseUrl', null) ||
            get(params, 'base_url', null) ||
            process.env.PROCUREMENT_EXPRESS_BASE_URL ||
            DEFAULT_BASE_URL;

        this.authenticationToken =
            get(params, 'authenticationToken', null) ||
            get(params, 'authentication_token', null) ||
            get(params, 'access_token', null) ||
            null;

        this.companyId =
            get(params, 'companyId', null) ||
            get(params, 'company_id', null) ||
            get(params, 'employer_id', null) ||
            get(params, 'app_company_id', null) ||
            null;

        this.URLs = {
            currentUser: '/currentuser',
            companies: '/companies',
            companyById: (id) => `/companies/${id}`,
            purchaseOrders: '/purchase_orders',
            purchaseOrderById: (id) => `/purchase_orders/${id}`,
            purchaseOrderApprove: (id) => `/purchase_orders/${id}/approve`,
            purchaseOrderReject: (id) => `/purchase_orders/${id}/reject`,
            purchaseOrderCancel: (id) => `/purchase_orders/${id}/cancel`,
            purchaseOrderArchive: (id) => `/purchase_orders/${id}/archive`,
            invoices: '/invoices',
            invoiceById: (id) => `/invoices/${id}`,
            invoiceApprove: (id) => `/invoices/${id}/approve`,
            invoiceReject: (id) => `/invoices/${id}/reject`,
            suppliers: '/suppliers',
            supplierById: (id) => `/suppliers/${id}`,
            departments: '/departments',
            departmentById: (id) => `/departments/${id}`,
            budgets: '/budgets',
            budgetById: (id) => `/budgets/${id}`,
            products: '/products',
            productById: (id) => `/products/${id}`,
            taxRates: '/tax_rates',
            taxRateById: (id) => `/tax_rates/${id}`,
            webhooks: '/webhooks',
            webhookById: (id) => `/webhooks/${id}`,
        };
    }

    setAuth({ authenticationToken, companyId } = {}) {
        if (authenticationToken !== undefined) {
            this.authenticationToken = authenticationToken;
        }
        if (companyId !== undefined) {
            this.companyId = companyId;
        }
    }

    setCompany(companyId) {
        this.companyId = companyId;
    }

    async addAuthHeaders(headers = {}) {
        const next = { ...headers };
        if (this.authenticationToken) {
            next.authentication_token = this.authenticationToken;
        }
        if (this.companyId !== undefined && this.companyId !== null) {
            next.app_company_id = String(this.companyId);
        }
        // Identifies Frigg-originated traffic; present on the cleared port source.
        next.app_source = next.app_source || 'frigg';
        if (!next['Content-Type'] && !next['content-type']) {
            next['Content-Type'] = 'application/json';
        }
        return next;
    }

    isAuthenticated() {
        return Boolean(
            this.authenticationToken &&
                String(this.authenticationToken).length > 0
        );
    }

    _url(path) {
        return `${this.baseUrl}${path}`;
    }

    // ---- Identity ----------------------------------------------------------

    /** GET /currentuser */
    async getCurrentUser() {
        return this._get({ url: this._url(this.URLs.currentUser) });
    }

    /** PUT /currentuser */
    async updateCurrentUser(userData = {}) {
        return this._put({
            url: this._url(this.URLs.currentUser),
            body: userData,
        });
    }

    // ---- Companies ---------------------------------------------------------

    /** GET /companies */
    async listCompanies(params = {}) {
        return this._get({
            url: this._url(this.URLs.companies),
            query: params,
        });
    }

    /** GET /companies/:id */
    async getCompany(companyId) {
        return this._get({
            url: this._url(this.URLs.companyById(companyId)),
        });
    }

    /** POST /companies */
    async createCompany(companyData) {
        return this._post({
            url: this._url(this.URLs.companies),
            body: { company: companyData },
        });
    }

    // ---- Purchase orders ---------------------------------------------------

    /** GET /purchase_orders */
    async listPurchaseOrders(params = {}) {
        const query = {};
        if (params.page !== undefined) query.page = params.page;
        if (params.status !== undefined) query.status = params.status;
        if (params.per_page !== undefined) query.per_page = params.per_page;
        if (params.archived !== undefined) query.archived = params.archived;
        return this._get({
            url: this._url(this.URLs.purchaseOrders),
            query,
        });
    }

    /** GET /purchase_orders/:id */
    async getPurchaseOrder(purchaseOrderId) {
        return this._get({
            url: this._url(this.URLs.purchaseOrderById(purchaseOrderId)),
        });
    }

    /**
     * POST /purchase_orders
     * Body: { commit, purchase_order: { ... } } per vendor docs.
     */
    async createPurchaseOrder(purchaseOrderData = {}) {
        const commit = purchaseOrderData.commit || 'Send';
        const nested =
            purchaseOrderData.purchase_order ||
            (() => {
                const {
                    commit: _c,
                    line_items,
                    purchase_order_items_attributes,
                    ...rest
                } = purchaseOrderData;
                return {
                    ...rest,
                    purchase_order_items_attributes:
                        purchase_order_items_attributes || line_items,
                    company_id: rest.company_id || this.companyId,
                };
            })();

        return this._post({
            url: this._url(this.URLs.purchaseOrders),
            body: {
                commit,
                purchase_order: nested,
            },
        });
    }

    /**
     * GET /purchase_orders/:id/approve
     * Requires the approver's accept `token` (query) per vendor docs.
     */
    async approvePurchaseOrder(purchaseOrderId, params = {}) {
        const query = {};
        if (params.token !== undefined) query.token = params.token;
        return this._get({
            url: this._url(this.URLs.purchaseOrderApprove(purchaseOrderId)),
            query,
        });
    }

    /**
     * GET /purchase_orders/:id/reject
     * Requires the approver's reject `token` (query) per vendor docs.
     */
    async rejectPurchaseOrder(purchaseOrderId, params = {}) {
        const query = {};
        if (params.token !== undefined) query.token = params.token;
        return this._get({
            url: this._url(this.URLs.purchaseOrderReject(purchaseOrderId)),
            query,
        });
    }

    /** POST /purchase_orders/:id/cancel */
    async cancelPurchaseOrder(purchaseOrderId) {
        return this._post({
            url: this._url(this.URLs.purchaseOrderCancel(purchaseOrderId)),
            body: {},
        });
    }

    /** POST /purchase_orders/:id/archive */
    async archivePurchaseOrder(purchaseOrderId) {
        return this._post({
            url: this._url(this.URLs.purchaseOrderArchive(purchaseOrderId)),
            body: {},
        });
    }

    // ---- Invoices ----------------------------------------------------------

    /** GET /invoices */
    async listInvoices(params = {}) {
        const query = {};
        if (params.page !== undefined) query.page = params.page;
        if (params.status !== undefined) query.status = params.status;
        if (params.per_page !== undefined) query.per_page = params.per_page;
        if (params.archived !== undefined) query.archived = params.archived;
        if (params.supplier_id !== undefined)
            query.supplier_id = params.supplier_id;
        return this._get({
            url: this._url(this.URLs.invoices),
            query,
        });
    }

    /** GET /invoices/:id */
    async getInvoice(invoiceId) {
        return this._get({
            url: this._url(this.URLs.invoiceById(invoiceId)),
        });
    }

    /** POST /invoices */
    async createInvoice(invoiceData) {
        return this._post({
            url: this._url(this.URLs.invoices),
            body: { invoice: invoiceData },
        });
    }

    /** PUT /invoices/:id */
    async updateInvoice(invoiceId, invoiceData) {
        return this._put({
            url: this._url(this.URLs.invoiceById(invoiceId)),
            body: { invoice: invoiceData },
        });
    }

    /** PUT /invoices/:id/approve */
    async approveInvoice(invoiceId) {
        return this._put({
            url: this._url(this.URLs.invoiceApprove(invoiceId)),
            body: {},
        });
    }

    /** PUT /invoices/:id/reject */
    async rejectInvoice(invoiceId, body = {}) {
        return this._put({
            url: this._url(this.URLs.invoiceReject(invoiceId)),
            body,
        });
    }

    // ---- Suppliers ---------------------------------------------------------

    /** GET /suppliers */
    async listSuppliers(params = {}) {
        const query = {};
        if (params.page !== undefined) query.page = params.page;
        if (params.per_page !== undefined) query.per_page = params.per_page;
        if (params.search !== undefined) query.search = params.search;
        return this._get({
            url: this._url(this.URLs.suppliers),
            query,
        });
    }

    /** GET /suppliers/:id */
    async getSupplier(supplierId) {
        return this._get({
            url: this._url(this.URLs.supplierById(supplierId)),
        });
    }

    /** POST /suppliers */
    async createSupplier(supplierData) {
        return this._post({
            url: this._url(this.URLs.suppliers),
            body: { supplier: supplierData },
        });
    }

    /** PUT /suppliers/:id */
    async updateSupplier(supplierId, supplierData) {
        return this._put({
            url: this._url(this.URLs.supplierById(supplierId)),
            body: { supplier: supplierData },
        });
    }

    // ---- Departments -------------------------------------------------------

    /** GET /departments */
    async listDepartments(params = {}) {
        const query = {};
        if (params.page !== undefined) query.page = params.page;
        return this._get({
            url: this._url(this.URLs.departments),
            query,
        });
    }

    /** GET /departments/:id */
    async getDepartment(departmentId) {
        return this._get({
            url: this._url(this.URLs.departmentById(departmentId)),
        });
    }

    /** POST /departments */
    async createDepartment(departmentData) {
        return this._post({
            url: this._url(this.URLs.departments),
            body: { department: departmentData },
        });
    }

    /** PUT /departments/:id */
    async updateDepartment(departmentId, departmentData) {
        return this._put({
            url: this._url(this.URLs.departmentById(departmentId)),
            body: { department: departmentData },
        });
    }

    // ---- Budgets -----------------------------------------------------------

    /** GET /budgets */
    async listBudgets(params = {}) {
        const query = {};
        if (params.page !== undefined) query.page = params.page;
        return this._get({
            url: this._url(this.URLs.budgets),
            query,
        });
    }

    /** GET /budgets/:id */
    async getBudget(budgetId) {
        return this._get({
            url: this._url(this.URLs.budgetById(budgetId)),
        });
    }

    /** POST /budgets */
    async createBudget(budgetData) {
        return this._post({
            url: this._url(this.URLs.budgets),
            body: { budget: budgetData },
        });
    }

    /** PUT /budgets/:id */
    async updateBudget(budgetId, budgetData) {
        return this._put({
            url: this._url(this.URLs.budgetById(budgetId)),
            body: { budget: budgetData },
        });
    }

    // ---- Products ----------------------------------------------------------

    /** GET /products */
    async listProducts(params = {}) {
        const query = {};
        if (params.page !== undefined) query.page = params.page;
        if (params.search !== undefined) query.search = params.search;
        if (params.supplier_id !== undefined)
            query.supplier_id = params.supplier_id;
        return this._get({
            url: this._url(this.URLs.products),
            query,
        });
    }

    /** GET /products/:id */
    async getProduct(productId) {
        return this._get({
            url: this._url(this.URLs.productById(productId)),
        });
    }

    /** POST /products */
    async createProduct(productData) {
        return this._post({
            url: this._url(this.URLs.products),
            body: { product: productData },
        });
    }

    /** PUT /products/:id */
    async updateProduct(productId, productData) {
        return this._put({
            url: this._url(this.URLs.productById(productId)),
            body: { product: productData },
        });
    }

    // ---- Tax rates ---------------------------------------------------------

    /** GET /tax_rates */
    async listTaxRates(params = {}) {
        return this._get({
            url: this._url(this.URLs.taxRates),
            query: params,
        });
    }

    /** GET /tax_rates/:id */
    async getTaxRate(taxRateId) {
        return this._get({
            url: this._url(this.URLs.taxRateById(taxRateId)),
        });
    }

    /** POST /tax_rates */
    async createTaxRate(taxRateData) {
        return this._post({
            url: this._url(this.URLs.taxRates),
            body: { tax_rate: taxRateData },
        });
    }

    /** PUT /tax_rates/:id */
    async updateTaxRate(taxRateId, taxRateData) {
        return this._put({
            url: this._url(this.URLs.taxRateById(taxRateId)),
            body: { tax_rate: taxRateData },
        });
    }

    // ---- Webhooks ----------------------------------------------------------

    /** GET /webhooks */
    async listWebhooks() {
        return this._get({
            url: this._url(this.URLs.webhooks),
        });
    }

    /** GET /webhooks/:id */
    async getWebhook(webhookId) {
        return this._get({
            url: this._url(this.URLs.webhookById(webhookId)),
        });
    }

    /**
     * POST /webhooks
     * Body: { webhook: { name, url, event_type, ... } } per vendor docs.
     */
    async createWebhook(webhookData) {
        const body =
            webhookData && webhookData.webhook
                ? webhookData
                : { webhook: webhookData };
        return this._post({
            url: this._url(this.URLs.webhooks),
            body,
        });
    }

    /** PUT /webhooks/:id */
    async updateWebhook(webhookId, webhookData) {
        const body =
            webhookData && webhookData.webhook
                ? webhookData
                : { webhook: webhookData };
        return this._put({
            url: this._url(this.URLs.webhookById(webhookId)),
            body,
        });
    }
}

module.exports = { Api };
