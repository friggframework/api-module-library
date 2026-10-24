const crypto = require('crypto');
const {
    verifyPersonioSignature,
} = require('../../extensions/webhooks/signature-verifier');
const {
    onPersonioWebhookReceived,
    onPersonioWebhookResolve,
} = require('../../extensions/webhooks/handlers');
const {
    findIntegrationByCompanyId,
} = require('../../extensions/webhooks/lookup');

const SECRET =
    '5e54aea2f2746789e0a569d6208f2cf40944b3ba262f344628816bd8ea20dc28';

function signedRequest(bodyObj, secret = SECRET) {
    const rawBody = JSON.stringify(bodyObj);
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const signature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${rawBody}`, 'utf8')
        .digest('hex');
    return {
        rawBody,
        body: bodyObj,
        headers: {
            'x-personio-webhook-timestamp': timestamp,
            'x-personio-webhook-signature': signature,
        },
    };
}

describe('Personio webhook extension', () => {
    describe('verifyPersonioSignature', () => {
        it('accepts a valid HMAC', () => {
            const req = signedRequest({
                company_id: '27277',
                event_name: 'person.created',
                occurred_at: '2024-02-05T18:07:02.069Z',
                payload: { person: { id: '1' } },
                meta: {},
            });
            expect(verifyPersonioSignature({ req, secret: SECRET })).toEqual({
                valid: true,
            });
        });

        it('rejects when secret is wrong', () => {
            const req = signedRequest({ company_id: '1', event_name: 'ping' });
            const result = verifyPersonioSignature({
                req,
                secret: 'wrong-secret-wrong-secret-wrong-secret-xx',
            });
            expect(result.valid).toBe(false);
        });
    });

    describe('handlers', () => {
        const prev = process.env.PERSONIO_WEBHOOK_SIGNING_SECRET;

        afterEach(() => {
            if (prev === undefined) {
                delete process.env.PERSONIO_WEBHOOK_SIGNING_SECRET;
            } else {
                process.env.PERSONIO_WEBHOOK_SIGNING_SECRET = prev;
            }
        });

        it('receiver verifies and enqueues resolve', async () => {
            process.env.PERSONIO_WEBHOOK_SIGNING_SECRET = SECRET;
            const body = {
                company_id: '27277',
                event_name: 'person.created',
                occurred_at: '2024-02-05T18:07:02.069Z',
                payload: { person: { id: '343536' } },
                meta: {},
            };
            const req = signedRequest(body);
            const queued = [];
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
            await onPersonioWebhookReceived.call(
                {
                    queueWebhook: async (job) => {
                        queued.push(job);
                    },
                },
                { req, res }
            );
            expect(res.statusCode).toBe(200);
            expect(queued).toHaveLength(1);
            expect(queued[0].event).toBe('PERSONIO_WEBHOOK_RESOLVE');
            expect(queued[0].body.company_id).toBe('27277');
        });

        it('receiver rejects bad signatures with 401', async () => {
            process.env.PERSONIO_WEBHOOK_SIGNING_SECRET = SECRET;
            const req = {
                body: { company_id: '1' },
                rawBody: '{}',
                headers: {
                    'x-personio-webhook-timestamp': new Date().toISOString(),
                    'x-personio-webhook-signature': 'deadbeef',
                },
            };
            const res = {
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    this.payload = payload;
                    return this;
                },
            };
            await onPersonioWebhookReceived.call(
                { queueWebhook: async () => {} },
                { req, res }
            );
            expect(res.statusCode).toBe(401);
        });

        it('resolve looks up company_id and re-enqueues', async () => {
            const queued = [];
            await onPersonioWebhookResolve.call(
                {
                    commands: {
                        findIntegrationByEntityExternalId: async (
                            companyId
                        ) => {
                            expect(companyId).toBe('27277');
                            return 'integration-1';
                        },
                    },
                    queueWebhook: async (job) => {
                        queued.push(job);
                    },
                },
                {
                    data: {
                        body: {
                            company_id: '27277',
                            event_name: 'person.created',
                        },
                    },
                }
            );
            expect(queued).toEqual([
                {
                    event: 'PERSONIO_WEBHOOK',
                    integrationId: 'integration-1',
                    body: {
                        company_id: '27277',
                        event_name: 'person.created',
                    },
                },
            ]);
        });
    });

    describe('lookup', () => {
        it('delegates to findIntegrationByEntityExternalId', async () => {
            const id = await findIntegrationByCompanyId(
                {
                    commands: {
                        findIntegrationByEntityExternalId: async (
                            companyId,
                            moduleName
                        ) => {
                            expect(companyId).toBe('99');
                            expect(moduleName).toBe('personio');
                            return 'int-99';
                        },
                    },
                },
                '99'
            );
            expect(id).toBe('int-99');
        });
    });
});
