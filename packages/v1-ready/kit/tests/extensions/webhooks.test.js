const crypto = require('crypto');
const {
    onKitWebhookReceived,
    onKitWebhookResolve,
} = require('../../extensions/webhooks/handlers');
const { verifyKitSignature } = require('../../extensions/webhooks/signature-verifier');
const { findIntegrationByAccountId } = require('../../extensions/webhooks/lookup');
const { SIGNATURE_HEADER } = require('../../api');

function signedReq({ body, secret, accountId }) {
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
    const t = Math.floor(Date.now() / 1000);
    const sig = crypto
        .createHmac('sha256', secret)
        .update(`${t}.${rawBody}`)
        .digest('hex');
    return {
        headers: { [SIGNATURE_HEADER]: `t=${t},v1=${sig}` },
        rawBody,
        body: typeof body === 'string' ? JSON.parse(body) : body,
        params: accountId ? { accountId } : {},
    };
}

describe('Kit webhooks extension', () => {
    const secret = 'whsec_test';

    beforeEach(() => {
        process.env.KIT_WEBHOOK_SECRET = secret;
    });

    afterEach(() => {
        delete process.env.KIT_WEBHOOK_SECRET;
    });

    it('verifyKitSignature accepts a valid header', () => {
        const req = signedReq({
            body: { delivery_id: 1, events: [] },
            secret,
        });
        expect(verifyKitSignature({ req, secret }).valid).toBe(true);
    });

    it('receiver queues resolve when accountId is in the path', async () => {
        const queued = [];
        const ctx = {
            queueWebhook: async (job) => {
                queued.push(job);
            },
        };
        const req = signedReq({
            body: { delivery_id: 1, events: [{ type: 'subscriber.created' }] },
            secret,
            accountId: '99',
        });
        const res = {
            statusCode: null,
            payload: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                this.payload = payload;
                return this;
            },
        };

        await onKitWebhookReceived.call(ctx, { req, res });
        expect(res.statusCode).toBe(200);
        expect(queued[0].event).toBe('KIT_WEBHOOK_RESOLVE');
        expect(queued[0].body.accountId).toBe('99');
    });

    it('receiver rejects invalid signatures with 401', async () => {
        const req = {
            headers: { [SIGNATURE_HEADER]: 't=1,v1=nope' },
            rawBody: '{}',
            body: {},
            params: { accountId: '1' },
        };
        const res = {
            statusCode: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json() {
                return this;
            },
        };
        await onKitWebhookReceived.call(
            { queueWebhook: async () => {} },
            { req, res }
        );
        expect(res.statusCode).toBe(401);
    });

    it('resolve re-enqueues KIT_WEBHOOK when lookup hits', async () => {
        const queued = [];
        const ctx = {
            queueWebhook: async (job) => {
                queued.push(job);
            },
            integrationMO: {
                list: async () => [
                    {
                        id: 'int-1',
                        entities: [{ externalId: '99', type: 'kit' }],
                    },
                ],
            },
        };
        await onKitWebhookResolve.call(ctx, {
            data: { body: { accountId: '99', delivery_id: 1 } },
        });
        expect(queued[0]).toEqual({
            event: 'KIT_WEBHOOK',
            integrationId: 'int-1',
            body: { accountId: '99', delivery_id: 1 },
        });
    });

    it('findIntegrationByAccountId returns null without MO', async () => {
        expect(await findIntegrationByAccountId({}, '1')).toBeNull();
    });
});
