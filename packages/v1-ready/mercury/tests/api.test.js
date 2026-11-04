const { Api } = require('../api');

// Fully offline: stub the low-level HTTP methods and assert on the request
// options the API methods construct. No network is touched.
function makeApi(overrides = {}) {
    const api = new Api({ api_key: 'test-key', ...overrides });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { accounts: [], page: {} };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'wh_1', secret: 'sec_1' };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return undefined;
    };
    return api;
}

describe('Mercury Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and Bearer Authorization header', () => {
            const api = new Api({ api_key: 'secret-token:abc' });
            expect(api.baseUrl).toBe('https://api.mercury.com/api/v1');
            expect(api.api_key_name).toBe('Authorization');
            expect(api.api_key_raw).toBe('secret-token:abc');
            expect(api.api_key).toBe('Bearer secret-token:abc');
        });

        it('accepts apiKey and access_token aliases', () => {
            expect(new Api({ apiKey: 'k1' }).api_key_raw).toBe('k1');
            expect(new Api({ access_token: 'k2' }).api_key_raw).toBe('k2');
            expect(new Api({ api_key_raw: 'k3' }).api_key_raw).toBe('k3');
        });

        it('strips a pre-existing Bearer prefix', () => {
            const api = new Api({ api_key: 'Bearer already' });
            expect(api.api_key_raw).toBe('already');
            expect(api.api_key).toBe('Bearer already');
        });

        it('adds the Authorization Bearer auth header', async () => {
            const api = new Api({ api_key: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
        });

        it('reports authenticated only with a non-empty key', () => {
            expect(new Api({ api_key: 'x' }).isAuthenticated()).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });

        it('setApiToken updates raw + Bearer header value', () => {
            const api = new Api({});
            api.setApiToken('Bearer tok');
            expect(api.api_key_raw).toBe('tok');
            expect(api.api_key).toBe('Bearer tok');
        });
    });

    describe('accounts', () => {
        it('getAccounts hits GET /accounts', async () => {
            const api = makeApi();
            await api.getAccounts();
            expect(api._captured[0].url).toBe(
                'https://api.mercury.com/api/v1/accounts'
            );
        });

        it('getAccounts forwards query params', async () => {
            const api = makeApi();
            await api.getAccounts({ limit: 10, order: 'desc' });
            expect(api._captured[0].query).toEqual({
                limit: 10,
                order: 'desc',
            });
        });

        it('getAccount hits GET /account/{id}', async () => {
            const api = makeApi();
            await api.getAccount('acc-1');
            expect(api._captured[0].url).toBe(
                'https://api.mercury.com/api/v1/account/acc-1'
            );
        });
    });

    describe('transactions', () => {
        it('listAccountTransactions hits the account transactions path', async () => {
            const api = makeApi();
            await api.listAccountTransactions('acc-1', {
                start: '2026-01-01',
                limit: 50,
            });
            expect(api._captured[0].url).toBe(
                'https://api.mercury.com/api/v1/account/acc-1/transactions'
            );
            expect(api._captured[0].query).toEqual({
                start: '2026-01-01',
                limit: 50,
            });
        });

        it('getTransaction hits the transaction path', async () => {
            const api = makeApi();
            await api.getTransaction('acc-1', 'txn-9');
            expect(api._captured[0].url).toBe(
                'https://api.mercury.com/api/v1/account/acc-1/transaction/txn-9'
            );
        });

        it('listTransactions hits GET /transactions', async () => {
            const api = makeApi();
            await api.listTransactions({ order: 'asc' });
            expect(api._captured[0].url).toBe(
                'https://api.mercury.com/api/v1/transactions'
            );
            expect(api._captured[0].query).toEqual({ order: 'asc' });
        });
    });

    describe('webhooks', () => {
        it('getWebhooks hits GET /webhooks', async () => {
            const api = makeApi();
            await api.getWebhooks({ status: ['active'] });
            expect(api._captured[0].url).toBe(
                'https://api.mercury.com/api/v1/webhooks'
            );
        });

        it('getWebhook hits GET /webhooks/{id}', async () => {
            const api = makeApi();
            await api.getWebhook('wh-1');
            expect(api._captured[0].url).toBe(
                'https://api.mercury.com/api/v1/webhooks/wh-1'
            );
        });

        it('createWebhook POSTs to /webhooks with the body', async () => {
            const api = makeApi();
            const body = {
                url: 'https://hook.example.com/mercury?externalId=acc-1',
                eventTypes: ['transaction.created'],
            };
            await api.createWebhook(body);
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.mercury.com/api/v1/webhooks'
            );
            expect(captured.body).toEqual(body);
        });

        it('updateWebhook POSTs to /webhooks/{id} (Mercury uses POST, not PATCH)', async () => {
            const api = makeApi();
            await api.updateWebhook('wh-1', { status: 'paused' });
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.mercury.com/api/v1/webhooks/wh-1'
            );
            expect(captured.body).toEqual({ status: 'paused' });
        });

        it('deleteWebhook DELETEs /webhooks/{id}', async () => {
            const api = makeApi();
            await api.deleteWebhook('wh-1');
            expect(api._captured[0]).toMatchObject({
                method: 'DELETE',
                url: 'https://api.mercury.com/api/v1/webhooks/wh-1',
            });
        });
    });
});
