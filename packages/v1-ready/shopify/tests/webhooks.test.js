const crypto = require('crypto');
const {
    verifyShopifySignature,
} = require('../extensions/webhooks/signature-verifier');
const {
    onShopifyWebhookReceived,
    onShopifyWebhookResolve,
} = require('../extensions/webhooks/handlers');

describe('Shopify webhook extension', () => {
    it('verifies a valid HMAC', () => {
        const secret = 'shh';
        const body = '{"hello":"world"}';
        const digest = crypto
            .createHmac('sha256', secret)
            .update(body)
            .digest('base64');
        const result = verifyShopifySignature({
            req: {
                headers: { 'x-shopify-hmac-sha256': digest },
                rawBody: body,
            },
            clientSecret: secret,
        });
        expect(result.valid).toBe(true);
    });

    it('receiver rejects bad signatures', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        process.env.SHOPIFY_CLIENT_SECRET = 'shh';
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
        await onShopifyWebhookReceived.call(ctx, {
            req: {
                headers: {
                    'x-shopify-hmac-sha256': 'bad',
                    'x-shopify-shop-domain': 'acme.myshopify.com',
                },
                body: {},
            },
            res,
        });
        expect(res.statusCode).toBe(401);
        expect(ctx.queueWebhook).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    it('resolve looks up the shop domain and re-enqueues', async () => {
        const queued = [];
        const ctx = {
            commands: {
                findIntegrationByEntityExternalId: async (shop) =>
                    shop === 'acme.myshopify.com' ? 'int-1' : null,
            },
            queueWebhook: async (job) => {
                queued.push(job);
            },
        };
        await onShopifyWebhookResolve.call(ctx, {
            data: {
                body: {
                    shopDomain: 'acme.myshopify.com',
                    topic: 'orders/create',
                    payload: { id: 1 },
                },
            },
        });
        expect(queued).toEqual([
            {
                event: 'SHOPIFY_WEBHOOK',
                integrationId: 'int-1',
                body: expect.objectContaining({
                    shopDomain: 'acme.myshopify.com',
                }),
            },
        ]);
    });
});
