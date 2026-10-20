const crypto = require('crypto');
const { Api, DEFAULT_BASE_URL, DEFAULT_NOTION_VERSION } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'test-token',
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://example.com/redirect/notion',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { object: 'list', results: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'created' };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return { id: 'updated' };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return { id: 'deleted', archived: true };
    };
    return api;
}

describe('Notion Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and Notion-Version default', () => {
            const api = new Api({ access_token: 't' });
            expect(api.baseUrl).toBe(DEFAULT_BASE_URL);
            expect(api.notionVersion).toBe(DEFAULT_NOTION_VERSION);
        });

        it('builds the authorize URL with owner=user', () => {
            const api = new Api({
                client_id: 'abc',
                redirect_uri: 'https://app.example/redirect/notion',
                state: 's1',
            });
            const url = api.getAuthorizationUri();
            expect(url).toContain(
                'https://api.notion.com/v1/oauth/authorize?'
            );
            expect(url).toContain('client_id=abc');
            expect(url).toContain('owner=user');
            expect(url).toContain('response_type=code');
            expect(url).toContain(
                'redirect_uri=https%3A%2F%2Fapp.example%2Fredirect%2Fnotion'
            );
        });

        it('getAuthorizationRequirements returns oauth2 url', () => {
            const api = new Api({
                client_id: 'abc',
                redirect_uri: 'https://app.example/redirect/notion',
            });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain('oauth/authorize');
        });

        it('addAuthHeaders sets Bearer and Notion-Version', async () => {
            const api = new Api({ access_token: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
            expect(headers['Notion-Version']).toBe(DEFAULT_NOTION_VERSION);
        });

        it('getTokenFromCode posts JSON with Basic auth to the token URI', async () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 'csecret',
                redirect_uri: 'https://example.com/cb',
            });
            let captured;
            api._post = async (options) => {
                captured = options;
                return {
                    access_token: 'at',
                    refresh_token: 'rt',
                    workspace_id: 'ws-1',
                    workspace_name: 'Acme',
                    bot_id: 'bot-1',
                };
            };
            api.setTokens = async function (params) {
                this.access_token = params.access_token;
                this.refresh_token = params.refresh_token;
                this.workspace_id = params.workspace_id;
                this.workspace_name = params.workspace_name;
                this.bot_id = params.bot_id;
            };

            await api.getTokenFromCode('auth-code');
            expect(captured.url).toBe(
                'https://api.notion.com/v1/oauth/token'
            );
            expect(captured.headers['Content-Type']).toBe('application/json');
            expect(captured.headers['Notion-Version']).toBe(
                DEFAULT_NOTION_VERSION
            );
            expect(captured.headers.Authorization).toBe(
                `Basic ${Buffer.from('cid:csecret').toString('base64')}`
            );
            expect(captured.body).toEqual({
                grant_type: 'authorization_code',
                code: 'auth-code',
                redirect_uri: 'https://example.com/cb',
            });
            expect(api.workspace_id).toBe('ws-1');
            expect(api.bot_id).toBe('bot-1');
        });
    });

    describe('users', () => {
        it('getSelf hits GET /v1/users/me', async () => {
            const api = makeApi();
            await api.getSelf();
            expect(api._captured[0].url).toBe(
                'https://api.notion.com/v1/users/me'
            );
        });

        it('listUsers hits GET /v1/users', async () => {
            const api = makeApi();
            await api.listUsers({ page_size: 10 });
            expect(api._captured[0].url).toBe(
                'https://api.notion.com/v1/users'
            );
            expect(api._captured[0].query).toEqual({ page_size: 10 });
        });

        it('getUser hits GET /v1/users/{id}', async () => {
            const api = makeApi();
            await api.getUser('u1');
            expect(api._captured[0].url).toBe(
                'https://api.notion.com/v1/users/u1'
            );
        });
    });

    describe('pages', () => {
        it('createPage POSTs to /v1/pages', async () => {
            const api = makeApi();
            const body = {
                parent: { database_id: 'db' },
                properties: {},
            };
            await api.createPage(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://api.notion.com/v1/pages'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('retrievePage GETs /v1/pages/{id}', async () => {
            const api = makeApi();
            await api.retrievePage('p1');
            expect(api._captured[0].url).toBe(
                'https://api.notion.com/v1/pages/p1'
            );
        });

        it('updatePage PATCHes /v1/pages/{id}', async () => {
            const api = makeApi();
            await api.updatePage('p1', { properties: {} });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toBe(
                'https://api.notion.com/v1/pages/p1'
            );
        });
    });

    describe('databases & data sources', () => {
        it('createDatabase / retrieveDatabase / updateDatabase', async () => {
            const api = makeApi();
            await api.createDatabase({ parent: { page_id: 'p' } });
            expect(api._captured[0].url).toBe(
                'https://api.notion.com/v1/databases'
            );
            await api.retrieveDatabase('db1');
            expect(api._captured[1].url).toBe(
                'https://api.notion.com/v1/databases/db1'
            );
            await api.updateDatabase('db1', { title: [] });
            expect(api._captured[2].method).toBe('PATCH');
        });

        it('queryDatabase POSTs to /v1/data_sources/{id}/query', async () => {
            const api = makeApi();
            await api.queryDatabase('ds1', { page_size: 5 });
            expect(api._captured[0].url).toBe(
                'https://api.notion.com/v1/data_sources/ds1/query'
            );
            expect(api._captured[0].body).toEqual({ page_size: 5 });
        });

        it('searchDatabases POSTs /v1/search with object=database filter', async () => {
            const api = makeApi();
            await api.searchDatabases({ query: 'CRM' });
            expect(api._captured[0].url).toBe(
                'https://api.notion.com/v1/search'
            );
            expect(api._captured[0].body).toEqual({
                filter: { property: 'object', value: 'database' },
                query: 'CRM',
            });
        });
    });

    describe('blocks', () => {
        it('appendBlockChildren PATCHes children', async () => {
            const api = makeApi();
            await api.appendBlockChildren('b1', {
                children: [{ paragraph: { rich_text: [] } }],
            });
            expect(api._captured[0].url).toBe(
                'https://api.notion.com/v1/blocks/b1/children'
            );
            expect(api._captured[0].method).toBe('PATCH');
        });

        it('getBlockChildren / retrieveBlock / updateBlock / deleteBlock', async () => {
            const api = makeApi();
            await api.getBlockChildren('b1');
            expect(api._captured[0].url).toBe(
                'https://api.notion.com/v1/blocks/b1/children'
            );
            await api.retrieveBlock('b1');
            expect(api._captured[1].url).toBe(
                'https://api.notion.com/v1/blocks/b1'
            );
            await api.updateBlock('b1', {});
            expect(api._captured[2].method).toBe('PATCH');
            await api.deleteBlock('b1');
            expect(api._captured[3].method).toBe('DELETE');
        });
    });

    describe('search & comments', () => {
        it('search POSTs /v1/search', async () => {
            const api = makeApi();
            await api.search({ query: 'q' });
            expect(api._captured[0].url).toBe(
                'https://api.notion.com/v1/search'
            );
        });

        it('listComments / createComment', async () => {
            const api = makeApi();
            await api.listComments({ block_id: 'b1' });
            expect(api._captured[0].url).toBe(
                'https://api.notion.com/v1/comments'
            );
            await api.createComment({ parent: { page_id: 'p' }, rich_text: [] });
            expect(api._captured[1].method).toBe('POST');
        });
    });

    describe('verifyWebhookSignature', () => {
        it('accepts a valid sha256 HMAC', async () => {
            const token = 'secret_verify_token';
            const body = {
                id: 'evt-1',
                type: 'page.created',
                workspace_id: 'ws',
            };
            const raw = JSON.stringify(body);
            const signature = `sha256=${crypto
                .createHmac('sha256', token)
                .update(raw)
                .digest('hex')}`;
            const api = new Api({
                access_token: 't',
                webhookVerificationToken: token,
            });
            const ok = await api.verifyWebhookSignature({
                headers: { 'X-Notion-Signature': signature },
                rawBody: raw,
            });
            expect(ok).toBe(true);
        });

        it('rejects a bad signature', async () => {
            const api = new Api({
                access_token: 't',
                webhookVerificationToken: 'secret',
            });
            const ok = await api.verifyWebhookSignature({
                headers: { 'X-Notion-Signature': 'sha256=deadbeef' },
                body: { type: 'page.created' },
            });
            expect(ok).toBe(false);
        });
    });
});
