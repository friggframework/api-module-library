const {
    verifyRingCentralWebhook,
    VALIDATION_TOKEN_HEADER,
    VERIFICATION_TOKEN_HEADER,
} = require('../../extensions/webhooks/signature-verifier');
const {
    onRingCentralWebhookReceived,
    onRingCentralWebhookResolve,
    extractAccountId,
} = require('../../extensions/webhooks/handlers');
const {
    findIntegrationByAccountId,
} = require('../../extensions/webhooks/lookup');

function mockRes() {
    const res = {
        statusCode: null,
        body: null,
        headers: {},
        status(code) {
            this.statusCode = code;
            return this;
        },
        set(k, v) {
            this.headers[k] = v;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
        send(body) {
            this.body = body;
            return this;
        },
    };
    return res;
}

describe('RingCentral webhook signature verifier', () => {
    it('accepts Validation-Token handshake without verification token', () => {
        const result = verifyRingCentralWebhook({
            req: {
                headers: { [VALIDATION_TOKEN_HEADER]: 'val-123' },
                body: {},
            },
        });
        expect(result.valid).toBe(true);
        expect(result.isValidation).toBe(true);
        expect(result.validationToken).toBe('val-123');
    });

    it('accepts matching Verification-Token', () => {
        const result = verifyRingCentralWebhook({
            req: {
                headers: { [VERIFICATION_TOKEN_HEADER]: 'secret' },
                body: { uuid: '1' },
            },
            verificationToken: 'secret',
        });
        expect(result.valid).toBe(true);
        expect(result.isValidation).toBe(false);
    });

    it('rejects mismatch / missing config on event deliveries', () => {
        expect(
            verifyRingCentralWebhook({
                req: {
                    headers: { [VERIFICATION_TOKEN_HEADER]: 'nope' },
                    body: {},
                },
                verificationToken: 'secret',
            }).valid
        ).toBe(false);
        expect(
            verifyRingCentralWebhook({
                req: {
                    headers: { [VERIFICATION_TOKEN_HEADER]: 'secret' },
                    body: {},
                },
            }).reason
        ).toMatch(/missing verification token/i);
    });
});

describe('extractAccountId', () => {
    it('prefers body.body.accountId then body.accountId then ownerId', () => {
        expect(
            extractAccountId({
                body: { accountId: '111' },
                ownerId: '222',
            })
        ).toBe('111');
        expect(extractAccountId({ accountId: '333' })).toBe('333');
        expect(extractAccountId({ ownerId: '444' })).toBe('444');
        expect(extractAccountId({})).toBeNull();
    });
});

describe('webhook handlers', () => {
    const prev = process.env.RINGCENTRAL_WEBHOOK_VERIFICATION_TOKEN;

    afterEach(() => {
        if (prev === undefined) {
            delete process.env.RINGCENTRAL_WEBHOOK_VERIFICATION_TOKEN;
        } else {
            process.env.RINGCENTRAL_WEBHOOK_VERIFICATION_TOKEN = prev;
        }
    });

    it('echoes Validation-Token on handshake', async () => {
        const res = mockRes();
        const ctx = { queueWebhook: jest.fn() };
        await onRingCentralWebhookReceived.call(ctx, {
            req: {
                headers: { [VALIDATION_TOKEN_HEADER]: 'handshake' },
                body: {},
            },
            res,
        });
        expect(res.statusCode).toBe(200);
        expect(res.headers['Validation-Token']).toBe('handshake');
        expect(ctx.queueWebhook).not.toHaveBeenCalled();
    });

    it('queues resolve for verified deliveries', async () => {
        process.env.RINGCENTRAL_WEBHOOK_VERIFICATION_TOKEN = 'secret';
        const res = mockRes();
        const ctx = { queueWebhook: jest.fn() };
        await onRingCentralWebhookReceived.call(ctx, {
            req: {
                headers: { [VERIFICATION_TOKEN_HEADER]: 'secret' },
                body: {
                    uuid: 'evt-1',
                    body: { accountId: '401836781008' },
                },
            },
            res,
        });
        expect(res.statusCode).toBe(200);
        expect(ctx.queueWebhook).toHaveBeenCalledWith({
            event: 'RINGCENTRAL_WEBHOOK_RESOLVE',
            body: {
                accountId: '401836781008',
                notification: {
                    uuid: 'evt-1',
                    body: { accountId: '401836781008' },
                },
            },
        });
    });

    it('resolve re-enqueues RINGCENTRAL_WEBHOOK for the integration', async () => {
        const ctx = {
            queueWebhook: jest.fn(),
            commands: {
                findIntegrationByEntityExternalId: jest
                    .fn()
                    .mockResolvedValue('integ-1'),
            },
        };
        await onRingCentralWebhookResolve.call(ctx, {
            data: {
                body: {
                    accountId: '401836781008',
                    notification: { uuid: 'evt-1' },
                },
            },
        });
        expect(ctx.queueWebhook).toHaveBeenCalledWith({
            event: 'RINGCENTRAL_WEBHOOK',
            integrationId: 'integ-1',
            body: {
                accountId: '401836781008',
                notification: { uuid: 'evt-1' },
            },
        });
    });
});

describe('findIntegrationByAccountId', () => {
    it('delegates to findIntegrationByEntityExternalId with moduleName', async () => {
        const integration = {
            commands: {
                findIntegrationByEntityExternalId: jest
                    .fn()
                    .mockResolvedValue('id-9'),
            },
        };
        const id = await findIntegrationByAccountId(integration, 'acct');
        expect(id).toBe('id-9');
        expect(
            integration.commands.findIntegrationByEntityExternalId
        ).toHaveBeenCalledWith('acct', 'ringcentral');
    });
});
