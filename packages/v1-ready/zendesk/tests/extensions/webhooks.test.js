const crypto = require('crypto');
const {
    verifyZendeskSignature,
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
} = require('../../extensions/webhooks/signature-verifier');
const {
    onZendeskWebhookReceived,
} = require('../../extensions/webhooks/handlers');

const SECRET = 'test-signing-secret';

function sign(timestamp, body) {
    return crypto
        .createHmac('sha256', SECRET)
        .update(String(timestamp) + body, 'utf8')
        .digest('base64');
}

describe('Zendesk webhook signature verifier', () => {
    it('accepts a valid HMAC signature', () => {
        const body = '{"hello":"world"}';
        const timestamp = '2020-01-01T00:00:00Z';
        const req = {
            method: 'POST',
            headers: {
                [SIGNATURE_HEADER]: sign(timestamp, body),
                [TIMESTAMP_HEADER]: timestamp,
            },
            rawBody: body,
            body: JSON.parse(body),
        };
        expect(
            verifyZendeskSignature({ req, signingSecret: SECRET })
        ).toEqual({ valid: true });
    });

    it('rejects a bad signature', () => {
        const req = {
            method: 'POST',
            headers: {
                [SIGNATURE_HEADER]: 'nope',
                [TIMESTAMP_HEADER]: '2020-01-01T00:00:00Z',
            },
            rawBody: '{}',
            body: {},
        };
        const result = verifyZendeskSignature({
            req,
            signingSecret: SECRET,
        });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/mismatch/i);
    });

    it('rejects missing secret or headers', () => {
        expect(
            verifyZendeskSignature({ req: { headers: {} }, signingSecret: '' })
                .valid
        ).toBe(false);
        expect(
            verifyZendeskSignature({
                req: { headers: {} },
                signingSecret: SECRET,
            }).reason
        ).toMatch(/signature/i);
    });
});

describe('Zendesk webhook receiver', () => {
    const prev = process.env.ZENDESK_WEBHOOK_SIGNING_SECRET;

    afterEach(() => {
        if (prev === undefined) {
            delete process.env.ZENDESK_WEBHOOK_SIGNING_SECRET;
        } else {
            process.env.ZENDESK_WEBHOOK_SIGNING_SECRET = prev;
        }
    });

    it('returns 401 on bad signature', async () => {
        process.env.ZENDESK_WEBHOOK_SIGNING_SECRET = SECRET;
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
        const ctx = {
            queueWebhook: jest.fn(),
        };
        await onZendeskWebhookReceived.call(ctx, {
            req: {
                method: 'POST',
                headers: {},
                body: {},
                rawBody: '{}',
                query: {},
            },
            res,
        });
        expect(res.statusCode).toBe(401);
        expect(ctx.queueWebhook).not.toHaveBeenCalled();
    });

    it('queues ZENDESK_WEBHOOK_RESOLVE on valid signature', async () => {
        process.env.ZENDESK_WEBHOOK_SIGNING_SECRET = SECRET;
        const body = '{"id":1}';
        const timestamp = 'ts';
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
        const ctx = { queueWebhook: jest.fn() };
        await onZendeskWebhookReceived.call(ctx, {
            req: {
                method: 'POST',
                headers: {
                    [SIGNATURE_HEADER]: sign(timestamp, body),
                    [TIMESTAMP_HEADER]: timestamp,
                },
                rawBody: body,
                body: JSON.parse(body),
                query: { subdomain: 'acme' },
            },
            res,
        });
        expect(res.statusCode).toBe(200);
        expect(ctx.queueWebhook).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'ZENDESK_WEBHOOK_RESOLVE',
                body: expect.objectContaining({ subdomain: 'acme' }),
            })
        );
    });
});
