const crypto = require('crypto');
const webhooksExtension = require('../../extensions/webhooks');
const {
    verifyCalendlySignature,
    safeCompare,
} = require('../../extensions/webhooks/signature-verifier');
const {
    findIntegrationByUserUri,
} = require('../../extensions/webhooks/lookup');
const {
    onCalendlyWebhookReceived,
    onCalendlyWebhookResolve,
    onCalendlyWebhook,
} = require('../../extensions/webhooks/handlers');

const SIGNING_KEY = 'test-signing-key';
const USER_URI = 'https://api.calendly.com/users/AAAAAAAAAAAAAAAA';

const buildSignedRequest = ({
    body = {
        event: 'invitee.created',
        created_at: '2020-01-02T03:04:05.678123Z',
        created_by: USER_URI,
        payload: { email: 'invitee@example.com' },
    },
    timestamp = Math.floor(Date.now() / 1000),
    signingKey = SIGNING_KEY,
    overrideSignature,
    rawBody,
} = {}) => {
    const bodyString =
        rawBody !== undefined
            ? rawBody
            : typeof body === 'string'
              ? body
              : JSON.stringify(body);
    const signature = crypto
        .createHmac('sha256', signingKey)
        .update(`${timestamp}.${bodyString}`, 'utf8')
        .digest('hex');

    return {
        method: 'POST',
        url: '/webhooks',
        body: typeof body === 'string' ? JSON.parse(body) : body,
        rawBody: bodyString,
        headers: {
            'Calendly-Webhook-Signature':
                overrideSignature ?? `t=${timestamp},v1=${signature}`,
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

describe('calendly-webhooks extension bundle shape', () => {
    it('conforms to the Tier 3 contract', () => {
        expect(webhooksExtension).toEqual(
            expect.objectContaining({
                name: 'calendly-webhooks',
                routes: expect.any(Array),
                events: expect.any(Object),
            })
        );
        expect(webhooksExtension.routes).toHaveLength(1);
        expect(webhooksExtension.routes[0]).toEqual({
            path: '/webhooks',
            method: 'POST',
            event: 'CALENDLY_WEBHOOK_RECEIVED',
        });
    });

    it('declares useDatabase: false so the receiver route is DB-free', () => {
        expect(webhooksExtension.useDatabase).toBe(false);
    });

    it('every route event references a declared event', () => {
        for (const route of webhooksExtension.routes) {
            expect(webhooksExtension.events).toHaveProperty(route.event);
        }
    });

    it('declares the receiver, resolve, and webhook events with function handlers', () => {
        expect(webhooksExtension.events.CALENDLY_WEBHOOK_RECEIVED.handler).toBe(
            onCalendlyWebhookReceived
        );
        expect(webhooksExtension.events.CALENDLY_WEBHOOK_RESOLVE.handler).toBe(
            onCalendlyWebhookResolve
        );
        expect(webhooksExtension.events.CALENDLY_WEBHOOK.handler).toBe(
            onCalendlyWebhook
        );
    });
});

describe('verifyCalendlySignature', () => {
    it('accepts a correctly signed payload', () => {
        const req = buildSignedRequest();
        expect(
            verifyCalendlySignature({ req, signingKey: SIGNING_KEY })
        ).toEqual({ valid: true });
    });

    it('rejects a missing signing key', () => {
        const req = buildSignedRequest();
        expect(verifyCalendlySignature({ req, signingKey: '' }).valid).toBe(
            false
        );
    });

    it('rejects a bad signature', () => {
        const req = buildSignedRequest({
            overrideSignature: 't=1,v1=deadbeef',
        });
        expect(
            verifyCalendlySignature({ req, signingKey: SIGNING_KEY }).reason
        ).toMatch(/mismatch|malformed|skew/);
    });

    it('rejects timestamps outside the tolerance window', () => {
        const old = Math.floor(Date.now() / 1000) - 600;
        const req = buildSignedRequest({ timestamp: old });
        const result = verifyCalendlySignature({
            req,
            signingKey: SIGNING_KEY,
        });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/skew/);
    });

    it('safeCompare returns false on length mismatch', () => {
        expect(safeCompare('abc', 'abcd')).toBe(false);
        expect(safeCompare('abc', 'abc')).toBe(true);
    });
});

describe('handlers', () => {
    const prevKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;

    beforeEach(() => {
        process.env.CALENDLY_WEBHOOK_SIGNING_KEY = SIGNING_KEY;
    });

    afterEach(() => {
        if (prevKey === undefined) {
            delete process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
        } else {
            process.env.CALENDLY_WEBHOOK_SIGNING_KEY = prevKey;
        }
    });

    it('onCalendlyWebhookReceived verifies and enqueues resolve', async () => {
        const req = buildSignedRequest();
        const res = makeRes();
        const ctx = { queueWebhook: jest.fn().mockResolvedValue(undefined) };
        await onCalendlyWebhookReceived.call(ctx, { req, res });
        expect(res.statusCode).toBe(200);
        expect(ctx.queueWebhook).toHaveBeenCalledWith({
            event: 'CALENDLY_WEBHOOK_RESOLVE',
            body: req.body,
        });
    });

    it('onCalendlyWebhookReceived rejects invalid signatures with 401', async () => {
        const req = buildSignedRequest({
            overrideSignature: 't=1,v1=nope',
        });
        const res = makeRes();
        const ctx = { queueWebhook: jest.fn() };
        await onCalendlyWebhookReceived.call(ctx, { req, res });
        expect(res.statusCode).toBe(401);
        expect(ctx.queueWebhook).not.toHaveBeenCalled();
    });

    it('onCalendlyWebhookResolve looks up by created_by and re-enqueues', async () => {
        const body = {
            event: 'invitee.created',
            created_by: USER_URI,
            payload: {},
        };
        const ctx = {
            commands: {
                findIntegrationByEntityExternalId: jest
                    .fn()
                    .mockResolvedValue('integ-1'),
            },
            queueWebhook: jest.fn().mockResolvedValue(undefined),
        };
        await onCalendlyWebhookResolve.call(ctx, { data: { body } });
        expect(ctx.queueWebhook).toHaveBeenCalledWith({
            event: 'CALENDLY_WEBHOOK',
            integrationId: 'integ-1',
            body,
        });
    });
});

describe('findIntegrationByUserUri', () => {
    it('delegates to findIntegrationByEntityExternalId with moduleName', async () => {
        const integration = {
            commands: {
                findIntegrationByEntityExternalId: jest
                    .fn()
                    .mockResolvedValue('id-9'),
            },
        };
        const result = await findIntegrationByUserUri(integration, USER_URI);
        expect(result).toBe('id-9');
        expect(
            integration.commands.findIntegrationByEntityExternalId
        ).toHaveBeenCalledWith(USER_URI, 'calendly');
    });

    it('throws when commands are missing', async () => {
        await expect(findIntegrationByUserUri({}, USER_URI)).rejects.toThrow(
            /findIntegrationByEntityExternalId/
        );
    });
});
