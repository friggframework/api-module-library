const { Api } = require('../api');

// Fully offline: stub low-level HTTP methods and assert on constructed options.
function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'test-token',
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://app.example.com/redirect/miro',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { data: [] };
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
        return {};
    };
    return api;
}

describe('Miro Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and OAuth token URI', () => {
            const api = new Api({
                access_token: 't',
                client_id: 'c',
                redirect_uri: 'https://x/miro',
            });
            expect(api.baseUrl).toBe('https://api.miro.com');
            expect(api.tokenUri).toBe('https://api.miro.com/v1/oauth/token');
            expect(api.access_token).toBe('t');
            expect(api.isRefreshable).toBe(true);
        });

        it('builds the Miro authorize URL without a scope query param', () => {
            const api = new Api({
                client_id: 'app-123',
                redirect_uri: 'https://app.example.com/redirect/miro',
                state: 's1',
            });
            const uri = decodeURIComponent(api.authorizationUri);
            expect(uri).toContain('https://miro.com/oauth/authorize?');
            expect(uri).toContain('response_type=code');
            expect(uri).toContain('client_id=app-123');
            expect(uri).toContain(
                'redirect_uri=https://app.example.com/redirect/miro'
            );
            expect(uri).toContain('state=s1');
            expect(uri).not.toContain('scope=');
        });

        it('defaults scopes to boards:read boards:write', () => {
            const api = new Api({});
            expect(api.scope).toBe('boards:read boards:write');
        });
    });

    describe('getTokenInfo', () => {
        it('hits GET /v1/oauth-token', async () => {
            const api = makeApi();
            await api.getTokenInfo();
            expect(api._captured[0].url).toBe(
                'https://api.miro.com/v1/oauth-token'
            );
        });
    });

    describe('boards', () => {
        it('listBoards hits GET /v2/boards with query', async () => {
            const api = makeApi();
            await api.listBoards({ limit: '10', team_id: 'team-1' });
            const captured = api._captured[0];
            expect(captured.method).toBe('GET');
            expect(captured.url).toBe('https://api.miro.com/v2/boards');
            expect(captured.query).toEqual({ limit: '10', team_id: 'team-1' });
        });

        it('createBoard POSTs BoardChanges body', async () => {
            const api = makeApi();
            const body = { name: 'Sprint board', teamId: 'team-1' };
            await api.createBoard(body);
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe('https://api.miro.com/v2/boards');
            expect(captured.body).toEqual(body);
        });

        it('getBoard / updateBoard / deleteBoard hit board-by-id paths', async () => {
            const api = makeApi();
            await api.getBoard('b1');
            await api.updateBoard('b1', { name: 'Renamed' });
            await api.deleteBoard('b1');
            expect(api._captured[0].url).toBe(
                'https://api.miro.com/v2/boards/b1'
            );
            expect(api._captured[1].method).toBe('PATCH');
            expect(api._captured[1].body).toEqual({ name: 'Renamed' });
            expect(api._captured[2].method).toBe('DELETE');
        });
    });

    describe('items', () => {
        it('listBoardItems hits GET /v2/boards/{id}/items', async () => {
            const api = makeApi();
            await api.listBoardItems('b1', { type: 'sticky_note', limit: '20' });
            expect(api._captured[0].url).toBe(
                'https://api.miro.com/v2/boards/b1/items'
            );
            expect(api._captured[0].query).toEqual({
                type: 'sticky_note',
                limit: '20',
            });
        });

        it('getBoardItem hits item-by-id path', async () => {
            const api = makeApi();
            await api.getBoardItem('b1', 'i1');
            expect(api._captured[0].url).toBe(
                'https://api.miro.com/v2/boards/b1/items/i1'
            );
        });
    });

    describe('sticky notes', () => {
        it('createStickyNote POSTs to sticky_notes', async () => {
            const api = makeApi();
            const body = { data: { content: 'Hello', shape: 'square' } };
            await api.createStickyNote('b1', body);
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.miro.com/v2/boards/b1/sticky_notes'
            );
            expect(captured.body).toEqual(body);
        });

        it('get / update / delete sticky note hit item paths', async () => {
            const api = makeApi();
            await api.getStickyNote('b1', 's1');
            await api.updateStickyNote('b1', 's1', {
                data: { content: 'Updated' },
            });
            await api.deleteStickyNote('b1', 's1');
            expect(api._captured[0].url).toBe(
                'https://api.miro.com/v2/boards/b1/sticky_notes/s1'
            );
            expect(api._captured[1].method).toBe('PATCH');
            expect(api._captured[2].method).toBe('DELETE');
        });
    });

    describe('board members', () => {
        it('listBoardMembers hits GET /v2/boards/{id}/members', async () => {
            const api = makeApi();
            await api.listBoardMembers('b1', { limit: '50' });
            expect(api._captured[0].url).toBe(
                'https://api.miro.com/v2/boards/b1/members'
            );
            expect(api._captured[0].query).toEqual({ limit: '50' });
        });
    });
});
