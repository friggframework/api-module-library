const crypto = require('crypto');
const {
    verifySalesloftSignature,
    SIGNATURE_HEADER,
    EVENT_HEADER,
} = require('../../extensions/webhooks/signature-verifier');
const {
    onSalesloftWebhookReceived,
    onSalesloftWebhookResolve,
} = require('../../extensions/webhooks/handlers');

describe('Salesloft webhook extension', () => {
    const token = 'callback-secret';
    const bodyObj = { id: 99, tenant_id: 123 };
    const rawBody = JSON.stringify(bodyObj);
    const signature = crypto
        .createHmac('sha1', token)
        .update(rawBody, 'utf8')
        .digest('hex');

    beforeEach(() => {
        process.env.SALESLOFT_WEBHOOK_CALLBACK_TOKEN = token;
    });

    it('verifySalesloftSignature accepts a valid delivery', () => {
        const result = verifySalesloftSignature({
            req: {
                headers: {
                    [SIGNATURE_HEADER]: signature,
                    [EVENT_HEADER]: 'person_created',
                },
                rawBody,
                body: bodyObj,
            },
            callbackToken: token,
        });
        expect(result.valid).toBe(true);
        expect(result.eventType).toBe('person_created');
    });

    it('receiver rejects bad signatures with 401', async () => {
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
        const ctx = {
            queueWebhook: jest.fn(),
        };
        await onSalesloftWebhookReceived.call(ctx, {
            req: {
                headers: { [SIGNATURE_HEADER]: 'nope' },
                rawBody,
                body: bodyObj,
            },
            res,
        });
        expect(res.statusCode).toBe(401);
        expect(ctx.queueWebhook).not.toHaveBeenCalled();
    });

    it('receiver queues resolve on valid signature', async () => {
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
        const ctx = { queueWebhook: jest.fn() };
        await onSalesloftWebhookReceived.call(ctx, {
            req: {
                headers: {
                    [SIGNATURE_HEADER]: signature,
                    [EVENT_HEADER]: 'person_created',
                },
                rawBody,
                body: bodyObj,
            },
            res,
        });
        expect(res.statusCode).toBe(200);
        expect(ctx.queueWebhook).toHaveBeenCalledWith({
            event: 'SALESLOFT_WEBHOOK_RESOLVE',
            body: {
                eventType: 'person_created',
                payload: bodyObj,
            },
        });
    });

    it('resolve skips when tenant_id is missing', async () => {
        const ctx = { queueWebhook: jest.fn() };
        await onSalesloftWebhookResolve.call(ctx, {
            data: { body: { eventType: 'person_created', payload: { id: 1 } } },
        });
        expect(ctx.queueWebhook).not.toHaveBeenCalled();
    });
});
