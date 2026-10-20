const crypto = require('crypto');
const { Api, JSON_API_CONTENT_TYPE, SIGNATURE_HEADER } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'test-token',
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://app.example.com/redirect/outreach',
        scope: 'accounts.read prospects.read tasks.all users.read webhooks.all',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { data: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { data: { id: 1, type: 'webhook' } };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return { data: { id: 1 } };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Outreach Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL to api.outreach.io/api/v2', () => {
            const api = new Api({ access_token: 't' });
            expect(api.baseUrl).toBe('https://api.outreach.io/api/v2');
        });

        it('builds an OAuth authorize URL with client_id, redirect_uri, scope', () => {
            const api = new Api({
                client_id: 'app-id',
                redirect_uri: 'https://app.example.com/redirect/outreach',
                scope: 'prospects.read accounts.read',
            });
            const uri = api.getAuthorizationUri();
            expect(uri).toContain('https://api.outreach.io/oauth/authorize?');
            expect(uri).toContain('client_id=app-id');
            expect(uri).toContain(
                'redirect_uri=https%3A%2F%2Fapp.example.com%2Fredirect%2Foutreach'
            );
            expect(uri).toContain('response_type=code');
            expect(uri).toContain('scope=prospects.read+accounts.read');
        });

        it('exposes oauth2 authorization requirements', () => {
            const api = new Api({
                client_id: 'x',
                redirect_uri: 'https://r.example/outreach',
                scope: 'users.read',
            });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain('api.outreach.io/oauth/authorize');
        });

        it('uses JSON:API content type on POST', async () => {
            const api = makeApi();
            const calls = [];
            api._post = async function (options) {
                this.addJsonApiHeaders(options);
                calls.push(options);
                return { data: {} };
            };
            await api.createAccount({
                data: { type: 'account', attributes: { name: 'Acme' } },
            });
            expect(calls[0].headers['Content-Type']).toBe(
                JSON_API_CONTENT_TYPE
            );
            expect(calls[0].headers.Accept).toBe(JSON_API_CONTENT_TYPE);
        });
    });

    describe('identity', () => {
        it('getApiRoot hits GET /api/v2', async () => {
            const api = makeApi();
            await api.getApiRoot();
            expect(api._captured[0].url).toBe('https://api.outreach.io/api/v2');
        });
    });

    describe('accounts', () => {
        it('listAccounts hits GET /accounts', async () => {
            const api = makeApi();
            await api.listAccounts();
            expect(api._captured[0].url).toBe(
                'https://api.outreach.io/api/v2/accounts'
            );
        });

        it('getAccount hits GET /accounts/{id}', async () => {
            const api = makeApi();
            await api.getAccount(42);
            expect(api._captured[0].url).toBe(
                'https://api.outreach.io/api/v2/accounts/42'
            );
        });

        it('createAccount POSTs a JSON:API body', async () => {
            const api = makeApi();
            const body = {
                data: { type: 'account', attributes: { name: 'Acme' } },
            };
            await api.createAccount(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual(body);
        });

        it('updateAccount PATCHes /accounts/{id}', async () => {
            const api = makeApi();
            await api.updateAccount(7, {
                data: { type: 'account', id: 7, attributes: { name: 'X' } },
            });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toBe(
                'https://api.outreach.io/api/v2/accounts/7'
            );
        });

        it('deleteAccount DELETEs /accounts/{id}', async () => {
            const api = makeApi();
            await api.deleteAccount(9);
            expect(api._captured[0].method).toBe('DELETE');
            expect(api._captured[0].url).toBe(
                'https://api.outreach.io/api/v2/accounts/9'
            );
        });
    });

    describe('prospects', () => {
        it('listProspects / getProspect / createProspect / updateProspect / deleteProspect', async () => {
            const api = makeApi();
            await api.listProspects();
            await api.getProspect(1);
            await api.createProspect({
                data: { type: 'prospect', attributes: { firstName: 'A' } },
            });
            await api.updateProspect(1, {
                data: { type: 'prospect', id: 1, attributes: { lastName: 'B' } },
            });
            await api.deleteProspect(1);
            expect(api._captured.map((c) => c.method)).toEqual([
                'GET',
                'GET',
                'POST',
                'PATCH',
                'DELETE',
            ]);
            expect(api._captured[0].url).toBe(
                'https://api.outreach.io/api/v2/prospects'
            );
            expect(api._captured[1].url).toBe(
                'https://api.outreach.io/api/v2/prospects/1'
            );
        });
    });

    describe('tasks', () => {
        it('covers list/get/create/update/delete', async () => {
            const api = makeApi();
            await api.listTasks();
            await api.getTask(3);
            await api.createTask({
                data: { type: 'task', attributes: { action: 'email' } },
            });
            await api.updateTask(3, {
                data: { type: 'task', id: 3, attributes: { note: 'hi' } },
            });
            await api.deleteTask(3);
            expect(api._captured[0].url).toBe(
                'https://api.outreach.io/api/v2/tasks'
            );
            expect(api._captured[1].url).toBe(
                'https://api.outreach.io/api/v2/tasks/3'
            );
        });
    });

    describe('users', () => {
        it('listUsers and getUser', async () => {
            const api = makeApi();
            await api.listUsers();
            await api.getUser(5);
            expect(api._captured[0].url).toBe(
                'https://api.outreach.io/api/v2/users'
            );
            expect(api._captured[1].url).toBe(
                'https://api.outreach.io/api/v2/users/5'
            );
        });
    });

    describe('webhooks', () => {
        it('list/get/create/update/delete webhooks', async () => {
            const api = makeApi();
            await api.listWebhooks();
            await api.getWebhook(2);
            await api.createWebhook({
                data: {
                    type: 'webhook',
                    attributes: {
                        url: 'https://hook.example/outreach',
                        resource: 'prospect',
                        action: 'updated',
                    },
                },
            });
            await api.updateWebhook(2, {
                data: {
                    type: 'webhook',
                    id: 2,
                    attributes: { active: false },
                },
            });
            await api.deleteWebhook(2);
            expect(api._captured[0].url).toBe(
                'https://api.outreach.io/api/v2/webhooks'
            );
            expect(api._captured[2].method).toBe('POST');
        });

        it('cleanupWebhook POSTs /webhooks/cleanup with cleanup Bearer token', async () => {
            const api = makeApi();
            await api.cleanupWebhook('cleanup-tok');
            const captured = api._captured[0];
            expect(captured.url).toBe(
                'https://api.outreach.io/api/v2/webhooks/cleanup'
            );
            expect(captured.headers.Authorization).toBe('Bearer cleanup-tok');
        });

        it('verifyWebhookSignature accepts a valid HMAC hex digest', async () => {
            const secret = 'abcd1234';
            const body = JSON.stringify({
                data: { type: 'task', id: 1 },
                meta: { eventName: 'task.completed' },
            });
            const signature = crypto
                .createHmac('sha256', secret)
                .update(body)
                .digest('hex');
            const api = new Api({
                access_token: 't',
                webhook_secret: secret,
            });
            const ok = await api.verifyWebhookSignature({
                headers: { [SIGNATURE_HEADER]: signature },
                rawBody: body,
            });
            expect(ok).toBe(true);
        });

        it('verifyWebhookSignature rejects a bad signature', async () => {
            const api = new Api({
                access_token: 't',
                webhook_secret: 'secret',
            });
            const ok = await api.verifyWebhookSignature({
                headers: { [SIGNATURE_HEADER]: 'deadbeef' },
                rawBody: '{"a":1}',
            });
            expect(ok).toBe(false);
        });
    });
});
