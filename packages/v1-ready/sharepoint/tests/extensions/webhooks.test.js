const {
    extractValidationToken,
    verifyGraphClientState,
} = require('../../extensions/webhooks/signature-verifier');
const { findIntegrationByTenantId } = require('../../extensions/webhooks/lookup');
const {
    onSharePointWebhookReceived,
} = require('../../extensions/webhooks/handlers');

describe('SharePoint webhook extension', () => {
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
            await onSharePointWebhookReceived.call(ctx, {
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
                            { clientState: 'secret', tenantId: 't1' },
                            { clientState: 'secret', tenantId: 't1' },
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
                        value: [{ clientState: 'wrong', tenantId: 't1' }],
                    },
                },
                expectedClientState: 'secret',
            });
            expect(result.valid).toBe(false);
        });
    });

    describe('tenant lookup', () => {
        it('finds the integration by tenant externalId', async () => {
            const ctx = {
                getEntitiesForModule: async () => [
                    { externalId: 'tenant-a', integrationId: 'int-1' },
                ],
            };
            await expect(
                findIntegrationByTenantId(ctx, 'tenant-a')
            ).resolves.toBe('int-1');
        });

        it('returns null when no entity matches', async () => {
            const ctx = {
                getEntitiesForModule: async () => [
                    { externalId: 'other', integrationId: 'int-1' },
                ],
            };
            await expect(
                findIntegrationByTenantId(ctx, 'tenant-a')
            ).resolves.toBeNull();
        });
    });
});
