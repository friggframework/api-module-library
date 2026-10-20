const crypto = require('crypto');
const {
    verifyAttentiveSignature,
    SIGNATURE_HEADER,
} = require('../../extensions/webhooks/signature-verifier');
const {
    onAttentiveWebhookReceived,
    onAttentiveWebhookResolve,
    extractCompanyId,
    extractEvents,
} = require('../../extensions/webhooks/handlers');
const { findIntegrationByCompanyId } = require('../../extensions/webhooks/lookup');
const extension = require('../../extensions/webhooks');

function sign(body, secret) {
    const raw = typeof body === 'string' ? body : JSON.stringify(body);
    return {
        raw,
        signature: crypto
            .createHmac('sha256', secret)
            .update(raw, 'utf8')
            .digest('hex'),
    };
}

describe('attentive-webhooks extension', () => {
    it('declares the Tier-3 DB-free receiver contract', () => {
        expect(extension.name).toBe('attentive-webhooks');
        expect(extension.useDatabase).toBe(false);
        expect(extension.routes[0]).toEqual({
            path: '/webhooks',
            method: 'POST',
            event: 'ATTENTIVE_WEBHOOK_RECEIVED',
        });
        expect(Object.keys(extension.events).sort()).toEqual([
            'ATTENTIVE_WEBHOOK',
            'ATTENTIVE_WEBHOOK_RECEIVED',
            'ATTENTIVE_WEBHOOK_RESOLVE',
        ]);
    });

    describe('signature verifier', () => {
        it('accepts a valid hex HMAC over the raw body', () => {
            const secret = 'wk_secret';
            const { raw, signature } = sign(
                { type: 'sms.subscribed', companyId: 'co_1' },
                secret
            );
            const result = verifyAttentiveSignature({
                req: {
                    headers: { [SIGNATURE_HEADER]: signature },
                    rawBody: raw,
                },
                signingKey: secret,
            });
            expect(result).toEqual({ valid: true });
        });

        it('rejects missing key, missing header, or mismatch', () => {
            expect(
                verifyAttentiveSignature({ req: { headers: {} }, signingKey: '' })
                    .valid
            ).toBe(false);
            expect(
                verifyAttentiveSignature({
                    req: { headers: {}, rawBody: '{}' },
                    signingKey: 'x',
                }).reason
            ).toMatch(/missing/);
            expect(
                verifyAttentiveSignature({
                    req: {
                        headers: { [SIGNATURE_HEADER]: 'nope' },
                        rawBody: '{}',
                    },
                    signingKey: 'x',
                }).reason
            ).toBe('signature mismatch');
        });
    });

    describe('payload helpers', () => {
        it('extractCompanyId reads common locations', () => {
            expect(extractCompanyId({ companyId: 'a' })).toBe('a');
            expect(extractCompanyId({ company: { id: 'b' } })).toBe('b');
            expect(extractCompanyId({ data: { companyId: 'c' } })).toBe('c');
            expect(extractCompanyId({})).toBeNull();
        });

        it('extractEvents wraps single objects and arrays', () => {
            expect(extractEvents({ companyId: '1' })).toHaveLength(1);
            expect(
                extractEvents([{ companyId: '1' }, { companyId: '2' }])
            ).toHaveLength(2);
        });
    });

    describe('handlers', () => {
        const secret = 'wk_secret';

        beforeEach(() => {
            process.env.ATTENTIVE_WEBHOOK_SIGNING_KEY = secret;
        });

        afterEach(() => {
            delete process.env.ATTENTIVE_WEBHOOK_SIGNING_KEY;
        });

        it('receiver verifies, queues resolve jobs, returns 200', async () => {
            const body = { type: 'sms.subscribed', companyId: 'co_9' };
            const { raw, signature } = sign(body, secret);
            const queued = [];
            const ctx = {
                queueWebhook: async (job) => {
                    queued.push(job);
                },
            };
            const res = {
                statusCode: null,
                body: null,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    this.body = payload;
                    return this;
                },
            };
            await onAttentiveWebhookReceived.call(ctx, {
                req: {
                    headers: { [SIGNATURE_HEADER]: signature },
                    rawBody: raw,
                    body,
                },
                res,
            });
            expect(res.statusCode).toBe(200);
            expect(res.body.queued).toBe(1);
            expect(queued[0].event).toBe('ATTENTIVE_WEBHOOK_RESOLVE');
            expect(queued[0].body.companyId).toBe('co_9');
        });

        it('receiver rejects invalid signatures with 401', async () => {
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
            await onAttentiveWebhookReceived.call(
                { queueWebhook: async () => {} },
                {
                    req: {
                        headers: { [SIGNATURE_HEADER]: 'bad' },
                        rawBody: '{}',
                        body: {},
                    },
                    res,
                }
            );
            expect(res.statusCode).toBe(401);
        });

        it('resolve looks up companyId and re-enqueues ATTENTIVE_WEBHOOK', async () => {
            const queued = [];
            const ctx = {
                commands: {
                    findIntegrationByEntityExternalId: async () => 'int_1',
                },
                queueWebhook: async (job) => {
                    queued.push(job);
                },
            };
            await onAttentiveWebhookResolve.call(ctx, {
                data: { body: { companyId: 'co_9', event: { type: 'sms.sent' } } },
            });
            expect(queued[0]).toEqual({
                event: 'ATTENTIVE_WEBHOOK',
                integrationId: 'int_1',
                body: { companyId: 'co_9', event: { type: 'sms.sent' } },
            });
        });
    });

    describe('lookup', () => {
        it('delegates to findIntegrationByEntityExternalId with moduleName', async () => {
            let args;
            const integration = {
                commands: {
                    findIntegrationByEntityExternalId: async (...a) => {
                        args = a;
                        return 'int';
                    },
                },
            };
            const id = await findIntegrationByCompanyId(integration, 'co');
            expect(id).toBe('int');
            expect(args).toEqual(['co', 'attentive']);
        });
    });
});
