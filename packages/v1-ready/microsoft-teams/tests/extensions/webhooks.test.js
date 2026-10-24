const {
    extractValidationToken,
    verifyGraphClientState,
    extractTenantId,
} = require('../../extensions/webhooks/signature-verifier');
const {
    onMicrosoftTeamsWebhookReceived,
    onMicrosoftTeamsWebhookResolve,
} = require('../../extensions/webhooks/handlers');
const { findIntegrationByTenantId } = require('../../extensions/webhooks/lookup');

describe('Graph webhook signature-verifier helpers', () => {
    it('extracts validationToken from query', () => {
        expect(
            extractValidationToken({
                query: { validationToken: 'opaque-token' },
            })
        ).toBe('opaque-token');
    });

    it('verifies clientState on a value batch', () => {
        const ok = verifyGraphClientState({
            notification: {
                value: [
                    { clientState: 'secret', tenantId: 't1' },
                    { clientState: 'secret', tenantId: 't1' },
                ],
            },
            expectedClientState: 'secret',
        });
        expect(ok.valid).toBe(true);

        const bad = verifyGraphClientState({
            notification: { value: [{ clientState: 'nope' }] },
            expectedClientState: 'secret',
        });
        expect(bad.valid).toBe(false);
    });

    it('extractTenantId reads tenantId', () => {
        expect(extractTenantId({ tenantId: 'abc' })).toBe('abc');
    });
});

describe('webhook handlers', () => {
    const prev = process.env.TEAMS_WEBHOOK_CLIENT_STATE;
    afterEach(() => {
        if (prev === undefined) delete process.env.TEAMS_WEBHOOK_CLIENT_STATE;
        else process.env.TEAMS_WEBHOOK_CLIENT_STATE = prev;
    });

    it('echoes validationToken as text/plain', async () => {
        const res = {
            statusCode: null,
            typ: null,
            body: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            type(t) {
                this.typ = t;
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
        const ctx = { queueWebhook: jest.fn() };
        await onMicrosoftTeamsWebhookReceived.call(ctx, {
            req: { query: { validationToken: 'probe-token' }, body: {} },
            res,
        });
        expect(res.statusCode).toBe(200);
        expect(res.typ).toBe('text/plain');
        expect(res.body).toBe('probe-token');
        expect(ctx.queueWebhook).not.toHaveBeenCalled();
    });

    it('rejects bad clientState with 401', async () => {
        process.env.TEAMS_WEBHOOK_CLIENT_STATE = 'secret';
        const res = {
            statusCode: null,
            payload: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(p) {
                this.payload = p;
                return this;
            },
            type() {
                return this;
            },
            send() {
                return this;
            },
        };
        await onMicrosoftTeamsWebhookReceived.call(
            { queueWebhook: jest.fn() },
            {
                req: {
                    query: {},
                    body: { value: [{ clientState: 'wrong', tenantId: 't' }] },
                },
                res,
            }
        );
        expect(res.statusCode).toBe(401);
    });

    it('queues resolve jobs for valid notifications', async () => {
        process.env.TEAMS_WEBHOOK_CLIENT_STATE = 'secret';
        const queueWebhook = jest.fn();
        const res = {
            statusCode: null,
            payload: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(p) {
                this.payload = p;
                return this;
            },
            type() {
                return this;
            },
            send() {
                return this;
            },
        };
        await onMicrosoftTeamsWebhookReceived.call(
            { queueWebhook },
            {
                req: {
                    query: {},
                    body: {
                        value: [
                            {
                                clientState: 'secret',
                                tenantId: 'tenant-1',
                                subscriptionId: 'sub',
                            },
                        ],
                    },
                },
                res,
            }
        );
        expect(res.statusCode).toBe(200);
        expect(res.payload.queued).toBe(1);
        expect(queueWebhook).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'MICROSOFT_TEAMS_WEBHOOK_RESOLVE',
            })
        );
    });

    it('resolve re-enqueues bound to the integration', async () => {
        const Entity = {
            find: jest.fn().mockResolvedValue([
                { integrationId: 'int-9', data: { tenant_id: 'tenant-1' } },
            ]),
        };
        const queueWebhook = jest.fn();
        const integration = {
            constructor: { Model: { Entity } },
            queueWebhook,
        };
        await onMicrosoftTeamsWebhookResolve.call(integration, {
            data: {
                body: { tenantId: 'tenant-1', subscriptionId: 'sub' },
            },
        });
        expect(queueWebhook).toHaveBeenCalledWith({
            event: 'MICROSOFT_TEAMS_WEBHOOK',
            integrationId: 'int-9',
            body: { tenantId: 'tenant-1', subscriptionId: 'sub' },
        });
    });
});

describe('lookup', () => {
    it('returns null when no entity matches', async () => {
        const integration = {
            constructor: {
                Model: { Entity: { find: async () => [] } },
            },
        };
        await expect(
            findIntegrationByTenantId(integration, 'missing')
        ).resolves.toBeNull();
    });
});
