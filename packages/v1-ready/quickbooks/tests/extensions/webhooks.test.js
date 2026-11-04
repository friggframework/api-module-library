const crypto = require('crypto');
const webhooksExtension = require('../../extensions/webhooks');
const {
    verifyQuickBooksSignature,
    SIGNATURE_HEADER,
} = require('../../extensions/webhooks/signature-verifier');
const {
    findIntegrationByRealmId,
} = require('../../extensions/webhooks/lookup');
const {
    onQuickBooksWebhookReceived,
    onQuickBooksWebhookResolve,
    extractNotifications,
} = require('../../extensions/webhooks/handlers');

const VERIFIER = 'qb-verifier-token';

const sign = (body) =>
    crypto.createHmac('sha256', VERIFIER).update(body, 'utf8').digest('base64');

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

describe('quickbooks-webhooks extension bundle shape', () => {
    it('conforms to the Tier 3 contract', () => {
        expect(webhooksExtension).toEqual(
            expect.objectContaining({
                name: 'quickbooks-webhooks',
                useDatabase: false,
                routes: expect.any(Array),
                events: expect.any(Object),
            })
        );
        expect(webhooksExtension.routes[0]).toEqual({
            path: '/webhooks',
            method: 'POST',
            event: 'QUICKBOOKS_WEBHOOK_RECEIVED',
        });
        expect(webhooksExtension.events).toHaveProperty(
            'QUICKBOOKS_WEBHOOK_RECEIVED'
        );
        expect(webhooksExtension.events).toHaveProperty(
            'QUICKBOOKS_WEBHOOK_RESOLVE'
        );
        expect(webhooksExtension.events).toHaveProperty('QUICKBOOKS_WEBHOOK');
    });
});

describe('signature verification', () => {
    it('validates HMAC-SHA256 base64 over the raw body', () => {
        const rawBody = '{"eventNotifications":[]}';
        const req = {
            headers: { [SIGNATURE_HEADER]: sign(rawBody) },
            rawBody,
            body: JSON.parse(rawBody),
        };
        expect(
            verifyQuickBooksSignature({ req, verifierToken: VERIFIER })
        ).toEqual({ valid: true });
    });

    it('rejects tampered bodies', () => {
        const req = {
            headers: { [SIGNATURE_HEADER]: sign('{"a":1}') },
            rawBody: '{"a":2}',
        };
        const result = verifyQuickBooksSignature({
            req,
            verifierToken: VERIFIER,
        });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/mismatch/);
    });
});

describe('extractNotifications', () => {
    it('expands legacy eventNotifications by realmId + entity', () => {
        const rows = extractNotifications({
            eventNotifications: [
                {
                    realmId: '9130',
                    dataChangeEvent: {
                        entities: [
                            {
                                name: 'Customer',
                                id: '58',
                                operation: 'Create',
                            },
                            {
                                name: 'Payment',
                                id: '1',
                                operation: 'Create',
                            },
                        ],
                    },
                },
            ],
        });
        expect(rows).toHaveLength(2);
        expect(rows[0].realmId).toBe('9130');
        expect(rows[0].entity.name).toBe('Customer');
        expect(rows[1].entity.name).toBe('Payment');
    });

    it('reads CloudEvents intuitaccountid as realmId', () => {
        const rows = extractNotifications([
            {
                specversion: '1.0',
                type: 'qbo.customer.created.v1',
                intuitentityid: '123',
                intuitaccountid: '9341455327810551',
            },
        ]);
        expect(rows).toHaveLength(1);
        expect(rows[0].realmId).toBe('9341455327810551');
        expect(rows[0].format).toBe('cloudevents');
        expect(rows[0].entity.id).toBe('123');
    });
});

describe('handlers', () => {
    const prev = process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN;
    beforeEach(() => {
        process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN = VERIFIER;
    });
    afterEach(() => {
        process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN = prev;
    });

    it('receiver rejects invalid signatures with 401', async () => {
        const ctx = { queueWebhook: jest.fn() };
        const res = makeRes();
        await onQuickBooksWebhookReceived.call(ctx, {
            req: {
                headers: { [SIGNATURE_HEADER]: 'bad' },
                rawBody: '{}',
                body: {},
            },
            res,
        });
        expect(res.status).toHaveBeenCalledWith(401);
        expect(ctx.queueWebhook).not.toHaveBeenCalled();
    });

    it('receiver queues one resolve job per legacy entity', async () => {
        const body = {
            eventNotifications: [
                {
                    realmId: '9130',
                    dataChangeEvent: {
                        entities: [
                            { name: 'Customer', id: '1', operation: 'Create' },
                        ],
                    },
                },
            ],
        };
        const rawBody = JSON.stringify(body);
        const ctx = { queueWebhook: jest.fn() };
        const res = makeRes();
        await onQuickBooksWebhookReceived.call(ctx, {
            req: {
                headers: { [SIGNATURE_HEADER]: sign(rawBody) },
                rawBody,
                body,
            },
            res,
        });
        expect(ctx.queueWebhook).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'QUICKBOOKS_WEBHOOK_RESOLVE',
                body: expect.objectContaining({ realmId: '9130' }),
            })
        );
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('resolve looks up realmId and re-enqueues QUICKBOOKS_WEBHOOK', async () => {
        const ctx = {
            queueWebhook: jest.fn(),
            commands: {
                findIntegrationByEntityExternalId: jest
                    .fn()
                    .mockResolvedValue('integ-1'),
            },
        };
        await onQuickBooksWebhookResolve.call(ctx, {
            data: {
                body: {
                    realmId: '9130',
                    entity: { name: 'Customer', id: '1' },
                },
            },
        });
        expect(ctx.queueWebhook).toHaveBeenCalledWith({
            event: 'QUICKBOOKS_WEBHOOK',
            integrationId: 'integ-1',
            body: expect.objectContaining({ realmId: '9130' }),
        });
    });
});

describe('findIntegrationByRealmId', () => {
    it('delegates to findIntegrationByEntityExternalId with moduleName', async () => {
        const integration = {
            commands: {
                findIntegrationByEntityExternalId: jest
                    .fn()
                    .mockResolvedValue('id-9'),
            },
        };
        const id = await findIntegrationByRealmId(integration, '9130');
        expect(id).toBe('id-9');
        expect(
            integration.commands.findIntegrationByEntityExternalId
        ).toHaveBeenCalledWith('9130', 'quickbooks');
    });
});
