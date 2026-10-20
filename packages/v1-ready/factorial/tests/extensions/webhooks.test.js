const {
    onFactorialWebhookReceived,
    onFactorialWebhookResolve,
} = require('../../extensions/webhooks/handlers');
const { findIntegrationByCompanyId } = require('../../extensions/webhooks/lookup');
const extension = require('../../extensions/webhooks');

describe('Factorial webhooks extension', () => {
    it('registers the hubspot-style DB-free receiver contract', () => {
        expect(extension.name).toBe('factorial-webhooks');
        expect(extension.useDatabase).toBe(false);
        expect(extension.routes).toEqual([
            {
                path: '/webhooks',
                method: 'POST',
                event: 'FACTORIAL_WEBHOOK_RECEIVED',
            },
        ]);
        expect(extension.events.FACTORIAL_WEBHOOK_RECEIVED).toBeDefined();
        expect(extension.events.FACTORIAL_WEBHOOK_RESOLVE).toBeDefined();
        expect(extension.events.FACTORIAL_WEBHOOK).toBeDefined();
    });

    it('rejects deliveries with a bad challenge', async () => {
        process.env.FACTORIAL_WEBHOOK_CHALLENGE = 'good';
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
        await onFactorialWebhookReceived.call(ctx, {
            req: {
                headers: { 'x-factorial-wh-challenge': 'bad' },
                body: { id: 1, company_id: 9 },
            },
            res,
        });
        expect(res.statusCode).toBe(401);
        expect(ctx.queueWebhook).not.toHaveBeenCalled();
        delete process.env.FACTORIAL_WEBHOOK_CHALLENGE;
    });

    it('queues resolve when challenge matches and company_id is present', async () => {
        process.env.FACTORIAL_WEBHOOK_CHALLENGE = 'good';
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
        const body = { id: 2, company_id: 157412, first_name: 'Ana' };
        await onFactorialWebhookReceived.call(ctx, {
            req: {
                headers: { 'x-factorial-wh-challenge': 'good' },
                body,
            },
            res,
        });
        expect(res.statusCode).toBe(200);
        expect(ctx.queueWebhook).toHaveBeenCalledWith({
            event: 'FACTORIAL_WEBHOOK_RESOLVE',
            body,
        });
        delete process.env.FACTORIAL_WEBHOOK_CHALLENGE;
    });

    it('resolve re-enqueues FACTORIAL_WEBHOOK for a known company', async () => {
        const ctx = {
            queueWebhook: jest.fn(),
            Entity: {
                find: async () => [
                    { identifiers: { externalId: '7' }, integrationId: 'int-1' },
                ],
            },
        };
        await onFactorialWebhookResolve.call(ctx, {
            data: { body: { id: 1, company_id: 7 } },
        });
        expect(ctx.queueWebhook).toHaveBeenCalledWith({
            event: 'FACTORIAL_WEBHOOK',
            integrationId: 'int-1',
            body: { id: 1, company_id: 7 },
        });
    });

    it('findIntegrationByCompanyId returns null without Entity', async () => {
        expect(await findIntegrationByCompanyId({}, 1)).toBeNull();
    });
});
