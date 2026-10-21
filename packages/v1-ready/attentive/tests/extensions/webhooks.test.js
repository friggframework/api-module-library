const crypto = require('crypto');
const {
    onAttentiveWebhookReceived,
    onAttentiveWebhookResolve,
} = require('../../extensions/webhooks/handlers');
const { SIGNATURE_HEADER } = require('../../api');

function signedReq(body, secret) {
    const rawBody = JSON.stringify(body);
    const digest = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');
    return {
        headers: { [SIGNATURE_HEADER]: digest },
        rawBody,
        body,
    };
}

describe('Attentive webhooks extension', () => {
    const secret = 'whsec-test';
    let prev;

    beforeEach(() => {
        prev = process.env.ATTENTIVE_WEBHOOK_SECRET;
        process.env.ATTENTIVE_WEBHOOK_SECRET = secret;
    });

    afterEach(() => {
        if (prev === undefined) delete process.env.ATTENTIVE_WEBHOOK_SECRET;
        else process.env.ATTENTIVE_WEBHOOK_SECRET = prev;
    });

    it('rejects invalid signatures with 401', async () => {
        const statuses = [];
        const payloads = [];
        const ctx = {
            queueWebhook: jest.fn(),
        };
        await onAttentiveWebhookReceived.call(ctx, {
            req: {
                headers: { [SIGNATURE_HEADER]: 'nope' },
                rawBody: '{}',
                body: {},
            },
            res: {
                status(code) {
                    statuses.push(code);
                    return {
                        json(p) {
                            payloads.push(p);
                        },
                    };
                },
            },
        });
        expect(statuses).toEqual([401]);
        expect(ctx.queueWebhook).not.toHaveBeenCalled();
    });

    it('queues ATTENTIVE_WEBHOOK_RESOLVE for a valid payload', async () => {
        const body = {
            type: 'sms.subscribed',
            timestamp: 1632945178104,
            company: {
                display_name: 'Hudson & Ivy',
                company_id: 'MDc6Q29tcGFueTU',
            },
        };
        const queued = [];
        const statuses = [];
        const ctx = {
            queueWebhook: async (job) => {
                queued.push(job);
            },
        };
        await onAttentiveWebhookReceived.call(ctx, {
            req: signedReq(body, secret),
            res: {
                status(code) {
                    statuses.push(code);
                    return {
                        json() {},
                    };
                },
            },
        });
        expect(statuses).toEqual([200]);
        expect(queued).toEqual([
            { event: 'ATTENTIVE_WEBHOOK_RESOLVE', body },
        ]);
    });

    it('resolve re-enqueues ATTENTIVE_WEBHOOK with integrationId', async () => {
        const body = {
            type: 'sms.subscribed',
            company: { company_id: 'cmp-1' },
        };
        const queued = [];
        const ctx = {
            integrationMO: {
                list: async () => [
                    {
                        id: 'int-99',
                        entities: [
                            { externalId: 'cmp-1', type: 'attentive' },
                        ],
                    },
                ],
            },
            queueWebhook: async (job) => {
                queued.push(job);
            },
        };
        await onAttentiveWebhookResolve.call(ctx, { data: { body } });
        expect(queued).toEqual([
            {
                event: 'ATTENTIVE_WEBHOOK',
                integrationId: 'int-99',
                body,
            },
        ]);
    });
});
