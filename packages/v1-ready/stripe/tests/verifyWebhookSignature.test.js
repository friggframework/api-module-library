const crypto = require('crypto');
jest.mock('stripe', () => jest.fn().mockImplementation(() => ({ oauth: { authorizeUrl: () => 'x' } })), { virtual: true });
const { Api } = require('../api');

const SECRET = 'whsec_test_secret';
const TS = 1492774577;
const NOW = TS * 1000;
const BODY = '{\n  "id": "evt_test_webhook",\n  "object": "event"\n}';
const sig = (secret = SECRET, ts = TS, body = BODY) =>
    crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
const hdr = (v1 = sig(), ts = TS) => ({ 'Stripe-Signature': `t=${ts},v1=${v1},v0=${'0'.repeat(64)}` });

describe('Stripe verifyWebhookSignature', () => {
    const api = new Api({ stripeApiSecretKey: 'sk_test', stripeClientId: 'ca_x', redirect_uri: 'https://x.test/cb', webhookSecret: SECRET });
    const call = (over = {}) => api.verifyWebhookSignature({ headers: hdr(), rawBody: BODY, now: NOW, ...over });

    it('accepts a genuine delivery', async () => expect(await call()).toBe(true));
    it('is case-insensitive on headers and takes a Buffer', async () => {
        expect(await call({ headers: { 'stripe-signature': hdr()['Stripe-Signature'] }, rawBody: Buffer.from(BODY) })).toBe(true);
    });
    it('accepts when any of several v1 signatures matches (secret rolling) and with a secret array', async () => {
        const h = { 'Stripe-Signature': `t=${TS},v1=${sig('old')},v1=${sig()}` };
        expect(await call({ headers: h })).toBe(true);
        const rolled = new Api({ stripeApiSecretKey: 'sk_test', stripeClientId: 'ca_x', redirect_uri: 'https://x.test/cb', webhookSecret: ['whsec_new', SECRET] });
        expect(await rolled.verifyWebhookSignature({ headers: hdr(), rawBody: BODY, now: NOW })).toBe(true);
    });
    it('ignores the fake v0 scheme (downgrade protection)', async () => {
        const v0 = crypto.createHmac('sha256', SECRET).update(`${TS}.${BODY}`).digest('hex');
        expect(await call({ headers: { 'Stripe-Signature': `t=${TS},v0=${v0}` } })).toBe(false);
    });
    it('rejects a wrong secret', async () => {
        expect(await new Api({ stripeApiSecretKey: 'sk_test', stripeClientId: 'ca_x', redirect_uri: 'https://x.test/cb', webhookSecret: 'whsec_other' }).verifyWebhookSignature({ headers: hdr(), rawBody: BODY, now: NOW })).toBe(false);
    });
    it('rejects a tampered body', async () => expect(await call({ rawBody: BODY.replace('evt_test', 'evt_evil') })).toBe(false));
    it('rejects a tampered timestamp (t is signed)', async () => {
        expect(await call({ headers: hdr(sig(), TS + 1) })).toBe(false);
    });
    it('rejects a stale timestamp with a valid signature; custom tolerance; 0 does not disable', async () => {
        expect(await call({ now: NOW + 301000 })).toBe(false);
        expect(await call({ now: NOW + 299000 })).toBe(true);
        expect(await call({ now: NOW + 600000, tolerance: 900 })).toBe(true);
        expect(await call({ now: NOW + 1000, tolerance: 0 })).toBe(true); // 0 means default, not "no check"
        expect(await call({ now: NOW + 301000, tolerance: 0 })).toBe(false);
    });
    it('rejects a missing header or a header without t / v1', async () => {
        expect(await call({ headers: {} })).toBe(false);
        expect(await call({ headers: { 'Stripe-Signature': `v1=${sig()}` } })).toBe(false);
        expect(await call({ headers: { 'Stripe-Signature': `t=${TS}` } })).toBe(false);
    });
    it('rejects a different-length signature without throwing', async () => {
        expect(await call({ headers: hdr('abcd') })).toBe(false);
        expect(await call({ headers: hdr(sig() + '00') })).toBe(false);
    });
    it('reads STRIPE_WEBHOOK_SECRET; returns false with no secret', async () => {
        expect(await new Api({ stripeApiSecretKey: 'sk_test', stripeClientId: 'ca_x', redirect_uri: 'https://x.test/cb' }).verifyWebhookSignature({ headers: hdr(), rawBody: BODY, now: NOW })).toBe(false);
        process.env.STRIPE_WEBHOOK_SECRET = SECRET;
        try {
            expect(await new Api({ stripeApiSecretKey: 'sk_test', stripeClientId: 'ca_x', redirect_uri: 'https://x.test/cb' }).verifyWebhookSignature({ headers: hdr(), rawBody: BODY, now: NOW })).toBe(true);
        } finally { delete process.env.STRIPE_WEBHOOK_SECRET; }
    });
    it('compares signatures in constant time (crypto.timingSafeEqual)', async () => {
        const spy = jest.spyOn(require('crypto'), 'timingSafeEqual');
        try {
            expect(await call()).toBe(true);
            expect(spy).toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });
});
