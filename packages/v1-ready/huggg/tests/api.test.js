const { Api } = require('../api');

// Fully offline: stub _get/_post and assert on the request options the API
// methods construct. No network is touched.
function makeApi(overrides = {}) {
    const api = new Api({ api_key: 'test-key', ...overrides });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { data: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { data: { id: 'txn_1' } };
    };
    return api;
}

describe('Huggg Api', () => {
    describe('construction & auth', () => {
        it('sets the production base URL and X-Huggg-API-Key header name', () => {
            const api = new Api({ api_key: 'abc' });
            expect(api.baseUrl).toBe('https://api.huggg.me');
            expect(api.api_key_name).toBe('X-Huggg-API-Key');
            expect(api.api_key).toBe('abc');
            expect(api.tokenUri).toBe('https://api.huggg.me/oauth/token');
        });

        it('uses the sandbox host when isSandbox is true', () => {
            const api = new Api({ api_key: 'abc', isSandbox: true });
            expect(api.baseUrl).toBe('https://beta.api.huggg.me');
            expect(api.tokenUri).toBe('https://beta.api.huggg.me/oauth/token');
        });

        it('honours an explicit base_url override', () => {
            const api = new Api({
                api_key: 'abc',
                base_url: 'https://custom.example',
            });
            expect(api.baseUrl).toBe('https://custom.example');
        });

        it('adds the X-Huggg-API-Key auth header for API keys', async () => {
            const api = new Api({ api_key: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers['X-Huggg-API-Key']).toBe('secret');
            expect(headers.Authorization).toBeUndefined();
        });

        it('adds Bearer Authorization when only access_token is set', async () => {
            const api = new Api({ access_token: 'oauth-token' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer oauth-token');
            expect(headers['X-Huggg-API-Key']).toBeUndefined();
        });

        it('does not treat access_token as an API key', () => {
            const api = new Api({ access_token: 'oauth-token' });
            expect(api.api_key).toBeNull();
            expect(api.access_token).toBe('oauth-token');
        });

        it('reports authenticated with either credential', () => {
            expect(new Api({ api_key: 'x' }).isAuthenticated()).toBe(true);
            expect(new Api({ access_token: 'y' }).isAuthenticated()).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('OAuth helpers', () => {
        it('getTokenFromClientCredentials posts JSON client_credentials', async () => {
            const api = makeApi({
                api_key: null,
                client_id: 'cid',
                client_secret: 'csec',
            });
            api._post = async (options) => {
                api._captured.push({ method: 'POST', ...options });
                return { access_token: 'client-tok', token_type: 'Bearer' };
            };
            await api.getTokenFromClientCredentials();
            const captured = api._captured[0];
            expect(captured.url).toBe('https://api.huggg.me/oauth/token');
            expect(captured.body).toEqual({
                grant_type: 'client_credentials',
                client_id: 'cid',
                client_secret: 'csec',
            });
            expect(api.access_token).toBe('client-tok');
        });

        it('getTokenFromUsernamePassword posts password grant with client Bearer', async () => {
            const api = makeApi({
                api_key: null,
                access_token: 'client-tok',
                username: 'user',
                password: 'pass',
            });
            api._post = async (options) => {
                api._captured.push({ method: 'POST', ...options });
                return {
                    access_token: 'user-tok',
                    refresh_token: 'ref-tok',
                    token_type: 'Bearer',
                };
            };
            await api.getTokenFromUsernamePassword();
            expect(api._captured[0].body).toEqual({
                grant_type: 'password',
                username: 'user',
                password: 'pass',
            });
            expect(api.access_token).toBe('user-tok');
            expect(api.refresh_token).toBe('ref-tok');
        });

        it('refreshAccessToken posts refresh_token without prior auth headers', async () => {
            const api = makeApi({
                api_key: null,
                access_token: 'expired',
                refresh_token: 'ref',
                client_id: 'cid',
                client_secret: 'csec',
            });
            api._post = async (options) => {
                // During the call, credentials must be cleared so addAuthHeaders
                // would not attach a stale token.
                expect(api.access_token).toBeNull();
                expect(api.api_key).toBeNull();
                api._captured.push({ method: 'POST', ...options });
                return { access_token: 'new-tok', refresh_token: 'new-ref' };
            };
            await api.refreshAccessToken();
            expect(api._captured[0].body).toEqual({
                grant_type: 'refresh_token',
                refresh_token: 'ref',
                client_id: 'cid',
                client_secret: 'csec',
            });
            expect(api.access_token).toBe('new-tok');
            expect(api.refresh_token).toBe('new-ref');
        });
    });

    describe('products & brands', () => {
        it('listProducts hits GET /v3/products/', async () => {
            const api = makeApi();
            await api.listProducts();
            expect(api._captured[0].url).toBe(
                'https://api.huggg.me/v3/products/'
            );
        });

        it('listProducts serializes query params', async () => {
            const api = makeApi();
            await api.listProducts({
                'pagination-limit': 10,
                active: true,
            });
            const { url } = api._captured[0];
            expect(url).toContain('pagination-limit=10');
            expect(url).toContain('active=true');
        });

        it('getProduct hits GET /v3/products/{id}', async () => {
            const api = makeApi();
            await api.getProduct('prod-1');
            expect(api._captured[0].url).toBe(
                'https://api.huggg.me/v3/products/prod-1'
            );
        });

        it('listBrands and getBrand hit the V3 brand paths', async () => {
            const api = makeApi();
            await api.listBrands();
            await api.getBrand('brand-1');
            expect(api._captured[0].url).toBe(
                'https://api.huggg.me/v3/brands/'
            );
            expect(api._captured[1].url).toBe(
                'https://api.huggg.me/v3/brands/brand-1'
            );
        });

        it('getProductSegments hits the V2 segments path', async () => {
            const api = makeApi();
            await api.getProductSegments('prod-1');
            expect(api._captured[0].url).toBe(
                'https://api.huggg.me/api/v2/products/prod-1/segments'
            );
        });
    });

    describe('wallets', () => {
        it('getTeamWallets hits GET /api/v2/teams/{teamId}/wallets', async () => {
            const api = makeApi();
            await api.getTeamWallets('team-1');
            expect(api._captured[0].url).toBe(
                'https://api.huggg.me/api/v2/teams/team-1/wallets'
            );
        });
    });

    describe('transactions', () => {
        it('createTransaction POSTs to /api/v2/transactions', async () => {
            const api = makeApi();
            const body = {
                payment: { method: 'walletCommitment', reference: 'w1' },
                purchase: { type: 'huggg', reference: 'p1', quantity: 1 },
            };
            await api.createTransaction(body);
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.huggg.me/api/v2/transactions'
            );
            expect(captured.body).toEqual(body);
        });

        it('createTransaction can embed hugggs', async () => {
            const api = makeApi();
            await api.createTransaction(
                { payment: {}, purchase: {} },
                { embed: ['hugggs'] }
            );
            expect(api._captured[0].url).toContain('embed%5B%5D=hugggs');
        });

        it('getTransaction / cancelTransaction / getHugggsFromTransaction', async () => {
            const api = makeApi();
            await api.getTransaction('t1');
            await api.cancelTransaction('t1');
            await api.getHugggsFromTransaction('t1', { embed: ['message'] });
            expect(api._captured[0].url).toBe(
                'https://api.huggg.me/api/v2/transactions/t1'
            );
            expect(api._captured[1].url).toBe(
                'https://api.huggg.me/api/v2/transactions/t1/cancel'
            );
            expect(api._captured[2].url).toContain(
                '/api/v2/transactions/t1/hugggs'
            );
            expect(api._captured[2].url).toContain('embed%5B%5D=message');
        });
    });

    describe('hugggs & search', () => {
        it('getHuggg and cancelHuggg hit the documented paths', async () => {
            const api = makeApi();
            await api.getHuggg('h1');
            await api.cancelHuggg('h1');
            expect(api._captured[0].url).toBe(
                'https://api.huggg.me/api/v2/hugggs/h1'
            );
            expect(api._captured[1].url).toBe(
                'https://api.huggg.me/api/v2/hugggs/h1/cancel'
            );
        });

        it('searchHugggs POSTs to /v3/searches/hugggs', async () => {
            const api = makeApi();
            const body = {
                index: 'huggg',
                query: 'huggg.updated_at:{2023-01-01 TO *}',
                size: 100,
            };
            await api.searchHugggs(body);
            expect(api._captured[0].url).toBe(
                'https://api.huggg.me/v3/searches/hugggs'
            );
            expect(api._captured[0].body).toEqual(body);
        });
    });

    describe('bank-payment orders', () => {
        it('createBankPaymentOrder and getBankPaymentOrder', async () => {
            const api = makeApi();
            const body = {
                idempotencyKey: 'k1',
                walletId: 'w1',
                autoClaim: true,
                requireNameOnAccount: true,
                sendingMethod: 'BANK_PAYMENT',
                recipients: [{ amount: 100, recipientName: 'A' }],
            };
            await api.createBankPaymentOrder(body);
            await api.getBankPaymentOrder('ord-1');
            expect(api._captured[0].url).toBe(
                'https://api.huggg.me/v3/bank-payments/orders'
            );
            expect(api._captured[0].body).toEqual(body);
            expect(api._captured[1].url).toBe(
                'https://api.huggg.me/v3/bank-payments/orders/ord-1'
            );
        });
    });
});
