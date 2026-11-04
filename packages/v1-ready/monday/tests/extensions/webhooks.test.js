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
    const body = Buffer.from(
        JSON.stringify({
            exp: Math.floor(Date.now() / 1000) + 3600,
            ...payload,
        })
    ).toString('base64url');
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
        it('fails closed when no signing secret is configured', () => {
            delete process.env.MONDAY_SIGNING_SECRET;
            const result = verifyMondayWebhookSignature({
                headers: { Authorization: 'x.y.z' },
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('no_secret');
        });

        it('rejects missing Authorization when a secret is set', () => {
            const result = verifyMondayWebhookSignature({
                headers: {},
                signingSecret: 'sec',
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('missing');
        });

        it('rejects alg none', () => {
            const header = Buffer.from(
                JSON.stringify({ alg: 'none', typ: 'JWT' })
            ).toString('base64url');
            const body = Buffer.from(
                JSON.stringify({
                    exp: Math.floor(Date.now() / 1000) + 3600,
                })
            ).toString('base64url');
            const token = `${header}.${body}.`;
            const result = verifyMondayWebhookSignature({
                headers: { Authorization: token },
                signingSecret: 'sec',
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('alg');
        });

        it('accepts a valid HS256 JWT', () => {
            const secret = 'sec';
            const token = sign({ boardId: 9 }, secret);
            const result = verifyMondayWebhookSignature({
                headers: { Authorization: token },
                signingSecret: secret,
            });
            expect(result.valid).toBe(true);
            expect(result.payload.boardId).toBe(9);
        });
    });

    describe('receive → resolve', () => {
        it('queues MONDAY_WEBHOOK_RESOLVE with boardId when JWT is valid', async () => {
            const secret = 'webhook-secret';
            process.env.MONDAY_SIGNING_SECRET = secret;
            const token = sign({ boardId: 1771812698 }, secret);
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
                    headers: { Authorization: token },
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

        it('rejects events with invalid JWT', async () => {
            process.env.MONDAY_SIGNING_SECRET = 'sec';
            const res = mockRes();
            const ctx = { queueWebhook: jest.fn() };
            await onMondayWebhookReceived.call(ctx, {
                req: {
                    body: { event: { boardId: 1 } },
                    headers: { Authorization: 'not.a.jwt' },
                },
                res,
            });
            expect(res.statusCode).toBe(401);
            expect(ctx.queueWebhook).not.toHaveBeenCalled();
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
