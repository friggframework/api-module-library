const crypto = require('crypto');
const {
    onJiraWebhookReceived,
    onJiraWebhookResolve,
    onJiraWebhook,
} = require('../../extensions/webhooks/handlers');
const {
    verifyJiraWebhookSignature,
} = require('../../extensions/webhooks/signature-verifier');
const {
    findIntegrationByCloudId,
} = require('../../extensions/webhooks/lookup');
const webhooksExt = require('../../extensions/webhooks');

function base64Url(buf) {
    return Buffer.from(buf)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
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

describe('jira webhooks extension', () => {
    it('exports a DB-free Tier-3 bundle with three events', () => {
        expect(webhooksExt.name).toBe('jira-webhooks');
        expect(webhooksExt.useDatabase).toBe(false);
        expect(webhooksExt.routes[0]).toEqual({
            path: '/webhooks',
            method: 'POST',
            event: 'JIRA_WEBHOOK_RECEIVED',
        });
        expect(Object.keys(webhooksExt.events).sort()).toEqual([
            'JIRA_WEBHOOK',
            'JIRA_WEBHOOK_RECEIVED',
            'JIRA_WEBHOOK_RESOLVE',
        ]);
    });

    describe('verifyJiraWebhookSignature', () => {
        it('validates a JWT with JIRA_CLIENT_SECRET', () => {
            const secret = 'secret-1';
            const token = signHs256({ aud: 'jira' }, secret);
            const result = verifyJiraWebhookSignature({
                headers: { Authorization: `Bearer ${token}` },
                clientSecret: secret,
            });
            expect(result.valid).toBe(true);
        });

        it('fails without a client secret', () => {
            const prev = process.env.JIRA_CLIENT_SECRET;
            delete process.env.JIRA_CLIENT_SECRET;
            const result = verifyJiraWebhookSignature({
                headers: { Authorization: 'Bearer x.y.z' },
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('missing_client_secret');
            if (prev !== undefined) process.env.JIRA_CLIENT_SECRET = prev;
        });
    });

    describe('handlers', () => {
        it('rejects invalid signatures with 401', async () => {
            const prev = process.env.JIRA_CLIENT_SECRET;
            process.env.JIRA_CLIENT_SECRET = 'sec';
            const res = {
                statusCode: null,
                body: null,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(body) {
                    this.body = body;
                    return this;
                },
            };
            const ctx = {
                queueWebhook: jest.fn(),
            };
            await onJiraWebhookReceived.call(ctx, {
                req: { body: {}, headers: {} },
                res,
            });
            expect(res.statusCode).toBe(401);
            expect(ctx.queueWebhook).not.toHaveBeenCalled();
            if (prev !== undefined) process.env.JIRA_CLIENT_SECRET = prev;
            else delete process.env.JIRA_CLIENT_SECRET;
        });

        it('queues resolve with cloudId from query on valid JWT', async () => {
            const secret = 'sec';
            const prev = process.env.JIRA_CLIENT_SECRET;
            process.env.JIRA_CLIENT_SECRET = secret;
            const token = signHs256({ sub: 'app' }, secret);
            const res = {
                statusCode: null,
                body: null,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(body) {
                    this.body = body;
                    return this;
                },
            };
            const ctx = { queueWebhook: jest.fn() };
            await onJiraWebhookReceived.call(ctx, {
                req: {
                    body: { webhookEvent: 'jira:issue_created', issue: { id: '1' } },
                    headers: { Authorization: `Bearer ${token}` },
                    query: { cloudId: 'cloud-99' },
                },
                res,
            });
            expect(res.statusCode).toBe(200);
            expect(ctx.queueWebhook).toHaveBeenCalledWith(
                expect.objectContaining({
                    event: 'JIRA_WEBHOOK_RESOLVE',
                    body: expect.objectContaining({ cloudId: 'cloud-99' }),
                })
            );
            if (prev !== undefined) process.env.JIRA_CLIENT_SECRET = prev;
            else delete process.env.JIRA_CLIENT_SECRET;
        });

        it('resolve looks up integration and re-enqueues JIRA_WEBHOOK', async () => {
            const ctx = {
                findIntegrationByExternalId: async (id) =>
                    id === 'cloud-99' ? 'integ-1' : null,
                queueWebhook: jest.fn(),
            };
            await onJiraWebhookResolve.call(ctx, {
                data: { body: { cloudId: 'cloud-99', event: {} } },
            });
            expect(ctx.queueWebhook).toHaveBeenCalledWith({
                event: 'JIRA_WEBHOOK',
                integrationId: 'integ-1',
                body: { cloudId: 'cloud-99', event: {} },
            });
        });

        it('resolve skips when cloudId is missing', async () => {
            const ctx = { queueWebhook: jest.fn() };
            await onJiraWebhookResolve.call(ctx, { data: { body: {} } });
            expect(ctx.queueWebhook).not.toHaveBeenCalled();
        });

        it('default JIRA_WEBHOOK handler is a no-op', async () => {
            await expect(onJiraWebhook()).resolves.toBeUndefined();
        });
    });

    describe('lookup', () => {
        it('uses findIntegrationByExternalId when present', async () => {
            const id = await findIntegrationByCloudId(
                { findIntegrationByExternalId: async (x) => `ext:${x}` },
                'c1'
            );
            expect(id).toBe('ext:c1');
        });

        it('returns null without helpers', async () => {
            expect(await findIntegrationByCloudId({}, 'c1')).toBeNull();
        });
    });
});
