const crypto = require('crypto');
const { Api, verifyStandardWebhookSignature } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'test-token',
        client_id: 'cid',
        client_secret: 'csec',
        redirect_uri: 'https://app.example/redirect/gitlab',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { id: 1 };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 1 };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { id: 1 };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('GitLab Api', () => {
    describe('construction & auth', () => {
        it('defaults to gitlab.com api/v4 and oauth hosts', () => {
            const api = new Api({ access_token: 't' });
            expect(api.host).toBe('https://gitlab.com');
            expect(api.baseUrl).toBe('https://gitlab.com/api/v4');
            expect(api.tokenUri).toBe('https://gitlab.com/oauth/token');
            expect(api.getAuthorizationUri()).toContain(
                'https://gitlab.com/oauth/authorize?'
            );
        });

        it('honors a Self-Managed host override', () => {
            const api = new Api({
                access_token: 't',
                host: 'https://gitlab.example.com/',
            });
            expect(api.host).toBe('https://gitlab.example.com');
            expect(api.baseUrl).toBe('https://gitlab.example.com/api/v4');
            expect(api.tokenUri).toBe(
                'https://gitlab.example.com/oauth/token'
            );
        });

        it('getAuthorizationRequirements is oauth2 with authorize url', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app/redirect/gitlab',
                scope: 'api read_user',
            });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain('client_id=cid');
            expect(reqs.url).toContain('response_type=code');
            expect(reqs.url).toContain('scope=api+read_user');
        });

        it('adds Bearer Authorization header', async () => {
            const api = new Api({ access_token: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
        });
    });

    describe('identity & projects', () => {
        it('getCurrentUser hits GET /user', async () => {
            const api = makeApi();
            await api.getCurrentUser();
            expect(api._captured[0].url).toBe(
                'https://gitlab.com/api/v4/user'
            );
        });

        it('listProjects hits GET /projects with query', async () => {
            const api = makeApi();
            await api.listProjects({ membership: true, per_page: 20 });
            expect(api._captured[0].url).toBe(
                'https://gitlab.com/api/v4/projects'
            );
            expect(api._captured[0].query).toEqual({
                membership: true,
                per_page: 20,
            });
        });

        it('getProject encodes path ids', async () => {
            const api = makeApi();
            await api.getProject('group/subgroup/proj');
            expect(api._captured[0].url).toBe(
                'https://gitlab.com/api/v4/projects/group%2Fsubgroup%2Fproj'
            );
        });

        it('createProject POSTs JSON body', async () => {
            const api = makeApi();
            await api.createProject({ name: 'demo', visibility: 'private' });
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual({
                name: 'demo',
                visibility: 'private',
            });
        });

        it('updateProject PUTs to /projects/:id', async () => {
            const api = makeApi();
            await api.updateProject(42, { description: 'x' });
            expect(api._captured[0].url).toBe(
                'https://gitlab.com/api/v4/projects/42'
            );
            expect(api._captured[0].method).toBe('PUT');
        });
    });

    describe('issues', () => {
        it('listIssues / getIssue / createIssue / updateIssue paths', async () => {
            const api = makeApi();
            await api.listIssues(7, { state: 'opened' });
            await api.getIssue(7, 3);
            await api.createIssue(7, { title: 'Bug' });
            await api.updateIssue(7, 3, { state_event: 'close' });
            expect(api._captured[0].url).toBe(
                'https://gitlab.com/api/v4/projects/7/issues'
            );
            expect(api._captured[0].query).toEqual({ state: 'opened' });
            expect(api._captured[1].url).toBe(
                'https://gitlab.com/api/v4/projects/7/issues/3'
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[2].body).toEqual({ title: 'Bug' });
            expect(api._captured[3].method).toBe('PUT');
        });
    });

    describe('merge requests', () => {
        it('list / get / create / update paths', async () => {
            const api = makeApi();
            await api.listMergeRequests(9, { state: 'opened' });
            await api.getMergeRequest(9, 1);
            await api.createMergeRequest(9, {
                source_branch: 'feat',
                target_branch: 'main',
                title: 'MR',
            });
            await api.updateMergeRequest(9, 1, { title: 'MR2' });
            expect(api._captured[0].url).toBe(
                'https://gitlab.com/api/v4/projects/9/merge_requests'
            );
            expect(api._captured[1].url).toBe(
                'https://gitlab.com/api/v4/projects/9/merge_requests/1'
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[3].method).toBe('PUT');
        });
    });

    describe('project hooks', () => {
        it('CRUD paths', async () => {
            const api = makeApi();
            await api.listProjectHooks(5);
            await api.getProjectHook(5, 11);
            await api.createProjectHook(5, {
                url: 'https://hook.example/gitlab',
                issues_events: true,
            });
            await api.updateProjectHook(5, 11, {
                url: 'https://hook.example/gitlab',
                merge_requests_events: true,
            });
            await api.deleteProjectHook(5, 11);
            expect(api._captured[0].url).toBe(
                'https://gitlab.com/api/v4/projects/5/hooks'
            );
            expect(api._captured[1].url).toBe(
                'https://gitlab.com/api/v4/projects/5/hooks/11'
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[3].method).toBe('PUT');
            expect(api._captured[4].method).toBe('DELETE');
        });
    });

    describe('verifyWebhookSignature', () => {
        it('accepts matching X-Gitlab-Token', () => {
            const api = new Api({ webhookSecret: 's3cret' });
            const result = api.verifyWebhookSignature({
                headers: { 'X-Gitlab-Token': 's3cret' },
                body: { object_kind: 'issue' },
            });
            expect(result).toEqual({ valid: true, method: 'X-Gitlab-Token' });
        });

        it('rejects mismatched X-Gitlab-Token', () => {
            const api = new Api({ webhookSecret: 's3cret' });
            const result = api.verifyWebhookSignature({
                headers: { 'X-Gitlab-Token': 'nope' },
                body: {},
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('bad_token');
        });

        it('verifies Standard Webhooks HMAC signing token', () => {
            const key = crypto.randomBytes(32);
            const signingToken = `whsec_${key.toString('base64')}`;
            const messageId = 'msg_123';
            const timestamp = String(Math.floor(Date.now() / 1000));
            const body = JSON.stringify({ object_kind: 'push' });
            const signed = `${messageId}.${timestamp}.${body}`;
            const digest = crypto
                .createHmac('sha256', key)
                .update(signed)
                .digest('base64');
            const api = new Api({ webhookSecret: signingToken });
            const result = api.verifyWebhookSignature({
                headers: {
                    'webhook-id': messageId,
                    'webhook-timestamp': timestamp,
                    'webhook-signature': `v1,${digest}`,
                },
                rawBody: body,
            });
            expect(result).toEqual({
                valid: true,
                method: 'webhook-signature',
            });
            expect(
                verifyStandardWebhookSignature(
                    signingToken,
                    messageId,
                    timestamp,
                    Buffer.from(body),
                    `v1,${digest}`
                )
            ).toBe(true);
        });

        it('fails when no secret configured', () => {
            const api = new Api({});
            const result = api.verifyWebhookSignature({
                headers: { 'X-Gitlab-Token': 'x' },
                body: {},
            });
            expect(result).toEqual({
                valid: false,
                reason: 'missing_secret',
            });
        });
    });
});
