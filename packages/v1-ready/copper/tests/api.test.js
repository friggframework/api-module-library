const { Api, DEFAULT_BASE_URL, APPLICATION_HEADER_VALUE } = require('../api');

// Fully offline: stub low-level HTTP methods and assert on the request options
// the API methods construct. No network is touched.
function makeApi(overrides = {}) {
    const api = new Api({
        api_key: 'test-key',
        user_email: 'owner@example.com',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { id: 1 };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 2 };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { id: 3 };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return { id: 4 };
    };
    return api;
}

describe('Copper Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and X-PW-AccessToken header name', () => {
            const api = new Api({
                api_key: 'abc',
                user_email: 'a@b.com',
            });
            expect(api.baseUrl).toBe(DEFAULT_BASE_URL);
            expect(api.baseUrl).toBe(
                'https://api.copper.com/developer_api/v1'
            );
            expect(api.api_key_name).toBe('X-PW-AccessToken');
            expect(api.api_key).toBe('abc');
            expect(api.user_email).toBe('a@b.com');
        });

        it('accepts access_token as an alias for api_key', () => {
            const api = new Api({ access_token: 'from-token' });
            expect(api.api_key).toBe('from-token');
        });

        it('adds the three Copper auth headers', async () => {
            const api = new Api({
                api_key: 'secret',
                user_email: 'owner@example.com',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers['X-PW-AccessToken']).toBe('secret');
            expect(headers['X-PW-Application']).toBe(APPLICATION_HEADER_VALUE);
            expect(headers['X-PW-Application']).toBe('developer_api');
            expect(headers['X-PW-UserEmail']).toBe('owner@example.com');
            expect(headers['Content-Type']).toBe('application/json');
        });

        it('reports authenticated only with a non-empty key', () => {
            expect(new Api({ api_key: 'x' }).isAuthenticated()).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('getAccount', () => {
        it('hits GET /account', async () => {
            const api = makeApi();
            await api.getAccount();
            expect(api._captured[0].url).toBe(
                'https://api.copper.com/developer_api/v1/account'
            );
        });
    });

    describe('people', () => {
        it('listPeople POSTs to /people/search with the body', async () => {
            const api = makeApi();
            const body = { page_size: 25, name: 'Ada' };
            await api.listPeople(body);
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.copper.com/developer_api/v1/people/search'
            );
            expect(captured.body).toEqual(body);
        });

        it('getPerson hits GET /people/{id}', async () => {
            const api = makeApi();
            await api.getPerson(99);
            expect(api._captured[0].url).toBe(
                'https://api.copper.com/developer_api/v1/people/99'
            );
        });

        it('createPerson POSTs to /people', async () => {
            const api = makeApi();
            const body = { name: 'My Contact' };
            await api.createPerson(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://api.copper.com/developer_api/v1/people'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('updatePerson PUTs to /people/{id}', async () => {
            const api = makeApi();
            await api.updatePerson(5, { details: 'upd' });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toBe(
                'https://api.copper.com/developer_api/v1/people/5'
            );
            expect(api._captured[0].body).toEqual({ details: 'upd' });
        });
    });

    describe('companies', () => {
        it('listCompanies POSTs to /companies/search', async () => {
            const api = makeApi();
            await api.listCompanies({ page_size: 10 });
            expect(api._captured[0].url).toBe(
                'https://api.copper.com/developer_api/v1/companies/search'
            );
        });

        it('getCompany / createCompany / updateCompany hit the right paths', async () => {
            const api = makeApi();
            await api.getCompany(1);
            await api.createCompany({ name: 'Acme' });
            await api.updateCompany(1, { details: 'x' });
            expect(api._captured[0].url).toBe(
                'https://api.copper.com/developer_api/v1/companies/1'
            );
            expect(api._captured[1].url).toBe(
                'https://api.copper.com/developer_api/v1/companies'
            );
            expect(api._captured[2].method).toBe('PUT');
            expect(api._captured[2].url).toBe(
                'https://api.copper.com/developer_api/v1/companies/1'
            );
        });
    });

    describe('opportunities', () => {
        it('CRUD paths match the official docs', async () => {
            const api = makeApi();
            await api.listOpportunities({});
            await api.getOpportunity(7);
            await api.createOpportunity({ name: 'Deal' });
            await api.updateOpportunity(7, { details: 'y' });
            expect(api._captured[0].url).toContain('/opportunities/search');
            expect(api._captured[1].url).toContain('/opportunities/7');
            expect(api._captured[2].url).toMatch(/\/opportunities$/);
            expect(api._captured[3].method).toBe('PUT');
        });
    });

    describe('leads', () => {
        it('CRUD paths match the official docs', async () => {
            const api = makeApi();
            await api.listLeads({});
            await api.getLead(3);
            await api.createLead({ name: 'Lead' });
            await api.updateLead(3, { details: 'z' });
            expect(api._captured[0].url).toContain('/leads/search');
            expect(api._captured[1].url).toContain('/leads/3');
            expect(api._captured[2].url).toMatch(/\/leads$/);
            expect(api._captured[3].method).toBe('PUT');
        });
    });

    describe('webhooks', () => {
        it('listWebhooks hits GET /webhooks', async () => {
            const api = makeApi();
            await api.listWebhooks();
            expect(api._captured[0].method).toBe('GET');
            expect(api._captured[0].url).toBe(
                'https://api.copper.com/developer_api/v1/webhooks'
            );
        });

        it('createWebhook POSTs the subscription body', async () => {
            const api = makeApi();
            const body = {
                target: 'https://hook.example.com',
                type: 'person',
                event: 'update',
            };
            await api.createWebhook(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual(body);
        });

        it('updateWebhook / deleteWebhook use /webhooks/{id}', async () => {
            const api = makeApi();
            await api.updateWebhook(17065, {
                target: 'https://hook.example.com/v2',
            });
            await api.deleteWebhook(17065);
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toBe(
                'https://api.copper.com/developer_api/v1/webhooks/17065'
            );
            expect(api._captured[1].method).toBe('DELETE');
            expect(api._captured[1].url).toBe(
                'https://api.copper.com/developer_api/v1/webhooks/17065'
            );
        });
    });
});
