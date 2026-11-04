const crypto = require('crypto');
const {
    onAirtableWebhookReceived,
    onAirtableWebhookResolve,
    onAirtableWebhook,
} = require('../../extensions/webhooks/handlers');
const { verifyAirtableSignature } = require('../../extensions/webhooks/signature-verifier');
const { findIntegrationByBaseId } = require('../../extensions/webhooks/lookup');
const extension = require('../../extensions/webhooks');

function mockRes() {
    const res = {
        statusCode: null,
        body: null,
        ended: false,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
        end() {
            this.ended = true;
            return this;
        },
    };
    return res;
}

describe('airtable-webhooks extension', () => {
    it('declares the HubSpot-shaped DB-free bundle', () => {
        expect(extension.name).toBe('airtable-webhooks');
        expect(extension.useDatabase).toBe(false);
        expect(extension.routes[0]).toEqual({
            path: '/webhooks',
            method: 'POST',
            event: 'AIRTABLE_WEBHOOK_RECEIVED',
        });
        expect(extension.events.AIRTABLE_WEBHOOK_RECEIVED).toBeTruthy();
        expect(extension.events.AIRTABLE_WEBHOOK_RESOLVE).toBeTruthy();
        expect(extension.events.AIRTABLE_WEBHOOK).toBeTruthy();
    });

    describe('verifyAirtableSignature', () => {
        it('matches the official MAC algorithm', () => {
            const secret = Buffer.from('hook-secret');
            const payload = {
                base: { id: 'appX' },
                webhook: { id: 'achY' },
                timestamp: '2022-02-01T21:25:05.663Z',
            };
            const bodyStr = JSON.stringify(payload);
            const hmac = crypto.createHmac('sha256', secret);
            hmac.update(bodyStr, 'ascii');
            const header = `hmac-sha256=${hmac.digest('hex')}`;
            const result = verifyAirtableSignature({
                req: {
                    headers: { 'x-airtable-content-mac': header },
                    body: payload,
                },
                macSecretBase64: secret.toString('base64'),
            });
            expect(result.valid).toBe(true);
        });
    });

    describe('onAirtableWebhookReceived', () => {
        const prev = process.env.AIRTABLE_WEBHOOK_MAC_SECRET;

        afterEach(() => {
            if (prev === undefined) {
                delete process.env.AIRTABLE_WEBHOOK_MAC_SECRET;
            } else {
                process.env.AIRTABLE_WEBHOOK_MAC_SECRET = prev;
            }
        });

        it('rejects malformed pings', async () => {
            const res = mockRes();
            const ctx = { queueWebhook: jest.fn() };
            await onAirtableWebhookReceived.call(ctx, {
                req: { body: { hello: true }, headers: {} },
                res,
            });
            expect(res.statusCode).toBe(400);
            expect(ctx.queueWebhook).not.toHaveBeenCalled();
        });

        it('queues resolve and returns 204 when shape is valid', async () => {
            delete process.env.AIRTABLE_WEBHOOK_MAC_SECRET;
            const res = mockRes();
            const ctx = { queueWebhook: jest.fn() };
            const body = {
                base: { id: 'app1' },
                webhook: { id: 'ach1' },
                timestamp: '2022-02-01T21:25:05.663Z',
            };
            await onAirtableWebhookReceived.call(ctx, {
                req: { body, headers: {} },
                res,
            });
            expect(res.statusCode).toBe(204);
            expect(res.ended).toBe(true);
            expect(ctx.queueWebhook).toHaveBeenCalledWith({
                event: 'AIRTABLE_WEBHOOK_RESOLVE',
                body,
            });
        });

        it('rejects when MAC secret is set and signature is wrong', async () => {
            process.env.AIRTABLE_WEBHOOK_MAC_SECRET = Buffer.from('s').toString(
                'base64'
            );
            const res = mockRes();
            const ctx = { queueWebhook: jest.fn() };
            await onAirtableWebhookReceived.call(ctx, {
                req: {
                    body: {
                        base: { id: 'app1' },
                        webhook: { id: 'ach1' },
                    },
                    headers: { 'x-airtable-content-mac': 'hmac-sha256=nope' },
                },
                res,
            });
            expect(res.statusCode).toBe(401);
            expect(ctx.queueWebhook).not.toHaveBeenCalled();
        });
    });

    describe('onAirtableWebhookResolve', () => {
        it('re-enqueues AIRTABLE_WEBHOOK when a base match is found', async () => {
            const ctx = {
                queueWebhook: jest.fn(),
                commands: {
                    getEntitiesForModule: async () => [
                        {
                            details: { baseIds: ['app1'] },
                            integrationId: 'int-9',
                        },
                    ],
                },
            };
            await onAirtableWebhookResolve.call(ctx, {
                data: {
                    body: {
                        base: { id: 'app1' },
                        webhook: { id: 'ach1' },
                    },
                },
            });
            expect(ctx.queueWebhook).toHaveBeenCalledWith({
                event: 'AIRTABLE_WEBHOOK',
                integrationId: 'int-9',
                body: {
                    base: { id: 'app1' },
                    webhook: { id: 'ach1' },
                },
            });
        });
    });

    describe('findIntegrationByBaseId', () => {
        it('matches entity.details.baseIds', async () => {
            const integration = {
                commands: {
                    getEntitiesForModule: async () => [
                        { details: { baseIds: ['appZ'] }, integrationId: 'i1' },
                    ],
                },
            };
            await expect(
                findIntegrationByBaseId(integration, 'appZ')
            ).resolves.toBe('i1');
        });
    });

    describe('onAirtableWebhook', () => {
        it('is a no-op by default', async () => {
            await expect(
                onAirtableWebhook({ data: { body: {} } })
            ).resolves.toBeUndefined();
        });
    });
});
