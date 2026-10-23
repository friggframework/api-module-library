const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://app.example.com/redirect/figma',
        scope: 'current_user:read,file_content:read',
        access_token: 'test-token',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return {};
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { access_token: 'new', refresh_token: 'ref', expires_in: 3600 };
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

describe('Figma Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and OAuth endpoints', () => {
            const api = makeApi();
            expect(api.baseUrl).toBe('https://api.figma.com');
            expect(api.tokenUri).toBe('https://api.figma.com/v1/oauth/token');
            expect(api.refreshUri).toBe(
                'https://api.figma.com/v1/oauth/refresh'
            );
            expect(api.authorizationUri).toContain('https://www.figma.com/oauth');
            expect(api.authorizationUri).toContain('client_id=cid');
            expect(api.authorizationUri).toContain('response_type=code');
        });

        it('getTokenFromCode delegates to Basic-auth exchange', async () => {
            const api = makeApi();
            api.getTokenFromCodeBasicAuthHeader = jest
                .fn()
                .mockResolvedValue({ access_token: 't' });
            await api.getTokenFromCode('auth-code');
            expect(api.getTokenFromCodeBasicAuthHeader).toHaveBeenCalledWith(
                'auth-code'
            );
        });

        it('refreshAccessToken posts refresh_token with Basic auth to refreshUri', async () => {
            const api = makeApi({ refresh_token: 'r1' });
            api.setTokens = jest.fn().mockResolvedValue(undefined);
            await api.refreshAccessToken({ refresh_token: 'r1' });
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.figma.com/v1/oauth/refresh'
            );
            expect(captured.headers.Authorization).toMatch(/^Basic /);
            expect(captured.body.get('refresh_token')).toBe('r1');
            expect(captured.body.get('grant_type')).toBeNull();
        });
    });

    describe('identity & files', () => {
        it('getMe hits GET /v1/me', async () => {
            const api = makeApi();
            await api.getMe();
            expect(api._captured[0].url).toBe('https://api.figma.com/v1/me');
        });

        it('getFile hits GET /v1/files/{key} with query', async () => {
            const api = makeApi();
            await api.getFile('abc', { depth: 1 });
            expect(api._captured[0].url).toBe(
                'https://api.figma.com/v1/files/abc'
            );
            expect(api._captured[0].query).toEqual({ depth: 1 });
        });

        it('getFileMeta hits GET /v1/files/{key}/meta', async () => {
            const api = makeApi();
            await api.getFileMeta('abc');
            expect(api._captured[0].url).toBe(
                'https://api.figma.com/v1/files/abc/meta'
            );
        });
    });

    describe('comments', () => {
        it('getComments / postComment / deleteComment hit comment paths', async () => {
            const api = makeApi();
            await api.getComments('f1', { as_md: true });
            await api.postComment('f1', { message: 'hi' });
            await api.deleteComment('f1', 'c1');
            expect(api._captured[0].url).toBe(
                'https://api.figma.com/v1/files/f1/comments'
            );
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[1].body).toEqual({ message: 'hi' });
            expect(api._captured[2].method).toBe('DELETE');
            expect(api._captured[2].url).toBe(
                'https://api.figma.com/v1/files/f1/comments/c1'
            );
        });
    });

    describe('projects & folders', () => {
        it('lists team projects and project files', async () => {
            const api = makeApi();
            await api.getTeamProjects('t1');
            await api.getProjectFiles('p1', { branch_data: true });
            await api.getProjectMeta('p1');
            expect(api._captured[0].url).toBe(
                'https://api.figma.com/v1/teams/t1/projects'
            );
            expect(api._captured[1].url).toBe(
                'https://api.figma.com/v1/projects/p1/files'
            );
            expect(api._captured[2].url).toBe(
                'https://api.figma.com/v1/projects/p1/meta'
            );
        });

        it('lists team folders and folder files/meta', async () => {
            const api = makeApi();
            await api.getTeamFolders('t1');
            await api.getFolderFiles('fold1', { branch_data: true });
            await api.getFolderMeta('fold1');
            expect(api._captured[0].url).toBe(
                'https://api.figma.com/v2/teams/t1/folders'
            );
            expect(api._captured[1].url).toBe(
                'https://api.figma.com/v2/folders/fold1/files'
            );
            expect(api._captured[1].query).toEqual({ branch_data: true });
            expect(api._captured[2].url).toBe(
                'https://api.figma.com/v2/folders/fold1/meta'
            );
        });
    });

    describe('webhooks', () => {
        it('CRUD webhooks against /v2/webhooks', async () => {
            const api = makeApi();
            const body = {
                event_type: 'FILE_UPDATE',
                endpoint: 'https://hook.example.com',
                passcode: 'secret',
                context: 'team',
                context_id: 't1',
            };
            await api.getWebhooks({ context: 'team', context_id: 't1' });
            await api.postWebhook(body);
            await api.getWebhook('99');
            await api.putWebhook('99', {
                event_type: 'FILE_UPDATE',
                team_id: 't1',
                endpoint: body.endpoint,
                passcode: body.passcode,
                status: 'PAUSED',
            });
            await api.deleteWebhook('99');
            await api.getTeamWebhooks('t1');
            await api.getWebhookRequests('99');

            expect(api._captured[0].url).toBe(
                'https://api.figma.com/v2/webhooks'
            );
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[1].body).toEqual(body);
            expect(api._captured[2].url).toBe(
                'https://api.figma.com/v2/webhooks/99'
            );
            expect(api._captured[3].method).toBe('PUT');
            expect(api._captured[3].body.team_id).toBe('t1');
            expect(api._captured[4].method).toBe('DELETE');
            expect(api._captured[5].url).toBe(
                'https://api.figma.com/v2/teams/t1/webhooks'
            );
            expect(api._captured[6].url).toBe(
                'https://api.figma.com/v2/webhooks/99/requests'
            );
        });
    });
});
