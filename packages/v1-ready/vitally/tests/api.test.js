const { Api } = require('../api');

function makeApi(
    params = { api_key: 'ak-123', subdomain: 'acme' }
) {
    const api = new Api(params);
    api.sent = [];
    const record = (method) => async (options) => {
        api.sent.push({ method, ...options });
        return { ok: true };
    };
    api._get = record('GET');
    api._post = record('POST');
    api._put = record('PUT');
    api._delete = record('DELETE');
    return api;
}

describe('Vitally Api', () => {
    describe('auth', () => {
        it('maps api_key onto Basic auth username with empty password', () => {
            const api = new Api({ api_key: 'secret', subdomain: 'acme' });
            expect(api.api_key).toBe('secret');
            expect(api.username).toBe('secret');
            expect(api.password).toBe('');
        });

        it('builds the Base64(apiKey:) Basic header', async () => {
            const api = new Api({ api_key: 'secret', subdomain: 'acme' });
            const headers = await api.addAuthHeaders({});
            const expected =
                'Basic ' + Buffer.from('secret:').toString('base64');
            expect(headers['Authorization']).toBe(expected);
        });

        it('builds US base URL from subdomain', () => {
            const api = new Api({ api_key: 'ak', subdomain: 'acme' });
            expect(api.baseUrl).toBe(
                'https://acme.rest.vitally.io/resources'
            );
        });

        it('defaults to the OpenAPI example host when subdomain is absent', () => {
            const api = new Api({ api_key: 'ak' });
            expect(api.baseUrl).toBe(
                'https://yoursubdomain.rest.vitally.io/resources'
            );
        });

        it('honors a base_url override (EU)', () => {
            const api = new Api({
                api_key: 'ak',
                base_url: 'https://rest.vitally-eu.io/resources',
            });
            expect(api.baseUrl).toBe('https://rest.vitally-eu.io/resources');
        });
    });

    describe('accounts', () => {
        it('listAccounts GETs /accounts with pagination + status', async () => {
            const api = makeApi();
            await api.listAccounts({
                limit: 10,
                from: 'cursor',
                status: 'active',
            });
            const req = api.sent[0];
            expect(req.method).toBe('GET');
            expect(req.url).toBe(
                'https://acme.rest.vitally.io/resources/accounts'
            );
            expect(req.query).toEqual({
                limit: 10,
                from: 'cursor',
                status: 'active',
            });
        });

        it('getAccount GETs /accounts/{id}', async () => {
            const api = makeApi();
            await api.getAccount('acct-1');
            expect(api.sent[0].url).toBe(
                'https://acme.rest.vitally.io/resources/accounts/acct-1'
            );
        });

        it('getAccountHealthScores GETs /accounts/{id}/healthScores', async () => {
            const api = makeApi();
            await api.getAccountHealthScores('acct-1');
            expect(api.sent[0].url).toBe(
                'https://acme.rest.vitally.io/resources/accounts/acct-1/healthScores'
            );
        });

        it('createAccount POSTs /accounts', async () => {
            const api = makeApi();
            await api.createAccount({
                externalId: 'a-1',
                name: 'Acme',
            });
            expect(api.sent[0].method).toBe('POST');
            expect(api.sent[0].body).toEqual({
                externalId: 'a-1',
                name: 'Acme',
            });
        });

        it('updateAccount PUTs /accounts/{id}', async () => {
            const api = makeApi();
            await api.updateAccount('acct-1', { name: 'New' });
            expect(api.sent[0].method).toBe('PUT');
            expect(api.sent[0].url).toContain('/accounts/acct-1');
        });
    });

    describe('users', () => {
        it('listUsersForAccount GETs /accounts/{id}/users', async () => {
            const api = makeApi();
            await api.listUsersForAccount('acct-1', { limit: 5 });
            expect(api.sent[0].url).toBe(
                'https://acme.rest.vitally.io/resources/accounts/acct-1/users'
            );
            expect(api.sent[0].query).toEqual({ limit: 5 });
        });

        it('searchUsers GETs /users/search', async () => {
            const api = makeApi();
            await api.searchUsers({ email: 'a@b.com' });
            expect(api.sent[0].url).toContain('/users/search');
            expect(api.sent[0].query).toEqual({ email: 'a@b.com' });
        });
    });

    describe('tasks / notes / conversations / custom fields', () => {
        it('listTasks GETs /tasks with archived + source', async () => {
            const api = makeApi();
            await api.listTasks({ archived: false, source: 'hubspot' });
            expect(api.sent[0].url).toContain('/tasks');
            expect(api.sent[0].query).toEqual({
                archived: false,
                source: 'hubspot',
            });
        });

        it('listNotesForAccount GETs nested notes', async () => {
            const api = makeApi();
            await api.listNotesForAccount('acct-1');
            expect(api.sent[0].url).toBe(
                'https://acme.rest.vitally.io/resources/accounts/acct-1/notes'
            );
        });

        it('getConversation GETs /conversations/{id}', async () => {
            const api = makeApi();
            await api.getConversation('c-1');
            expect(api.sent[0].url).toBe(
                'https://acme.rest.vitally.io/resources/conversations/c-1'
            );
        });

        it('listCustomFields GETs /customFields?model=', async () => {
            const api = makeApi();
            await api.listCustomFields({ model: 'accounts' });
            expect(api.sent[0].url).toContain('/customFields');
            expect(api.sent[0].query).toEqual({ model: 'accounts' });
        });
    });

    describe('testAuth', () => {
        it('lists a single account page', async () => {
            const api = makeApi();
            await api.testAuth();
            expect(api.sent[0].url).toContain('/accounts');
            expect(api.sent[0].query).toEqual({ limit: 1 });
        });
    });
});
