const crypto = require('crypto');
const { Api, API_VERSION, toGraphqlTopic } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://app.example.com/redirect/shopify',
        scope: 'read_customers,write_orders',
        access_token: 'shpat_test',
        shop: 'acme.myshopify.com',
        ...overrides,
    });
    api._captured = [];
    api._post = async (options, stringify = true) => {
        api._captured.push({ method: 'POST', stringify, ...options });
        if (stringify === false) {
            return {
                access_token: 'shpat_new',
                refresh_token: 'shprt_new',
                scope: 'read_customers,write_orders',
                expires_in: 3600,
                refresh_token_expires_in: 7776000,
            };
        }
        return { data: {} };
    };
    return api;
}

describe('Shopify Api', () => {
    describe('construction & shop wiring', () => {
        it('defaults baseUrl to the templated GraphQL Admin endpoint', () => {
            const api = new Api({});
            expect(api.baseUrl).toBe(
                `https://{shop}.myshopify.com/admin/api/${API_VERSION}/graphql.json`
            );
            expect(api.apiVersion).toBe(API_VERSION);
        });

        it('setShop normalizes bare shop names to *.myshopify.com', () => {
            const api = new Api({});
            api.setShop('Acme');
            expect(api.shop).toBe('acme.myshopify.com');
            expect(api.baseUrl).toBe(
                `https://acme.myshopify.com/admin/api/${API_VERSION}/graphql.json`
            );
            expect(api.tokenUri).toBe(
                'https://acme.myshopify.com/admin/oauth/access_token'
            );
        });

        it('rejects invalid shop domains', () => {
            const api = new Api({});
            expect(() => api.setShop('not a shop!!!')).toThrow(/Invalid Shopify shop/);
        });

        it('builds a per-shop authorize URL', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example.com/redirect/shopify',
                scope: 'read_products',
                state: 'nonce',
                shop: 'acme.myshopify.com',
            });
            const uri = api.getAuthUri();
            expect(uri).toContain(
                'https://acme.myshopify.com/admin/oauth/authorize?'
            );
            expect(uri).toContain('client_id=cid');
            expect(uri).toContain('scope=read_products');
            expect(uri).toContain('state=nonce');
        });
    });

    describe('auth headers & tokens', () => {
        it('sends X-Shopify-Access-Token instead of Bearer', async () => {
            const api = new Api({ access_token: 'shpat_abc' });
            const headers = await api.addAuthHeaders({});
            expect(headers['X-Shopify-Access-Token']).toBe('shpat_abc');
            expect(headers.Authorization).toBeUndefined();
        });

        it('getTokenFromCode posts expiring=1 to the shop token URI', async () => {
            const api = makeApi({ access_token: null });
            await api.getTokenFromCode('auth-code');
            const call = api._captured[0];
            expect(call.url).toBe(
                'https://acme.myshopify.com/admin/oauth/access_token'
            );
            expect(call.stringify).toBe(false);
            const body = call.body.toString();
            expect(body).toContain('client_id=cid');
            expect(body).toContain('client_secret=csecret');
            expect(body).toContain('code=auth-code');
            expect(body).toContain('expiring=1');
            expect(api.access_token).toBe('shpat_new');
            expect(api.refresh_token).toBe('shprt_new');
        });

        it('refreshAccessToken uses grant_type=refresh_token', async () => {
            const api = makeApi();
            await api.refreshAccessToken({ refresh_token: 'shprt_old' });
            const body = api._captured[0].body.toString();
            expect(body).toContain('grant_type=refresh_token');
            expect(body).toContain('refresh_token=shprt_old');
        });
    });

    describe('GraphQL operations', () => {
        it('listCustomers posts a customers query and maps the page', async () => {
            const api = makeApi();
            api._post = async (options) => {
                api._captured.push(options);
                return {
                    data: {
                        customers: {
                            nodes: [
                                {
                                    id: 'gid://shopify/Customer/1',
                                    firstName: 'Dana',
                                    lastName: 'Reyes',
                                    email: 'dana@example.com',
                                    tags: ['vip'],
                                    createdAt: '2026-01-01T00:00:00Z',
                                    updatedAt: '2026-01-02T00:00:00Z',
                                    numberOfOrders: '3',
                                    amountSpent: {
                                        amount: '10.00',
                                        currencyCode: 'USD',
                                    },
                                    defaultAddress: null,
                                    emailMarketingConsent: null,
                                },
                            ],
                            pageInfo: {
                                hasNextPage: true,
                                endCursor: 'cursor-2',
                            },
                        },
                    },
                };
            };
            const page = await api.listCustomers({
                limit: 10,
                updated_at_min: '2026-01-01',
            });
            expect(api._captured[0].url).toBe(api.baseUrl);
            expect(api._captured[0].body.query).toMatch(/customers\(/);
            expect(page.customers[0].id).toBe('1');
            expect(page.customers[0].first_name).toBe('Dana');
            expect(page.customers[0].email).toBe('dana@example.com');
            expect(page.nextPageInfo).toBe('cursor-2');
        });

        it('getOrder fetches by GID and returns a mapped order', async () => {
            const api = makeApi();
            api._post = async () => ({
                data: {
                    order: {
                        id: 'gid://shopify/Order/99',
                        name: '#1042',
                        email: 'a@b.com',
                        createdAt: '2026-01-01T00:00:00Z',
                        currencyCode: 'USD',
                        displayFinancialStatus: 'PAID',
                        displayFulfillmentStatus: null,
                        subtotalPriceSet: {
                            shopMoney: { amount: '10.00', currencyCode: 'USD' },
                        },
                        totalDiscountsSet: {
                            shopMoney: { amount: '0.00', currencyCode: 'USD' },
                        },
                        totalTaxSet: {
                            shopMoney: { amount: '1.00', currencyCode: 'USD' },
                        },
                        totalPriceSet: {
                            shopMoney: { amount: '11.00', currencyCode: 'USD' },
                        },
                        totalShippingPriceSet: {
                            shopMoney: { amount: '0.00', currencyCode: 'USD' },
                        },
                        customer: null,
                        shippingAddress: null,
                        lineItems: { nodes: [] },
                        discountCodes: [],
                        tags: [],
                    },
                },
            });
            const { order } = await api.getOrder({ id: '99' });
            expect(order.id).toBe('99');
            expect(order.name).toBe('#1042');
            expect(order.financial_status).toBe('paid');
            expect(order.total_price).toBe('11.00');
        });

        it('createWebhook maps REST topic to GraphQL enum', async () => {
            const api = makeApi();
            api._post = async (options) => {
                api._captured.push(options);
                return {
                    data: {
                        webhookSubscriptionCreate: {
                            webhookSubscription: {
                                id: 'gid://shopify/WebhookSubscription/5',
                                topic: 'ORDERS_CREATE',
                                format: 'JSON',
                                createdAt: '2026-01-01T00:00:00Z',
                                endpoint: {
                                    callbackUrl: 'https://hook.example.com',
                                },
                            },
                            userErrors: [],
                        },
                    },
                };
            };
            const res = await api.createWebhook({
                topic: 'orders/create',
                address: 'https://hook.example.com',
            });
            expect(api._captured[0].body.variables.topic).toBe('ORDERS_CREATE');
            expect(res.webhook.id).toBe('5');
            expect(res.webhook.address).toBe('https://hook.example.com');
        });

        it('toGraphqlTopic converts slash topics', () => {
            expect(toGraphqlTopic('customers/update')).toBe('CUSTOMERS_UPDATE');
            expect(toGraphqlTopic('ORDERS_PAID')).toBe('ORDERS_PAID');
        });
    });

    describe('verifyWebhookSignature', () => {
        it('accepts a valid HMAC of the raw body', () => {
            const secret = 'csecret';
            const body = '{"id":1}';
            const digest = crypto
                .createHmac('sha256', secret)
                .update(body)
                .digest('base64');
            const api = new Api({ client_secret: secret });
            expect(
                api.verifyWebhookSignature({
                    headers: { 'X-Shopify-Hmac-Sha256': digest },
                    body,
                })
            ).toBe(true);
        });

        it('rejects a bad HMAC', () => {
            const api = new Api({ client_secret: 'csecret' });
            expect(
                api.verifyWebhookSignature({
                    headers: { 'x-shopify-hmac-sha256': 'nope' },
                    body: '{}',
                })
            ).toBe(false);
        });
    });
});
