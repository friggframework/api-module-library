const crypto = require('crypto');
const { Api, verifyHs256Jwt } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'test-token',
        client_id: 'cid',
        client_secret: 'csecret',
        cloudId: 'cloud-123',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return {};
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: '1' };
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

function signHs256(payload, secret) {
    const header = base64Url(
        Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    );
    const body = base64Url(Buffer.from(JSON.stringify(payload)));
    const data = `${header}.${body}`;
    const sig = base64Url(
        crypto.createHmac('sha256', secret).update(data).digest()
    );
    return `${data}.${sig}`;
}

function base64Url(buf) {
    return Buffer.from(buf)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

describe('Jira Api', () => {
    describe('construction & auth URLs', () => {
        it('builds OAuth baseUrl with cloudId placeholder when unset', () => {
            const api = new Api({});
            expect(api.baseUrl).toBe(
                'https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3'
            );
            expect(api.tokenUri).toBe('https://auth.atlassian.com/oauth/token');
        });

        it('applies cloudId into baseUrl', () => {
            const api = new Api({ cloudId: 'abc-def' });
            expect(api.baseUrl).toBe(
                'https://api.atlassian.com/ex/jira/abc-def/rest/api/3'
            );
        });

        it('authorization URI includes audience, prompt=consent, and scopes', () => {
            const api = new Api({
                client_id: 'my-client',
                redirect_uri: 'https://app.example/redirect/jira',
                scope: 'read:jira-work offline_access',
                state: 'st',
            });
            const uri = api.getAuthorizationUri();
            expect(uri).toContain('https://auth.atlassian.com/authorize?');
            expect(uri).toContain('audience=api.atlassian.com');
            expect(uri).toContain('client_id=my-client');
            expect(uri).toContain('prompt=consent');
            expect(uri).toContain('response_type=code');
            expect(uri).toContain('offline_access');
            expect(uri).toContain('state=st');
        });

        it('setCloudId updates baseUrl and site metadata', () => {
            const api = new Api({});
            api.setCloudId('site-1', {
                url: 'https://acme.atlassian.net',
                name: 'Acme',
            });
            expect(api.cloudId).toBe('site-1');
            expect(api.siteUrl).toBe('https://acme.atlassian.net');
            expect(api.siteName).toBe('Acme');
            expect(api.baseUrl).toContain('/ex/jira/site-1/');
        });
    });

    describe('token exchange', () => {
        it('getTokenFromCode POSTs JSON to the Atlassian token URI', async () => {
            const api = makeApi({ cloudId: null });
            api.client_id = 'cid';
            api.client_secret = 'sec';
            api.redirect_uri = 'https://app/cb';
            let setTokensArg = null;
            api.setTokens = async (t) => {
                setTokensArg = t;
            };
            api._post = async (options) => {
                api._captured.push(options);
                return {
                    access_token: 'a',
                    refresh_token: 'r',
                    expires_in: 3600,
                };
            };
            await api.getTokenFromCode('auth-code');
            expect(api._captured[0].url).toBe(
                'https://auth.atlassian.com/oauth/token'
            );
            expect(api._captured[0].headers['Content-Type']).toBe(
                'application/json'
            );
            expect(api._captured[0].body).toEqual({
                grant_type: 'authorization_code',
                client_id: 'cid',
                client_secret: 'sec',
                code: 'auth-code',
                redirect_uri: 'https://app/cb',
            });
            expect(setTokensArg.access_token).toBe('a');
        });

        it('refreshAccessToken POSTs JSON with rotating refresh_token', async () => {
            const api = makeApi();
            api._post = async (options) => {
                api._captured.push(options);
                return {
                    access_token: 'a2',
                    refresh_token: 'r2',
                    expires_in: 3600,
                };
            };
            api.setTokens = async () => {};
            await api.refreshAccessToken({ refresh_token: 'r1' });
            expect(api._captured[0].body).toEqual({
                grant_type: 'refresh_token',
                client_id: 'cid',
                client_secret: 'csecret',
                refresh_token: 'r1',
            });
        });
    });

    describe('identity', () => {
        it('getAccessibleResources hits the absolute Atlassian URL', async () => {
            const api = makeApi();
            await api.getAccessibleResources();
            expect(api._captured[0].url).toBe(
                'https://api.atlassian.com/oauth/token/accessible-resources'
            );
        });

        it('ensureCloudId picks the first jira-scoped resource', async () => {
            const api = new Api({ access_token: 't' });
            api.getAccessibleResources = async () => [
                {
                    id: 'conf-1',
                    name: 'Wiki',
                    scopes: ['read:confluence-content.all'],
                },
                {
                    id: 'jira-9',
                    name: 'Work',
                    url: 'https://work.atlassian.net',
                    scopes: ['read:jira-work'],
                },
            ];
            const id = await api.ensureCloudId();
            expect(id).toBe('jira-9');
            expect(api.baseUrl).toContain('/ex/jira/jira-9/');
            expect(api.siteName).toBe('Work');
        });

        it('getCurrentUser hits GET /myself', async () => {
            const api = makeApi();
            await api.getCurrentUser();
            expect(api._captured[0].url).toBe(
                'https://api.atlassian.com/ex/jira/cloud-123/rest/api/3/myself'
            );
        });
    });

    describe('projects', () => {
        it('searchProjects hits /project/search', async () => {
            const api = makeApi();
            await api.searchProjects({ maxResults: 10 });
            expect(api._captured[0].url).toBe(
                'https://api.atlassian.com/ex/jira/cloud-123/rest/api/3/project/search'
            );
            expect(api._captured[0].query).toEqual({ maxResults: 10 });
        });

        it('getProject / createProject / updateProject hit the project paths', async () => {
            const api = makeApi();
            await api.getProject('DEMO');
            await api.createProject({ key: 'DEMO', name: 'Demo' });
            await api.updateProject('DEMO', { name: 'Demo 2' });
            expect(api._captured[0].url).toContain('/project/DEMO');
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[1].url).toContain('/project');
            expect(api._captured[2].method).toBe('PUT');
        });
    });

    describe('issues', () => {
        it('CRUD hits /issue paths', async () => {
            const api = makeApi();
            await api.createIssue({ fields: { summary: 'x' } });
            await api.getIssue('DEMO-1');
            await api.editIssue('DEMO-1', { fields: { summary: 'y' } });
            await api.deleteIssue('DEMO-1');
            expect(api._captured.map((c) => c.method)).toEqual([
                'POST',
                'GET',
                'PUT',
                'DELETE',
            ]);
            expect(api._captured[1].url).toContain('/issue/DEMO-1');
        });

        it('searchAndReconsileIssuesUsingJql hits /search/jql', async () => {
            const api = makeApi();
            await api.searchAndReconsileIssuesUsingJql({ jql: 'project = DEMO' });
            expect(api._captured[0].url).toContain('/search/jql');
            expect(api._captured[0].query.jql).toBe('project = DEMO');
        });
    });

    describe('comments & users', () => {
        it('getComments and addComment hit issue comment paths', async () => {
            const api = makeApi();
            await api.getComments('DEMO-1');
            await api.addComment('DEMO-1', { body: { type: 'doc', content: [] } });
            expect(api._captured[0].url).toContain('/issue/DEMO-1/comment');
            expect(api._captured[1].method).toBe('POST');
        });

        it('findUsers hits /user/search', async () => {
            const api = makeApi();
            await api.findUsers({ query: 'ada' });
            expect(api._captured[0].url).toContain('/user/search');
        });
    });

    describe('webhooks', () => {
        it('get/register/delete/refresh hit /webhook paths', async () => {
            const api = makeApi();
            await api.getDynamicWebhooksForApp({ startAt: 0 });
            await api.registerDynamicWebhooks({
                url: 'https://hook.example/jira',
                webhooks: [
                    {
                        events: ['jira:issue_created'],
                        jqlFilter: 'project = DEMO',
                    },
                ],
            });
            await api.deleteWebhookById({ webhookIds: [1, 2] });
            await api.refreshWebhooks({ webhookIds: [1] });
            expect(api._captured[0].url).toContain('/webhook');
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[2].method).toBe('DELETE');
            expect(api._captured[2].body).toEqual({ webhookIds: [1, 2] });
            expect(api._captured[3].url).toContain('/webhook/refresh');
        });
    });

    describe('verifyWebhookSignature / verifyHs256Jwt', () => {
        it('accepts a valid HS256 JWT signed with the client secret', () => {
            const secret = 'client-secret';
            const token = signHs256({ iss: 'jira', sub: 'app' }, secret);
            const result = verifyHs256Jwt(token, secret);
            expect(result.valid).toBe(true);
            expect(result.payload.iss).toBe('jira');
        });

        it('rejects a bad signature', () => {
            const token = signHs256({ iss: 'jira' }, 'right');
            expect(verifyHs256Jwt(token, 'wrong').valid).toBe(false);
        });

        it('Api.verifyWebhookSignature reads Authorization header', () => {
            const secret = 'csecret';
            const token = signHs256({ cloudId: 'c1' }, secret);
            const api = new Api({ client_secret: secret });
            const result = api.verifyWebhookSignature({
                headers: { Authorization: `Bearer ${token}` },
            });
            expect(result.valid).toBe(true);
            expect(result.payload.cloudId).toBe('c1');
        });
    });
});
