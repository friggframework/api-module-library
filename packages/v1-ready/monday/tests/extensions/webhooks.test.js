const crypto = require('crypto');
const {
    onMondayWebhookReceived,
    onMondayWebhookResolve,
} = require('../../extensions/webhooks/handlers');
const {
    verifyMondayWebhookSignature,
} = require('../../extensions/webhooks/signature-verifier');

function sign(payload, secret) {
    const header = Buffer.from(
        JSON.stringify({ alg: 'HS256', typ: 'JWT' })
    ).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const data = `${header}.${body}`;
    const sig = crypto
        .createHmac('sha256', secret)
        .update(data)
        .digest('base64url');
    return `${data}.${sig}`;
}

function mockRes() {
    return {
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
}

describe('monday webhooks extension', () => {
    const prevSecret = process.env.MONDAY_SIGNING_SECRET;

    afterEach(() => {
        if (prevSecret === undefined) delete process.env.MONDAY_SIGNING_SECRET;
        else process.env.MONDAY_SIGNING_SECRET = prevSecret;
    });

    describe('challenge', () => {
        it('echoes the challenge JSON for URL verification', async () => {
            const res = mockRes();
            const ctx = { queueWebhook: jest.fn() };
            await onMondayWebhookReceived.call(ctx, {
                req: { body: { challenge: 'abc123' }, headers: {} },
                res,
            });
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ challenge: 'abc123' });
            expect(ctx.queueWebhook).not.toHaveBeenCalled();
        });
    });

    describe('signature', () => {
        it('skips verification when no signing secret is configured', () => {
            delete process.env.MONDAY_SIGNING_SECRET;
            const result = verifyMondayWebhookSignature({
                headers: {},
            });
            expect(result.valid).toBe(true);
            expect(result.skipped).toBe(true);
        });

        it('rejects missing Authorization when a secret is set', () => {
            const result = verifyMondayWebhookSignature({
                headers: {},
                signingSecret: 'sec',
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('missing_authorization');
        });

        it('accepts a valid JWT', () => {
            const secret = 'sec';
            const token = sign({ boardId: 9 }, secret);
            const result = verifyMondayWebhookSignature({
                headers: { Authorization: token },
                signingSecret: secret,
            });
            expect(result.valid).toBe(true);
        });
    });

    describe('receive → resolve', () => {
        it('queues MONDAY_WEBHOOK_RESOLVE with boardId', async () => {
            delete process.env.MONDAY_SIGNING_SECRET;
            const res = mockRes();
            const ctx = { queueWebhook: jest.fn() };
            await onMondayWebhookReceived.call(ctx, {
                req: {
                    body: {
                        event: {
                            type: 'create_pulse',
                            boardId: 1771812698,
                            pulseId: 1,
                        },
                    },
                    headers: {},
                },
                res,
            });
            expect(res.statusCode).toBe(200);
            expect(ctx.queueWebhook).toHaveBeenCalledWith(
                expect.objectContaining({
                    event: 'MONDAY_WEBHOOK_RESOLVE',
                    body: expect.objectContaining({ boardId: 1771812698 }),
                })
            );
        });

        it('resolve re-enqueues MONDAY_WEBHOOK when lookup succeeds', async () => {
            const ctx = {
                queueWebhook: jest.fn(),
                findIntegrationByBoardId: async () => 'int-1',
            };
            await onMondayWebhookResolve.call(ctx, {
                data: { body: { boardId: 5, event: { type: 'create_pulse' } } },
            });
            expect(ctx.queueWebhook).toHaveBeenCalledWith({
                event: 'MONDAY_WEBHOOK',
                integrationId: 'int-1',
                body: expect.objectContaining({ boardId: 5 }),
            });
        });

        it('resolve skips when boardId is missing', async () => {
            const ctx = { queueWebhook: jest.fn() };
            await onMondayWebhookResolve.call(ctx, { data: { body: {} } });
            expect(ctx.queueWebhook).not.toHaveBeenCalled();
        });
    });
});
