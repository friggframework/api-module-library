const crypto = require('crypto');
const { Api, SIGNATURE_HEADER, BASE_URL } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        api_key: 'test-key',
        token: 'test-token',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return {};
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'new' };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { id: 'upd' };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Trello Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and credentials', () => {
            const api = new Api({ api_key: 'k', token: 't' });
            expect(api.baseUrl).toBe(BASE_URL);
            expect(api.api_key).toBe('k');
            expect(api.token).toBe('t');
        });

        it('accepts access_token as an alias for token', () => {
            const api = new Api({ api_key: 'k', access_token: 'tok' });
            expect(api.token).toBe('tok');
        });

        it('adds the OAuth Authorization header with key and token', async () => {
            const api = new Api({ api_key: 'akey', token: 'atok' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe(
                'OAuth oauth_consumer_key="akey", oauth_token="atok"'
            );
        });

        it('reports authenticated only with both key and token', () => {
            expect(
                new Api({ api_key: 'k', token: 't' }).isAuthenticated()
            ).toBe(true);
            expect(new Api({ api_key: 'k' }).isAuthenticated()).toBe(false);
            expect(new Api({ token: 't' }).isAuthenticated()).toBe(false);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });

        it('exposes an apiKey authorization form', () => {
            const api = new Api({ api_key: 'k' });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('apiKey');
            expect(reqs.data.jsonSchema.required).toEqual(
                expect.arrayContaining(['api_key', 'token'])
            );
            expect(reqs.url).toContain('trello.com/1/authorize');
            expect(reqs.url).toContain('key=k');
        });
    });

    describe('members', () => {
        it('getMember hits GET /members/{id}', async () => {
            const api = makeApi();
            await api.getMember('me');
            expect(api._captured[0].url).toBe(
                'https://api.trello.com/1/members/me'
            );
        });
    });

    describe('boards', () => {
        it('listBoards hits GET /members/{id}/boards', async () => {
            const api = makeApi();
            await api.listBoards('me', { filter: 'open' });
            expect(api._captured[0].url).toBe(
                'https://api.trello.com/1/members/me/boards'
            );
            expect(api._captured[0].query).toEqual({ filter: 'open' });
        });

        it('getBoard / createBoard / updateBoard hit the board paths', async () => {
            const api = makeApi();
            await api.getBoard('b1');
            await api.createBoard({ name: 'N' });
            await api.updateBoard('b1', { name: 'N2' });
            expect(api._captured[0].url).toBe(
                'https://api.trello.com/1/boards/b1'
            );
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[1].url).toBe(
                'https://api.trello.com/1/boards/'
            );
            expect(api._captured[1].query).toEqual({ name: 'N' });
            expect(api._captured[2].method).toBe('PUT');
            expect(api._captured[2].url).toBe(
                'https://api.trello.com/1/boards/b1'
            );
        });
    });

    describe('lists', () => {
        it('listLists / getList / createList / updateList', async () => {
            const api = makeApi();
            await api.listLists('b1');
            await api.getList('l1');
            await api.createList({ name: 'L', idBoard: 'b1' });
            await api.updateList('l1', { name: 'L2' });
            expect(api._captured[0].url).toBe(
                'https://api.trello.com/1/boards/b1/lists'
            );
            expect(api._captured[1].url).toBe(
                'https://api.trello.com/1/lists/l1'
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[2].url).toBe(
                'https://api.trello.com/1/lists'
            );
            expect(api._captured[3].method).toBe('PUT');
        });
    });

    describe('cards', () => {
        it('listCards / listListCards / getCard / createCard / updateCard', async () => {
            const api = makeApi();
            await api.listCards('b1');
            await api.listListCards('l1');
            await api.getCard('c1');
            await api.createCard({ idList: 'l1', name: 'C' });
            await api.updateCard('c1', { name: 'C2' });
            expect(api._captured[0].url).toBe(
                'https://api.trello.com/1/boards/b1/cards'
            );
            expect(api._captured[1].url).toBe(
                'https://api.trello.com/1/lists/l1/cards'
            );
            expect(api._captured[2].url).toBe(
                'https://api.trello.com/1/cards/c1'
            );
            expect(api._captured[3].method).toBe('POST');
            expect(api._captured[3].query).toEqual({
                idList: 'l1',
                name: 'C',
            });
            expect(api._captured[4].method).toBe('PUT');
        });
    });

    describe('organizations & labels', () => {
        it('listOrganizations / getOrganization / listLabels / createLabel', async () => {
            const api = makeApi();
            await api.listOrganizations('me');
            await api.getOrganization('o1');
            await api.listLabels('b1');
            await api.createLabel({ idBoard: 'b1', name: 'bug', color: 'red' });
            expect(api._captured[0].url).toBe(
                'https://api.trello.com/1/members/me/organizations'
            );
            expect(api._captured[1].url).toBe(
                'https://api.trello.com/1/organizations/o1'
            );
            expect(api._captured[2].url).toBe(
                'https://api.trello.com/1/boards/b1/labels'
            );
            expect(api._captured[3].method).toBe('POST');
            expect(api._captured[3].url).toBe(
                'https://api.trello.com/1/labels'
            );
        });
    });

    describe('webhooks', () => {
        it('createWebhook POSTs JSON body to /webhooks/', async () => {
            const api = makeApi();
            const body = {
                callbackURL: 'https://hook.example.com/trello',
                idModel: 'model1',
                description: 'test',
            };
            await api.createWebhook(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://api.trello.com/1/webhooks/'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('get / update / delete webhook', async () => {
            const api = makeApi();
            await api.getWebhook('w1');
            await api.updateWebhook('w1', { active: false });
            await api.deleteWebhook('w1');
            expect(api._captured[0].url).toBe(
                'https://api.trello.com/1/webhooks/w1'
            );
            expect(api._captured[1].method).toBe('PUT');
            expect(api._captured[2].method).toBe('DELETE');
        });

        it('listTokenWebhooks / createTokenWebhook use the token path', async () => {
            const api = makeApi();
            await api.listTokenWebhooks();
            await api.createTokenWebhook({
                callbackURL: 'https://hook.example.com',
                idModel: 'm1',
            });
            expect(api._captured[0].url).toBe(
                'https://api.trello.com/1/tokens/test-token/webhooks'
            );
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[1].url).toBe(
                'https://api.trello.com/1/tokens/test-token/webhooks'
            );
        });

        it('verifyWebhookSignature accepts a valid HMAC-SHA1 digest', () => {
            const secret = 'app-secret';
            const callbackURL = 'https://hook.example.com/trello';
            const body = { action: { type: 'updateCard' } };
            const raw = JSON.stringify(body);
            const signature = crypto
                .createHmac('sha1', secret)
                .update(raw + callbackURL)
                .digest('base64');

            const api = new Api({
                api_key: 'k',
                token: 't',
                api_secret: secret,
            });
            const result = api.verifyWebhookSignature({
                headers: { [SIGNATURE_HEADER]: signature },
                rawBody: raw,
                callbackURL,
            });
            expect(result).toEqual({ valid: true });
        });

        it('verifyWebhookSignature rejects a bad signature', () => {
            const api = new Api({
                api_key: 'k',
                token: 't',
                api_secret: 'secret',
            });
            const result = api.verifyWebhookSignature({
                headers: { [SIGNATURE_HEADER]: 'nope' },
                rawBody: '{}',
                callbackURL: 'https://hook.example.com',
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('signature mismatch');
        });
    });
});
