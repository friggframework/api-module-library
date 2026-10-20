const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'test-token',
        accountId: 'zDmNq',
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://example.com/callback',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { response: { result: {} } };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { response: { result: {} } };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { response: { result: {} } };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return { response: {} };
    };
    return api;
}

describe('FreshBooks Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and token URI', () => {
            const api = new Api({ access_token: 't' });
            expect(api.baseUrl).toBe('https://api.freshbooks.com');
            expect(api.tokenUri).toBe(
                'https://api.freshbooks.com/auth/oauth/token'
            );
        });

        it('builds the official auth.freshbooks.com authorize URL', () => {
            const api = new Api({
                client_id: 'abc',
                redirect_uri: 'https://app.example/cb',
                scope: 'user:profile:read',
            });
            const uri = api.getAuthUri();
            expect(uri).toContain(
                'https://auth.freshbooks.com/oauth/authorize/?'
            );
            expect(uri).toContain('response_type=code');
            expect(uri).toContain('client_id=abc');
            expect(uri).toContain(
                'redirect_uri=https%3A%2F%2Fapp.example%2Fcb'
            );
            expect(uri).toContain('scope=user%3Aprofile%3Aread');
        });

        it('adds Bearer + Api-Version alpha headers', async () => {
            const api = new Api({ access_token: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
            expect(headers['Api-Version']).toBe('alpha');
        });

        it('requires accountId for accounting paths', async () => {
            const api = makeApi({ accountId: null });
            await expect(api.listClients()).rejects.toThrow(/accountId/);
        });
    });

    describe('identity', () => {
        it('getUserInfo hits GET /auth/api/v1/users/me', async () => {
            const api = makeApi();
            await api.getUserInfo();
            expect(api._captured[0].url).toBe(
                'https://api.freshbooks.com/auth/api/v1/users/me'
            );
        });

        it('listBusinessAccounts maps memberships', async () => {
            const api = makeApi();
            api.getUserInfo = async () => ({
                response: {
                    business_memberships: [
                        {
                            id: 1,
                            role: 'owner',
                            business: {
                                id: 99,
                                name: 'Acme',
                                account_id: 'ABC123',
                            },
                        },
                    ],
                },
            });
            const accounts = await api.listBusinessAccounts();
            expect(accounts).toEqual([
                {
                    name: 'Acme',
                    accountId: 'ABC123',
                    businessId: 99,
                    role: 'owner',
                    membershipId: 1,
                },
            ]);
        });
    });

    describe('clients', () => {
        it('listClients hits the accounting clients path', async () => {
            const api = makeApi();
            await api.listClients({ page: 1 });
            expect(api._captured[0].url).toBe(
                'https://api.freshbooks.com/accounting/account/zDmNq/users/clients?page=1'
            );
        });

        it('createClient POSTs a wrapped client body', async () => {
            const api = makeApi();
            await api.createClient({ fname: 'Ada', email: 'a@x.com' });
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual({
                client: { fname: 'Ada', email: 'a@x.com' },
            });
        });

        it('updateClient PUTs to the client id path', async () => {
            const api = makeApi();
            await api.updateClient(42, { fname: 'Grace' });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toContain('/users/clients/42');
        });
    });

    describe('invoices', () => {
        it('list/get/create/update/delete invoice paths', async () => {
            const api = makeApi();
            await api.listInvoices();
            await api.getInvoice(7);
            await api.createInvoice({ customerid: 1 });
            await api.updateInvoice(7, { notes: 'x' });
            await api.deleteInvoice(7);
            expect(api._captured.map((c) => c.method)).toEqual([
                'GET',
                'GET',
                'POST',
                'PUT',
                'DELETE',
            ]);
            expect(api._captured[1].url).toContain('/invoices/invoices/7');
            expect(api._captured[4].url).toContain('/invoices/invoices/7');
        });
    });

    describe('expenses & categories', () => {
        it('listExpenses and listExpenseCategories', async () => {
            const api = makeApi();
            await api.listExpenses();
            await api.getExpense(9);
            await api.createExpense({
                amount: { amount: '10.00' },
                categoryid: 1,
                staffid: 1,
                date: '2024-01-01',
            });
            await api.listExpenseCategories();
            await api.getExpenseCategory(3);
            expect(api._captured[0].url).toContain('/expenses/expenses');
            expect(api._captured[3].url).toContain('/expenses/categories');
            expect(api._captured[4].url).toContain('/expenses/categories/3');
        });
    });

    describe('payments & staff & other income', () => {
        it('covers payment/staff/other_income paths', async () => {
            const api = makeApi();
            await api.listPayments();
            await api.createPayment({
                invoiceid: 1,
                amount: { amount: '5.00' },
                date: '2024-01-01',
                type: 'Check',
            });
            await api.listStaff();
            await api.getStaff(2);
            await api.createOtherIncome({ amount: { amount: '1.00' } });
            await api.updateOtherIncome(4, { note: 'n' });
            expect(api._captured[0].url).toContain('/payments/payments');
            expect(api._captured[2].url).toContain('/users/staffs');
            expect(api._captured[4].url).toContain(
                '/other_incomes/other_incomes'
            );
            expect(api._captured[5].body).toEqual({
                other_income: { note: 'n' },
            });
        });
    });

    describe('webhooks', () => {
        it('create/list/verify/resend/delete callbacks', async () => {
            const api = makeApi();
            await api.createCallback({
                event: 'invoice.create',
                uri: 'https://hook.example/fb',
            });
            await api.listCallbacks();
            await api.verifyCallback(2001, 'scADVVi5');
            await api.resendCallbackVerification(2001);
            await api.deleteCallback(2001);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toContain('/events/callbacks');
            expect(api._captured[2].body).toEqual({
                callback: { verifier: 'scADVVi5' },
            });
            expect(api._captured[3].body).toEqual({
                callback: { resend: true },
            });
            expect(api._captured[4].method).toBe('DELETE');
        });
    });

    describe('query builder', () => {
        it('serializes nested search filters', async () => {
            const api = makeApi();
            await api.listClients({
                search: { email: 'a@x.com', userids: [1, 2] },
            });
            const { url } = api._captured[0];
            expect(url).toContain('search%5Bemail%5D=a%40x.com');
            expect(url).toContain('search%5Buserids%5D%5B%5D=1');
            expect(url).toContain('search%5Buserids%5D%5B%5D=2');
        });
    });
});
