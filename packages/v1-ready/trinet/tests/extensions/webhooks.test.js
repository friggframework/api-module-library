const crypto = require('crypto');
const {
    verifyTriNetSignature,
} = require('../../extensions/webhooks/signature-verifier');
const {
    onTriNetWebhookReceived,
    onTriNetWebhookResolve,
    companyIdFromBody,
} = require('../../extensions/webhooks/handlers');
const {
    findIntegrationByCompanyId,
} = require('../../extensions/webhooks/lookup');

// Official TriNet docs test vector
const SECRET =
    'lDVtBQnoRcqYv4fUeVD0oyzgsKWHGtqhatjBX5wXRFQzkVUCzBA571E4qUxvR5LE';
const OFFICIAL_PAYLOAD = '{"test":"valid payload"}';
const OFFICIAL_SIG =
    '219a08ea32f319931dc849badc076323f40367aad859ddba4de82e33135fad31';

function signedRequest(bodyObj, secret = SECRET) {
    const rawBody = JSON.stringify(bodyObj);
    const signature = crypto
        .createHmac('sha256', secret)
        .update(rawBody, 'utf8')
        .digest('hex');
    return {
        rawBody,
        body: bodyObj,
        headers: {
            signature,
        },
    };
}

describe('TriNet webhook extension', () => {
    describe('verifyTriNetSignature', () => {
        it('accepts the official docs test vector', () => {
            expect(
                verifyTriNetSignature({
                    req: {
                        rawBody: OFFICIAL_PAYLOAD,
                        headers: { Signature: OFFICIAL_SIG },
                    },
                    secret: SECRET,
                })
            ).toEqual({ valid: true });
        });

        it('rejects when secret is wrong', () => {
            const req = signedRequest({ type: 'people.did_create' });
            const result = verifyTriNetSignature({
                req,
                secret: 'wrong-secret-wrong-secret-wrong-secret-xx',
            });
            expect(result.valid).toBe(false);
        });
    });

    describe('companyIdFromBody', () => {
        it('reads data.company.id', () => {
            expect(
                companyIdFromBody({
                    type: 'people.did_create',
                    data: { company: { id: '48' } },
                })
            ).toBe('48');
        });
    });

    describe('handlers', () => {
        const prev = process.env.TRINET_WEBHOOK_SHARED_SECRET;

        afterEach(() => {
            if (prev === undefined) {
                delete process.env.TRINET_WEBHOOK_SHARED_SECRET;
            } else {
                process.env.TRINET_WEBHOOK_SHARED_SECRET = prev;
            }
        });

        it('receiver verifies and enqueues resolve', async () => {
            process.env.TRINET_WEBHOOK_SHARED_SECRET = SECRET;
            const body = {
                type: 'people.did_create',
                object: '/meta/event',
                data: {
                    company: { id: '48', name: 'Acme' },
                    id: '105024',
                    object: '/core/people',
                },
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
            await onTriNetWebhookReceived.call(
                {
                    queueWebhook: async (job) => {
                        queued.push(job);
                    },
                },
                { req, res }
            );
            expect(res.statusCode).toBe(200);
            expect(res.payload.queued).toBe(1);
            expect(queued[0].event).toBe('TRINET_WEBHOOK_RESOLVE');
            expect(queued[0].body.data.company.id).toBe('48');
        });

        it('receiver rejects invalid signature with 401', async () => {
            process.env.TRINET_WEBHOOK_SHARED_SECRET = SECRET;
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
            await onTriNetWebhookReceived.call(
                { queueWebhook: async () => {} },
                {
                    req: {
                        rawBody: '{}',
                        body: {},
                        headers: { signature: 'nope' },
                    },
                    res,
                }
            );
            expect(res.statusCode).toBe(401);
        });

        it('resolve maps company id to integration', async () => {
            const queued = [];
            const body = {
                type: 'people.did_create',
                data: { company: { id: '48' } },
            };
            await onTriNetWebhookResolve.call(
                {
                    commands: {
                        findIntegrationByEntityExternalId: async (
                            companyId,
                            moduleName
                        ) => {
                            expect(companyId).toBe('48');
                            expect(moduleName).toBe('trinet');
                            return 'integ-1';
                        },
                    },
                    queueWebhook: async (job) => {
                        queued.push(job);
                    },
                },
                { data: { body } }
            );
            expect(queued[0]).toEqual({
                event: 'TRINET_WEBHOOK',
                integrationId: 'integ-1',
                body,
            });
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
                        ) => `${moduleName}:${companyId}`,
                    },
                },
                '48'
            );
            expect(id).toBe('trinet:48');
        });
    });
});
