const crypto = require('crypto');
const {
    verifyMailchimpSignature,
    SIGNATURE_HEADER,
} = require('../../extensions/webhooks/signature-verifier');
const {
    onMailchimpWebhookReceived,
    onMailchimpWebhookResolve,
    extractAccountId,
} = require('../../extensions/webhooks/handlers');
const {
    findIntegrationByAccountId,
} = require('../../extensions/webhooks/lookup');

function sign(secret, timestamp, rawBody) {
    const hex = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex');
    return `t=${timestamp},v1=${hex}`;
}

describe('Mailchimp webhook signature verifier', () => {
    const secret = 'test-signing-secret-value';
    const rawBody = 'type=subscribe&data%5Blist_id%5D=abc';
    const ts = 1718000000;

    it('accepts a valid signature within the skew window', () => {
        const req = {
            headers: {
                [SIGNATURE_HEADER]: sign(secret, ts, rawBody),
            },
            rawBody,
        };
        const result = verifyMailchimpSignature({
            req,
            secret,
            nowSeconds: ts + 10,
        });
        expect(result).toEqual({ valid: true });
    });

    it('rejects a bad signature', () => {
        const req = {
            headers: {
                [SIGNATURE_HEADER]: `t=${ts},v1=${'ab'.repeat(32)}`,
            },
            rawBody,
        };
        const result = verifyMailchimpSignature({
            req,
            secret,
            nowSeconds: ts,
        });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/mismatch/i);
    });

    it('rejects timestamps outside the tolerance window', () => {
        const req = {
            headers: {
                [SIGNATURE_HEADER]: sign(secret, ts, rawBody),
            },
            rawBody,
        };
        const result = verifyMailchimpSignature({
            req,
            secret,
            nowSeconds: ts + 301,
        });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/tolerance/i);
    });

    it('rejects missing secret or header', () => {
        expect(
            verifyMailchimpSignature({ req: { headers: {} }, secret: '' })
                .valid
        ).toBe(false);
        expect(
            verifyMailchimpSignature({
                req: { headers: {} },
                secret,
            }).reason
        ).toMatch(/missing/i);
    });
});

describe('Mailchimp webhook handlers', () => {
    const prevSecret = process.env.MAILCHIMP_WEBHOOK_SECRET;

    afterEach(() => {
        if (prevSecret === undefined) {
            delete process.env.MAILCHIMP_WEBHOOK_SECRET;
        } else {
            process.env.MAILCHIMP_WEBHOOK_SECRET = prevSecret;
        }
    });

    it('extractAccountId prefers query param', () => {
        expect(
            extractAccountId(
                { query: { account_id: 'from-query' } },
                { account_id: 'from-body' }
            )
        ).toBe('from-query');
    });

    it('receiver queues resolve when account_id is present', async () => {
        delete process.env.MAILCHIMP_WEBHOOK_SECRET;
        const queued = [];
        const ctx = {
            queueWebhook: async (payload) => {
                queued.push(payload);
            },
        };
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
        await onMailchimpWebhookReceived.call(ctx, {
            req: {
                query: { account_id: 'acc-1' },
                body: {
                    type: 'subscribe',
                    data: { list_id: 'list-9', email: 'a@b.com' },
                },
                headers: {},
            },
            res,
        });
        expect(res.statusCode).toBe(200);
        expect(res.body.queued).toBe(true);
        expect(queued[0].event).toBe('MAILCHIMP_WEBHOOK_RESOLVE');
        expect(queued[0].body.account_id).toBe('acc-1');
        expect(queued[0].body.list_id).toBe('list-9');
    });

    it('receiver skips resolve when account_id is missing', async () => {
        delete process.env.MAILCHIMP_WEBHOOK_SECRET;
        const queued = [];
        const ctx = {
            queueWebhook: async (payload) => {
                queued.push(payload);
            },
        };
        const res = {
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(body) {
                this.body = body;
                return this;
            },
        };
        await onMailchimpWebhookReceived.call(ctx, {
            req: {
                query: {},
                body: { type: 'subscribe', data: { list_id: 'L' } },
                headers: {},
            },
            res,
        });
        expect(res.body.skipped).toBe(true);
        expect(queued).toHaveLength(0);
    });

    it('resolve re-enqueues MAILCHIMP_WEBHOOK for the owning integration', async () => {
        const queued = [];
        const ctx = {
            commands: {
                findIntegrationByEntityExternalId: async () => 'integ-42',
            },
            queueWebhook: async (payload) => {
                queued.push(payload);
            },
        };
        await onMailchimpWebhookResolve.call(ctx, {
            data: { body: { account_id: 'acc-1', type: 'subscribe' } },
        });
        expect(queued[0]).toEqual({
            event: 'MAILCHIMP_WEBHOOK',
            integrationId: 'integ-42',
            body: { account_id: 'acc-1', type: 'subscribe' },
        });
    });

    it('findIntegrationByAccountId delegates to commands', async () => {
        const calls = [];
        const integration = {
            commands: {
                findIntegrationByEntityExternalId: async (id, moduleName) => {
                    calls.push({ id, moduleName });
                    return 'x';
                },
            },
        };
        await findIntegrationByAccountId(integration, 'acc');
        expect(calls[0]).toEqual({ id: 'acc', moduleName: 'mailchimp' });
    });
});
