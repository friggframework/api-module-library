const {
    verifyOptionsHandshake,
    verifyWebhookKey,
    EXPECTED_ORIGIN,
} = require('../../extensions/webhooks/signature-verifier');
const {
    findIntegrationByEnvironmentId,
    findIntegrationBySubscriptionId,
    hashEnvironmentId,
} = require('../../extensions/webhooks/lookup');
const {
    onRaisersEdgeWebhookOptions,
    onRaisersEdgeWebhookReceived,
    onRaisersEdgeWebhookResolve,
    extractRoutingHints,
} = require('../../extensions/webhooks/handlers');
const webhooks = require('../../extensions/webhooks');

function mockRes() {
    const res = {
        statusCode: null,
        headers: {},
        body: null,
        set(k, v) {
            this.headers[k] = v;
            return this;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
        end() {
            return this;
        },
    };
    return res;
}

describe('raisersedge webhooks extension', () => {
    it('registers OPTIONS + POST /webhooks without database', () => {
        expect(webhooks.name).toBe('raisersedge-webhooks');
        expect(webhooks.useDatabase).toBe(false);
        expect(webhooks.routes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    method: 'OPTIONS',
                    path: '/webhooks',
                }),
                expect.objectContaining({ method: 'POST', path: '/webhooks' }),
            ])
        );
    });

    describe('signature / handshake', () => {
        it('accepts Event Grid OPTIONS origin', () => {
            const result = verifyOptionsHandshake({
                req: {
                    headers: {
                        'webhook-request-origin': 'eventgrid.azure.net',
                    },
                },
            });
            expect(result).toEqual({
                valid: true,
                origin: EXPECTED_ORIGIN,
            });
        });

        it('rejects missing or unexpected OPTIONS origin', () => {
            expect(verifyOptionsHandshake({ req: { headers: {} } }).valid).toBe(
                false
            );
            expect(
                verifyOptionsHandshake({
                    req: { headers: { 'webhook-request-origin': 'evil.test' } },
                }).valid
            ).toBe(false);
        });

        it('skips webhookKey when unset; enforces when set', () => {
            const prev = process.env.BLACKBAUD_WEBHOOK_KEY;
            delete process.env.BLACKBAUD_WEBHOOK_KEY;
            expect(
                verifyWebhookKey({ req: { url: '/webhooks' } }).valid
            ).toBe(true);

            process.env.BLACKBAUD_WEBHOOK_KEY = 'secret';
            expect(
                verifyWebhookKey({
                    req: { url: '/webhooks?webhookKey=secret' },
                }).valid
            ).toBe(true);
            expect(
                verifyWebhookKey({
                    req: { url: '/webhooks?webhookKey=wrong' },
                }).valid
            ).toBe(false);
            expect(
                verifyWebhookKey({ req: { url: '/webhooks' } }).valid
            ).toBe(false);

            if (prev === undefined) delete process.env.BLACKBAUD_WEBHOOK_KEY;
            else process.env.BLACKBAUD_WEBHOOK_KEY = prev;
        });
    });

    describe('handlers', () => {
        it('OPTIONS handler sets WebHook-Allowed-Origin', async () => {
            const res = mockRes();
            await onRaisersEdgeWebhookOptions({
                req: {
                    headers: {
                        'webhook-request-origin': 'eventgrid.azure.net',
                    },
                },
                res,
            });
            expect(res.statusCode).toBe(200);
            expect(res.headers['WebHook-Allowed-Origin']).toBe(
                EXPECTED_ORIGIN
            );
        });

        it('POST receiver queues resolve when environment_id present', async () => {
            const res = mockRes();
            const queued = [];
            const ctx = {
                queueWebhook: async (job) => queued.push(job),
            };
            await onRaisersEdgeWebhookReceived.call(ctx, {
                req: {
                    url: '/webhooks',
                    body: {
                        data: { environment_id: 'env-1', id: 'gift-1' },
                        type: 'com.blackbaud.gift.add.v1',
                    },
                },
                res,
            });
            expect(res.statusCode).toBe(200);
            expect(queued[0].event).toBe('RAISERSEDGE_WEBHOOK_RESOLVE');
        });

        it('resolve looks up by environment_id and re-queues', async () => {
            const queued = [];
            const ctx = {
                queueWebhook: async (job) => queued.push(job),
                integrationMO: {
                    list: async () => [
                        {
                            id: 'int-1',
                            entities: [
                                {
                                    type: 'raisersedge',
                                    externalId: hashEnvironmentId('env-1'),
                                    details: { environment_id: 'env-1' },
                                },
                            ],
                        },
                    ],
                },
            };
            await onRaisersEdgeWebhookResolve.call(ctx, {
                data: {
                    body: { data: { environment_id: 'env-1' } },
                    hints: { environmentId: 'env-1' },
                },
            });
            expect(queued[0]).toMatchObject({
                event: 'RAISERSEDGE_WEBHOOK',
                integrationId: 'int-1',
            });
        });
    });

    describe('lookup + routing hints', () => {
        it('findIntegrationByEnvironmentId matches hashed externalId', async () => {
            const envId = 'p-env';
            const ctx = {
                integrationMO: {
                    list: async () => [
                        {
                            id: 'i1',
                            entities: [
                                {
                                    type: 'raisersedge',
                                    externalId: hashEnvironmentId(envId),
                                },
                            ],
                        },
                    ],
                },
            };
            expect(await findIntegrationByEnvironmentId(ctx, envId)).toBe('i1');
        });

        it('findIntegrationBySubscriptionId reads config ids', async () => {
            const ctx = {
                integrationMO: {
                    list: async () => [
                        {
                            id: 'i2',
                            config: { webhookSubscriptionIds: ['sub-9'] },
                        },
                    ],
                },
            };
            expect(await findIntegrationBySubscriptionId(ctx, 'sub-9')).toBe(
                'i2'
            );
        });

        it('extractRoutingHints reads environment_id and subscription path', () => {
            const hints = extractRoutingHints({
                data: {
                    environment_id: 'e1',
                    eventSubscriptionId:
                        '/subscription/resource/segments/eventSubscriptions/sub-abc',
                },
            });
            expect(hints.environmentId).toBe('e1');
            expect(hints.subscriptionId).toBe('sub-abc');
        });
    });
});
