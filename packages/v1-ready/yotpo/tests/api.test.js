const { Api } = require('../api');

// Fully offline: stub low-level HTTP methods and assert on request options.
function makeApi(overrides = {}) {
    const api = new Api({
        store_id: 'store_abc',
        secret: 'secret_xyz',
        access_token: 'tok_123',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { products: [], orders: [], customers: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { access_token: 'new_tok', product: { yotpo_id: 1 } };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return {};
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Yotpo Api', () => {
    describe('construction & auth', () => {
        it('sets base URL and X-Yotpo-Token header name', () => {
            const api = new Api({
                store_id: 's1',
                access_token: 'tok',
            });
            expect(api.baseUrl).toBe('https://api.yotpo.com');
            expect(api.api_key_name).toBe('X-Yotpo-Token');
            expect(api.api_key).toBe('tok');
            expect(api.access_token).toBe('tok');
            expect(api.store_id).toBe('s1');
        });

        it('accepts app_key as an alias for store_id', () => {
            const api = new Api({ app_key: 'from-app-key' });
            expect(api.store_id).toBe('from-app-key');
        });

        it('adds the X-Yotpo-Token auth header', async () => {
            const api = new Api({ access_token: 'secret-tok' });
            const headers = await api.addAuthHeaders({});
            expect(headers['X-Yotpo-Token']).toBe('secret-tok');
        });

        it('exposes an apiKey authorization form for store_id + secret', () => {
            const api = new Api({});
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('apiKey');
            expect(reqs.data.jsonSchema.required).toEqual(
                expect.arrayContaining(['store_id', 'secret'])
            );
        });
    });

    describe('generateAccessToken', () => {
        it('POSTs secret to /access_tokens and stores the token', async () => {
            const api = makeApi({ access_token: null });
            api._post = async (options) => {
                api._captured.push({ method: 'POST', ...options });
                return { access_token: 'minted' };
            };
            const res = await api.generateAccessToken();
            expect(api._captured[0].url).toBe(
                'https://api.yotpo.com/core/v3/stores/store_abc/access_tokens'
            );
            expect(api._captured[0].body).toEqual({ secret: 'secret_xyz' });
            expect(res.access_token).toBe('minted');
            expect(api.api_key).toBe('minted');
            expect(api.access_token).toBe('minted');
        });

        it('requires store_id and secret', async () => {
            await expect(
                new Api({ secret: 's' }).generateAccessToken()
            ).rejects.toThrow(/store_id/);
            await expect(
                new Api({ store_id: 's' }).generateAccessToken()
            ).rejects.toThrow(/secret/);
        });
    });

    describe('products', () => {
        it('listProducts hits GET /products with query', async () => {
            const api = makeApi();
            await api.listProducts({ limit: 10, page_info: 'p1' });
            const { url, query } = api._captured[0];
            expect(url).toBe(
                'https://api.yotpo.com/core/v3/stores/store_abc/products'
            );
            expect(query).toEqual({ limit: 10, page_info: 'p1' });
        });

        it('getProduct hits the product path', async () => {
            const api = makeApi();
            await api.getProduct(99);
            expect(api._captured[0].url).toBe(
                'https://api.yotpo.com/core/v3/stores/store_abc/products/99'
            );
        });

        it('createProduct POSTs the body', async () => {
            const api = makeApi();
            const body = { product: { external_id: 'e1', name: 'Board' } };
            await api.createProduct(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual(body);
        });

        it('updateProduct PATCHes the product path', async () => {
            const api = makeApi();
            const body = { product: { price: 10 } };
            await api.updateProduct(5, body);
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toContain('/products/5');
            expect(api._captured[0].body).toEqual(body);
        });
    });

    describe('orders', () => {
        it('listOrders hits GET /orders', async () => {
            const api = makeApi();
            await api.listOrders({
                order_date_min: '2020-01-01T00:00:00Z',
            });
            expect(api._captured[0].url).toContain('/orders');
            expect(api._captured[0].query.order_date_min).toBe(
                '2020-01-01T00:00:00Z'
            );
        });

        it('getOrder / createOrder / updateOrder hit the right paths', async () => {
            const api = makeApi();
            await api.getOrder('ord_1');
            await api.createOrder({ order: { external_id: 'x' } });
            await api.updateOrder('ord_1', { order: { payment_status: 'paid' } });
            expect(api._captured[0].url).toContain('/orders/ord_1');
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[2].method).toBe('PATCH');
        });
    });

    describe('fulfillments', () => {
        it('createOrderFulfillment POSTs under the order', async () => {
            const api = makeApi();
            const body = {
                fulfillment: {
                    external_id: 'f1',
                    fulfillment_date: '2021-03-31T11:58:51Z',
                    status: 'success',
                    fulfilled_items: [
                        { external_product_id: 'p1', quantity: 1 },
                    ],
                },
            };
            await api.createOrderFulfillment('ord_9', body);
            expect(api._captured[0].url).toBe(
                'https://api.yotpo.com/core/v3/stores/store_abc/orders/ord_9/fulfillments'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('listOrderFulfillments GETs under the order', async () => {
            const api = makeApi();
            await api.listOrderFulfillments('ord_9');
            expect(api._captured[0].method).toBe('GET');
            expect(api._captured[0].url).toContain(
                '/orders/ord_9/fulfillments'
            );
        });
    });

    describe('customers', () => {
        it('createCustomer PATCHes /customers (upsert)', async () => {
            const api = makeApi();
            const body = {
                customer: { external_id: 'c1', email: 'a@b.com' },
            };
            await api.createCustomer(body);
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toContain('/customers');
            expect(api._captured[0].body).toEqual(body);
        });

        it('listCustomers forwards email filter', async () => {
            const api = makeApi();
            await api.listCustomers({ email: 'a@b.com' });
            expect(api._captured[0].query.email).toBe('a@b.com');
        });
    });

    describe('webhooks', () => {
        it('createWebhookTarget / createWebhookFilter / createWebhookSubscription', async () => {
            const api = makeApi();
            await api.createWebhookTarget({
                webhook_target: { url: 'https://hook.example.com' },
            });
            await api.createWebhookFilter({
                webhook_filter: { events: ['review_create'] },
            });
            await api.createWebhookSubscription({
                webhook_subscription: {
                    target_id: '1',
                    filter_id: '2',
                    active: true,
                },
            });
            expect(api._captured[0].url).toContain('/webhooks/targets');
            expect(api._captured[1].url).toContain('/webhooks/filters');
            expect(api._captured[2].url).toContain('/webhooks/subscriptions');
        });

        it('list and delete webhook subscriptions', async () => {
            const api = makeApi();
            await api.listWebhookSubscriptions();
            await api.deleteWebhookSubscription('sub_1');
            expect(api._captured[0].method).toBe('GET');
            expect(api._captured[1].method).toBe('DELETE');
            expect(api._captured[1].url).toContain(
                '/webhooks/subscriptions/sub_1'
            );
        });
    });
});
