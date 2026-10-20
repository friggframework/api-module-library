const {
    extractValidationToken,
    verifyGraphClientState,
} = require('../../extensions/webhooks/signature-verifier');
const {
    findIntegrationForNotification,
    extractUserIdFromResource,
} = require('../../extensions/webhooks/lookup');
const {
    onOneDriveWebhookReceived,
} = require('../../extensions/webhooks/handlers');

describe('OneDrive webhook extension', () => {
    describe('validationToken handshake', () => {
        it('extracts validationToken from the query string', () => {
            expect(
                extractValidationToken({
                    query: { validationToken: 'tok-123' },
                })
            ).toBe('tok-123');
        });

        it('echoes validationToken as plain text on receive', async () => {
            const res = {
                statusCode: null,
                contentType: null,
                body: null,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                type(t) {
                    this.contentType = t;
                    return this;
                },
                send(b) {
                    this.body = b;
                    return this;
                },
                json() {
                    return this;
                },
            };
            const ctx = {
                queueWebhook: async () => {
                    throw new Error('should not queue on validation');
                },
            };
            await onOneDriveWebhookReceived.call(ctx, {
                req: { query: { validationToken: 'validate-me' }, body: {} },
                res,
            });
            expect(res.statusCode).toBe(200);
            expect(res.contentType).toBe('text/plain');
            expect(res.body).toBe('validate-me');
        });
    });

    describe('clientState verification', () => {
        it('accepts matching clientState on all notifications', () => {
            const result = verifyGraphClientState({
                req: {
                    body: {
                        value: [
                            { clientState: 'secret', resource: '/me/drive/root' },
                            { clientState: 'secret', resource: '/me/drive/root' },
                        ],
                    },
                },
                expectedClientState: 'secret',
            });
            expect(result.valid).toBe(true);
        });

        it('rejects mismatched clientState', () => {
            const result = verifyGraphClientState({
                req: {
                    body: {
                        value: [
                            { clientState: 'wrong', resource: '/me/drive/root' },
                        ],
                    },
                },
                expectedClientState: 'secret',
            });
            expect(result.valid).toBe(false);
        });
    });

    describe('integration lookup', () => {
        it('parses user id from resource path', () => {
            expect(
                extractUserIdFromResource(
                    "/users/user-abc/drive/root"
                )
            ).toBe('user-abc');
        });

        it('finds the integration by user id in resource', async () => {
            const ctx = {
                getEntitiesForModule: async () => [
                    { externalId: 'user-abc', integrationId: 'int-1' },
                ],
            };
            await expect(
                findIntegrationForNotification(ctx, {
                    resource: '/users/user-abc/drive/root',
                })
            ).resolves.toBe('int-1');
        });

        it('falls back to the sole connected entity', async () => {
            const ctx = {
                getEntitiesForModule: async () => [
                    { externalId: 'user-only', integrationId: 'int-solo' },
                ],
            };
            await expect(
                findIntegrationForNotification(ctx, {
                    resource: '/me/drive/root',
                    tenantId: 'tenant-x',
                })
            ).resolves.toBe('int-solo');
        });

        it('returns null when multiple entities and no match', async () => {
            const ctx = {
                getEntitiesForModule: async () => [
                    { externalId: 'a', integrationId: 'int-1' },
                    { externalId: 'b', integrationId: 'int-2' },
                ],
            };
            await expect(
                findIntegrationForNotification(ctx, {
                    resource: '/me/drive/root',
                    tenantId: 'other',
                })
            ).resolves.toBeNull();
        });
    });
});
