const { Api } = require('../api');

// Fully offline: stub low-level HTTP methods and assert on request options.
function makeApi(overrides = {}) {
    const api = new Api({ api_token: 'test-token', ...overrides });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return [];
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { _id: 'new' };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { _id: 'upd' };
    };
    return api;
}

describe('Planhat Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and Bearer Authorization header', () => {
            const api = new Api({ api_token: 'abc' });
            expect(api.baseUrl).toBe('https://api.planhat.com');
            expect(api.api_key_name).toBe('Authorization');
            expect(api.api_token).toBe('abc');
            expect(api.api_key).toBe('Bearer abc');
        });

        it('accepts access_token / api_key aliases and strips Bearer prefix', () => {
            expect(new Api({ access_token: 'from-token' }).api_token).toBe(
                'from-token'
            );
            expect(new Api({ api_key: 'from-key' }).api_token).toBe('from-key');
            expect(new Api({ api_token: 'Bearer already' }).api_token).toBe(
                'already'
            );
            expect(new Api({ api_token: 'Bearer already' }).api_key).toBe(
                'Bearer already'
            );
        });

        it('adds the Authorization Bearer auth header', async () => {
            const api = new Api({ api_token: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
        });

        it('setApiToken updates raw token and header value', () => {
            const api = new Api({});
            api.setApiToken('Bearer new-tok');
            expect(api.api_token).toBe('new-tok');
            expect(api.api_key).toBe('Bearer new-tok');
        });

        it('exposes an apiKey authorization form', () => {
            const reqs = new Api({}).getAuthorizationRequirements();
            expect(reqs.type).toBe('apiKey');
            expect(reqs.data.jsonSchema.required).toContain('api_token');
        });
    });

    describe('companies', () => {
        it('listCompanies hits GET /companies with query', async () => {
            const api = makeApi();
            await api.listCompanies({ limit: 2, offset: 0, sort: 'name' });
            expect(api._captured[0].url).toBe(
                'https://api.planhat.com/companies'
            );
            expect(api._captured[0].query).toEqual({
                limit: 2,
                offset: 0,
                sort: 'name',
            });
        });

        it('getCompany hits GET /companies/{id}', async () => {
            const api = makeApi();
            await api.getCompany('c1');
            expect(api._captured[0].url).toBe(
                'https://api.planhat.com/companies/c1'
            );
        });

        it('listLeanCompanies hits GET /leancompanies', async () => {
            const api = makeApi();
            await api.listLeanCompanies({ status: 'customer' });
            expect(api._captured[0].url).toBe(
                'https://api.planhat.com/leancompanies'
            );
        });

        it('createCompany POSTs JSON body', async () => {
            const api = makeApi();
            const body = { name: 'Acme' };
            await api.createCompany(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual(body);
        });

        it('updateCompany PUTs to /companies/{id}', async () => {
            const api = makeApi();
            await api.updateCompany('c1', { name: 'New' });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toBe(
                'https://api.planhat.com/companies/c1'
            );
        });

        it('getCompanyHealth projects health fields from getCompany', async () => {
            const api = new Api({ api_token: 'k' });
            api.getCompany = async () => ({
                _id: 'c1',
                name: 'Acme',
                h: 7,
                hProfile: 'hp1',
                csmScore: 4,
                hDiff: -1,
                hDiffDate: '2026-01-01T00:00:00.000Z',
                orgHealthTotal: 12,
                lastUpdated: '2026-02-01T00:00:00.000Z',
                web: 'https://acme.example',
            });
            const health = await api.getCompanyHealth('c1');
            expect(health).toEqual({
                _id: 'c1',
                name: 'Acme',
                h: 7,
                hProfile: 'hp1',
                csmScore: 4,
                hDiff: -1,
                hDiffDate: '2026-01-01T00:00:00.000Z',
                orgHealthTotal: 12,
                lastUpdated: '2026-02-01T00:00:00.000Z',
            });
            expect(health.web).toBeUndefined();
        });
    });

    describe('endusers', () => {
        it('listEndusers / get / create / update hit the right paths', async () => {
            const api = makeApi();
            await api.listEndusers({ companyId: 'c1' });
            await api.getEnduser('e1');
            await api.createEnduser({ email: 'a@b.com', companyId: 'c1' });
            await api.updateEnduser('e1', { firstName: 'A' });
            expect(api._captured.map((c) => c.url)).toEqual([
                'https://api.planhat.com/endusers',
                'https://api.planhat.com/endusers/e1',
                'https://api.planhat.com/endusers',
                'https://api.planhat.com/endusers/e1',
            ]);
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[3].method).toBe('PUT');
        });
    });

    describe('tasks', () => {
        it('listTasks / get / create / update hit the right paths', async () => {
            const api = makeApi();
            await api.listTasks({ limit: 10 });
            await api.getTask('t1');
            await api.createTask({ companyId: 'c1', action: 'Call' });
            await api.updateTask('t1', { action: 'Done' });
            expect(api._captured[0].url).toBe('https://api.planhat.com/tasks');
            expect(api._captured[1].url).toBe(
                'https://api.planhat.com/tasks/t1'
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[3].method).toBe('PUT');
        });
    });

    describe('conversations', () => {
        it('listConversations / get / create / update hit the right paths', async () => {
            const api = makeApi();
            await api.listConversations({});
            await api.getConversation('cv1');
            await api.createConversation({ companyId: 'c1', type: 'note' });
            await api.updateConversation('cv1', { subject: 'x' });
            expect(api._captured[0].url).toBe(
                'https://api.planhat.com/conversations'
            );
            expect(api._captured[1].url).toBe(
                'https://api.planhat.com/conversations/cv1'
            );
        });
    });

    describe('custom fields & users', () => {
        it('listCustomFields / getCustomField', async () => {
            const api = makeApi();
            await api.listCustomFields({ limit: 5 });
            await api.getCustomField('cf1');
            expect(api._captured[0].url).toBe(
                'https://api.planhat.com/customfields'
            );
            expect(api._captured[1].url).toBe(
                'https://api.planhat.com/customfields/cf1'
            );
        });

        it('listUsers / getUser', async () => {
            const api = makeApi();
            await api.listUsers({ limit: 1 });
            await api.getUser('u1');
            expect(api._captured[0].url).toBe('https://api.planhat.com/users');
            expect(api._captured[1].url).toBe(
                'https://api.planhat.com/users/u1'
            );
        });
    });
});
