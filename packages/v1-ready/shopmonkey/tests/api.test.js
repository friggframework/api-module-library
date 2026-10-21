const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({ api_key: 'test-key', ...overrides });
    api._captured = [];
    const record =
        (method) =>
        async (options) => {
            api._captured.push({ method, ...options });
            return { success: true, data: {} };
        };
    api._get = record('GET');
    api._post = record('POST');
    api._put = record('PUT');
    api._patch = record('PATCH');
    api._delete = record('DELETE');
    return api;
}

describe('Shopmonkey Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and stores the bare API key', () => {
            const api = new Api({ api_key: 'abc' });
            expect(api.baseUrl).toBe('https://api.shopmonkey.cloud/v3');
            expect(api.api_key_name).toBe('Authorization');
            expect(api.api_key).toBe('abc');
        });

        it('strips an existing Bearer prefix from the stored key', () => {
            const api = new Api({ api_key: 'Bearer already' });
            expect(api.api_key).toBe('already');
        });

        it('accepts access_token as an alias for api_key', () => {
            const api = new Api({ access_token: 'from-token' });
            expect(api.api_key).toBe('from-token');
        });

        it('adds the Authorization Bearer auth header', async () => {
            const api = new Api({ api_key: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
        });

        it('setApiKey updates the bare key', () => {
            const api = new Api({});
            api.setApiKey('new-key');
            expect(api.api_key).toBe('new-key');
        });
    });

    describe('auth & users', () => {
        it('getApiKeyStatus hits GET /auth/api_key/status', async () => {
            const api = makeApi();
            await api.getApiKeyStatus();
            expect(api._captured[0].url).toBe(
                'https://api.shopmonkey.cloud/v3/auth/api_key/status'
            );
        });

        it('getCurrentUser hits GET /user/me', async () => {
            const api = makeApi();
            await api.getCurrentUser();
            expect(api._captured[0].url).toBe(
                'https://api.shopmonkey.cloud/v3/user/me'
            );
        });

        it('listUsers forwards query params', async () => {
            const api = makeApi();
            await api.listUsers({ limit: 10, skip: 5 });
            expect(api._captured[0].url).toBe(
                'https://api.shopmonkey.cloud/v3/user'
            );
            expect(api._captured[0].query).toEqual({ limit: 10, skip: 5 });
        });
    });

    describe('customers', () => {
        it('searchCustomers POSTs to /customer/search', async () => {
            const api = makeApi();
            const body = { limit: 25 };
            await api.searchCustomers(body);
            expect(api._captured[0]).toMatchObject({
                method: 'POST',
                url: 'https://api.shopmonkey.cloud/v3/customer/search',
                body,
            });
        });

        it('createCustomer POSTs to /customer', async () => {
            const api = makeApi();
            await api.createCustomer({ firstName: 'Ada' });
            expect(api._captured[0].url).toBe(
                'https://api.shopmonkey.cloud/v3/customer'
            );
            expect(api._captured[0].body).toEqual({ firstName: 'Ada' });
        });

        it('softDeleteCustomer PATCHes /customer/:id/:action', async () => {
            const api = makeApi();
            await api.softDeleteCustomer('cust_1', 'delete');
            expect(api._captured[0]).toMatchObject({
                method: 'PATCH',
                url: 'https://api.shopmonkey.cloud/v3/customer/cust_1/delete',
            });
        });

        it('listCustomerOrders hits the nested path', async () => {
            const api = makeApi();
            await api.listCustomerOrders('cust_1', { limit: 5 });
            expect(api._captured[0].url).toBe(
                'https://api.shopmonkey.cloud/v3/customer/cust_1/order'
            );
        });
    });

    describe('orders', () => {
        it('listOrders hits GET /order', async () => {
            const api = makeApi();
            await api.listOrders({ limit: 50 });
            expect(api._captured[0].url).toBe(
                'https://api.shopmonkey.cloud/v3/order'
            );
        });

        it('getOrderPdf hits GET /order/:id/pdf', async () => {
            const api = makeApi();
            await api.getOrderPdf('ord_9', { download: true });
            expect(api._captured[0].url).toBe(
                'https://api.shopmonkey.cloud/v3/order/ord_9/pdf'
            );
            expect(api._captured[0].query).toEqual({ download: true });
        });
    });

    describe('payments', () => {
        it('uses the documented /integration/payment paths', async () => {
            const api = makeApi();
            await api.searchPayments({ limit: 10 });
            await api.recordManualPayment({ amountCents: 100 });
            await api.deleteManualPayment('pay_1');
            expect(api._captured[0].url).toBe(
                'https://api.shopmonkey.cloud/v3/integration/payment/search'
            );
            expect(api._captured[1].url).toBe(
                'https://api.shopmonkey.cloud/v3/integration/payment/manual/charge'
            );
            expect(api._captured[2]).toMatchObject({
                method: 'DELETE',
                url: 'https://api.shopmonkey.cloud/v3/integration/payment/manual/pay_1',
            });
        });
    });

    describe('webhooks', () => {
        it('createWebhook POSTs name and url', async () => {
            const api = makeApi();
            const body = {
                name: 'orders',
                url: 'https://example.com/hooks',
                triggers: ['Order'],
            };
            await api.createWebhook(body);
            expect(api._captured[0]).toMatchObject({
                method: 'POST',
                url: 'https://api.shopmonkey.cloud/v3/webhook',
                body,
            });
        });

        it('get/update/deleteWebhook hit /webhook/:id', async () => {
            const api = makeApi();
            await api.getWebhook('wh_1');
            await api.updateWebhook('wh_1', { enabled: false });
            await api.deleteWebhook('wh_1');
            expect(api._captured.map((c) => c.method)).toEqual([
                'GET',
                'PUT',
                'DELETE',
            ]);
            expect(api._captured.every((c) => c.url.endsWith('/webhook/wh_1')))
                .toBe(true);
        });
    });
});
