const { Api } = require('../api');

const CLOUD = '11111111-2222-3333-4444-555555555555';
const BASE = `https://api.atlassian.com/ex/confluence/${CLOUD}/wiki/api/v2`;

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'conf-client',
        client_secret: 'secret',
        redirect_uri: 'https://example.com/redirect/confluence',
        access_token: 'tok',
        refresh_token: 'ref',
        cloudId: CLOUD,
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { results: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        if (options.url === 'https://auth.atlassian.com/oauth/token') {
            return {
                access_token: 'new-at',
                refresh_token: 'new-rt',
                expires_in: 3600,
                scope: 'read:space:confluence',
            };
        }
        return { id: '1' };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { id: '1' };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Confluence Api', () => {
    describe('construction & auth', () => {
        it('defaults baseUrl to the OAuth gateway template without cloudId', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
            });
            expect(api.baseUrl).toBe(
                'https://api.atlassian.com/ex/confluence/{cloudId}/wiki/api/v2'
            );
            expect(api.tokenUri).toBe('https://auth.atlassian.com/oauth/token');
        });

        it('resolves baseUrl when cloudId is provided', () => {
            const api = new Api({ cloudId: CLOUD });
            expect(api.baseUrl).toBe(BASE);
        });

        it('builds an authorize URL on auth.atlassian.com', () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r/confluence',
                scope: 'read:me offline_access read:space:confluence',
                state: 'xyz',
            });
            const uri = api.getAuthUri();
            expect(uri).toContain('https://auth.atlassian.com/authorize?');
            expect(uri).toContain('audience=api.atlassian.com');
            expect(uri).toContain('client_id=cid');
            expect(uri).toContain('response_type=code');
            expect(uri).toContain('prompt=consent');
            expect(uri).toContain('state=xyz');
            expect(uri).toContain(
                'redirect_uri=https%3A%2F%2Fex.com%2Fr%2Fconfluence'
            );
        });

        it('adds Bearer Authorization header', async () => {
            const api = new Api({
                access_token: 'tok-1',
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer tok-1');
        });

        it('exchanges code with a JSON token body', async () => {
            const api = makeApi({ cloudId: null });
            await api.getTokenFromCode('auth-code');
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe('https://auth.atlassian.com/oauth/token');
            expect(captured.headers['Content-Type']).toBe('application/json');
            expect(captured.body).toEqual({
                grant_type: 'authorization_code',
                client_id: 'conf-client',
                client_secret: 'secret',
                code: 'auth-code',
                redirect_uri: 'https://example.com/redirect/confluence',
            });
        });

        it('refreshes with a JSON token body', async () => {
            const api = makeApi();
            await api.refreshAccessToken({ refresh_token: 'old-ref' });
            const captured = api._captured[0];
            expect(captured.body).toEqual({
                grant_type: 'refresh_token',
                client_id: 'conf-client',
                client_secret: 'secret',
                refresh_token: 'old-ref',
            });
        });
    });

    describe('identity', () => {
        it('listAccessibleResources hits the platform URL', async () => {
            const api = makeApi();
            await api.listAccessibleResources();
            expect(api._captured[0].url).toBe(
                'https://api.atlassian.com/oauth/token/accessible-resources'
            );
        });

        it('getCurrentUser hits GET /me', async () => {
            const api = makeApi();
            await api.getCurrentUser();
            expect(api._captured[0].url).toBe('https://api.atlassian.com/me');
        });

        it('resolveCloudId prefers a confluence-scoped site', async () => {
            const api = makeApi({ cloudId: null });
            api.listAccessibleResources = async () => [
                {
                    id: 'jira-only',
                    name: 'Jira',
                    url: 'https://jira.example.atlassian.net',
                    scopes: ['read:jira-work'],
                },
                {
                    id: CLOUD,
                    name: 'Wiki',
                    url: 'https://wiki.example.atlassian.net',
                    scopes: ['read:space:confluence'],
                },
            ];
            const site = await api.resolveCloudId();
            expect(site.id).toBe(CLOUD);
            expect(api.cloudId).toBe(CLOUD);
            expect(api.baseUrl).toBe(BASE);
        });
    });

    describe('spaces', () => {
        it('getSpaces hits GET /spaces', async () => {
            const api = makeApi();
            await api.getSpaces({ limit: 25 });
            expect(api._captured[0].url).toBe(`${BASE}/spaces?limit=25`);
        });

        it('getSpaceById hits GET /spaces/{id}', async () => {
            const api = makeApi();
            await api.getSpaceById(99);
            expect(api._captured[0].url).toBe(`${BASE}/spaces/99`);
        });

        it('createSpace POSTs the body', async () => {
            const api = makeApi();
            const body = { name: 'Eng', key: 'ENG' };
            await api.createSpace(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(`${BASE}/spaces`);
            expect(api._captured[0].body).toEqual(body);
        });

        it('throws when cloudId is missing', async () => {
            const api = makeApi({ cloudId: null });
            await expect(api.getSpaces()).rejects.toThrow(/cloudId is required/);
        });
    });

    describe('pages', () => {
        it('getPages hits GET /pages', async () => {
            const api = makeApi();
            await api.getPages({ 'space-id': [1], limit: 10 });
            const { url } = api._captured[0];
            expect(url).toContain(`${BASE}/pages?`);
            expect(url).toContain('space-id=1');
            expect(url).toContain('limit=10');
        });

        it('getPageById / createPage / updatePage / deletePage', async () => {
            const api = makeApi();
            await api.getPageById(7, { 'body-format': 'storage' });
            expect(api._captured[0].url).toBe(
                `${BASE}/pages/7?body-format=storage`
            );

            await api.createPage({
                spaceId: '1',
                title: 'Hello',
                body: { representation: 'storage', value: '<p>Hi</p>' },
            });
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[1].url).toBe(`${BASE}/pages`);

            await api.updatePage(7, {
                id: '7',
                status: 'current',
                title: 'Hello',
                body: { representation: 'storage', value: '<p>Hi</p>' },
                version: { number: 2 },
            });
            expect(api._captured[2].method).toBe('PUT');
            expect(api._captured[2].url).toBe(`${BASE}/pages/7`);

            await api.deletePage(7, { purge: true });
            expect(api._captured[3].method).toBe('DELETE');
            expect(api._captured[3].url).toBe(`${BASE}/pages/7?purge=true`);
        });

        it('getPagesInSpace hits GET /spaces/{id}/pages', async () => {
            const api = makeApi();
            await api.getPagesInSpace(5);
            expect(api._captured[0].url).toBe(`${BASE}/spaces/5/pages`);
        });
    });

    describe('blog posts', () => {
        it('CRUD paths match the official v2 routes', async () => {
            const api = makeApi();
            await api.getBlogPosts();
            expect(api._captured[0].url).toBe(`${BASE}/blogposts`);

            await api.getBlogPostById(3);
            expect(api._captured[1].url).toBe(`${BASE}/blogposts/3`);

            await api.createBlogPost({ spaceId: '1', title: 'Post' });
            expect(api._captured[2].url).toBe(`${BASE}/blogposts`);

            await api.updateBlogPost(3, {
                id: '3',
                status: 'current',
                title: 'Post',
                body: { representation: 'storage', value: '<p>x</p>' },
                version: { number: 2 },
            });
            expect(api._captured[3].url).toBe(`${BASE}/blogposts/3`);

            await api.deleteBlogPost(3);
            expect(api._captured[4].method).toBe('DELETE');

            await api.getBlogPostsInSpace(5);
            expect(api._captured[5].url).toBe(`${BASE}/spaces/5/blogposts`);
        });
    });
});
