const crypto = require('crypto');
const {
    verifySegmentSignature,
} = require('../extensions/webhooks/signature-verifier');
const {
    onSegmentWebhookReceived,
    onSegmentWebhookResolve,
} = require('../extensions/webhooks/handlers');

function sign(body, secret) {
    const raw = typeof body === 'string' ? body : JSON.stringify(body);
    return crypto.createHmac('sha1', secret).update(raw, 'utf8').digest('hex');
}

describe('Segment webhook signature verifier', () => {
    it('accepts a valid X-Signature HMAC-SHA1 hex digest', () => {
        const body = { type: 'track', event: 'Order Completed' };
        const secret = 'shhh';
        const req = {
            headers: { 'x-signature': sign(body, secret) },
            body,
            rawBody: JSON.stringify(body),
        };
        expect(verifySegmentSignature({ req, secret })).toEqual({
            valid: true,
        });
    });

    it('rejects missing secret, header, or mismatch', () => {
        const body = { type: 'identify' };
        const req = {
            headers: { 'x-signature': 'deadbeef' },
            body,
            rawBody: JSON.stringify(body),
        };
        expect(verifySegmentSignature({ req, secret: '' }).valid).toBe(false);
        expect(
            verifySegmentSignature({
                req: { headers: {}, body, rawBody: '{}' },
                secret: 'x',
            }).valid
        ).toBe(false);
        expect(verifySegmentSignature({ req, secret: 'other' }).valid).toBe(
            false
        );
    });
});

describe('Segment webhook handlers', () => {
    const secret = 'shared';
    const prev = process.env.SEGMENT_WEBHOOK_SHARED_SECRET;

    beforeEach(() => {
        process.env.SEGMENT_WEBHOOK_SHARED_SECRET = secret;
    });
    afterEach(() => {
        process.env.SEGMENT_WEBHOOK_SHARED_SECRET = prev;
    });

    it('onSegmentWebhookReceived verifies and queues resolve', async () => {
        const body = { type: 'track', event: 'Signed Up', writeKey: 'wk_1' };
        const queued = [];
        const ctx = {
            queueWebhook: async (job) => {
                queued.push(job);
            },
        };
        const res = {
            statusCode: null,
            payload: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                this.payload = payload;
                return this;
            },
        };
        const req = {
            headers: {
                'x-signature': sign(body, secret),
                'x-segment-workspace-id': 'ws_1',
            },
            body,
            rawBody: JSON.stringify(body),
        };

        await onSegmentWebhookReceived.call(ctx, { req, res });
        expect(res.statusCode).toBe(200);
        expect(queued).toHaveLength(1);
        expect(queued[0].event).toBe('SEGMENT_WEBHOOK_RESOLVE');
        expect(queued[0].meta.workspaceId).toBe('ws_1');
    });

    it('onSegmentWebhookResolve re-enqueues SEGMENT_WEBHOOK when lookup hits', async () => {
        const queued = [];
        const ctx = {
            queueWebhook: async (job) => {
                queued.push(job);
            },
            Integration: {
                find: async () => [{ id: 'int_9' }],
            },
        };
        await onSegmentWebhookResolve.call(ctx, {
            data: {
                body: { type: 'track' },
                meta: { workspaceId: 'ws_1' },
            },
        });
        expect(queued).toHaveLength(1);
        expect(queued[0]).toMatchObject({
            event: 'SEGMENT_WEBHOOK',
            integrationId: 'int_9',
        });
    });
});
