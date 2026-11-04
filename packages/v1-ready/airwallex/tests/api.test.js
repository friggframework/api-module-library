const { Api } = require('../api');

// Fully offline: stub _get/_post and assert on the request options methods build.
function makeApi(overrides = {}) {
    const api = new Api({
        api_key: 'test-api-key',
        client_id: 'test-client-id',
        access_token: 'tok_test',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { items: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'created_1', token: 'tok_new', expires_at: '2030-01-01T00:00:00+0000' };
    };
    return api;
}

describe('Airwallex Api', () => {
    describe('construction & auth', () => {
        it('defaults to the production base URL', () => {
            const api = new Api({ api_key: 'k', client_id: 'c' });
            expect(api.baseUrl).toBe('https://api.airwallex.com');
            expect(api.base_url).toBe(api.baseUrl);
        });

        it('accepts a sandbox base_url override', () => {
            const api = new Api({
                api_key: 'k',
                client_id: 'c',
                base_url: 'https://api.sandbox.airwallex.com',
            });
            expect(api.baseUrl).toBe('https://api.sandbox.airwallex.com');
        });

        it('is authenticated with api_key + client_id even without a token yet', () => {
            expect(
                new Api({ api_key: 'k', client_id: 'c' }).isAuthenticated()
            ).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });

        it('adds Authorization Bearer when an access_token is present', async () => {
            const api = new Api({
                api_key: 'k',
                client_id: 'c',
                access_token: 'tok',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer tok');
        });

        it('login POSTs to /api/v1/authentication/login with x-api-key and x-client-id', async () => {
            const api = makeApi({ access_token: null });
            await api.login();
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.airwallex.com/api/v1/authentication/login'
            );
            expect(captured.headers['x-api-key']).toBe('test-api-key');
            expect(captured.headers['x-client-id']).toBe('test-client-id');
            expect(api.access_token).toBe('tok_new');
            expect(api.expires_at).toBe('2030-01-01T00:00:00+0000');
        });

        it('login includes x-login-as when login_as is set', async () => {
            const api = makeApi({ access_token: null, login_as: 'acct_1' });
            await api.login();
            expect(api._captured[0].headers['x-login-as']).toBe('acct_1');
        });

        it('refreshAuth re-logins with the stored api key', async () => {
            const api = makeApi({ access_token: 'stale' });
            const ok = await api.refreshAuth();
            expect(ok).toBe(true);
            expect(api._captured[0].url).toContain('/authentication/login');
            expect(api.access_token).toBe('tok_new');
        });
    });

    describe('account & balances', () => {
        it('getAccount hits GET /api/v1/account', async () => {
            const api = makeApi();
            await api.getAccount();
            expect(api._captured[0].url).toBe(
                'https://api.airwallex.com/api/v1/account'
            );
        });

        it('listCurrentBalances hits GET /api/v1/balances/current', async () => {
            const api = makeApi();
            await api.listCurrentBalances({ account_type: 'TRANSACTION' });
            expect(api._captured[0].url).toBe(
                'https://api.airwallex.com/api/v1/balances/current'
            );
            expect(api._captured[0].query.account_type).toBe('TRANSACTION');
        });

        it('listBalanceHistory hits GET /api/v1/balances/history', async () => {
            const api = makeApi();
            await api.listBalanceHistory({ currency: 'USD' });
            expect(api._captured[0].url).toContain('/balances/history');
            expect(api._captured[0].query.currency).toBe('USD');
        });
    });

    describe('financial transactions', () => {
        it('listFinancialTransactions hits the collection path', async () => {
            const api = makeApi();
            await api.listFinancialTransactions({ page_size: 20 });
            expect(api._captured[0].url).toContain('/financial_transactions');
            expect(api._captured[0].query.page_size).toBe(20);
        });

        it('getFinancialTransaction hits the id path', async () => {
            const api = makeApi();
            await api.getFinancialTransaction('ft_1');
            expect(api._captured[0].url).toBe(
                'https://api.airwallex.com/api/v1/financial_transactions/ft_1'
            );
        });
    });

    describe('beneficiaries', () => {
        it('listBeneficiaries / getBeneficiary / create / update', async () => {
            const api = makeApi();
            await api.listBeneficiaries();
            expect(api._captured[0].url).toContain('/beneficiaries');

            await api.getBeneficiary('bnf_1');
            expect(api._captured[1].url).toContain('/beneficiaries/bnf_1');

            const body = { beneficiary: {}, transfer_methods: ['LOCAL'] };
            await api.createBeneficiary(body);
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[2].url).toContain('/beneficiaries/create');
            expect(api._captured[2].body).toEqual(body);

            await api.updateBeneficiary('bnf_1', body);
            expect(api._captured[3].url).toContain(
                '/beneficiaries/bnf_1/update'
            );
        });
    });

    describe('transfers', () => {
        it('list / get / create transfer', async () => {
            const api = makeApi();
            await api.listTransfers({ status: 'PAID' });
            expect(api._captured[0].url).toContain('/transfers');
            expect(api._captured[0].query.status).toBe('PAID');

            await api.getTransfer('tr_1');
            expect(api._captured[1].url).toContain('/transfers/tr_1');

            const body = { request_id: 'r1', transfer_amount: 10 };
            await api.createTransfer(body);
            expect(api._captured[2].url).toContain('/transfers/create');
            expect(api._captured[2].body).toEqual(body);
        });
    });

    describe('payment acceptance', () => {
        it('customers CRUD paths', async () => {
            const api = makeApi();
            await api.listCustomers();
            expect(api._captured[0].url).toContain('/pa/customers');
            await api.getCustomer('cus_1');
            expect(api._captured[1].url).toContain('/pa/customers/cus_1');
            await api.createCustomer({ request_id: 'r', merchant_customer_id: 'm' });
            expect(api._captured[2].url).toContain('/pa/customers/create');
            await api.updateCustomer('cus_1', { email: 'a@b.com' });
            expect(api._captured[3].url).toContain('/pa/customers/cus_1/update');
        });

        it('payment attempts, links, charges', async () => {
            const api = makeApi();
            await api.listPaymentAttempts();
            expect(api._captured[0].url).toContain('/pa/payment_attempts');
            await api.getPaymentAttempt('pa_1');
            expect(api._captured[1].url).toContain('/pa/payment_attempts/pa_1');

            await api.createPaymentLink({ title: 'Pay' });
            expect(api._captured[2].url).toContain('/pa/payment_links/create');
            await api.getPaymentLink('pl_1');
            expect(api._captured[3].url).toContain('/pa/payment_links/pl_1');
            await api.notifyPaymentLinkShopper('pl_1', { shopper_email: 'a@b.com' });
            expect(api._captured[4].url).toContain(
                '/pa/payment_links/pl_1/notify_shopper'
            );

            await api.listCharges();
            expect(api._captured[5].url).toContain('/charges');
            await api.getCharge('ch_1');
            expect(api._captured[6].url).toContain('/charges/ch_1');
        });
    });

    describe('issuing', () => {
        it('cards and cardholders', async () => {
            const api = makeApi();
            await api.listCards();
            expect(api._captured[0].url).toContain('/issuing/cards');
            await api.getCard('card_1');
            expect(api._captured[1].url).toContain('/issuing/cards/card_1');
            await api.createCard({ cardholder_id: 'ch_1' });
            expect(api._captured[2].url).toContain('/issuing/cards/create');
            await api.listCardLimits('card_1');
            expect(api._captured[3].url).toContain('/issuing/cards/card_1/limits');
            await api.createCardholder({ email: 'a@b.com' });
            expect(api._captured[4].url).toContain('/issuing/cardholders/create');
        });
    });

    describe('webhooks', () => {
        it('list / get / create / update / delete', async () => {
            const api = makeApi();
            await api.listWebhooks();
            expect(api._captured[0].url).toContain('/webhooks');
            await api.getWebhook('wh_1');
            expect(api._captured[1].url).toContain('/webhooks/wh_1');
            const body = {
                url: 'https://hook.example.com',
                version: '2024-01-01',
                events: ['payment_intent.succeeded'],
                request_id: 'req_1',
            };
            await api.createWebhook(body);
            expect(api._captured[2].url).toContain('/webhooks/create');
            expect(api._captured[2].body).toEqual(body);
            await api.updateWebhook('wh_1', { url: 'https://hook2.example.com' });
            expect(api._captured[3].url).toContain('/webhooks/wh_1/update');
            await api.deleteWebhook('wh_1');
            expect(api._captured[4].url).toContain('/webhooks/wh_1/delete');
        });
    });
});
