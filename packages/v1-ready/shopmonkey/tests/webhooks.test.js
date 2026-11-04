const crypto = require('crypto');
const {
    verifyShopmonkeyWebhookSignature,
} = require('../extensions/webhooks/signature-verifier');
const { extractExternalId } = require('../extensions/webhooks/handlers');

describe('Shopmonkey webhook signature verifier', () => {
    const secret = 'whsec_test_secret';
    const msgId = 'msg_123';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({
        apiVersion: '3',
        operation: 'INSERT',
        table: 'order',
        data: { id: 'ord_1', companyId: 'co_9' },
    });

    function sign(rawBody = body) {
        const signed = `${msgId}.${timestamp}.${rawBody}`;
        return crypto
            .createHmac('sha256', secret)
            .update(signed, 'utf8')
            .digest('base64');
    }

    it('accepts a valid HMAC signature', () => {
        const req = {
            headers: {
                'webhook-id': msgId,
                'webhook-timestamp': timestamp,
                'webhook-signature': sign(),
            },
            rawBody: body,
        };
        expect(verifyShopmonkeyWebhookSignature(req, secret)).toEqual({
            ok: true,
        });
    });

    it('rejects a bad signature', () => {
        const req = {
            headers: {
                'webhook-id': msgId,
                'webhook-timestamp': timestamp,
                'webhook-signature': 'not-valid',
            },
            rawBody: body,
        };
        expect(verifyShopmonkeyWebhookSignature(req, secret).ok).toBe(false);
    });

    it('rejects when secret is missing', () => {
        expect(
            verifyShopmonkeyWebhookSignature({ headers: {} }, null).reason
        ).toBe('missing_secret');
    });
});

describe('extractExternalId', () => {
    it('prefers data.companyId from the documented event envelope', () => {
        expect(
            extractExternalId({
                operation: 'INSERT',
                table: 'customer',
                data: { id: 'cust_1', companyId: 'co_42' },
            })
        ).toBe('co_42');
    });

    it('returns null when nothing usable is present', () => {
        expect(extractExternalId({ table: 'order', data: { id: 'x' } })).toBe(
            null
        );
    });
});
