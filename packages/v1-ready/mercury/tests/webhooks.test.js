const crypto = require('crypto');
const {
    verifyMercurySignature,
    parseMercurySignature,
} = require('../extensions/webhooks/signature-verifier');
const {
    onMercuryWebhookReceived,
    extractExternalId,
} = require('../extensions/webhooks/handlers');

function sign(secret, timestamp, body) {
    const hex = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${body}`, 'utf8')
        .digest('hex');
    return `t=${timestamp},v1=${hex}`;
}

describe('Mercury webhook signature verifier', () => {
    const secret = 'whsec_test_secret';
    const body = JSON.stringify({
        id: 'evt-1',
        resourceType: 'transaction',
        operationType: 'create',
    });

    it('parses Mercury-Signature header parts', () => {
        expect(parseMercurySignature('t=1700000000,v1=abc')).toEqual({
            t: '1700000000',
            v1: 'abc',
        });
        expect(parseMercurySignature('bad')).toBeNull();
    });

    it('accepts a valid signature over timestamp.rawBody', () => {
        const ts = Math.floor(Date.now() / 1000);
        const req = {
            headers: { 'Mercury-Signature': sign(secret, ts, body) },
            rawBody: body,
            body: JSON.parse(body),
        };
        expect(verifyMercurySignature({ req, secret })).toEqual({
            valid: true,
        });
    });

    it('rejects a tampered body', () => {
        const ts = Math.floor(Date.now() / 1000);
        const req = {
            headers: { 'mercury-signature': sign(secret, ts, body) },
            rawBody: body + 'x',
        };
        expect(verifyMercurySignature({ req, secret }).valid).toBe(false);
    });

    it('rejects a missing secret', () => {
        const req = { headers: {}, rawBody: body };
        expect(verifyMercurySignature({ req, secret: null }).reason).toMatch(
            /missing webhook secret/
        );
    });
});

describe('Mercury webhook handlers', () => {
    it('extractExternalId reads query, body, then params', () => {
        expect(
            extractExternalId({ query: { externalId: 'from-q' } }, {})
        ).toBe('from-q');
        expect(extractExternalId({}, { externalId: 'from-b' })).toBe('from-b');
        expect(
            extractExternalId({ params: { externalId: 'from-p' } }, {})
        ).toBe('from-p');
        expect(extractExternalId({}, {})).toBeNull();
    });

    it('RECEIVED rejects invalid signatures with 401', async () => {
        const status = jest.fn().mockReturnThis();
        const json = jest.fn();
        const ctx = { queueWebhook: jest.fn() };
        await onMercuryWebhookReceived.call(ctx, {
            req: { headers: {}, body: {}, query: { externalId: 'a' } },
            res: { status, json },
        });
        expect(status).toHaveBeenCalledWith(401);
        expect(ctx.queueWebhook).not.toHaveBeenCalled();
    });

    it('RECEIVED queues RESOLVE when signature + externalId are valid', async () => {
        const secret = 'sec';
        process.env.MERCURY_WEBHOOK_SECRET = secret;
        const bodyObj = { id: 'evt-2', resourceType: 'transaction' };
        const body = JSON.stringify(bodyObj);
        const ts = Math.floor(Date.now() / 1000);
        const status = jest.fn().mockReturnThis();
        const json = jest.fn();
        const queueWebhook = jest.fn();
        const ctx = { queueWebhook };

        await onMercuryWebhookReceived.call(ctx, {
            req: {
                headers: { 'Mercury-Signature': sign(secret, ts, body) },
                rawBody: body,
                body: bodyObj,
                query: { externalId: 'acc-1' },
            },
            res: { status, json },
        });

        expect(queueWebhook).toHaveBeenCalledWith({
            event: 'MERCURY_WEBHOOK_RESOLVE',
            body: { ...bodyObj, externalId: 'acc-1' },
        });
        expect(status).toHaveBeenCalledWith(200);
        delete process.env.MERCURY_WEBHOOK_SECRET;
    });
});
