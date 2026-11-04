const crypto = require('crypto');
const {
    onClickUpWebhookReceived,
    onClickUpWebhookResolve,
} = require('../../extensions/webhooks/handlers');
const { findIntegrationByTeamId } = require('../../extensions/webhooks/lookup');
const webhooks = require('../../extensions/webhooks');

function mockRes() {
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
    return res;
}

describe('clickup webhooks extension', () => {
    it('exports a DB-free bundle with receive/resolve/webhook events', () => {
        expect(webhooks.name).toBe('clickup-webhooks');
        expect(webhooks.useDatabase).toBe(false);
        expect(webhooks.routes[0].event).toBe('CLICKUP_WEBHOOK_RECEIVED');
        expect(webhooks.events.CLICKUP_WEBHOOK_RESOLVE).toBeDefined();
        expect(webhooks.events.CLICKUP_WEBHOOK).toBeDefined();
    });

    it('findIntegrationByTeamId prefers findIntegrationByExternalId', async () => {
        const ctx = {
            findIntegrationByExternalId: async (id) => `int-${id}`,
        };
        await expect(findIntegrationByTeamId(ctx, 1234)).resolves.toBe(
            'int-1234'
        );
    });

    it('receiver queues resolve with teamId when present', async () => {
        const queued = [];
        const ctx = {
            queueWebhook: async (job) => queued.push(job),
        };
        const res = mockRes();
        await onClickUpWebhookReceived.call(ctx, {
            req: {
                headers: {},
                body: {
                    event: 'taskCreated',
                    task_id: 'c0j',
                    webhook_id: 'wh-1',
                    team_id: '999',
                },
            },
            res,
        });
        expect(res.statusCode).toBe(200);
        expect(queued[0].event).toBe('CLICKUP_WEBHOOK_RESOLVE');
        expect(queued[0].body.teamId).toBe('999');
    });

    it('receiver rejects invalid signature when secret env is set', async () => {
        const prev = process.env.CLICKUP_WEBHOOK_SECRET;
        process.env.CLICKUP_WEBHOOK_SECRET = 'secret';
        try {
            const ctx = { queueWebhook: async () => {} };
            const res = mockRes();
            await onClickUpWebhookReceived.call(ctx, {
                req: {
                    headers: { 'X-Signature': 'bad' },
                    rawBody: '{"event":"taskCreated"}',
                    body: { event: 'taskCreated' },
                },
                res,
            });
            expect(res.statusCode).toBe(401);
        } finally {
            if (prev === undefined) delete process.env.CLICKUP_WEBHOOK_SECRET;
            else process.env.CLICKUP_WEBHOOK_SECRET = prev;
        }
    });

    it('receiver accepts a valid signature when secret env is set', async () => {
        const prev = process.env.CLICKUP_WEBHOOK_SECRET;
        process.env.CLICKUP_WEBHOOK_SECRET = 'secret';
        try {
            const raw = '{"event":"taskCreated","team_id":"1"}';
            const signature = crypto
                .createHmac('sha256', 'secret')
                .update(raw)
                .digest('hex');
            const queued = [];
            const ctx = {
                queueWebhook: async (job) => queued.push(job),
            };
            const res = mockRes();
            await onClickUpWebhookReceived.call(ctx, {
                req: {
                    headers: { 'X-Signature': signature },
                    rawBody: raw,
                    body: JSON.parse(raw),
                },
                res,
            });
            expect(res.statusCode).toBe(200);
            expect(queued).toHaveLength(1);
        } finally {
            if (prev === undefined) delete process.env.CLICKUP_WEBHOOK_SECRET;
            else process.env.CLICKUP_WEBHOOK_SECRET = prev;
        }
    });

    it('resolve re-enqueues CLICKUP_WEBHOOK when team maps to an integration', async () => {
        const queued = [];
        const ctx = {
            findIntegrationByExternalId: async () => 'integ-1',
            queueWebhook: async (job) => queued.push(job),
        };
        await onClickUpWebhookResolve.call(ctx, {
            data: { body: { teamId: '999', event: 'taskCreated' } },
        });
        expect(queued[0]).toEqual({
            event: 'CLICKUP_WEBHOOK',
            integrationId: 'integ-1',
            body: { teamId: '999', event: 'taskCreated' },
        });
    });

    it('resolve skips when teamId is missing', async () => {
        const queued = [];
        const ctx = {
            queueWebhook: async (job) => queued.push(job),
        };
        await onClickUpWebhookResolve.call(ctx, {
            data: { body: { webhook_id: 'wh-1' } },
        });
        expect(queued).toHaveLength(0);
    });
});
