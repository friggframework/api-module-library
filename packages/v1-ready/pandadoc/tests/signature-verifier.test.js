const crypto = require('crypto');
const {
    verifyPandaDocSignature,
    extractSignature,
} = require('../extensions/webhooks/signature-verifier');

describe('PandaDoc webhook signature verifier', () => {
    const sharedKey = 'test-shared-key';
    const body = JSON.stringify([
        { event: 'document_state_changed', data: { id: 'd1' } },
    ]);
    const signature = crypto
        .createHmac('sha256', sharedKey)
        .update(body, 'utf8')
        .digest('hex');

    it('accepts a valid signature from query', () => {
        const result = verifyPandaDocSignature({
            req: {
                query: { signature },
                rawBody: body,
            },
            sharedKey,
        });
        expect(result.valid).toBe(true);
    });

    it('rejects a tampered body', () => {
        const result = verifyPandaDocSignature({
            req: {
                query: { signature },
                rawBody: body + 'x',
            },
            sharedKey,
        });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/mismatch/i);
    });

    it('rejects a missing signature', () => {
        const result = verifyPandaDocSignature({
            req: { query: {}, rawBody: body },
            sharedKey,
        });
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/missing signature/i);
    });

    it('extracts signature from a raw URL', () => {
        expect(
            extractSignature({
                url: `/webhooks?workspace_id=ws&signature=${signature}`,
            })
        ).toBe(signature);
    });
});
