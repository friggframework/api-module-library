const crypto = require('crypto');
const {
    verifySignature,
    getSignatureFromHeaders,
    SIGNATURE_HEADER,
    EVENTS,
} = require('../webhooks');

const SECRET = 'whsec_test_secret';
const RAW_BODY = '{"type":"job.completed","data":{"id":12345}}';

const hexSignature = (body, secret = SECRET) =>
    crypto.createHmac('sha256', secret).update(body).digest('hex');

const base64Signature = (body, secret = SECRET) =>
    crypto.createHmac('sha256', secret).update(body).digest('base64');

describe('ServiceTitan webhook signature verification', () => {
    it('accepts a hex-encoded signature over the raw body', () => {
        expect(
            verifySignature({
                rawBody: RAW_BODY,
                signature: hexSignature(RAW_BODY),
                secret: SECRET,
            })
        ).toBe(true);
    });

    it('accepts a base64-encoded signature over the same body', () => {
        expect(
            verifySignature({
                rawBody: RAW_BODY,
                signature: base64Signature(RAW_BODY),
                secret: SECRET,
            })
        ).toBe(true);
    });

    it('accepts a Buffer raw body', () => {
        expect(
            verifySignature({
                rawBody: Buffer.from(RAW_BODY, 'utf8'),
                signature: hexSignature(RAW_BODY),
                secret: SECRET,
            })
        ).toBe(true);
    });

    it('rejects a tampered body', () => {
        const tampered = RAW_BODY.replace('12345', '99999');
        expect(
            verifySignature({
                rawBody: tampered,
                signature: hexSignature(RAW_BODY),
                secret: SECRET,
            })
        ).toBe(false);
    });

    it('rejects a signature made with a different secret', () => {
        expect(
            verifySignature({
                rawBody: RAW_BODY,
                signature: hexSignature(RAW_BODY, 'wrong-secret'),
                secret: SECRET,
            })
        ).toBe(false);
    });

    it('rejects a missing or empty signature instead of passing', () => {
        for (const signature of [undefined, null, '']) {
            expect(verifySignature({ rawBody: RAW_BODY, signature, secret: SECRET })).toBe(
                false
            );
        }
    });

    it('rejects a signature of the wrong length without throwing', () => {
        // crypto.timingSafeEqual throws on length mismatch; verifySignature
        // must compare fixed-width digests so a short signature is a plain false.
        expect(() =>
            verifySignature({ rawBody: RAW_BODY, signature: 'abc', secret: SECRET })
        ).not.toThrow();
        expect(
            verifySignature({ rawBody: RAW_BODY, signature: 'abc', secret: SECRET })
        ).toBe(false);
    });

    it('throws when no secret is configured rather than accepting everything', () => {
        expect(() =>
            verifySignature({ rawBody: RAW_BODY, signature: hexSignature(RAW_BODY) })
        ).toThrow(/webhook secret is required/);
    });

    it('fails when the body was re-serialized from parsed JSON', () => {
        // This is the trap the raw-body requirement exists for: re-stringifying a
        // parsed body is not byte-identical to what ServiceTitan signed, so
        // verification fails for every delivery and looks like a bad secret.
        const reSerialized = JSON.stringify(JSON.parse(RAW_BODY.replace(/"/g, '"')));
        const spaced = JSON.stringify(JSON.parse(RAW_BODY), null, 2);
        expect(reSerialized).toEqual(RAW_BODY); // key order happens to survive here
        expect(spaced).not.toEqual(RAW_BODY);
        expect(
            verifySignature({
                rawBody: spaced,
                signature: hexSignature(RAW_BODY),
                secret: SECRET,
            })
        ).toBe(false);
    });
});

describe('getSignatureFromHeaders', () => {
    it('finds the header regardless of casing', () => {
        expect(getSignatureFromHeaders({ 'X-ServiceTitan-Signature': 'abc' })).toEqual(
            'abc'
        );
        expect(getSignatureFromHeaders({ [SIGNATURE_HEADER]: 'abc' })).toEqual('abc');
    });

    it('takes the first value when the header repeats', () => {
        expect(getSignatureFromHeaders({ [SIGNATURE_HEADER]: ['first', 'second'] })).toEqual(
            'first'
        );
    });

    it('returns null when absent', () => {
        expect(getSignatureFromHeaders({ 'content-type': 'application/json' })).toBeNull();
        expect(getSignatureFromHeaders()).toBeNull();
    });
});

describe('EVENTS', () => {
    it('covers the events the Podium-parity automations trigger on', () => {
        expect(Object.values(EVENTS)).toEqual(
            expect.arrayContaining([
                'job.created',
                'job.completed',
                'appointment.created',
                'appointment.rescheduled',
                'customer.created',
                'customer.updated',
            ])
        );
    });
});
