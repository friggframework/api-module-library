const { Api } = require('../api');

function makeApi(
    params = {
        username: 'api.user',
        password: 'secret',
        client_code: 'Acme',
    }
) {
    const api = new Api(params);
    api.sent = [];
    const record = (method) => async (options) => {
        api.sent.push({ method, ...options });
        return { ok: true };
    };
    api._get = record('GET');
    api._post = record('POST');
    api._patch = record('PATCH');
    api._delete = record('DELETE');
    return api;
}

describe('Rev.io Api', () => {
    describe('auth', () => {
        it('defaults to the documented restapi.rev.io/v1 base URL', () => {
            const api = new Api({
                username: 'u',
                password: 'p',
                client_code: 'c',
            });
            expect(api.baseUrl).toBe('https://restapi.rev.io/v1');
        });

        it('honors a base_url override', () => {
            const api = new Api({
                username: 'u',
                password: 'p',
                client_code: 'c',
                base_url: 'https://api.revioapi.com/v1',
            });
            expect(api.baseUrl).toBe('https://api.revioapi.com/v1');
        });

        it('builds Base64(username@client_code:password) Basic header', async () => {
            const api = new Api({
                username: 'user123',
                password: 'mypassword',
                client_code: 'testclient',
            });
            const headers = await api.addAuthHeaders({});
            const expected =
                'Basic ' +
                Buffer.from('user123@testclient:mypassword').toString('base64');
            expect(headers.Authorization).toBe(expected);
        });

        it('omits Authorization when credentials are incomplete', async () => {
            const api = new Api({ username: 'u', password: 'p' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBeUndefined();
        });

        it('exposes a basic auth form with username, password, client_code', () => {
            const api = new Api({});
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('basic');
            expect(reqs.data.jsonSchema.required).toEqual([
                'username',
                'password',
                'client_code',
            ]);
        });
    });

    describe('customers', () => {
        it('listCustomers GETs /Customers with query', async () => {
            const api = makeApi();
            await api.listCustomers({ 'search.page': 1 });
            expect(api.sent[0]).toMatchObject({
                method: 'GET',
                url: 'https://restapi.rev.io/v1/Customers',
                query: { 'search.page': 1 },
            });
        });

        it('getCustomer GETs /Customers/{id}', async () => {
            const api = makeApi();
            await api.getCustomer(1029);
            expect(api.sent[0].url).toBe(
                'https://restapi.rev.io/v1/Customers/1029'
            );
        });

        it('createCustomer POSTs JSON body', async () => {
            const api = makeApi();
            const body = { finance: { bill_profile_id: 1001 } };
            await api.createCustomer(body);
            expect(api.sent[0]).toMatchObject({
                method: 'POST',
                url: 'https://restapi.rev.io/v1/Customers',
                body,
            });
            expect(api.sent[0].headers['Content-Type']).toBe(
                'application/json'
            );
        });

        it('updateCustomer PATCHes JSON Patch ops', async () => {
            const api = makeApi();
            await api.updateCustomer(1, { email: 'a@b.com' });
            expect(api.sent[0].method).toBe('PATCH');
            expect(api.sent[0].headers['Content-Type']).toBe(
                'application/json-patch+json'
            );
            expect(api.sent[0].body).toEqual([
                { op: 'replace', path: '/email', value: 'a@b.com' },
            ]);
        });
    });

    describe('contacts', () => {
        it('createContact / getContact / deleteContact hit the right paths', async () => {
            const api = makeApi();
            await api.createContact({ name: 'Ada', customer_id: 1 });
            await api.getContact(9);
            await api.deleteContact(9);
            expect(api.sent[0].url).toBe('https://restapi.rev.io/v1/Contacts');
            expect(api.sent[1].url).toBe(
                'https://restapi.rev.io/v1/Contacts/9'
            );
            expect(api.sent[2].method).toBe('DELETE');
        });

        it('updateContact nests JSON Patch paths', async () => {
            const api = makeApi();
            await api.updateContact(3, { address: { city: 'Orlando' } });
            expect(api.sent[0].body).toEqual([
                { op: 'replace', path: '/address/city', value: 'Orlando' },
            ]);
        });
    });

    describe('bills, payments, charges, bill profiles', () => {
        it('list/get helpers hit documented paths', async () => {
            const api = makeApi();
            await api.listBillProfiles();
            await api.getBillProfile(1001);
            await api.listBills();
            await api.getBill(5);
            await api.listPayments();
            await api.getPayment(6);
            await api.createPayment({ customer_id: 1, amount: 10 });
            await api.listCharges();
            await api.getCharge(7);
            const urls = api.sent.map((s) => s.url);
            expect(urls).toEqual([
                'https://restapi.rev.io/v1/BillProfiles',
                'https://restapi.rev.io/v1/BillProfiles/1001',
                'https://restapi.rev.io/v1/Bills',
                'https://restapi.rev.io/v1/Bills/5',
                'https://restapi.rev.io/v1/Payments',
                'https://restapi.rev.io/v1/Payments/6',
                'https://restapi.rev.io/v1/Payments',
                'https://restapi.rev.io/v1/Charges',
                'https://restapi.rev.io/v1/Charges/7',
            ]);
        });
    });

    describe('webhooks', () => {
        it('createWebhookReceiver POSTs url/description', async () => {
            const api = makeApi();
            const body = {
                url: 'https://hook.example.com/revio',
                description: 'Frigg',
            };
            await api.createWebhookReceiver(body);
            expect(api.sent[0]).toMatchObject({
                method: 'POST',
                url: 'https://restapi.rev.io/v1/WebhookReceivers',
                body,
            });
        });

        it('activateWebhookReceiver sends X-Hook-Secret', async () => {
            const api = makeApi();
            await api.activateWebhookReceiver(12, 'confirm-code');
            expect(api.sent[0]).toMatchObject({
                method: 'POST',
                url: 'https://restapi.rev.io/v1/WebhookReceivers/12/activate',
            });
            expect(api.sent[0].headers['X-Hook-Secret']).toBe('confirm-code');
        });

        it('createWebhookSubscription POSTs receiver + event_type', async () => {
            const api = makeApi();
            await api.createWebhookSubscription({
                webhook_receiver_id: 12,
                event_type: 'CUSTOMER_CREATED',
            });
            expect(api.sent[0].body).toEqual({
                webhook_receiver_id: 12,
                event_type: 'CUSTOMER_CREATED',
            });
        });

        it('delete helpers hit receiver and subscription paths', async () => {
            const api = makeApi();
            await api.deleteWebhookReceiver(1);
            await api.deleteWebhookSubscription(2);
            expect(api.sent[0].method).toBe('DELETE');
            expect(api.sent[0].url).toBe(
                'https://restapi.rev.io/v1/WebhookReceivers/1'
            );
            expect(api.sent[1].url).toBe(
                'https://restapi.rev.io/v1/WebhookSubscriptions/2'
            );
        });
    });

    describe('testAuth', () => {
        it('lists a single page of bill profiles', async () => {
            const api = makeApi();
            await api.testAuth();
            expect(api.sent[0].url).toBe(
                'https://restapi.rev.io/v1/BillProfiles'
            );
            expect(api.sent[0].query).toEqual({
                'search.page_size': 1,
                'search.page': 1,
            });
        });
    });
});
