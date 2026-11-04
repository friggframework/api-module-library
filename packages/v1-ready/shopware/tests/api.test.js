const { Api } = require('../api');

// Fully offline: stub the low-level HTTP methods and assert on the request
// options the API methods construct. No network is touched.
function makeApi(overrides = {}) {
    const api = new Api({
        api_partner_id: 'partner-1',
        api_secret: 'secret-1',
        tenant_id: 69,
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { results: [], total_count: 0 };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 1 };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { id: 1 };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Shop-Ware Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and dual partner headers', async () => {
            const api = new Api({
                api_partner_id: 'pid',
                api_secret: 'sec',
            });
            expect(api.baseUrl).toBe('https://api.shop-ware.com/api/v1');
            const headers = await api.addAuthHeaders({});
            expect(headers['X-Api-Partner-Id']).toBe('pid');
            expect(headers['X-Api-Secret']).toBe('sec');
        });

        it('accepts apiKey as an alias for api_secret', () => {
            const api = new Api({
                api_partner_id: 'pid',
                apiKey: 'from-key',
            });
            expect(api.api_secret).toBe('from-key');
        });

        it('reports authenticated only with both partner id and secret', () => {
            expect(
                new Api({
                    api_partner_id: 'p',
                    api_secret: 's',
                }).isAuthenticated()
            ).toBe(true);
            expect(new Api({ api_partner_id: 'p' }).isAuthenticated()).toBe(
                false
            );
            expect(new Api({ api_secret: 's' }).isAuthenticated()).toBe(false);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('tenants', () => {
        it('listTenants hits GET /tenants', async () => {
            const api = makeApi();
            await api.listTenants({ page: 1 });
            expect(api._captured[0].url).toBe(
                'https://api.shop-ware.com/api/v1/tenants?page=1'
            );
        });

        it('getTenant hits GET /tenants/{id}', async () => {
            const api = makeApi();
            await api.getTenant(69);
            expect(api._captured[0].url).toBe(
                'https://api.shop-ware.com/api/v1/tenants/69'
            );
        });
    });

    describe('customers', () => {
        it('listCustomers uses the default tenant_id', async () => {
            const api = makeApi();
            await api.listCustomers({ email: 'a@b.com' });
            expect(api._captured[0].url).toBe(
                'https://api.shop-ware.com/api/v1/tenants/69/customers?email=a%40b.com'
            );
        });

        it('getCustomer hits the customer path', async () => {
            const api = makeApi();
            await api.getCustomer(10);
            expect(api._captured[0].url).toBe(
                'https://api.shop-ware.com/api/v1/tenants/69/customers/10'
            );
        });

        it('createCustomer POSTs the body', async () => {
            const api = makeApi();
            const body = { first_name: 'Ada', last_name: 'Lovelace' };
            await api.createCustomer(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://api.shop-ware.com/api/v1/tenants/69/customers'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('updateCustomer PUTs the body', async () => {
            const api = makeApi();
            await api.updateCustomer(10, { email: 'x@y.com' });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toBe(
                'https://api.shop-ware.com/api/v1/tenants/69/customers/10'
            );
        });

        it('throws when no tenant_id is available', async () => {
            const api = makeApi({ tenant_id: null });
            await expect(api.listCustomers()).rejects.toThrow(/tenant_id/i);
        });
    });

    describe('vehicles / repair orders / shops / staff / payments / inventory', () => {
        it('listVehicles hits the vehicles collection', async () => {
            const api = makeApi();
            await api.listVehicles({ vin: '1HGCM' });
            expect(api._captured[0].url).toContain(
                '/tenants/69/vehicles?vin=1HGCM'
            );
        });

        it('createVehicle POSTs', async () => {
            const api = makeApi();
            await api.createVehicle({ vin: 'ABC', customer_id: 1 });
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toContain('/tenants/69/vehicles');
        });

        it('listRepairOrders forwards filters', async () => {
            const api = makeApi();
            await api.listRepairOrders({
                customer_id: 3,
                status: 'in_progress',
            });
            const { url } = api._captured[0];
            expect(url).toContain('/tenants/69/repair_orders?');
            expect(url).toContain('customer_id=3');
            expect(url).toContain('status=in_progress');
        });

        it('getRepairOrder hits the detail path', async () => {
            const api = makeApi();
            await api.getRepairOrder(123);
            expect(api._captured[0].url).toBe(
                'https://api.shop-ware.com/api/v1/tenants/69/repair_orders/123'
            );
        });

        it('listShops / getShop', async () => {
            const api = makeApi();
            await api.listShops();
            await api.getShop(2);
            expect(api._captured[0].url).toContain('/tenants/69/shops');
            expect(api._captured[1].url).toContain('/tenants/69/shops/2');
        });

        it('listStaffs / getStaff', async () => {
            const api = makeApi();
            await api.listStaffs({ is_active: true });
            await api.getStaff(5);
            expect(api._captured[0].url).toContain('is_active=true');
            expect(api._captured[1].url).toContain('/staffs/5');
        });

        it('listPayments / getPayment', async () => {
            const api = makeApi();
            await api.listPayments({ page: 2 });
            await api.getPayment(9);
            expect(api._captured[0].url).toContain('/payments?page=2');
            expect(api._captured[1].url).toContain('/payments/9');
        });

        it('listInventories / getInventory', async () => {
            const api = makeApi();
            await api.listInventories({ in_stock: true });
            await api.getInventory(4);
            expect(api._captured[0].url).toContain('/inventories?in_stock=true');
            expect(api._captured[1].url).toContain('/inventories/4');
        });
    });

    describe('webhooks', () => {
        it('listWebhooks hits GET /webhooks (partner-scoped)', async () => {
            const api = makeApi();
            await api.listWebhooks();
            expect(api._captured[0].url).toBe(
                'https://api.shop-ware.com/api/v1/webhooks'
            );
        });

        it('createWebhook POSTs url + events', async () => {
            const api = makeApi();
            const body = {
                url: 'https://hook.example.com',
                events: ['customer.created'],
            };
            await api.createWebhook(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual(body);
        });

        it('updateWebhook / deleteWebhook / getWebhook', async () => {
            const api = makeApi();
            await api.getWebhook(2);
            await api.updateWebhook(2, { events: ['customer.updated'] });
            await api.deleteWebhook(2);
            expect(api._captured[0].url).toContain('/webhooks/2');
            expect(api._captured[1].method).toBe('PUT');
            expect(api._captured[2].method).toBe('DELETE');
        });

        it('verifyWebhookSecret accepts a matching X-Api-Secret header', () => {
            const api = new Api({ api_secret: 'sec' });
            expect(
                api.verifyWebhookSecret({
                    headers: { 'x-api-secret': 'sec' },
                }).valid
            ).toBe(true);
            expect(
                api.verifyWebhookSecret({
                    headers: { 'x-api-secret': 'nope' },
                }).valid
            ).toBe(false);
        });
    });
});
