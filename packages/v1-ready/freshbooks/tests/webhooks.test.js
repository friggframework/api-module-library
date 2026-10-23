const crypto = require('crypto');
const {
    verifyFreshBooksSignature,
    buildSignedPayload,
    SIGNATURE_HEADER,
} = require('../extensions/webhooks/signature-verifier');

describe('FreshBooks webhook signature verifier', () => {
    const verifier = 'scADVVi5QuKuj5qTjVkbJNYQe7V7USpGd';
    const params = {
        name: 'invoice.create',
        object_id: '1234567',
        account_id: '6BApk',
        business_id: '6543',
        identity_id: '1234',
    };

    it('builds spaced JSON with string values', () => {
        const payload = buildSignedPayload(params);
        expect(payload).toContain(': ');
        expect(payload).toContain(', ');
        expect(payload).toContain('"object_id": "1234567"');
    });

    it('accepts a valid X-FreshBooks-Hmac-SHA256 signature', () => {
        const message = buildSignedPayload(params);
        const signature = crypto
            .createHmac('sha256', verifier)
            .update(message, 'utf8')
            .digest('base64');

        const result = verifyFreshBooksSignature({
            verifier,
            req: {
                headers: { [SIGNATURE_HEADER]: signature },
                body: params,
            },
        });
        expect(result.valid).toBe(true);
        expect(result.params.name).toBe('invoice.create');
    });

    it('rejects a tampered signature', () => {
        const result = verifyFreshBooksSignature({
            verifier,
            req: {
                headers: { [SIGNATURE_HEADER]: 'not-valid' },
                body: params,
            },
        });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/signature mismatch|missing/);
    });

    it('rejects when the verifier secret is missing', () => {
        const result = verifyFreshBooksSignature({
            verifier: null,
            req: { headers: {}, body: params },
        });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/verifier/);
    });
});
