const { Api, DEFAULT_DOMAIN, DUMMY_PASSWORD } = require('../api');

function makeApi(params = { domain: 'acme', api_key: 'test-key' }) {
    const api = new Api(params);
    api.sent = [];
    const record = (method) => async (options) => {
        api.sent.push({ method, ...options });
        return { ok: true };
    };
    api._get = record('GET');
    api._post = record('POST');
    api._put = record('PUT');
    api._patch = record('PATCH');
    api._delete = record('DELETE');
    return api;
}

describe('Freshdesk Api', () => {
    describe('construction & auth', () => {
        it('defaults to the placeholder domain base URL', () => {
            const api = new Api({ api_key: 'k' });
            expect(api.domain).toBe(DEFAULT_DOMAIN);
            expect(api.baseUrl).toBe('https://domain.freshdesk.com/api/v2');
        });

        it('builds baseUrl from domain and maps api_key onto Basic auth', () => {
            const api = new Api({ domain: 'acme', api_key: 'secret' });
            expect(api.baseUrl).toBe('https://acme.freshdesk.com/api/v2');
            expect(api.username).toBe('secret');
            expect(api.password).toBe(DUMMY_PASSWORD);
            expect(api.api_key).toBe('secret');
        });

        it('normalizes full hostnames to a subdomain', () => {
            const api = new Api({
                domain: 'https://Acme.freshdesk.com/',
                api_key: 'k',
            });
            expect(api.domain).toBe('acme');
            expect(api.baseUrl).toBe('https://acme.freshdesk.com/api/v2');
        });

        it('honors a base_url override', () => {
            const api = new Api({
                api_key: 'k',
                base_url: 'https://custom.example.com/api/v2',
            });
            expect(api.baseUrl).toBe('https://custom.example.com/api/v2');
        });

        it('builds Authorization: Basic base64(api_key:X)', async () => {
            const api = new Api({ domain: 'acme', api_key: 'secret' });
            const headers = await api.addAuthHeaders({});
            const expected =
                'Basic ' + Buffer.from('secret:X').toString('base64');
            expect(headers.Authorization).toBe(expected);
        });

        it('accepts access_token as an alias for api_key', () => {
            const api = new Api({ domain: 'acme', access_token: 'from-token' });
            expect(api.api_key).toBe('from-token');
            expect(api.username).toBe('from-token');
        });

        it('setDomain / setApiKey update auth and base URL', () => {
            const api = new Api({});
            api.setDomain('other');
            api.setApiKey('new-key');
            expect(api.baseUrl).toBe('https://other.freshdesk.com/api/v2');
            expect(api.username).toBe('new-key');
            expect(api.password).toBe('X');
        });
    });

    describe('account & agents', () => {
        it('getAccount GETs /account', async () => {
            const api = makeApi();
            await api.getAccount();
            expect(api.sent[0]).toMatchObject({
                method: 'GET',
                url: 'https://acme.freshdesk.com/api/v2/account',
            });
        });

        it('getAuthenticatedAgent GETs /agents/me', async () => {
            const api = makeApi();
            await api.getAuthenticatedAgent();
            expect(api.sent[0].url).toBe(
                'https://acme.freshdesk.com/api/v2/agents/me'
            );
        });

        it('listAgents GETs /agents with query', async () => {
            const api = makeApi();
            await api.listAgents({ email: 'a@b.com', state: 'fulltime' });
            expect(api.sent[0].url).toBe(
                'https://acme.freshdesk.com/api/v2/agents'
            );
            expect(api.sent[0].query).toEqual({
                email: 'a@b.com',
                state: 'fulltime',
            });
        });

        it('getAgent GETs /agents/{id}', async () => {
            const api = makeApi();
            await api.getAgent(432);
            expect(api.sent[0].url).toBe(
                'https://acme.freshdesk.com/api/v2/agents/432'
            );
        });
    });

    describe('tickets', () => {
        it('listTickets GETs /tickets with filters', async () => {
            const api = makeApi();
            await api.listTickets({
                filter: 'new_and_my_open',
                updated_since: '2026-01-01T00:00:00Z',
            });
            expect(api.sent[0].method).toBe('GET');
            expect(api.sent[0].url).toBe(
                'https://acme.freshdesk.com/api/v2/tickets'
            );
            expect(api.sent[0].query.filter).toBe('new_and_my_open');
        });

        it('getTicket GETs /tickets/{id}', async () => {
            const api = makeApi();
            await api.getTicket(20, { include: 'requester' });
            expect(api.sent[0].url).toBe(
                'https://acme.freshdesk.com/api/v2/tickets/20'
            );
            expect(api.sent[0].query).toEqual({ include: 'requester' });
        });

        it('createTicket POSTs JSON to /tickets', async () => {
            const api = makeApi();
            const body = {
                subject: 'Help',
                description: 'Details',
                email: 'tom@outerspace.com',
                priority: 1,
                status: 2,
            };
            await api.createTicket(body);
            const req = api.sent[0];
            expect(req.method).toBe('POST');
            expect(req.url).toBe('https://acme.freshdesk.com/api/v2/tickets');
            expect(req.body).toEqual(body);
            expect(req.headers['Content-Type']).toBe('application/json');
        });

        it('updateTicket PUTs JSON to /tickets/{id}', async () => {
            const api = makeApi();
            await api.updateTicket(1, { priority: 2, status: 3 });
            const req = api.sent[0];
            expect(req.method).toBe('PUT');
            expect(req.url).toBe('https://acme.freshdesk.com/api/v2/tickets/1');
            expect(req.body).toEqual({ priority: 2, status: 3 });
        });
    });

    describe('contacts', () => {
        it('listContacts / getContact / createContact / updateContact', async () => {
            const api = makeApi();
            await api.listContacts({ email: 'a@b.com' });
            await api.getContact(10);
            await api.createContact({ name: 'Ada', email: 'ada@ex.com' });
            await api.updateContact(10, { phone: '555' });

            expect(api.sent[0].url).toBe(
                'https://acme.freshdesk.com/api/v2/contacts'
            );
            expect(api.sent[1].url).toBe(
                'https://acme.freshdesk.com/api/v2/contacts/10'
            );
            expect(api.sent[2].method).toBe('POST');
            expect(api.sent[3].method).toBe('PUT');
            expect(api.sent[3].url).toBe(
                'https://acme.freshdesk.com/api/v2/contacts/10'
            );
        });
    });

    describe('companies', () => {
        it('listCompanies / getCompany / createCompany / updateCompany', async () => {
            const api = makeApi();
            await api.listCompanies({ page: 1 });
            await api.getCompany(8);
            await api.createCompany({ name: 'SuperNova' });
            await api.updateCompany(8, { name: 'Super Nova' });

            expect(api.sent[0].url).toBe(
                'https://acme.freshdesk.com/api/v2/companies'
            );
            expect(api.sent[1].url).toBe(
                'https://acme.freshdesk.com/api/v2/companies/8'
            );
            expect(api.sent[2].method).toBe('POST');
            expect(api.sent[3].method).toBe('PUT');
        });
    });

    describe('testAuth', () => {
        it('delegates to getAccount', async () => {
            const api = makeApi();
            await api.testAuth();
            expect(api.sent[0].url).toBe(
                'https://acme.freshdesk.com/api/v2/account'
            );
        });
    });
});
