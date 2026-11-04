const { Api, DEFAULT_SITE } = require('../api');

function makeApi(params = { api_key: 'test-key', site: 'acme-test' }) {
    const api = new Api(params);
    api.sent = [];
    const record = (method) => async (options) => {
        api.sent.push({ method, ...options });
        return { list: [], next_offset: null };
    };
    api._get = record('GET');
    api._post = async (options, stringify) => {
        api.sent.push({ method: 'POST', stringify, ...options });
        return { customer: { id: 'cust_1' } };
    };
    return api;
}

describe('Chargebee Api', () => {
    describe('construction & auth', () => {
        it('defaults site to demo and builds the site-scoped base URL', () => {
            const api = new Api({ api_key: 'k' });
            expect(DEFAULT_SITE).toBe('demo');
            expect(api.site).toBe('demo');
            expect(api.baseUrl).toBe('https://demo.chargebee.com/api/v2');
        });

        it('accepts a site subdomain and normalizes full hosts', () => {
            const api = new Api({
                api_key: 'k',
                site: 'https://acme-test.chargebee.com',
            });
            expect(api.site).toBe('acme-test');
            expect(api.baseUrl).toBe(
                'https://acme-test.chargebee.com/api/v2'
            );
        });

        it('maps api_key onto Basic auth username with empty password', () => {
            const api = new Api({ api_key: 'cbkey', site: 'acme' });
            expect(api.username).toBe('cbkey');
            expect(api.password).toBe('');
        });

        it('emits Basic Authorization even with an empty password', async () => {
            const api = new Api({ api_key: 'cbkey', site: 'acme' });
            const headers = await api.addAuthHeaders({});
            const expected =
                'Basic ' + Buffer.from('cbkey:').toString('base64');
            expect(headers.Authorization).toBe(expected);
        });

        it('reports authenticated only with a non-empty key', () => {
            expect(new Api({ api_key: 'x' }).isAuthenticated()).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('customers', () => {
        it('listCustomers GETs /customers with query', async () => {
            const api = makeApi();
            await api.listCustomers({ limit: 10, offset: 'next' });
            expect(api.sent[0]).toMatchObject({
                method: 'GET',
                url: 'https://acme-test.chargebee.com/api/v2/customers',
                query: { limit: 10, offset: 'next' },
            });
        });

        it('getCustomer GETs /customers/{id}', async () => {
            const api = makeApi();
            await api.getCustomer('cust_1');
            expect(api.sent[0].url).toBe(
                'https://acme-test.chargebee.com/api/v2/customers/cust_1'
            );
        });

        it('createCustomer POSTs form-urlencoded body', async () => {
            const api = makeApi();
            await api.createCustomer({
                email: 'a@x.com',
                company: 'Acme',
            });
            const req = api.sent[0];
            expect(req.method).toBe('POST');
            expect(req.stringify).toBe(false);
            expect(req.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            expect(req.body).toContain('email=a%40x.com');
            expect(req.body).toContain('company=Acme');
        });

        it('updateCustomer POSTs to /customers/{id}', async () => {
            const api = makeApi();
            await api.updateCustomer('cust_1', { first_name: 'Ada' });
            expect(api.sent[0].url).toBe(
                'https://acme-test.chargebee.com/api/v2/customers/cust_1'
            );
            expect(api.sent[0].body).toContain('first_name=Ada');
        });
    });

    describe('read resources', () => {
        it.each([
            ['listSubscriptions', '/subscriptions'],
            ['listInvoices', '/invoices'],
            ['listTransactions', '/transactions'],
            ['listItems', '/items'],
            ['listItemPrices', '/item_prices'],
            ['listEvents', '/events'],
            ['listWebhookEndpoints', '/webhook_endpoints'],
        ])('%s hits GET %s', async (method, path) => {
            const api = makeApi();
            await api[method]({ limit: 1 });
            expect(api.sent[0].method).toBe('GET');
            expect(api.sent[0].url).toBe(
                `https://acme-test.chargebee.com/api/v2${path}`
            );
        });

        it.each([
            ['getSubscription', 'sub_1', '/subscriptions/sub_1'],
            ['getInvoice', 'inv_1', '/invoices/inv_1'],
            ['getTransaction', 'txn_1', '/transactions/txn_1'],
            ['getItem', 'item_1', '/items/item_1'],
            ['getItemPrice', 'price_1', '/item_prices/price_1'],
            ['getEvent', 'ev_1', '/events/ev_1'],
            [
                'getWebhookEndpoint',
                'wh_1',
                '/webhook_endpoints/wh_1',
            ],
        ])('%s hits GET %s', async (method, id, path) => {
            const api = makeApi();
            await api[method](id);
            expect(api.sent[0].url).toBe(
                `https://acme-test.chargebee.com/api/v2${path}`
            );
        });
    });

    describe('webhook endpoint mutations', () => {
        it('createWebhookEndpoint POSTs form fields', async () => {
            const api = makeApi();
            await api.createWebhookEndpoint({
                name: 'frigg',
                url: 'https://hook.example.com/cb?site=acme-test',
                'enabled_events[0]': 'subscription_created',
            });
            const req = api.sent[0];
            expect(req.url).toBe(
                'https://acme-test.chargebee.com/api/v2/webhook_endpoints'
            );
            expect(req.body).toContain('name=frigg');
            expect(req.body).toContain('enabled_events');
        });

        it('deleteWebhookEndpoint POSTs to .../delete', async () => {
            const api = makeApi();
            await api.deleteWebhookEndpoint('wh_1');
            expect(api.sent[0].url).toBe(
                'https://acme-test.chargebee.com/api/v2/webhook_endpoints/wh_1/delete'
            );
        });
    });

    describe('form flattening', () => {
        it('flattens nested objects to Chargebee bracket keys', () => {
            const api = new Api({ api_key: 'k', site: 'acme' });
            const flat = api._flattenForm({
                billing_address: { line1: '1 Main', city: 'SF' },
                enabled_events: ['subscription_created', 'invoice_generated'],
            });
            expect(flat['billing_address[line1]']).toBe('1 Main');
            expect(flat['billing_address[city]']).toBe('SF');
            expect(flat['enabled_events[0]']).toBe('subscription_created');
            expect(flat['enabled_events[1]']).toBe('invoice_generated');
        });
    });
});
