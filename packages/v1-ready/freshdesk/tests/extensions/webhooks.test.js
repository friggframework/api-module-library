const webhooks = require('../../extensions/webhooks');
const {
    onFreshdeskWebhookReceived,
    onFreshdeskWebhookResolve,
} = require('../../extensions/webhooks/handlers');

describe('freshdesk-webhooks extension', () => {
    it('declares the Tier-3 DB-free receiver shape', () => {
        expect(webhooks.name).toBe('freshdesk-webhooks');
        expect(webhooks.useDatabase).toBe(false);
        expect(Object.keys(webhooks.events)).toEqual(
            expect.arrayContaining([
                'FRESHDESK_WEBHOOK_RECEIVED',
                'FRESHDESK_WEBHOOK_RESOLVE',
                'FRESHDESK_WEBHOOK',
            ])
        );
    });

    it('rejects webhooks missing domain and account_id', async () => {
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
        await onFreshdeskWebhookReceived.call(ctx, {
            req: { body: {}, query: {} },
            res,
        });
        expect(res.statusCode).toBe(400);
        expect(ctx.queueWebhook).not.toHaveBeenCalled();
    });

    it('queues resolve with domain from query', async () => {
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
        await onFreshdeskWebhookReceived.call(ctx, {
            req: {
                body: { ticket_id: 1 },
                query: { domain: 'acme' },
                headers: {},
            },
            res,
        });
        expect(res.statusCode).toBe(200);
        expect(ctx.queueWebhook).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'FRESHDESK_WEBHOOK_RESOLVE',
                body: expect.objectContaining({ domain: 'acme' }),
            })
        );
    });

    it('resolve looks up integration and re-queues FRESHDESK_WEBHOOK', async () => {
        const ctx = {
            queueWebhook: jest.fn(),
            commands: {
                findIntegrationByEntityExternalId: jest
                    .fn()
                    .mockResolvedValue('integ-1'),
            },
        };
        await onFreshdeskWebhookResolve.call(ctx, {
            data: {
                body: {
                    domain: 'acme',
                    accountId: '1840509',
                    payload: { ticket_id: 9 },
                },
            },
        });
        expect(
            ctx.commands.findIntegrationByEntityExternalId
        ).toHaveBeenCalledWith('1840509', 'freshdesk');
        expect(ctx.queueWebhook).toHaveBeenCalledWith({
            event: 'FRESHDESK_WEBHOOK',
            integrationId: 'integ-1',
            body: expect.objectContaining({ accountId: '1840509' }),
        });
    });
});
