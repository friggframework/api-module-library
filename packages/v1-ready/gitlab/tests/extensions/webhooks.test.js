const {
    onGitLabWebhookReceived,
    onGitLabWebhookResolve,
    onGitLabWebhook,
} = require('../../extensions/webhooks/handlers');
const { findIntegrationByProjectId } = require('../../extensions/webhooks/lookup');
const {
    verifyGitLabWebhookSignature,
} = require('../../extensions/webhooks/signature-verifier');

describe('gitlab webhook extension', () => {
    const prevSecret = process.env.GITLAB_WEBHOOK_SECRET;

    afterEach(() => {
        if (prevSecret === undefined) {
            delete process.env.GITLAB_WEBHOOK_SECRET;
        } else {
            process.env.GITLAB_WEBHOOK_SECRET = prevSecret;
        }
    });

    it('verifyGitLabWebhookSignature accepts X-Gitlab-Token', () => {
        process.env.GITLAB_WEBHOOK_SECRET = 'tok';
        const result = verifyGitLabWebhookSignature({
            headers: { 'x-gitlab-token': 'tok' },
            body: { object_kind: 'issue' },
        });
        expect(result.valid).toBe(true);
    });

    it('receiver rejects invalid signatures', async () => {
        process.env.GITLAB_WEBHOOK_SECRET = 'expected';
        const queued = [];
        const ctx = {
            queueWebhook: async (job) => queued.push(job),
        };
        const res = {
            statusCode: null,
            body: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                this.body = payload;
                return this;
            },
        };
        await onGitLabWebhookReceived.call(ctx, {
            req: {
                headers: { 'x-gitlab-token': 'wrong' },
                body: { project: { id: 1 } },
            },
            res,
        });
        expect(res.statusCode).toBe(401);
        expect(queued).toHaveLength(0);
    });

    it('receiver queues resolve with projectId on valid token', async () => {
        process.env.GITLAB_WEBHOOK_SECRET = 'tok';
        const queued = [];
        const ctx = {
            queueWebhook: async (job) => queued.push(job),
        };
        const res = {
            statusCode: null,
            body: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                this.body = payload;
                return this;
            },
        };
        await onGitLabWebhookReceived.call(ctx, {
            req: {
                headers: {
                    'x-gitlab-token': 'tok',
                    'x-gitlab-event': 'Issue Hook',
                },
                body: {
                    object_kind: 'issue',
                    project: { id: 15 },
                },
            },
            res,
        });
        expect(res.statusCode).toBe(200);
        expect(queued[0].event).toBe('GITLAB_WEBHOOK_RESOLVE');
        expect(queued[0].body.projectId).toBe(15);
    });

    it('resolve re-enqueues GITLAB_WEBHOOK when project maps', async () => {
        const queued = [];
        const ctx = {
            findIntegrationByExternalId: async () => 'integ-1',
            queueWebhook: async (job) => queued.push(job),
        };
        await onGitLabWebhookResolve.call(ctx, {
            data: { body: { projectId: 15, raw: {} } },
        });
        expect(queued[0]).toEqual({
            event: 'GITLAB_WEBHOOK',
            integrationId: 'integ-1',
            body: { projectId: 15, raw: {} },
        });
    });

    it('findIntegrationByProjectId returns null without helpers', async () => {
        expect(await findIntegrationByProjectId({}, 1)).toBeNull();
    });

    it('default GITLAB_WEBHOOK handler is a no-op', async () => {
        await expect(onGitLabWebhook()).resolves.toBeUndefined();
    });
});
