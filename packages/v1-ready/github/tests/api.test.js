const { Api } = require('../api');

// Fully offline: stub the low-level HTTP methods and assert on the request
// options the API methods construct. No network is touched.
function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'test-token',
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://app.example.com/redirect/github',
        scope: 'read:user repo',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return {};
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 1 };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return { id: 1 };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('GitHub Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and OAuth endpoints', () => {
            const api = new Api({
                access_token: 't',
                client_id: 'abc',
                redirect_uri: 'https://app.example.com/redirect/github',
                scope: 'repo',
            });
            expect(api.baseUrl).toBe('https://api.github.com');
            expect(api.tokenUri).toBe(
                'https://github.com/login/oauth/access_token'
            );
            expect(api.getAuthorizationUri()).toContain(
                'https://github.com/login/oauth/authorize'
            );
            expect(api.getAuthorizationUri()).toContain('client_id=abc');
            expect(api.access_token).toBe('t');
        });

        it('reports oauth2 authorization requirements with a URL', () => {
            const api = new Api({
                client_id: 'abc',
                redirect_uri: 'https://app.example.com/redirect/github',
                scope: 'repo',
            });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain('github.com/login/oauth/authorize');
        });

        it('is an OAuth2 requester', () => {
            expect(Api.requesterType).toBe('oauth2');
        });
    });

    describe('getAuthenticatedUser', () => {
        it('hits GET /user', async () => {
            const api = makeApi();
            await api.getAuthenticatedUser();
            expect(api._captured[0].url).toBe('https://api.github.com/user');
        });
    });

    describe('listOrganizationsForAuthenticatedUser', () => {
        it('hits GET /user/orgs with query', async () => {
            const api = makeApi();
            await api.listOrganizationsForAuthenticatedUser({ per_page: 10 });
            expect(api._captured[0].url).toBe(
                'https://api.github.com/user/orgs'
            );
            expect(api._captured[0].query).toEqual({ per_page: 10 });
        });
    });

    describe('repositories', () => {
        it('listReposForAuthenticatedUser hits GET /user/repos', async () => {
            const api = makeApi();
            await api.listReposForAuthenticatedUser({
                visibility: 'all',
                since: '2024-01-01T00:00:00Z',
                before: '2024-12-31T23:59:59Z',
            });
            expect(api._captured[0].url).toBe(
                'https://api.github.com/user/repos'
            );
            expect(api._captured[0].query.visibility).toBe('all');
            expect(api._captured[0].query.since).toBe('2024-01-01T00:00:00Z');
            expect(api._captured[0].query.before).toBe(
                '2024-12-31T23:59:59Z'
            );
        });

        it('createRepositoryForAuthenticatedUser POSTs to /user/repos', async () => {
            const api = makeApi();
            const body = { name: 'hello', private: true };
            await api.createRepositoryForAuthenticatedUser(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://api.github.com/user/repos'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('getRepository hits GET /repos/{owner}/{repo}', async () => {
            const api = makeApi();
            await api.getRepository('octo', 'hello');
            expect(api._captured[0].url).toBe(
                'https://api.github.com/repos/octo/hello'
            );
        });

        it('updateRepository PATCHes /repos/{owner}/{repo}', async () => {
            const api = makeApi();
            await api.updateRepository('octo', 'hello', {
                description: 'x',
            });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toBe(
                'https://api.github.com/repos/octo/hello'
            );
            expect(api._captured[0].body).toEqual({ description: 'x' });
        });
    });

    describe('issues', () => {
        it('listRepositoryIssues hits the issues collection', async () => {
            const api = makeApi();
            await api.listRepositoryIssues('o', 'r', { state: 'open' });
            expect(api._captured[0].url).toBe(
                'https://api.github.com/repos/o/r/issues'
            );
            expect(api._captured[0].query.state).toBe('open');
        });

        it('getIssue hits a single issue', async () => {
            const api = makeApi();
            await api.getIssue('o', 'r', 42);
            expect(api._captured[0].url).toBe(
                'https://api.github.com/repos/o/r/issues/42'
            );
        });

        it('createIssue POSTs a body', async () => {
            const api = makeApi();
            await api.createIssue('o', 'r', { title: 'bug' });
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual({ title: 'bug' });
        });

        it('updateIssue PATCHes', async () => {
            const api = makeApi();
            await api.updateIssue('o', 'r', 1, { state: 'closed' });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toBe(
                'https://api.github.com/repos/o/r/issues/1'
            );
        });

        it('createIssueComment POSTs to .../issues/{n}/comments', async () => {
            const api = makeApi();
            await api.createIssueComment('o', 'r', 318, {
                body: 'Me too',
            });
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://api.github.com/repos/o/r/issues/318/comments'
            );
            expect(api._captured[0].body).toEqual({ body: 'Me too' });
        });
    });

    describe('pull requests', () => {
        it('listPullRequests hits /pulls', async () => {
            const api = makeApi();
            await api.listPullRequests('o', 'r');
            expect(api._captured[0].url).toBe(
                'https://api.github.com/repos/o/r/pulls'
            );
        });

        it('getPullRequest hits a single PR', async () => {
            const api = makeApi();
            await api.getPullRequest('o', 'r', 7);
            expect(api._captured[0].url).toBe(
                'https://api.github.com/repos/o/r/pulls/7'
            );
        });

        it('createPullRequest POSTs (official required: head+base)', async () => {
            const api = makeApi();
            const body = { head: 'feature', base: 'main', issue: 12 };
            await api.createPullRequest('o', 'r', body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual(body);
        });

        it('updateRepositoryWebhook forwards add_events', async () => {
            const api = makeApi();
            await api.updateRepositoryWebhook('o', 'r', 99, {
                add_events: ['pull_request'],
            });
            expect(api._captured[0].body).toEqual({
                add_events: ['pull_request'],
            });
        });

        it('updatePullRequest PATCHes', async () => {
            const api = makeApi();
            await api.updatePullRequest('o', 'r', 7, { title: 'n' });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toBe(
                'https://api.github.com/repos/o/r/pulls/7'
            );
        });
    });

    describe('repository webhooks', () => {
        it('listRepositoryWebhooks hits /hooks', async () => {
            const api = makeApi();
            await api.listRepositoryWebhooks('o', 'r');
            expect(api._captured[0].url).toBe(
                'https://api.github.com/repos/o/r/hooks'
            );
        });

        it('getRepositoryWebhook hits a hook id', async () => {
            const api = makeApi();
            await api.getRepositoryWebhook('o', 'r', 99);
            expect(api._captured[0].url).toBe(
                'https://api.github.com/repos/o/r/hooks/99'
            );
        });

        it('createRepositoryWebhook POSTs config', async () => {
            const api = makeApi();
            const body = {
                name: 'web',
                config: { url: 'https://hook.example.com', content_type: 'json' },
                events: ['push'],
            };
            await api.createRepositoryWebhook('o', 'r', body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual(body);
        });

        it('updateRepositoryWebhook PATCHes', async () => {
            const api = makeApi();
            await api.updateRepositoryWebhook('o', 'r', 99, { active: false });
            expect(api._captured[0].method).toBe('PATCH');
        });

        it('deleteRepositoryWebhook DELETEs', async () => {
            const api = makeApi();
            await api.deleteRepositoryWebhook('o', 'r', 99);
            expect(api._captured[0].method).toBe('DELETE');
            expect(api._captured[0].url).toBe(
                'https://api.github.com/repos/o/r/hooks/99'
            );
        });
    });

    describe('getTokenFromCode', () => {
        it('POSTs to the token URI with Accept application/json', async () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 'csecret',
                redirect_uri: 'https://app.example.com/redirect/github',
            });
            let captured;
            api._post = async (options) => {
                captured = options;
                return {
                    access_token: 'gho_x',
                    token_type: 'bearer',
                    scope: 'repo',
                };
            };
            api.setTokens = async () => {};
            await api.getTokenFromCode('the-code');
            expect(captured.url).toBe(
                'https://github.com/login/oauth/access_token'
            );
            expect(captured.headers.Accept).toBe('application/json');
            expect(captured.body.get('code')).toBe('the-code');
            expect(captured.body.get('client_id')).toBe('cid');
        });
    });
});
