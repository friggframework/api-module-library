const crypto = require('crypto');
const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'test-token',
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://example.com/redirect/salesloft',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { data: {} };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { data: { id: 1 } };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { data: { id: 1 } };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Salesloft Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and OAuth endpoints', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/redirect/salesloft',
            });
            expect(api.baseUrl).toBe('https://api.salesloft.com/v2');
            expect(api.tokenUri).toBe(
                'https://accounts.salesloft.com/oauth/token'
            );
            expect(api.authorizationUri).toContain(
                'https://accounts.salesloft.com/oauth/authorize'
            );
            expect(api.authorizationUri).toContain('client_id=cid');
            expect(api.authorizationUri).toContain('response_type=code');
        });

        it('stores access and refresh tokens', () => {
            const api = new Api({
                access_token: 'at',
                refresh_token: 'rt',
            });
            expect(api.access_token).toBe('at');
            expect(api.refresh_token).toBe('rt');
        });
    });

    describe('identity', () => {
        it('getMe hits GET /me', async () => {
            const api = makeApi();
            await api.getMe();
            expect(api._captured[0].url).toBe(
                'https://api.salesloft.com/v2/me'
            );
        });

        it('getTeam hits GET /team', async () => {
            const api = makeApi();
            await api.getTeam();
            expect(api._captured[0].url).toBe(
                'https://api.salesloft.com/v2/team'
            );
        });
    });

    describe('people', () => {
        it('listPeople hits GET /people with query', async () => {
            const api = makeApi();
            await api.listPeople({ page: 2, per_page: 50 });
            expect(api._captured[0].url).toBe(
                'https://api.salesloft.com/v2/people'
            );
            expect(api._captured[0].query).toEqual({
                page: 2,
                per_page: 50,
            });
        });

        it('getPerson hits GET /people/{id}', async () => {
            const api = makeApi();
            await api.getPerson(42);
            expect(api._captured[0].url).toBe(
                'https://api.salesloft.com/v2/people/42'
            );
        });

        it('createPerson POSTs JSON body', async () => {
            const api = makeApi();
            const person = {
                email_address: 'a@b.com',
                first_name: 'A',
                last_name: 'B',
            };
            await api.createPerson(person);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual(person);
        });

        it('updatePerson PUTs to /people/{id}', async () => {
            const api = makeApi();
            await api.updatePerson(9, { first_name: 'Z' });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toBe(
                'https://api.salesloft.com/v2/people/9'
            );
        });

        it('deletePerson DELETEs /people/{id}', async () => {
            const api = makeApi();
            await api.deletePerson(9);
            expect(api._captured[0].method).toBe('DELETE');
            expect(api._captured[0].url).toBe(
                'https://api.salesloft.com/v2/people/9'
            );
        });
    });

    describe('accounts', () => {
        it('listAccounts / createAccount / getAccount / updateAccount / deleteAccount', async () => {
            const api = makeApi();
            await api.listAccounts({ domain: 'acme.com' });
            await api.createAccount({ name: 'Acme', domain: 'acme.com' });
            await api.getAccount(7);
            await api.updateAccount(7, { name: 'Acme Inc' });
            await api.deleteAccount(7);
            expect(api._captured.map((c) => c.method)).toEqual([
                'GET',
                'POST',
                'GET',
                'PUT',
                'DELETE',
            ]);
            expect(api._captured[2].url).toBe(
                'https://api.salesloft.com/v2/accounts/7'
            );
        });
    });

    describe('users & tasks', () => {
        it('listUsers and getUser', async () => {
            const api = makeApi();
            await api.listUsers();
            await api.getUser('guid-1');
            expect(api._captured[0].url).toBe(
                'https://api.salesloft.com/v2/users'
            );
            expect(api._captured[1].url).toBe(
                'https://api.salesloft.com/v2/users/guid-1'
            );
        });

        it('task CRUD paths', async () => {
            const api = makeApi();
            await api.listTasks();
            await api.createTask({ subject: 'Call', person_id: 1 });
            await api.getTask(3);
            await api.updateTask(3, { subject: 'Email' });
            await api.deleteTask(3);
            expect(api._captured[2].url).toBe(
                'https://api.salesloft.com/v2/tasks/3'
            );
        });
    });

    describe('webhook subscriptions', () => {
        it('CRUD webhook_subscriptions', async () => {
            const api = makeApi();
            const body = {
                event_type: 'person_created',
                callback_url: 'https://hook.example/sl',
                callback_token: 'tok',
            };
            await api.listWebhookSubscriptions({ enabled: true });
            await api.createWebhookSubscription(body);
            await api.getWebhookSubscription(11);
            await api.updateWebhookSubscription(11, { enabled: false });
            await api.deleteWebhookSubscription(11);
            expect(api._captured[1].url).toBe(
                'https://api.salesloft.com/v2/webhook_subscriptions'
            );
            expect(api._captured[1].body).toEqual(body);
            expect(api._captured[4].method).toBe('DELETE');
        });
    });

    describe('verifyWebhookSignature', () => {
        it('accepts a valid HMAC-SHA1 hex signature', () => {
            const api = new Api({});
            const body = '{"id":1}';
            const token = 'secret-token';
            const signature = crypto
                .createHmac('sha1', token)
                .update(body, 'utf8')
                .digest('hex');
            expect(
                api.verifyWebhookSignature({
                    body,
                    signature,
                    callbackToken: token,
                })
            ).toEqual({ valid: true });
        });

        it('rejects a mismatched signature', () => {
            const api = new Api({});
            const result = api.verifyWebhookSignature({
                body: '{}',
                signature: 'deadbeef',
                callbackToken: 'tok',
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('signature mismatch');
        });
    });
});
