const crypto = require('crypto');
const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'test-token',
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://app.example.com/redirect/clickup',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return {};
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { access_token: 'new-token' };
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

describe('ClickUp Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and token URI', () => {
            const api = new Api({ access_token: 'abc' });
            expect(api.baseUrl).toBe('https://api.clickup.com/api/v2');
            expect(api.tokenUri).toBe(
                'https://api.clickup.com/api/v2/oauth/token'
            );
            expect(api.isRefreshable).toBe(false);
        });

        it('builds the authorize URL with client_id and redirect_uri', () => {
            const api = new Api({
                client_id: 'my-client',
                redirect_uri: 'https://app.example.com/redirect/clickup',
                state: 'xyz',
            });
            const url = api.getAuthorizationUri();
            expect(url).toContain('https://app.clickup.com/api?');
            expect(url).toContain('client_id=my-client');
            expect(url).toContain(
                'redirect_uri=https%3A%2F%2Fapp.example.com%2Fredirect%2Fclickup'
            );
            expect(url).toContain('state=xyz');
        });

        it('adds Bearer Authorization for OAuth tokens', async () => {
            const api = new Api({ access_token: 'oauth-tok' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer oauth-tok');
        });

        it('adds raw Authorization for personal pk_ tokens', async () => {
            const api = new Api({ access_token: 'pk_personal' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('pk_personal');
        });

        it('reports authenticated only with a non-empty token', () => {
            expect(new Api({ access_token: 'x' }).isAuthenticated()).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });

        it('getTokenFromCode posts JSON client_id/secret/code only', async () => {
            const api = makeApi();
            await api.getTokenFromCode('auth-code');
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.clickup.com/api/v2/oauth/token'
            );
            expect(captured.body).toEqual({
                client_id: 'cid',
                client_secret: 'csecret',
                code: 'auth-code',
            });
            expect(captured.body.grant_type).toBeUndefined();
            expect(api.access_token).toBe('new-token');
        });
    });

    describe('identity', () => {
        it('getAuthorizedUser hits GET /user', async () => {
            const api = makeApi();
            await api.getAuthorizedUser();
            expect(api._captured[0].url).toBe(
                'https://api.clickup.com/api/v2/user'
            );
        });

        it('getAuthorizedTeams hits GET /team', async () => {
            const api = makeApi();
            await api.getAuthorizedTeams();
            expect(api._captured[0].url).toBe(
                'https://api.clickup.com/api/v2/team'
            );
        });
    });

    describe('hierarchy', () => {
        it('getSpaces hits GET /team/{id}/space', async () => {
            const api = makeApi();
            await api.getSpaces('123');
            expect(api._captured[0].url).toBe(
                'https://api.clickup.com/api/v2/team/123/space'
            );
        });

        it('getSpace hits GET /space/{id}', async () => {
            const api = makeApi();
            await api.getSpace('s1');
            expect(api._captured[0].url).toBe(
                'https://api.clickup.com/api/v2/space/s1'
            );
        });

        it('getFolders hits GET /space/{id}/folder', async () => {
            const api = makeApi();
            await api.getFolders('s1');
            expect(api._captured[0].url).toBe(
                'https://api.clickup.com/api/v2/space/s1/folder'
            );
        });

        it('getLists hits GET /folder/{id}/list', async () => {
            const api = makeApi();
            await api.getLists('f1');
            expect(api._captured[0].url).toBe(
                'https://api.clickup.com/api/v2/folder/f1/list'
            );
        });

        it('getFolderlessLists hits GET /space/{id}/list', async () => {
            const api = makeApi();
            await api.getFolderlessLists('s1');
            expect(api._captured[0].url).toBe(
                'https://api.clickup.com/api/v2/space/s1/list'
            );
        });
    });

    describe('tasks', () => {
        it('getTasks hits GET /list/{id}/task', async () => {
            const api = makeApi();
            await api.getTasks('L1');
            expect(api._captured[0].url).toBe(
                'https://api.clickup.com/api/v2/list/L1/task'
            );
        });

        it('getTask hits GET /task/{id}', async () => {
            const api = makeApi();
            await api.getTask('t1');
            expect(api._captured[0].url).toBe(
                'https://api.clickup.com/api/v2/task/t1'
            );
        });

        it('createTask POSTs to /list/{id}/task', async () => {
            const api = makeApi();
            const body = { name: 'Ship it' };
            await api.createTask('L1', body);
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.clickup.com/api/v2/list/L1/task'
            );
            expect(captured.body).toEqual(body);
        });

        it('updateTask PUTs to /task/{id}', async () => {
            const api = makeApi();
            await api.updateTask('t1', { status: 'done' });
            const captured = api._captured[0];
            expect(captured.method).toBe('PUT');
            expect(captured.url).toBe(
                'https://api.clickup.com/api/v2/task/t1'
            );
            expect(captured.body).toEqual({ status: 'done' });
        });
    });

    describe('webhooks', () => {
        it('createWebhook POSTs to /team/{id}/webhook', async () => {
            const api = makeApi();
            const body = {
                endpoint: 'https://hook.example.com',
                events: ['taskCreated'],
            };
            await api.createWebhook('123', body);
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.clickup.com/api/v2/team/123/webhook'
            );
            expect(captured.body).toEqual(body);
        });

        it('getWebhooks hits GET /team/{id}/webhook', async () => {
            const api = makeApi();
            await api.getWebhooks('123');
            expect(api._captured[0].url).toBe(
                'https://api.clickup.com/api/v2/team/123/webhook'
            );
        });

        it('updateWebhook PUTs to /webhook/{id}', async () => {
            const api = makeApi();
            await api.updateWebhook('wh-1', { status: 'active' });
            expect(api._captured[0].url).toBe(
                'https://api.clickup.com/api/v2/webhook/wh-1'
            );
        });

        it('deleteWebhook DELETEs /webhook/{id}', async () => {
            const api = makeApi();
            await api.deleteWebhook('wh-1');
            expect(api._captured[0].method).toBe('DELETE');
            expect(api._captured[0].url).toBe(
                'https://api.clickup.com/api/v2/webhook/wh-1'
            );
        });

        it('verifyWebhookSignature accepts a valid HMAC-SHA256 hex', () => {
            const api = new Api({});
            const body = {
                webhook_id: '7689a169-a000-4985-8676-6902b96d6627',
                event: 'taskCreated',
                task_id: 'c0j',
            };
            const raw = JSON.stringify(body);
            const secret = 'secret';
            const signature = crypto
                .createHmac('sha256', secret)
                .update(raw)
                .digest('hex');
            const result = api.verifyWebhookSignature({
                headers: { 'X-Signature': signature },
                rawBody: raw,
                secret,
            });
            expect(result.valid).toBe(true);
        });

        it('verifyWebhookSignature rejects a bad signature', () => {
            const api = new Api({});
            const result = api.verifyWebhookSignature({
                headers: { 'X-Signature': 'deadbeef' },
                rawBody: '{"event":"taskCreated"}',
                secret: 'secret',
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('signature_mismatch');
        });
    });
});
