const crypto = require('crypto');
const {
    verifyFrontSignature,
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
    CHALLENGE_HEADER,
} = require('../../extensions/webhooks/signature-verifier');
const {
    onFrontWebhookReceived,
    onFrontWebhookResolve,
} = require('../../extensions/webhooks/handlers');
const { findIntegrationByCompanyId } = require('../../extensions/webhooks/lookup');
const extension = require('../../extensions/webhooks');

const SECRET = 'test-front-secret';

function sign(timestamp, rawBody) {
    return crypto
        .createHmac('sha256', SECRET)
        .update(
            Buffer.concat([
                Buffer.from(`${timestamp}:`, 'utf8'),
                Buffer.from(rawBody, 'utf8'),
            ])
        )
        .digest('base64');
}

function mockRes() {
    const res = {
        statusCode: null,
        body: null,
        headers: {},
        status(code) {
            this.statusCode = code;
            return this;
        },
        type(t) {
            this.headers['content-type'] = t;
            return this;
        },
        send(body) {
            this.body = body;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
    return res;
}

describe('front-webhooks extension', () => {
    it('declares the HubSpot-shaped Tier-3 contract', () => {
        expect(extension.name).toBe('front-webhooks');
        expect(extension.useDatabase).toBe(false);
        expect(extension.routes[0]).toEqual({
            path: '/webhooks',
            method: 'POST',
            event: 'FRONT_WEBHOOK_RECEIVED',
        });
        expect(extension.events.FRONT_WEBHOOK_RECEIVED).toBeDefined();
        expect(extension.events.FRONT_WEBHOOK_RESOLVE).toBeDefined();
        expect(extension.events.FRONT_WEBHOOK).toBeDefined();
    });

    describe('verifyFrontSignature', () => {
        it('validates HMAC over timestamp:rawBody', () => {
            const timestamp = '1710000000000';
            const rawBody = '{"type":"inbound_received"}';
            const req = {
                headers: {
                    [SIGNATURE_HEADER]: sign(timestamp, rawBody),
                    [TIMESTAMP_HEADER]: timestamp,
                },
                rawBody,
            };
            expect(verifyFrontSignature({ req, secret: SECRET })).toEqual({
                valid: true,
            });
        });
    });

    describe('onFrontWebhookReceived', () => {
        const prev = process.env.FRONT_WEBHOOK_SECRET;
        beforeAll(() => {
            process.env.FRONT_WEBHOOK_SECRET = SECRET;
        });
        afterAll(() => {
            process.env.FRONT_WEBHOOK_SECRET = prev;
        });

        it('echoes x-front-challenge on sync validation', async () => {
            const timestamp = '1710000000000';
            const rawBody = JSON.stringify({
                type: 'sync',
                authorization: { id: 'cmp_abc' },
            });
            const req = {
                headers: {
                    [SIGNATURE_HEADER]: sign(timestamp, rawBody),
                    [TIMESTAMP_HEADER]: timestamp,
                    [CHALLENGE_HEADER]: 'chal-123',
                },
                rawBody,
                body: JSON.parse(rawBody),
            };
            const res = mockRes();
            const ctx = { queueWebhook: jest.fn() };
            await onFrontWebhookReceived.call(ctx, { req, res });
            expect(res.statusCode).toBe(200);
            expect(res.body).toBe('chal-123');
            expect(ctx.queueWebhook).not.toHaveBeenCalled();
        });

        it('queues FRONT_WEBHOOK_RESOLVE for normal events', async () => {
            const timestamp = '1710000000000';
            const rawBody = JSON.stringify({
                type: 'inbound_received',
                authorization: { id: 'cmp_abc' },
                payload: { id: 'evt_1' },
            });
            const req = {
                headers: {
                    [SIGNATURE_HEADER]: sign(timestamp, rawBody),
                    [TIMESTAMP_HEADER]: timestamp,
                },
                rawBody,
                body: JSON.parse(rawBody),
            };
            const res = mockRes();
            const ctx = { queueWebhook: jest.fn() };
            await onFrontWebhookReceived.call(ctx, { req, res });
            expect(res.statusCode).toBe(200);
            expect(ctx.queueWebhook).toHaveBeenCalledWith({
                event: 'FRONT_WEBHOOK_RESOLVE',
                body: JSON.parse(rawBody),
            });
        });

        it('rejects invalid signatures with 401', async () => {
            const req = {
                headers: {
                    [SIGNATURE_HEADER]: 'bad',
                    [TIMESTAMP_HEADER]: '1710000000000',
                },
                rawBody: '{}',
                body: {},
            };
            const res = mockRes();
            await onFrontWebhookReceived.call(
                { queueWebhook: jest.fn() },
                { req, res }
            );
            expect(res.statusCode).toBe(401);
        });
    });

    describe('onFrontWebhookResolve', () => {
        it('re-enqueues FRONT_WEBHOOK for the owning integration', async () => {
            const body = {
                type: 'tag_added',
                authorization: { id: 'cmp_abc' },
                payload: {},
            };
            const ctx = {
                queueWebhook: jest.fn(),
                integrationMO: {
                    list: async () => [
                        {
                            id: 'int_1',
                            entities: [{ externalId: 'cmp_abc', type: 'front' }],
                        },
                    ],
                },
            };
            await onFrontWebhookResolve.call(ctx, { data: { body } });
            expect(ctx.queueWebhook).toHaveBeenCalledWith({
                event: 'FRONT_WEBHOOK',
                integrationId: 'int_1',
                body,
            });
        });
    });

    describe('findIntegrationByCompanyId', () => {
        it('returns null without an integrationMO', async () => {
            expect(await findIntegrationByCompanyId({}, 'cmp_x')).toBeNull();
        });
    });
});
