const crypto = require('crypto');
const {
    onIntercomWebhookReceived,
    onIntercomWebhookResolve,
} = require('../../extensions/webhooks/handlers');
const {
    verifyIntercomSignature,
    SIGNATURE_HEADER,
} = require('../../extensions/webhooks/signature-verifier');
const {
    findIntegrationByWorkspaceId,
} = require('../../extensions/webhooks/lookup');
const extension = require('../../extensions/webhooks');

const secret = 'test-client-secret';
const rawBody = JSON.stringify({
    type: 'notification_event',
    topic: 'contact.created',
    app_id: 'ws_abc',
    id: 'notif_1',
    data: { item: { type: 'contact', id: 'ct_1' } },
});

function sign(body, key = secret) {
    return (
        'sha1=' + crypto.createHmac('sha1', key).update(body).digest('hex')
    );
}

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

describe('intercom webhooks extension', () => {
    it('declares the Tier-3 DB-free receiver contract', () => {
        expect(extension.name).toBe('intercom-webhooks');
        expect(extension.useDatabase).toBe(false);
        expect(extension.routes[0]).toEqual({
            path: '/webhooks',
            method: 'POST',
            event: 'INTERCOM_WEBHOOK_RECEIVED',
        });
        expect(extension.events.INTERCOM_WEBHOOK_RECEIVED.handler).toBe(
            onIntercomWebhookReceived
        );
        expect(extension.events.INTERCOM_WEBHOOK_RESOLVE.handler).toBe(
            onIntercomWebhookResolve
        );
    });

    describe('verifyIntercomSignature', () => {
        it('validates HMAC-SHA1 over the raw body', () => {
            const result = verifyIntercomSignature({
                req: {
                    headers: { [SIGNATURE_HEADER]: sign(rawBody) },
                    rawBody,
                    body: JSON.parse(rawBody),
                },
                secret,
            });
            expect(result).toEqual({ valid: true });
        });
    });

    describe('onIntercomWebhookReceived', () => {
        const prevSecret = process.env.INTERCOM_WEBHOOK_SECRET;

        afterEach(() => {
            if (prevSecret === undefined) {
                delete process.env.INTERCOM_WEBHOOK_SECRET;
            } else {
                process.env.INTERCOM_WEBHOOK_SECRET = prevSecret;
            }
        });

        it('rejects invalid signatures with 401', async () => {
            process.env.INTERCOM_WEBHOOK_SECRET = secret;
            const res = mockRes();
            const ctx = { queueWebhook: jest.fn() };
            await onIntercomWebhookReceived.call(ctx, {
                req: {
                    headers: { [SIGNATURE_HEADER]: sign(rawBody, 'bad') },
                    rawBody,
                    body: JSON.parse(rawBody),
                },
                res,
            });
            expect(res.statusCode).toBe(401);
            expect(ctx.queueWebhook).not.toHaveBeenCalled();
        });

        it('queues INTERCOM_WEBHOOK_RESOLVE on valid signature', async () => {
            process.env.INTERCOM_WEBHOOK_SECRET = secret;
            const res = mockRes();
            const ctx = { queueWebhook: jest.fn() };
            const body = JSON.parse(rawBody);
            await onIntercomWebhookReceived.call(ctx, {
                req: {
                    headers: { [SIGNATURE_HEADER]: sign(rawBody) },
                    rawBody,
                    body,
                },
                res,
            });
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({
                received: 1,
                queued: 1,
                skipped: 0,
            });
            expect(ctx.queueWebhook).toHaveBeenCalledWith({
                event: 'INTERCOM_WEBHOOK_RESOLVE',
                body,
            });
        });
    });

    describe('onIntercomWebhookResolve', () => {
        it('re-enqueues INTERCOM_WEBHOOK when a matching integration exists', async () => {
            const ctx = {
                queueWebhook: jest.fn(),
                integrationMO: {
                    list: async () => [
                        {
                            id: 'int_1',
                            entities: [
                                { externalId: 'ws_abc', type: 'intercom' },
                            ],
                        },
                    ],
                },
            };
            await onIntercomWebhookResolve.call(ctx, {
                data: { body: JSON.parse(rawBody) },
            });
            expect(ctx.queueWebhook).toHaveBeenCalledWith({
                event: 'INTERCOM_WEBHOOK',
                integrationId: 'int_1',
                body: JSON.parse(rawBody),
            });
        });
    });

    describe('findIntegrationByWorkspaceId', () => {
        it('returns null without an integrationMO', async () => {
            expect(await findIntegrationByWorkspaceId({}, 'ws_abc')).toBeNull();
        });
    });
});
