const {
    verifyShopWareSecret,
} = require('../../extensions/webhooks/signature-verifier');
const {
    findIntegrationByTenantId,
} = require('../../extensions/webhooks/lookup');
const {
    onShopWareWebhookReceived,
    onShopWareWebhookResolve,
} = require('../../extensions/webhooks/handlers');

describe('Shop-Ware webhook extension', () => {
    const prev = process.env.SHOPWARE_API_SECRET;

    afterEach(() => {
        if (prev === undefined) delete process.env.SHOPWARE_API_SECRET;
        else process.env.SHOPWARE_API_SECRET = prev;
    });

    it('verifyShopWareSecret accepts a matching header', () => {
        const result = verifyShopWareSecret({
            req: { headers: { 'x-api-secret': 'sec' } },
            secret: 'sec',
        });
        expect(result.valid).toBe(true);
    });

    it('verifyShopWareSecret rejects a mismatch', () => {
        const result = verifyShopWareSecret({
            req: { headers: { 'x-api-secret': 'nope' } },
            secret: 'sec',
        });
        expect(result.valid).toBe(false);
    });

    it('onShopWareWebhookReceived rejects bad secrets with 401', async () => {
        process.env.SHOPWARE_API_SECRET = 'sec';
        const status = jest.fn().mockReturnThis();
        const json = jest.fn();
        const ctx = {
            queueWebhook: jest.fn(),
        };
        await onShopWareWebhookReceived.call(ctx, {
            req: {
                headers: { 'x-api-secret': 'wrong' },
                body: { payload: { tenant_id: 1 } },
            },
            res: { status, json },
        });
        expect(status).toHaveBeenCalledWith(401);
        expect(ctx.queueWebhook).not.toHaveBeenCalled();
    });

    it('onShopWareWebhookReceived queues resolve on valid secret', async () => {
        process.env.SHOPWARE_API_SECRET = 'sec';
        const status = jest.fn().mockReturnThis();
        const json = jest.fn();
        const ctx = { queueWebhook: jest.fn() };
        const body = {
            event: 'customer.created',
            payload: { tenant_id: 69, id: 10, type: 'Customer' },
        };
        await onShopWareWebhookReceived.call(ctx, {
            req: { headers: { 'x-api-secret': 'sec' }, body },
            res: { status, json },
        });
        expect(ctx.queueWebhook).toHaveBeenCalledWith({
            event: 'SHOPWARE_WEBHOOK_RESOLVE',
            body,
        });
        expect(status).toHaveBeenCalledWith(200);
    });

    it('findIntegrationByTenantId matches entity details.tenantId', async () => {
        const ctx = {
            listEntities: async () => [
                {
                    details: { tenantId: 69 },
                    integrationId: 'int-1',
                },
            ],
        };
        await expect(findIntegrationByTenantId(ctx, 69)).resolves.toBe(
            'int-1'
        );
        await expect(findIntegrationByTenantId(ctx, 1)).resolves.toBeNull();
    });

    it('onShopWareWebhookResolve re-enqueues with integrationId', async () => {
        const ctx = {
            listEntities: async () => [
                { details: { tenantId: 69 }, integrationId: 'int-9' },
            ],
            queueWebhook: jest.fn(),
        };
        const body = {
            event: 'customer.updated',
            payload: { tenant_id: 69 },
        };
        await onShopWareWebhookResolve.call(ctx, { data: { body } });
        expect(ctx.queueWebhook).toHaveBeenCalledWith({
            event: 'SHOPWARE_WEBHOOK',
            integrationId: 'int-9',
            body,
        });
    });
});
