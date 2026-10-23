const crypto = require('crypto');
const { Api } = require('../api');

// Docs' secret format: whsec_ + base64 key. Built at runtime from obviously fake key material.
const SECRET = 'whsec_' + Buffer.from('fathom-test-key-material').toString('base64');
const KEY = Buffer.from(SECRET.slice(6), 'base64');
const TS = 1700000000;
const NOW = TS * 1000;
const ID = 'msg_abc123';
const BODY = '{"recording_id":42,"title":"Weekly sync"}';
const sig = (body = BODY, { key = KEY, id = ID, ts = TS } = {}) =>
    crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
const hdrs = (over = {}) => ({
    'webhook-id': ID,
    'webhook-timestamp': String(TS),
    'webhook-signature': `v1,${sig()}`,
    ...over,
});

describe('Fathom verifyWebhookSignature', () => {
    const api = new Api({ webhookSecret: SECRET });
    const call = (over = {}) => api.verifyWebhookSignature({ headers: hdrs(), rawBody: BODY, now: NOW, ...over });

    it('accepts a genuine delivery', async () => expect(await call()).toBe(true));
    it('is case-insensitive on headers and takes a Buffer', async () => {
        const h = { 'Webhook-Id': ID, 'Webhook-Timestamp': String(TS), 'Webhook-Signature': `v1,${sig()}` };
        expect(await call({ headers: h, rawBody: Buffer.from(BODY) })).toBe(true);
    });
    it('accepts when any space-delimited signature matches', async () => {
        const h = hdrs({ 'webhook-signature': `v1,${sig('other')} v1,${sig()}` });
        expect(await call({ headers: h })).toBe(true);
    });
    it('ignores signatures of an unknown version', async () => {
        expect(await call({ headers: hdrs({ 'webhook-signature': `v2,${sig()}` }) })).toBe(false);
    });
    it('rejects a wrong secret', async () => {
        const other = 'whsec_' + Buffer.from('another-key-material').toString('base64');
        expect(await new Api({ webhookSecret: other }).verifyWebhookSignature({ headers: hdrs(), rawBody: BODY, now: NOW })).toBe(false);
    });
    it('rejects a tampered body and a tampered id', async () => {
        expect(await call({ rawBody: BODY.replace('42', '43') })).toBe(false);
        expect(await call({ headers: hdrs({ 'webhook-id': 'msg_evil' }) })).toBe(false);
    });
    it('rejects a stale timestamp with a valid signature; accepts at 299s', async () => {
        expect(await call({ now: NOW + 301000 })).toBe(false);
        expect(await call({ now: NOW - 301000 })).toBe(false);
        expect(await call({ now: NOW + 299000 })).toBe(true);
    });
    it('rejects missing headers', async () => {
        for (const k of ['webhook-id', 'webhook-timestamp', 'webhook-signature']) {
            const h = hdrs(); delete h[k];
            expect(await call({ headers: h })).toBe(false);
        }
        expect(await call({ headers: undefined })).toBe(false);
    });
    it('rejects a different-length signature without throwing', async () => {
        expect(await call({ headers: hdrs({ 'webhook-signature': 'v1,abc' }) })).toBe(false);
        expect(await call({ headers: hdrs({ 'webhook-signature': `v1,${sig()}AAAA` }) })).toBe(false);
        expect(await call({ headers: hdrs({ 'webhook-signature': 'garbage' }) })).toBe(false);
    });
    it('returns false with no secret; reads FATHOM_WEBHOOK_SECRET', async () => {
        expect(await new Api({}).verifyWebhookSignature({ headers: hdrs(), rawBody: BODY, now: NOW })).toBe(false);
        process.env.FATHOM_WEBHOOK_SECRET = SECRET;
        try {
            expect(await new Api({}).verifyWebhookSignature({ headers: hdrs(), rawBody: BODY, now: NOW })).toBe(true);
        } finally { delete process.env.FATHOM_WEBHOOK_SECRET; }
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
