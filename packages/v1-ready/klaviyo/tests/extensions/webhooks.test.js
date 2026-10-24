const crypto = require('crypto');
const webhooksExtension = require('../../extensions/webhooks');
const {
    verifyKlaviyoSignature,
} = require('../../extensions/webhooks/signature-verifier');
const {
    findIntegrationByAccountId,
} = require('../../extensions/webhooks/lookup');
const {
    onKlaviyoWebhookReceived,
    onKlaviyoWebhookResolve,
    onKlaviyoWebhook,
} = require('../../extensions/webhooks/handlers');

const SECRET = 'sixteen-chars-min-secret';

const buildSignedRequest = ({
    body = {
        data: [
            {
                external_id: 'evt1',
                topic: 'event:klaviyo.opened_email',
                payload: {},
            },
        ],
        meta: {
            klaviyo_account_id: 'AbC123',
            klaviyo_webhook_id: 'wh-abc',
            timestamp: '2024-01-04T13:05:25.891446+00:00',
        },
    },
    timestamp = 'Thu, 04 Jan 2024 18:05:25 GMT',
    secret = SECRET,
    overrideSignature,
} = {}) => {
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const signature = crypto
        .createHmac('sha256', secret)
        .update(bodyString)
        .update(timestamp)
        .digest('hex');

    return {
        method: 'POST',
        body: typeof body === 'string' ? JSON.parse(body) : body,
        rawBody: bodyString,
        headers: {
            'klaviyo-signature': overrideSignature ?? signature,
            'klaviyo-timestamp': timestamp,
            'klaviyo-webhook-id':
                (typeof body === 'object' &&
                    body.meta &&
                    body.meta.klaviyo_webhook_id) ||
                'wh-abc',
        },
    };
};

const makeRes = () => {
    const res = {};
    res.status = jest.fn((code) => {
        res.statusCode = code;
        return res;
    });
    res.json = jest.fn((payload) => {
        res.body = payload;
        return res;
    });
    return res;
};

describe('klaviyo-webhooks extension bundle shape', () => {
    it('conforms to the Tier 3 contract', () => {
        expect(webhooksExtension).toEqual(
            expect.objectContaining({
                name: 'klaviyo-webhooks',
                routes: expect.any(Array),
                events: expect.any(Object),
            })
        );
        expect(webhooksExtension.useDatabase).toBe(false);
        expect(webhooksExtension.routes[0]).toEqual({
            path: '/webhooks',
            method: 'POST',
            event: 'KLAVIYO_WEBHOOK_RECEIVED',
        });
    });

    it('declares receiver, resolve, and webhook event handlers', () => {
        expect(webhooksExtension.events.KLAVIYO_WEBHOOK_RECEIVED.handler).toBe(
            onKlaviyoWebhookReceived
        );
        expect(webhooksExtension.events.KLAVIYO_WEBHOOK_RESOLVE.handler).toBe(
            onKlaviyoWebhookResolve
        );
        expect(webhooksExtension.events.KLAVIYO_WEBHOOK.handler).toBe(
            onKlaviyoWebhook
        );
    });
});

describe('verifyKlaviyoSignature', () => {
    it('accepts a correctly signed body', () => {
        const req = buildSignedRequest();
        expect(
            verifyKlaviyoSignature({ req, secret: SECRET }).valid
        ).toBe(true);
    });

    it('rejects a bad signature', () => {
        const req = buildSignedRequest({ overrideSignature: 'deadbeef' });
        const result = verifyKlaviyoSignature({ req, secret: SECRET });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/mismatch/i);
    });

    it('rejects missing secret', () => {
        const req = buildSignedRequest();
        expect(verifyKlaviyoSignature({ req, secret: null }).valid).toBe(
            false
        );
    });
});

describe('handlers', () => {
    const prevSecret = process.env.KLAVIYO_WEBHOOK_SECRET;

    beforeEach(() => {
        process.env.KLAVIYO_WEBHOOK_SECRET = SECRET;
    });

    afterEach(() => {
        process.env.KLAVIYO_WEBHOOK_SECRET = prevSecret;
    });

    it('onKlaviyoWebhookReceived queues resolve on valid signature', async () => {
        const req = buildSignedRequest();
        const res = makeRes();
        const ctx = { queueWebhook: jest.fn(async () => {}) };
        await onKlaviyoWebhookReceived.call(ctx, { req, res });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(ctx.queueWebhook).toHaveBeenCalledWith(
            expect.objectContaining({ event: 'KLAVIYO_WEBHOOK_RESOLVE' })
        );
    });

    it('onKlaviyoWebhookReceived rejects invalid signature', async () => {
        const req = buildSignedRequest({ overrideSignature: 'nope' });
        const res = makeRes();
        const ctx = { queueWebhook: jest.fn(async () => {}) };
        await onKlaviyoWebhookReceived.call(ctx, { req, res });
        expect(res.status).toHaveBeenCalledWith(401);
        expect(ctx.queueWebhook).not.toHaveBeenCalled();
    });

    it('onKlaviyoWebhookResolve re-enqueues bound webhook', async () => {
        const body = buildSignedRequest().body;
        const ctx = {
            queueWebhook: jest.fn(async () => {}),
            commands: {
                findIntegrationByEntityExternalId: jest.fn(async () => 'int-1'),
            },
        };
        await onKlaviyoWebhookResolve.call(ctx, { data: { body } });
        expect(ctx.queueWebhook).toHaveBeenCalledWith({
            event: 'KLAVIYO_WEBHOOK',
            integrationId: 'int-1',
            body,
        });
    });
});

describe('findIntegrationByAccountId', () => {
    it('delegates to findIntegrationByEntityExternalId with moduleName', async () => {
        const integration = {
            commands: {
                findIntegrationByEntityExternalId: jest.fn(async () => 'x'),
            },
        };
        await findIntegrationByAccountId(integration, 'AbC123');
        expect(
            integration.commands.findIntegrationByEntityExternalId
        ).toHaveBeenCalledWith('AbC123', 'klaviyo');
    });
});
