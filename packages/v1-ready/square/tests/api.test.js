const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'sq0idp-test',
        client_secret: 'secret',
        redirect_uri: 'https://example.com/redirect/square',
        access_token: 'tok',
        refresh_token: 'ref',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return {};
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { access_token: 'new', refresh_token: 'ref', merchant_id: 'ML1' };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return {};
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Square Api', () => {
    describe('construction & auth', () => {
        it('defaults baseUrl to connect.squareup.com', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
            });
            expect(api.baseUrl).toBe('https://connect.squareup.com');
            expect(api.tokenUri).toBe(
                'https://connect.squareup.com/oauth2/token'
            );
            expect(api.squareVersion).toBe('2026-09-16');
        });

        it('builds an authorize URL with client_id, scope, and redirect_uri', () => {
            const api = new Api({
                client_id: 'sq0idp-abc',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r/square',
                scope: 'CUSTOMERS_READ PAYMENTS_READ',
                state: 'xyz',
            });
            const uri = api.getAuthUri();
            expect(uri).toContain(
                'https://connect.squareup.com/oauth2/authorize?'
            );
            expect(uri).toContain('client_id=sq0idp-abc');
            expect(uri).toContain('response_type=code');
            expect(uri).toContain('scope=CUSTOMERS_READ+PAYMENTS_READ');
            expect(uri).toContain(
                'redirect_uri=https%3A%2F%2Fex.com%2Fr%2Fsquare'
            );
            expect(uri).toContain('state=xyz');
        });

        it('adds Bearer and Square-Version headers', async () => {
            const api = new Api({
                access_token: 'tok-1',
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer tok-1');
            expect(headers['Square-Version']).toBe('2026-09-16');
        });

        it('exchanges a code via JSON ObtainToken body', async () => {
            const api = makeApi();
            await api.getTokenFromCode('auth-code');
            const call = api._captured[0];
            expect(call.method).toBe('POST');
            expect(call.url).toBe(
                'https://connect.squareup.com/oauth2/token'
            );
            expect(call.body).toEqual({
                client_id: 'sq0idp-test',
                client_secret: 'secret',
                code: 'auth-code',
                grant_type: 'authorization_code',
                redirect_uri: 'https://example.com/redirect/square',
            });
            expect(call.headers['Content-Type']).toBe('application/json');
        });

        it('refreshes via JSON ObtainToken with grant_type refresh_token', async () => {
            const api = makeApi();
            await api.refreshAccessToken({ refresh_token: 'ref-1' });
            const call = api._captured[0];
            expect(call.body.grant_type).toBe('refresh_token');
            expect(call.body.refresh_token).toBe('ref-1');
            expect(call.headers['Content-Type']).toBe('application/json');
        });

        it('parses expires_at from the token response', async () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
            });
            api.notify = async () => {};
            await api.setTokens({
                access_token: 'a',
                refresh_token: 'r',
                expires_at: '2030-01-01T00:00:00Z',
                merchant_id: 'ML99',
            });
            expect(api.access_token).toBe('a');
            expect(api.refresh_token).toBe('r');
            expect(api.merchant_id).toBe('ML99');
            expect(api.accessTokenExpire.toISOString()).toBe(
                '2030-01-01T00:00:00.000Z'
            );
        });
    });

    describe('merchants & locations', () => {
        it('listMerchants hits GET /v2/merchants', async () => {
            const api = makeApi();
            await api.listMerchants({ cursor: 1 });
            expect(api._captured[0].url).toBe(
                'https://connect.squareup.com/v2/merchants'
            );
            expect(api._captured[0].params).toEqual({ cursor: 1 });
        });

        it('retrieveMerchant hits /v2/merchants/{id}', async () => {
            const api = makeApi();
            await api.retrieveMerchant('me');
            expect(api._captured[0].url).toBe(
                'https://connect.squareup.com/v2/merchants/me'
            );
        });

        it('listLocations / createLocation / retrieveLocation / updateLocation', async () => {
            const api = makeApi();
            await api.listLocations();
            await api.createLocation({ location: { name: 'HQ' } });
            await api.retrieveLocation('L1');
            await api.updateLocation('L1', { location: { name: 'HQ2' } });
            expect(api._captured.map((c) => c.method)).toEqual([
                'GET',
                'POST',
                'GET',
                'PUT',
            ]);
            expect(api._captured[0].url).toBe(
                'https://connect.squareup.com/v2/locations'
            );
            expect(api._captured[2].url).toBe(
                'https://connect.squareup.com/v2/locations/L1'
            );
        });
    });

    describe('customers', () => {
        it('list / retrieve / create / update customers', async () => {
            const api = makeApi();
            await api.listCustomers({ limit: 10 });
            await api.retrieveCustomer('C1');
            await api.createCustomer({
                given_name: 'Ada',
                email_address: 'ada@ex.com',
            });
            await api.updateCustomer('C1', { given_name: 'Ada' });
            expect(api._captured[0].url).toBe(
                'https://connect.squareup.com/v2/customers'
            );
            expect(api._captured[1].url).toBe(
                'https://connect.squareup.com/v2/customers/C1'
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[3].method).toBe('PUT');
        });
    });

    describe('payments', () => {
        it('list / get / create / update payments', async () => {
            const api = makeApi();
            await api.listPayments({ location_id: 'L1' });
            await api.getPayment('P1');
            await api.createPayment({
                source_id: 'cnon:card',
                idempotency_key: 'k1',
                amount_money: { amount: 100, currency: 'USD' },
            });
            await api.updatePayment('P1', {
                idempotency_key: 'k2',
                payment: {},
            });
            expect(api._captured[1].url).toBe(
                'https://connect.squareup.com/v2/payments/P1'
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[3].method).toBe('PUT');
        });
    });

    describe('invoices', () => {
        it('list / get / create / update invoices', async () => {
            const api = makeApi();
            await api.listInvoices({ location_id: 'L1' });
            await api.getInvoice('I1');
            await api.createInvoice({
                invoice: { location_id: 'L1', order_id: 'O1' },
            });
            await api.updateInvoice('I1', {
                invoice: { version: 1, title: 't' },
            });
            expect(api._captured[0].params).toEqual({ location_id: 'L1' });
            expect(api._captured[1].url).toBe(
                'https://connect.squareup.com/v2/invoices/I1'
            );
        });
    });

    describe('webhook subscriptions', () => {
        it('list / retrieve / create / update / delete subscriptions', async () => {
            const api = makeApi();
            await api.listWebhookSubscriptions();
            await api.retrieveWebhookSubscription('WH1');
            await api.createWebhookSubscription({
                subscription: {
                    name: 'n',
                    event_types: ['payment.created'],
                    notification_url: 'https://hook.example.com',
                },
            });
            await api.updateWebhookSubscription('WH1', {
                subscription: { enabled: false },
            });
            await api.deleteWebhookSubscription('WH1');
            expect(api._captured.map((c) => c.method)).toEqual([
                'GET',
                'GET',
                'POST',
                'PUT',
                'DELETE',
            ]);
            expect(api._captured[0].url).toBe(
                'https://connect.squareup.com/v2/webhooks/subscriptions'
            );
            expect(api._captured[4].url).toBe(
                'https://connect.squareup.com/v2/webhooks/subscriptions/WH1'
            );
        });
    });
});
