const { Api } = require('../api');
const {
    verifyProcurementExpressWebhook,
} = require('../extensions/webhooks/signature-verifier');

// Fully offline: stub _get/_post/_put and assert on constructed request options.
function makeApi(overrides = {}) {
    const api = new Api({
        authenticationToken: 'test-token',
        companyId: 42,
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { purchase_orders: [], invoices: [], suppliers: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 1 };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { id: 1 };
    };
    return api;
}

describe('ProcurementExpress Api', () => {
    describe('construction & auth', () => {
        it('sets the default v1 base URL', () => {
            const api = new Api({ authenticationToken: 't' });
            expect(api.baseUrl).toBe(
                'https://app.procurementexpress.com/api/v1'
            );
        });

        it('accepts authentication_token and companyId aliases', () => {
            const api = new Api({
                authentication_token: 'tok',
                employer_id: 9,
            });
            expect(api.authenticationToken).toBe('tok');
            expect(api.companyId).toBe(9);
        });

        it('adds authentication_token, app_company_id, and app_source headers', async () => {
            const api = new Api({
                authenticationToken: 'secret',
                companyId: 7,
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.authentication_token).toBe('secret');
            expect(headers.app_company_id).toBe('7');
            expect(headers.app_source).toBe('frigg');
            expect(headers['Content-Type']).toBe('application/json');
        });

        it('reports authenticated only with a non-empty token', () => {
            expect(
                new Api({ authenticationToken: 'x' }).isAuthenticated()
            ).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('identity', () => {
        it('getCurrentUser hits GET /currentuser', async () => {
            const api = makeApi();
            await api.getCurrentUser();
            expect(api._captured[0].url).toBe(
                'https://app.procurementexpress.com/api/v1/currentuser'
            );
        });

        it('updateCurrentUser hits PUT /currentuser', async () => {
            const api = makeApi();
            await api.updateCurrentUser({ name: 'Ada' });
            expect(api._captured[0]).toMatchObject({
                method: 'PUT',
                url: 'https://app.procurementexpress.com/api/v1/currentuser',
                body: { name: 'Ada' },
            });
        });
    });

    describe('purchase orders', () => {
        it('listPurchaseOrders forwards page/status query params', async () => {
            const api = makeApi();
            await api.listPurchaseOrders({ page: 2, status: 'pending' });
            expect(api._captured[0].url).toBe(
                'https://app.procurementexpress.com/api/v1/purchase_orders'
            );
            expect(api._captured[0].query).toEqual({
                page: 2,
                status: 'pending',
            });
        });

        it('getPurchaseOrder hits the detail path', async () => {
            const api = makeApi();
            await api.getPurchaseOrder(99);
            expect(api._captured[0].url).toBe(
                'https://app.procurementexpress.com/api/v1/purchase_orders/99'
            );
        });

        it('createPurchaseOrder wraps commit + purchase_order', async () => {
            const api = makeApi();
            await api.createPurchaseOrder({
                commit: 'Draft',
                supplier_name: 'Acme Supplies',
                status: 'draft',
            });
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body.commit).toBe('Draft');
            expect(api._captured[0].body.purchase_order.supplier_name).toBe(
                'Acme Supplies'
            );
            expect(api._captured[0].body.purchase_order.company_id).toBe(42);
        });

        it('approvePurchaseOrder uses GET with token query', async () => {
            const api = makeApi();
            await api.approvePurchaseOrder(5, { token: 'accept-1' });
            expect(api._captured[0]).toMatchObject({
                method: 'GET',
                url: 'https://app.procurementexpress.com/api/v1/purchase_orders/5/approve',
                query: { token: 'accept-1' },
            });
        });

        it('rejectPurchaseOrder uses GET with token query', async () => {
            const api = makeApi();
            await api.rejectPurchaseOrder(5, { token: 'reject-1' });
            expect(api._captured[0]).toMatchObject({
                method: 'GET',
                url: 'https://app.procurementexpress.com/api/v1/purchase_orders/5/reject',
                query: { token: 'reject-1' },
            });
        });

        it('cancel and archive use POST', async () => {
            const api = makeApi();
            await api.cancelPurchaseOrder(3);
            await api.archivePurchaseOrder(3);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toContain('/cancel');
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[1].url).toContain('/archive');
        });
    });

    describe('invoices & suppliers', () => {
        it('listInvoices / createInvoice / approveInvoice / rejectInvoice', async () => {
            const api = makeApi();
            await api.listInvoices({ page: 1 });
            await api.createInvoice({ invoice_number: 'INV-1' });
            await api.approveInvoice(8);
            await api.rejectInvoice(8, { reason: 'duplicate' });
            expect(api._captured[0].url).toContain('/invoices');
            expect(api._captured[1].body).toEqual({
                invoice: { invoice_number: 'INV-1' },
            });
            expect(api._captured[2].method).toBe('PUT');
            expect(api._captured[2].url).toContain('/approve');
            expect(api._captured[3].method).toBe('PUT');
            expect(api._captured[3].url).toContain('/reject');
        });

        it('supplier CRUD hits /suppliers', async () => {
            const api = makeApi();
            await api.listSuppliers({ search: 'acme' });
            await api.getSupplier(2);
            await api.createSupplier({ name: 'Acme Supplies' });
            await api.updateSupplier(2, { email: 'ap@example.com' });
            expect(api._captured[0].query).toEqual({ search: 'acme' });
            expect(api._captured[1].url).toContain('/suppliers/2');
            expect(api._captured[2].body).toEqual({
                supplier: { name: 'Acme Supplies' },
            });
            expect(api._captured[3].method).toBe('PUT');
        });
    });

    describe('reference data & webhooks', () => {
        it('departments, budgets, products, tax rates paths', async () => {
            const api = makeApi();
            await api.listDepartments();
            await api.getBudget(1);
            await api.createProduct({ name: 'Widget' });
            await api.listTaxRates();
            expect(api._captured[0].url).toContain('/departments');
            expect(api._captured[1].url).toContain('/budgets/1');
            expect(api._captured[2].body).toEqual({
                product: { name: 'Widget' },
            });
            expect(api._captured[3].url).toContain('/tax_rates');
        });

        it('webhook list/get/create/update', async () => {
            const api = makeApi();
            await api.listWebhooks();
            await api.getWebhook(1);
            await api.createWebhook({
                name: 'Hook',
                url: 'https://example.com/hook',
                event_type: ['new_po'],
            });
            await api.updateWebhook(1, { archived: true });
            expect(api._captured[0].url).toContain('/webhooks');
            expect(api._captured[2].body.webhook.name).toBe('Hook');
            expect(api._captured[3].method).toBe('PUT');
        });
    });

    describe('webhook basic-auth verifier', () => {
        it('allows when credentials are not configured', () => {
            const prevUser = process.env.PROCUREMENT_EXPRESS_WEBHOOK_BASIC_USER;
            const prevPass =
                process.env.PROCUREMENT_EXPRESS_WEBHOOK_BASIC_PASSWORD;
            delete process.env.PROCUREMENT_EXPRESS_WEBHOOK_BASIC_USER;
            delete process.env.PROCUREMENT_EXPRESS_WEBHOOK_BASIC_PASSWORD;
            const result = verifyProcurementExpressWebhook({
                req: { headers: {} },
            });
            expect(result.valid).toBe(true);
            if (prevUser !== undefined)
                process.env.PROCUREMENT_EXPRESS_WEBHOOK_BASIC_USER = prevUser;
            if (prevPass !== undefined)
                process.env.PROCUREMENT_EXPRESS_WEBHOOK_BASIC_PASSWORD =
                    prevPass;
        });

        it('accepts matching Basic credentials', () => {
            const auth = Buffer.from('hookuser:hookpass').toString('base64');
            const result = verifyProcurementExpressWebhook({
                req: { headers: { authorization: `Basic ${auth}` } },
                username: 'hookuser',
                password: 'hookpass',
            });
            expect(result.valid).toBe(true);
        });

        it('rejects mismatched Basic credentials', () => {
            const auth = Buffer.from('hookuser:wrong').toString('base64');
            const result = verifyProcurementExpressWebhook({
                req: { headers: { authorization: `Basic ${auth}` } },
                username: 'hookuser',
                password: 'hookpass',
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('basic_auth_mismatch');
        });
    });
});
