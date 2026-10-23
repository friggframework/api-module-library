const crypto = require('crypto');
const {
    verifyHiBobSignature,
    isPingTest,
} = require('../../extensions/webhooks/signature-verifier');
const {
    onHiBobWebhookReceived,
    onHiBobWebhookResolve,
} = require('../../extensions/webhooks/handlers');

function sign(secret, body) {
    return crypto
        .createHmac('sha512', secret)
        .update(body, 'utf8')
        .digest('base64');
}

describe('HiBob webhook extension', () => {
    describe('signature verifier', () => {
        it('verifies Bob-Signature HMAC-SHA512 Base64', () => {
            const secret = 's3cret';
            const rawBody = '{"companyId":1,"type":"employee.created"}';
            const result = verifyHiBobSignature({
                req: {
                    headers: { 'Bob-Signature': sign(secret, rawBody) },
                    rawBody,
                },
                secret,
            });
            expect(result.valid).toBe(true);
        });

        it('detects ping test payloads', () => {
            expect(isPingTest({ body: { text: 'Ping test' } })).toBe(true);
            expect(isPingTest({ body: ' Ping test' })).toBe(true);
            expect(isPingTest({ body: { type: 'employee.created' } })).toBe(
                false
            );
        });
    });

    describe('handlers', () => {
        it('responds 200 to ping without verifying signature', async () => {
            const ctx = { queueWebhook: jest.fn() };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };
            await onHiBobWebhookReceived.call(ctx, {
                req: { body: { text: 'Ping test' }, headers: {} },
                res,
            });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(ctx.queueWebhook).not.toHaveBeenCalled();
        });

        it('rejects invalid signatures with 401', async () => {
            process.env.HIBOB_WEBHOOK_SIGNING_SECRET = 's3cret';
            const ctx = { queueWebhook: jest.fn() };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };
            await onHiBobWebhookReceived.call(ctx, {
                req: {
                    headers: { 'bob-signature': 'nope' },
                    rawBody: '{}',
                    body: { companyId: 1 },
                },
                res,
            });
            expect(res.status).toHaveBeenCalledWith(401);
            expect(ctx.queueWebhook).not.toHaveBeenCalled();
        });

        it('queues resolve for a valid signed event', async () => {
            const secret = 's3cret';
            process.env.HIBOB_WEBHOOK_SIGNING_SECRET = secret;
            const body = {
                companyId: 637323,
                type: 'employee.created',
                data: { employeeId: 'e1' },
            };
            const rawBody = JSON.stringify(body);
            const ctx = { queueWebhook: jest.fn() };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };
            await onHiBobWebhookReceived.call(ctx, {
                req: {
                    headers: { 'bob-signature': sign(secret, rawBody) },
                    rawBody,
                    body,
                },
                res,
            });
            expect(ctx.queueWebhook).toHaveBeenCalledWith({
                event: 'HIBOB_WEBHOOK_RESOLVE',
                body,
            });
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it('resolve re-enqueues HIBOB_WEBHOOK for the owning integration', async () => {
            const body = { companyId: 99, type: 'employee.updated' };
            const ctx = {
                queueWebhook: jest.fn(),
                commands: {
                    findIntegrationByEntityExternalId: jest
                        .fn()
                        .mockResolvedValue('integ-1'),
                },
            };
            await onHiBobWebhookResolve.call(ctx, { data: { body } });
            expect(ctx.queueWebhook).toHaveBeenCalledWith({
                event: 'HIBOB_WEBHOOK',
                integrationId: 'integ-1',
                body,
            });
        });
    });
});
