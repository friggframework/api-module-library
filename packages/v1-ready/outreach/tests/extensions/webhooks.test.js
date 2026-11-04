const crypto = require('crypto');
const {
    verifyOutreachSignature,
    SIGNATURE_HEADER,
} = require('../../extensions/webhooks/signature-verifier');
const { findIntegrationByExternalId } = require('../../extensions/webhooks/lookup');
const {
    onOutreachWebhookReceived,
    onOutreachWebhookResolve,
} = require('../../extensions/webhooks/handlers');

describe('Outreach webhook signature verifier', () => {
    it('accepts a valid Outreach-Webhook-Signature', () => {
        const secret = 'whsec';
        const rawBody = '{"data":{"type":"prospect","id":1}}';
        const signature = crypto
            .createHmac('sha256', secret)
            .update(rawBody)
            .digest('hex');
        const result = verifyOutreachSignature({
            req: {
                headers: { [SIGNATURE_HEADER]: signature },
                rawBody,
            },
            secret,
        });
        expect(result.valid).toBe(true);
    });

    it('rejects a missing or wrong signature', () => {
        expect(
            verifyOutreachSignature({
                req: { headers: {}, rawBody: '{}' },
                secret: 'x',
            }).valid
        ).toBe(false);
        expect(
            verifyOutreachSignature({
                req: {
                    headers: { [SIGNATURE_HEADER]: 'nope' },
                    rawBody: '{}',
                },
                secret: 'x',
            }).valid
        ).toBe(false);
    });
});

describe('Outreach webhook lookup', () => {
    it('finds a single matching outreach entity by externalId', async () => {
        const ctx = {
            integrations: [
                {
                    id: 'int-1',
                    entities: [
                        { type: 'outreach', externalId: 'org-abc' },
                    ],
                },
            ],
        };
        expect(await findIntegrationByExternalId(ctx, 'org-abc')).toBe(
            'int-1'
        );
        expect(await findIntegrationByExternalId(ctx, 'missing')).toBeNull();
    });
});

describe('Outreach webhook handlers', () => {
    it('receiver rejects invalid signatures with 401', async () => {
        const queued = [];
        const status = { code: null, body: null };
        const ctx = {
            queueWebhook: async (job) => queued.push(job),
        };
        const req = {
            headers: {},
            body: { data: { type: 'task', id: 1 } },
            params: {},
        };
        const res = {
            status(code) {
                status.code = code;
                return this;
            },
            json(body) {
                status.body = body;
            },
        };
        process.env.OUTREACH_WEBHOOK_SECRET = 'secret';
        await onOutreachWebhookReceived.call(ctx, { req, res });
        expect(status.code).toBe(401);
        expect(queued).toHaveLength(0);
        delete process.env.OUTREACH_WEBHOOK_SECRET;
    });

    it('receiver queues resolve with path externalId on valid signature', async () => {
        const secret = 'secret';
        const body = {
            data: { type: 'prospect', id: 9 },
            meta: { eventName: 'prospect.updated', deliveredAt: 't' },
        };
        const rawBody = JSON.stringify(body);
        const signature = crypto
            .createHmac('sha256', secret)
            .update(rawBody)
            .digest('hex');
        const queued = [];
        const status = { code: null };
        const ctx = {
            queueWebhook: async (job) => queued.push(job),
        };
        process.env.OUTREACH_WEBHOOK_SECRET = secret;
        await onOutreachWebhookReceived.call(ctx, {
            req: {
                headers: { [SIGNATURE_HEADER]: signature },
                rawBody,
                body,
                params: { externalId: 'org-1' },
            },
            res: {
                status(code) {
                    status.code = code;
                    return this;
                },
                json() {},
            },
        });
        expect(status.code).toBe(200);
        expect(queued[0].event).toBe('OUTREACH_WEBHOOK_RESOLVE');
        expect(queued[0].body.externalId).toBe('org-1');
        delete process.env.OUTREACH_WEBHOOK_SECRET;
    });

    it('resolve re-enqueues OUTREACH_WEBHOOK for the matched integration', async () => {
        const queued = [];
        const ctx = {
            integrations: [
                {
                    id: 'int-9',
                    entities: [{ type: 'outreach', externalId: 'org-9' }],
                },
            ],
            queueWebhook: async (job) => queued.push(job),
        };
        await onOutreachWebhookResolve.call(ctx, {
            data: {
                body: {
                    externalId: 'org-9',
                    payload: { data: { id: 1 } },
                },
            },
        });
        expect(queued[0]).toEqual({
            event: 'OUTREACH_WEBHOOK',
            integrationId: 'int-9',
            body: { data: { id: 1 } },
        });
    });
});
