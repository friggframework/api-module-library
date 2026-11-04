const crypto = require('crypto');
const {
    verifyGitHubSignature,
} = require('../extensions/webhooks/signature-verifier');

describe('GitHub webhook signature verifier', () => {
    const secret = 'test-webhook-secret';

    function sign(body, key = secret) {
        return (
            'sha256=' +
            crypto.createHmac('sha256', key).update(body, 'utf8').digest('hex')
        );
    }

    it('accepts a valid X-Hub-Signature-256', () => {
        const body = '{"zen":"Anything added dilutes everything else."}';
        const req = {
            headers: { 'x-hub-signature-256': sign(body) },
            rawBody: body,
        };
        expect(verifyGitHubSignature({ req, secret })).toEqual({ valid: true });
    });

    it('rejects a bad signature', () => {
        const body = '{"action":"opened"}';
        const req = {
            headers: { 'x-hub-signature-256': sign(body, 'wrong') },
            rawBody: body,
        };
        const result = verifyGitHubSignature({ req, secret });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/mismatch/i);
    });

    it('rejects missing signature header', () => {
        const result = verifyGitHubSignature({
            req: { headers: {}, rawBody: '{}' },
            secret,
        });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/missing/i);
    });

    it('rejects missing secret', () => {
        const result = verifyGitHubSignature({
            req: {
                headers: { 'x-hub-signature-256': 'sha256=abc' },
                rawBody: '{}',
            },
            secret: '',
        });
        expect(result.valid).toBe(false);
    });
});
