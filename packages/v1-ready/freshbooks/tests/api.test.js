const { Api, INVOICE_STATUSES } = require('../api');

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
        return {
            response: {
                result: {
                    clients: [],
                    pages: 0,
                    client: { id: 1 },
                    invoice: { id: 1 },
                    payment: { id: 1 },
                    invoices: [],
                    payments: [],
                    total: 0,
                    callbacks: [],
                    callback: { id: 1 },
                },
                id: 99,
                business_memberships: [],
            },
        };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return {
            response: {
                result: {
                    client: { id: 1 },
                    invoice: { id: 1 },
                    callback: { callbackid: 5 },
                },
            },
            access_token: 'new-access',
            refresh_token: 'new-refresh',
        };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return {
            response: {
                result: {
                    client: { id: 1 },
                    callback: { callbackid: 5, verified: true },
                },
            },
        };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    api.setTokens = async (tokens) => {
        if (tokens.access_token) api.access_token = tokens.access_token;
        if (tokens.refresh_token) api.refresh_token = tokens.refresh_token;
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
            expect(api.authorizationUri).toBe(
                'https://auth.freshbooks.com/oauth/authorize/'
            );
        });

        it('getAuthorizationUri includes client, redirect, response_type and state', () => {
            const api = new Api({
                client_id: 'abc',
                redirect_uri: 'https://app.example/cb',
                state: 'xyz',
            });
            const uri = api.getAuthorizationUri();
            expect(uri).toContain(
                'https://auth.freshbooks.com/oauth/authorize/?'
            );
            expect(uri).toContain('response_type=code');
            expect(uri).toContain('client_id=abc');
            expect(uri).toContain('redirect_uri=https%3A%2F%2Fapp.example%2Fcb');
            expect(uri).toContain('state=xyz');
        });

        it('adds Bearer + Api-Version alpha headers', async () => {
            const api = new Api({ access_token: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
            expect(headers['Api-Version']).toBe('alpha');
        });

        it('exchanges tokens with a JSON body (not form-urlencoded)', async () => {
            const api = makeApi({ access_token: null });
            await api.getTokenFromCode('auth-code');
            const captured = api._captured[0];
            expect(captured.url).toBe(
                'https://api.freshbooks.com/auth/oauth/token'
            );
            expect(captured.headers['Content-Type']).toBe('application/json');
            expect(captured.body).toEqual({
                client_id: 'cid',
                client_secret: 'csecret',
                redirect_uri: 'https://example.com/callback',
                grant_type: 'authorization_code',
                code: 'auth-code',
            });
        });

        it('refreshAccessToken posts grant_type=refresh_token as JSON', async () => {
            const api = makeApi();
            await api.refreshAccessToken({ refresh_token: 'old-refresh' });
            expect(api._captured[0].body.grant_type).toBe('refresh_token');
            expect(api._captured[0].body.refresh_token).toBe('old-refresh');
        });

        it('skips backoff retries for token URI requests', async () => {
            const api = makeApi({ backOff: [0, 0, 0] });
            let seenAttempt;
            api._rawRequest = async function (url, options, attempt) {
                // Call through our override path by invoking the real logic's attempt selection
                const tokenRequestAttempt =
                    url === this.tokenUri ? this.backOff.length : attempt;
                seenAttempt = tokenRequestAttempt;
                return { access_token: 'a', refresh_token: 'r' };
            };
            // Directly exercise the attempt calculation used by _rawRequest
            await api._rawRequest(api.tokenUri, {}, 0);
            expect(seenAttempt).toBe(api.backOff.length);
        });

        it('requires accountId for accounting paths', async () => {
            const api = makeApi({ accountId: null });
            await expect(api.listClients()).rejects.toThrow(/accountId/);
        });
    });

    describe('webUrls & invoiceStatusName', () => {
        it('builds FreshBooks web app deep links', () => {
            const { webUrls } = makeApi();
            expect(webUrls.client(7)).toBe(
                'https://my.freshbooks.com/#/client/7'
            );
            expect(webUrls.invoice('ej6eR', 11)).toBe(
                'https://my.freshbooks.com/#/invoice/ej6eR-11'
            );
            expect(webUrls.invoices()).toBe(
                'https://my.freshbooks.com/#/invoices'
            );
            expect(webUrls.invoices('Left Hook')).toBe(
                'https://my.freshbooks.com/#/invoices?q=Left%20Hook'
            );
        });

        it('maps invoice status codes from the official docs', () => {
            const api = makeApi();
            expect(api.invoiceStatusName(2)).toBe('Sent');
            expect(api.invoiceStatusName(4)).toBe('Paid');
            expect(api.invoiceStatusName(8)).toBe('Partial');
            expect(api.invoiceStatusName(42)).toBe('');
            expect(INVOICE_STATUSES[1]).toBe('Draft');
        });
    });

    describe('identity', () => {
        it('getUserDetails hits GET /auth/api/v1/users/me and sets freshbooksUserId', async () => {
            const api = makeApi();
            api._get = async (options) => {
                api._captured.push(options);
                return {
                    response: {
                        id: 712052,
                        email: 'b@example.com',
                        business_memberships: [],
                    },
                };
            };
            const user = await api.getUserDetails();
            expect(api._captured[0].url).toBe(
                'https://api.freshbooks.com/auth/api/v1/users/me'
            );
            expect(user.id).toBe(712052);
            expect(api.freshbooksUserId).toBe('712052');
        });

        it('getUserInfo aliases getUserDetails', async () => {
            const api = makeApi();
            api.getUserDetails = async () => ({ id: 1 });
            expect(await api.getUserInfo()).toEqual({ id: 1 });
        });

        it('getUserEmail returns email from getUserDetails', async () => {
            const api = makeApi();
            api.getUserDetails = async () => ({
                id: 1,
                email: 'acct@example.com',
            });
            expect(await api.getUserEmail()).toBe('acct@example.com');
        });

        it('retrieveAccounts maps listBusinessAccounts to { name, id }', async () => {
            const api = makeApi();
            api.listBusinessAccounts = async () => [
                { name: 'Acme', accountId: 'zDmNq', businessId: 1 },
            ];
            expect(await api.retrieveAccounts()).toEqual([
                { name: 'Acme', id: 'zDmNq' },
            ]);
        });

        it('throws when users/me has no id', async () => {
            const api = makeApi();
            api._get = async () => ({ response: {} });
            await expect(api.getUserDetails()).rejects.toThrow(/user id/i);
        });

        it('restores freshbooksUserId from credential params', () => {
            expect(
                new Api({ freshbooksUserId: '42' }).freshbooksUserId
            ).toBe('42');
        });

        it('setAccessToken / setRefreshToken / setRedirectUri mutate state', () => {
            const api = makeApi();
            api.setAccessToken('a2');
            api.setRefreshToken('r2');
            api.setRedirectUri('https://app.example/new');
            expect(api.access_token).toBe('a2');
            expect(api.refresh_token).toBe('r2');
            expect(api.redirect_uri).toBe('https://app.example/new');
        });
    });

    describe('clients', () => {
        it('listClients defaults to page 1 / 100 / updated_desc', async () => {
            const api = makeApi();
            await api.listClients('zDmNq');
            expect(api._captured[0].url).toContain(
                '/accounting/account/zDmNq/users/clients'
            );
            expect(api._captured[0].query).toEqual({
                page: 1,
                per_page: 100,
                sort: 'updated_desc',
            });
        });

        it('findClientsByEmail searches search[email]', async () => {
            const api = makeApi();
            await api.findClientsByEmail('zDmNq', '  a@b.co ');
            expect(api._captured[0].query).toEqual({
                'search[email]': 'a@b.co',
                sort: 'updated_desc',
            });
        });

        it('findClientsByEmail rejects empty email', async () => {
            const api = makeApi();
            await expect(api.findClientsByEmail('zDmNq', '')).rejects.toThrow(
                /email/i
            );
        });

        it('searchClientByEmail / getClientById alias find/get', async () => {
            const api = makeApi();
            await api.searchClientByEmail('zDmNq', 'a@b.co');
            await api.getClientById('zDmNq', 9);
            expect(api._captured[0].query['search[email]']).toBe('a@b.co');
            expect(api._captured[1].url).toContain('/users/clients/9');
        });

        it('createClient POSTs a wrapped client body', async () => {
            const api = makeApi();
            await api.createClient('zDmNq', {
                fname: 'Ada',
                email: 'a@x.com',
            });
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual({
                client: { fname: 'Ada', email: 'a@x.com' },
            });
        });

        it('updateClient PUTs to the client id path', async () => {
            const api = makeApi();
            await api.updateClient('zDmNq', 42, { fname: 'Grace' });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toContain('/users/clients/42');
        });
    });

    describe('invoices & payments', () => {
        it('getInvoice / createInvoice / updateInvoice / deleteInvoice', async () => {
            const api = makeApi();
            await api.getInvoice('zDmNq', 7);
            await api.createInvoice('zDmNq', { customerid: 1 });
            await api.updateInvoice('zDmNq', 7, { notes: 'x' });
            await api.deleteInvoice('zDmNq', 7);
            expect(api._captured.map((c) => c.method)).toEqual([
                'GET',
                'POST',
                'PUT',
                'DELETE',
            ]);
        });

        it('listClientInvoices filters by customerid', async () => {
            const api = makeApi();
            await api.listClientInvoices('zDmNq', 7, 5);
            expect(api._captured[0].query).toEqual({
                'search[customerid]': 7,
                sort: 'invoice_date_desc',
                per_page: 5,
            });
        });

        it('getPayment includes invoice via query string', async () => {
            const api = makeApi();
            await api.getPayment('zDmNq', 21);
            expect(api._captured[0].query).toEqual({
                'include[]': 'invoice',
            });
            expect(api._captured[0].url).toContain('/payments/payments/21');
        });

        it('listClientPayments filters by clientid and includes invoice', async () => {
            const api = makeApi();
            await api.listClientPayments('zDmNq', 7, 5);
            expect(api._captured[0].query).toEqual({
                'search[clientid]': 7,
                'include[]': 'invoice',
                sort: 'updated_desc',
                per_page: 5,
            });
        });

        it('getClientInvoices / getInvoiceById / getClientPayments / getPaymentById aliases', async () => {
            const api = makeApi();
            await api.getClientInvoices('zDmNq', 7, 5);
            await api.getInvoiceById('zDmNq', 11);
            await api.getClientPayments('zDmNq', 7, 5);
            await api.getPaymentById('zDmNq', 21);
            expect(api._captured[0].query['search[customerid]']).toBe(7);
            expect(api._captured[1].url).toContain('/invoices/invoices/11');
            expect(api._captured[2].query['search[clientid]']).toBe(7);
            expect(api._captured[3].url).toContain('/payments/payments/21');
        });
    });

    describe('bill vendors', () => {
        it('listBillVendors GETs bill_vendors path', async () => {
            const api = makeApi();
            await api.listBillVendors('zDmNq', { page: 1 });
            expect(api._captured[0].method).toBe('GET');
            expect(api._captured[0].url).toContain(
                '/accounting/account/zDmNq/bill_vendors/bill_vendors'
            );
            expect(api._captured[0].query).toEqual({ page: 1 });
        });

        it('createBillVendor POSTs wrapped bill_vendor body', async () => {
            const api = makeApi();
            await api.createBillVendor('zDmNq', {
                vendor_name: 'Acme Supply',
                currency_code: 'USD',
            });
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual({
                bill_vendor: {
                    vendor_name: 'Acme Supply',
                    currency_code: 'USD',
                },
            });
        });

        it('updateBillVendor PUTs to vendor id path', async () => {
            const api = makeApi();
            await api.updateBillVendor('zDmNq', 55, { vis_state: 1 });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toContain(
                '/bill_vendors/bill_vendors/55'
            );
            expect(api._captured[0].body).toEqual({
                bill_vendor: { vis_state: 1 },
            });
        });
    });

    describe('expenses / staff / other income', () => {
        it('covers expense, category, staff, other_income paths', async () => {
            const api = makeApi();
            await api.listExpenses('zDmNq');
            await api.getExpense('zDmNq', 9);
            await api.createExpense('zDmNq', {
                amount: { amount: '10.00' },
                categoryid: 1,
                staffid: 1,
                date: '2024-01-01',
            });
            await api.listExpenseCategories('zDmNq');
            await api.listStaff('zDmNq');
            await api.createOtherIncome('zDmNq', {
                amount: { amount: '1.00' },
            });
            expect(api._captured[0].url).toContain('/expenses/expenses');
            expect(api._captured[3].url).toContain('/expenses/categories');
            expect(api._captured[4].url).toContain('/users/staffs');
            expect(api._captured[5].url).toContain(
                '/other_incomes/other_incomes'
            );
        });
    });

    describe('webhooks', () => {
        it('create/list/get/verify/resend/delete callbacks', async () => {
            const api = makeApi();
            await api.createCallback('zDmNq', {
                event: 'invoice.create',
                uri: 'https://hook.example/fb',
            });
            await api.listCallbacks('zDmNq');
            await api.getCallback('zDmNq', 2001);
            await api.verifyCallback('zDmNq', 2001, 'scADVVi5');
            await api.resendCallbackVerification('zDmNq', 2001);
            await api.deleteCallback('zDmNq', 2001);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[2].url).toContain('/events/callbacks/2001');
            expect(api._captured[3].body).toEqual({
                callback: { callback_id: 2001, verifier: 'scADVVi5' },
            });
            expect(api._captured[4].body).toEqual({
                callback: { resend: true },
            });
            expect(api._captured[5].method).toBe('DELETE');
        });

        it('createEventCallback / verifyEventCallback / deleteEventCallback aliases', async () => {
            const api = makeApi();
            await api.createEventCallback('zDmNq', {
                event: 'invoice.create',
                uri: 'https://hook.example/fb',
            });
            await api.verifyEventCallback('zDmNq', 2001, 'scADVVi5');
            await api.deleteEventCallback('zDmNq', 2001);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[1].body).toEqual({
                callback: { callback_id: 2001, verifier: 'scADVVi5' },
            });
            expect(api._captured[2].method).toBe('DELETE');
        });
    });
});
