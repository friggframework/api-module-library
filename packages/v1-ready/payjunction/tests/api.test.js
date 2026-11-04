const { Api } = require('../api');

// Fully offline: stub low-level HTTP methods and assert on request options.
function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'client',
        client_secret: 'secret',
        redirect_uri: 'https://example.com/redirect/payjunction',
        app_key: 'app-key-1',
        access_token: 'tok',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { results: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { ok: true };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { ok: true };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return { ok: true };
    };
    return api;
}

describe('PayJunction Api', () => {
    describe('construction & auth', () => {
        it('defaults to production API and auth hosts', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
            });
            expect(api.baseUrl).toBe('https://api.payjunction.com');
            expect(api.authBaseUrl).toBe('https://www.payjunction.com');
            expect(api.tokenUri).toBe(
                'https://www.payjunction.com/trinity/oauth/token'
            );
        });

        it('uses official Labs hosts when sandbox=true', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
                sandbox: true,
            });
            expect(api.baseUrl).toBe('https://api.payjunctionlabs.com');
            expect(api.authBaseUrl).toBe('https://www.payjunctionlabs.com');
        });

        it('builds an authorize URL with scope and state', () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
                scope: 'read write',
                state: 'abc',
            });
            const uri = api.getAuthorizationUri();
            expect(uri).toContain(
                'https://www.payjunction.com/trinity/oauth/authorize?'
            );
            expect(uri).toContain('client_id=cid');
            expect(uri).toContain('redirect_uri=https%3A%2F%2Fex.com%2Fr');
            expect(uri).toContain('response_type=code');
            expect(uri).toContain('scope=read+write');
            expect(uri).toContain('state=abc');
        });

        it('adds Bearer + X-PJ-Application-Key headers', async () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
                access_token: 'access-1',
                app_key: 'pj-key',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer access-1');
            expect(headers['X-PJ-Application-Key']).toBe('pj-key');
            expect(headers.Accept).toBe('application/json');
        });

        it('exchanges code via Basic Auth client credentials', async () => {
            const api = makeApi({ access_token: null });
            api.setTokens = async () => {};
            await api.getTokenFromCode('auth-code');
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://www.payjunction.com/trinity/oauth/token'
            );
            expect(captured.headers.Authorization).toMatch(/^Basic /);
            expect(captured.body.get('grant_type')).toBe('authorization_code');
            expect(captured.body.get('code')).toBe('auth-code');
        });

        it('refreshes tokens via Basic Auth', async () => {
            const api = makeApi();
            api.setTokens = async () => {};
            await api.refreshAccessToken({ refresh_token: 'rt-1' });
            const captured = api._captured[0];
            expect(captured.url).toBe(
                'https://www.payjunction.com/trinity/oauth/token'
            );
            expect(captured.headers.Authorization).toMatch(/^Basic /);
            expect(captured.body.get('grant_type')).toBe('refresh_token');
            expect(captured.body.get('refresh_token')).toBe('rt-1');
        });
    });

    describe('merchant', () => {
        it('getMerchant hits GET /merchant', async () => {
            const api = makeApi();
            await api.getMerchant();
            expect(api._captured[0].url).toBe(
                'https://api.payjunction.com/merchant'
            );
        });
    });

    describe('transactions', () => {
        it('listTransactions hits GET /transactions with paging', async () => {
            const api = makeApi();
            await api.listTransactions({ limit: 10, offset: 20, action: 'CHARGE' });
            expect(api._captured[0].url).toBe(
                'https://api.payjunction.com/transactions'
            );
            expect(api._captured[0].query).toEqual({
                limit: 10,
                offset: 20,
                action: 'CHARGE',
            });
        });

        it('getTransaction hits the id path', async () => {
            const api = makeApi();
            await api.getTransaction(99);
            expect(api._captured[0].url).toBe(
                'https://api.payjunction.com/transactions/99'
            );
        });

        it('createTransaction POSTs form-urlencoded body', async () => {
            const api = makeApi();
            await api.createTransaction({
                action: 'CHARGE',
                amountBase: '3.00',
                tokenId: 'tok_1',
            });
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.payjunction.com/transactions'
            );
            expect(captured.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            expect(captured.body.get('action')).toBe('CHARGE');
            expect(captured.body.get('amountBase')).toBe('3.00');
            expect(captured.body.get('tokenId')).toBe('tok_1');
        });

        it('getTransactionReceipt hits receipts/latest', async () => {
            const api = makeApi();
            await api.getTransactionReceipt(5, 'PDF');
            expect(api._captured[0].url).toBe(
                'https://api.payjunction.com/transactions/5/receipts/latest'
            );
            expect(api._captured[0].query).toEqual({ format: 'PDF' });
        });
    });

    describe('customers', () => {
        it('listCustomers hits GET /customers', async () => {
            const api = makeApi();
            await api.listCustomers({ firstName: 'Ada' });
            expect(api._captured[0].url).toBe(
                'https://api.payjunction.com/customers'
            );
            expect(api._captured[0].query.firstName).toBe('Ada');
        });

        it('createCustomer POSTs form body', async () => {
            const api = makeApi();
            await api.createCustomer({ firstName: 'Ada', lastName: 'Lovelace' });
            expect(api._captured[0].body.get('firstName')).toBe('Ada');
            expect(api._captured[0].body.get('lastName')).toBe('Lovelace');
        });

        it('updateCustomer PUTs form body', async () => {
            const api = makeApi();
            await api.updateCustomer(12, { companyName: 'Analytical Engines' });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toBe(
                'https://api.payjunction.com/customers/12'
            );
            expect(api._captured[0].body.get('companyName')).toBe(
                'Analytical Engines'
            );
        });
    });

    describe('invoices', () => {
        it('createInvoice uses form-urlencoded (not JSON)', async () => {
            const api = makeApi();
            await api.createInvoice({
                amountBase: '1.99',
                customerEmail: 'a@example.com',
                terminalId: 1,
            });
            const captured = api._captured[0];
            expect(captured.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            expect(captured.body.get('amountBase')).toBe('1.99');
            expect(captured.body.get('terminalId')).toBe('1');
        });

        it('getInvoice hits the id path', async () => {
            const api = makeApi();
            await api.getInvoice('inv-1');
            expect(api._captured[0].url).toBe(
                'https://api.payjunction.com/invoices/inv-1'
            );
        });
    });

    describe('settlements / deposits / terminals', () => {
        it('listSettlements / getSettlement', async () => {
            const api = makeApi();
            await api.listSettlements({ terminalId: 9 });
            expect(api._captured[0].url).toBe(
                'https://api.payjunction.com/settlements'
            );
            await api.getSettlement(42);
            expect(api._captured[1].url).toBe(
                'https://api.payjunction.com/settlements/42'
            );
        });

        it('listDeposits / getDeposit', async () => {
            const api = makeApi();
            await api.listDeposits();
            expect(api._captured[0].url).toBe(
                'https://api.payjunction.com/deposits'
            );
            await api.getDeposit('dep-1');
            expect(api._captured[1].url).toBe(
                'https://api.payjunction.com/deposits/dep-1'
            );
        });

        it('listTerminals / listSmartTerminals', async () => {
            const api = makeApi();
            await api.listTerminals();
            expect(api._captured[0].url).toBe(
                'https://api.payjunction.com/terminals'
            );
            await api.listSmartTerminals();
            expect(api._captured[1].url).toBe(
                'https://api.payjunction.com/smartterminals'
            );
        });
    });

    describe('webhooks', () => {
        it('createWebhook POSTs event/url/secret as form fields', async () => {
            const api = makeApi();
            await api.createWebhook({
                event: 'TRANSACTION',
                url: 'https://hook.example.com/pj',
                secret: 's3cret',
            });
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.payjunction.com/webhooks'
            );
            expect(captured.body.get('event')).toBe('TRANSACTION');
            expect(captured.body.get('url')).toBe(
                'https://hook.example.com/pj'
            );
            expect(captured.body.get('secret')).toBe('s3cret');
        });

        it('supports the ported (event, url) call shape', async () => {
            const api = makeApi();
            await api.createWebhook('CUSTOMER', 'https://hook.example.com/c');
            expect(api._captured[0].body.get('event')).toBe('CUSTOMER');
            expect(api._captured[0].body.get('url')).toBe(
                'https://hook.example.com/c'
            );
        });

        it('updateWebhook / deleteWebhook / listWebhooks', async () => {
            const api = makeApi();
            await api.updateWebhook('wh-1', { secret: 'new' });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toBe(
                'https://api.payjunction.com/webhooks/wh-1'
            );
            await api.deleteWebhook('wh-1');
            expect(api._captured[1].method).toBe('DELETE');
            await api.listWebhooks();
            expect(api._captured[2].url).toBe(
                'https://api.payjunction.com/webhooks'
            );
        });
    });
});
