const {
    extractGooglePushHeaders,
    verifyGoogleChannelToken,
} = require('../../extensions/webhooks/signature-verifier');
const {
    findIntegrationForNotification,
} = require('../../extensions/webhooks/lookup');
const {
    onGoogleWorkspaceWebhookReceived,
} = require('../../extensions/webhooks/handlers');

describe('Google Workspace webhook extension', () => {
    describe('header extraction', () => {
        it('reads X-Goog-* headers case-insensitively', () => {
            const headers = extractGooglePushHeaders({
                headers: {
                    'X-Goog-Channel-ID': 'ch-1',
                    'x-goog-channel-token': 'tok',
                    'X-Goog-Resource-ID': 'res-1',
                    'X-Goog-Resource-State': 'sync',
                    'X-Goog-Message-Number': '1',
                },
            });
            expect(headers.channelId).toBe('ch-1');
            expect(headers.channelToken).toBe('tok');
            expect(headers.resourceId).toBe('res-1');
            expect(headers.resourceState).toBe('sync');
        });
    });

    describe('channel token verification', () => {
        it('accepts matching channel token', () => {
            const result = verifyGoogleChannelToken({
                req: {
                    headers: {
                        'x-goog-channel-id': 'ch',
                        'x-goog-channel-token': 'secret',
                        'x-goog-resource-id': 'r',
                        'x-goog-resource-state': 'change',
                    },
                },
                expectedChannelToken: 'secret',
            });
            expect(result.valid).toBe(true);
        });

        it('rejects mismatched channel token', () => {
            const result = verifyGoogleChannelToken({
                req: {
                    headers: {
                        'x-goog-channel-id': 'ch',
                        'x-goog-channel-token': 'wrong',
                        'x-goog-resource-id': 'r',
                        'x-goog-resource-state': 'change',
                    },
                },
                expectedChannelToken: 'secret',
            });
            expect(result.valid).toBe(false);
        });

        it('rejects missing required headers', () => {
            const result = verifyGoogleChannelToken({
                req: { headers: { 'x-goog-channel-id': 'ch' } },
                expectedChannelToken: 'secret',
            });
            expect(result.valid).toBe(false);
        });
    });

    describe('receiver', () => {
        it('queues resolve and returns 202 for a valid notification', async () => {
            const queued = [];
            const res = {
                statusCode: null,
                body: null,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(b) {
                    this.body = b;
                    return this;
                },
            };
            const prev = process.env.GOOGLE_WORKSPACE_WEBHOOK_CHANNEL_TOKEN;
            process.env.GOOGLE_WORKSPACE_WEBHOOK_CHANNEL_TOKEN = 'tok';
            try {
                const ctx = {
                    queueWebhook: async (job) => {
                        queued.push(job);
                    },
                };
                await onGoogleWorkspaceWebhookReceived.call(ctx, {
                    req: {
                        headers: {
                            'x-goog-channel-id': 'ch',
                            'x-goog-channel-token': 'tok',
                            'x-goog-resource-id': 'r',
                            'x-goog-resource-state': 'sync',
                        },
                        body: {},
                    },
                    res,
                });
                expect(res.statusCode).toBe(202);
                expect(queued).toHaveLength(1);
                expect(queued[0].event).toBe(
                    'GOOGLE_WORKSPACE_WEBHOOK_RESOLVE'
                );
            } finally {
                if (prev === undefined) {
                    delete process.env.GOOGLE_WORKSPACE_WEBHOOK_CHANNEL_TOKEN;
                } else {
                    process.env.GOOGLE_WORKSPACE_WEBHOOK_CHANNEL_TOKEN = prev;
                }
            }
        });
    });

    describe('integration lookup', () => {
        it('finds the integration by channel id on entity details', async () => {
            const ctx = {
                getEntitiesForModule: async () => [
                    {
                        id: 'ent-1',
                        integrationId: 'int-1',
                        details: { channelIds: ['ch-abc'] },
                    },
                ],
            };
            const id = await findIntegrationForNotification(ctx, {
                channelId: 'ch-abc',
                resourceId: 'r',
            });
            expect(id).toBe('int-1');
        });

        it('falls back to the sole google-workspace entity', async () => {
            const ctx = {
                getEntitiesForModule: async () => [
                    { id: 'ent-only', integrationId: 'int-only' },
                ],
            };
            const id = await findIntegrationForNotification(ctx, {
                channelId: 'unknown',
                resourceId: 'r',
            });
            expect(id).toBe('int-only');
        });
    });
});
