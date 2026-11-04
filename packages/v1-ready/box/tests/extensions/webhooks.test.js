const crypto = require('crypto');
const {
    onBoxWebhookReceived,
    onBoxWebhookResolve,
} = require('../../extensions/webhooks/handlers');
const {
    findIntegrationByBoxUserId,
} = require('../../extensions/webhooks/lookup');

const primaryKey = 'primary-secret';
const bodyObj = {
    type: 'webhook_event',
    id: 'evt-1',
    trigger: 'FILE.UPLOADED',
    created_by: { type: 'user', id: '98765', login: 'sean@example.com' },
    source: { type: 'file', id: '42' },
};
const body = JSON.stringify(bodyObj);
const timestamp = new Date().toISOString();
const signature = crypto
    .createHmac('sha256', primaryKey)
    .update(body)
    .update(timestamp)
    .digest('base64');

describe('box webhook extension', () => {
    const prevPrimary = process.env.BOX_WEBHOOK_PRIMARY_KEY;

    beforeAll(() => {
        process.env.BOX_WEBHOOK_PRIMARY_KEY = primaryKey;
    });

    afterAll(() => {
        if (prevPrimary === undefined) {
            delete process.env.BOX_WEBHOOK_PRIMARY_KEY;
        } else {
            process.env.BOX_WEBHOOK_PRIMARY_KEY = prevPrimary;
        }
    });

    it('rejects invalid signatures with 401', async () => {
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
        await onBoxWebhookReceived.call(ctx, {
            req: {
                headers: {
                    'box-delivery-timestamp': timestamp,
                    'box-signature-primary': 'bad',
                },
                rawBody: body,
                body: bodyObj,
            },
            res,
        });
        expect(res.statusCode).toBe(401);
        expect(ctx.queueWebhook).not.toHaveBeenCalled();
    });

    it('queues BOX_WEBHOOK_RESOLVE on valid signature', async () => {
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
        await onBoxWebhookReceived.call(ctx, {
            req: {
                headers: {
                    'box-delivery-timestamp': timestamp,
                    'box-signature-primary': signature,
                },
                rawBody: body,
                body: bodyObj,
            },
            res,
        });
        expect(res.statusCode).toBe(200);
        expect(ctx.queueWebhook).toHaveBeenCalledWith({
            event: 'BOX_WEBHOOK_RESOLVE',
            body: bodyObj,
        });
    });

    it('resolve looks up integration by created_by.id', async () => {
        const ctx = {
            getEntitiesForModule: async () => [
                { externalId: '98765', integrationId: 'int-1' },
            ],
            queueWebhook: jest.fn(),
        };
        await onBoxWebhookResolve.call(ctx, { data: { body: bodyObj } });
        expect(ctx.queueWebhook).toHaveBeenCalledWith({
            event: 'BOX_WEBHOOK',
            integrationId: 'int-1',
            body: bodyObj,
        });
    });

    it('findIntegrationByBoxUserId returns null when unmatched', async () => {
        const id = await findIntegrationByBoxUserId(
            { getEntitiesForModule: async () => [] },
            'nope'
        );
        expect(id).toBeNull();
    });
});
