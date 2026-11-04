const crypto = require('crypto');
const {
    verifyTypeformSignature,
} = require('../extensions/webhooks/signature-verifier');

describe('Typeform webhook signature verifier', () => {
    const secret = 'whsec_test_secret';

    function signedReq(body, { header, secretOverride } = {}) {
        const raw = typeof body === 'string' ? body : JSON.stringify(body);
        const hash = crypto
            .createHmac('sha256', secretOverride || secret)
            .update(raw)
            .digest('base64');
        return {
            headers: {
                'typeform-signature': header || `sha256=${hash}`,
            },
            rawBody: raw,
            body: typeof body === 'string' ? JSON.parse(body) : body,
        };
    }

    it('accepts a valid Typeform-Signature', () => {
        const req = signedReq({
            event_id: 'LtWXD3crgy',
            event_type: 'form_response',
        });
        expect(verifyTypeformSignature({ req, secret })).toEqual({
            valid: true,
        });
    });

    it('rejects a missing secret', () => {
        const req = signedReq({ event_id: 'x' });
        expect(verifyTypeformSignature({ req, secret: '' }).valid).toBe(false);
    });

    it('rejects a missing signature header', () => {
        const req = { headers: {}, rawBody: '{}', body: {} };
        const result = verifyTypeformSignature({ req, secret });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/missing/i);
    });

    it('rejects a tampered signature', () => {
        const req = signedReq({ event_id: 'x' }, { header: 'sha256=deadbeef' });
        expect(verifyTypeformSignature({ req, secret }).valid).toBe(false);
    });

    it('rejects a signature made with a different secret', () => {
        const req = signedReq({ event_id: 'x' }, { secretOverride: 'other' });
        expect(verifyTypeformSignature({ req, secret }).valid).toBe(false);
    });
});
