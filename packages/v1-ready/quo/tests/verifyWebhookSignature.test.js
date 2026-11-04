const crypto = require('crypto');
const { Api } = require('../api');

const KEY_B64 = Buffer.from('quo-test-signing-key-material-0123').toString('base64');
const KEY = Buffer.from(KEY_B64, 'base64');
const SECRET_NEW = `whsec_${KEY_B64}`;
const TS = 1700000000; // seconds
const NOW = TS * 1000;
const BODY = '{"id":"EV1","type":"message.received","data":{"object":{"text":"hi  there"}}}';
const hmac = (str, key = KEY) => crypto.createHmac('sha256', key).update(str).digest('base64');

describe('Quo verifyWebhookSignature: current scheme (webhook-* headers)', () => {
    const api = new Api({ webhookSecret: SECRET_NEW });
    const sig = (body = BODY, id = 'msg_1', ts = TS, key = KEY) => hmac(`${id}.${ts}.${body}`, key);
    const hdrs = (over = {}) => ({ 'webhook-id': 'msg_1', 'webhook-timestamp': String(TS), 'webhook-signature': `v1,${sig()}`, ...over });
    const call = (over = {}) => api.verifyWebhookSignature({ headers: hdrs(), rawBody: BODY, now: NOW, ...over });

    it('accepts a genuine delivery (any header case, Buffer body)', async () => {
        expect(await call()).toBe(true);
        const h = { 'Webhook-Id': 'msg_1', 'Webhook-Timestamp': String(TS), 'Webhook-Signature': `v1,${sig()}` };
        expect(await call({ headers: h, rawBody: Buffer.from(BODY) })).toBe(true);
    });
    it('accepts when any of several signatures matches', async () => {
        expect(await call({ headers: hdrs({ 'webhook-signature': `v1,${sig('x')} v1,${sig()}` }) })).toBe(true);
    });
    it('rejects wrong secret, tampered body, tampered id', async () => {
        const other = new Api({ webhookSecret: 'whsec_' + Buffer.from('different').toString('base64') });
        expect(await other.verifyWebhookSignature({ headers: hdrs(), rawBody: BODY, now: NOW })).toBe(false);
        expect(await call({ rawBody: BODY.replace('hi', 'yo') })).toBe(false);
        expect(await call({ headers: hdrs({ 'webhook-id': 'msg_2' }) })).toBe(false);
    });
    it('rejects a stale timestamp with a valid signature; accepts at 299s', async () => {
        expect(await call({ now: NOW + 301000 })).toBe(false);
        expect(await call({ now: NOW + 299000 })).toBe(true);
    });
    it('rejects missing headers and different-length signatures', async () => {
        for (const k of ['webhook-id', 'webhook-timestamp']) {
            const h = hdrs(); delete h[k];
            expect(await call({ headers: h })).toBe(false);
        }
        expect(await call({ headers: hdrs({ 'webhook-signature': 'v1,abc' }) })).toBe(false);
        expect(await call({ headers: hdrs({ 'webhook-signature': `v1,${sig()}AA` }) })).toBe(false);
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

describe('Quo verifyWebhookSignature: legacy openphone-signature', () => {
    const api = new Api({ webhookSecret: KEY_B64 });
    const TS_MS = TS * 1000;
    const legacy = (body = BODY, ts = TS_MS, key = KEY, sigOver) => `hmac;1;${ts};${sigOver || hmac(`${ts}.${body}`, key)}`;
    const call = (over = {}) => api.verifyWebhookSignature({ headers: { 'openphone-signature': legacy() }, rawBody: BODY, now: NOW, ...over });

    it('accepts a genuine delivery (header case-insensitive)', async () => {
        expect(await call()).toBe(true);
        expect(await call({ headers: { 'OpenPhone-Signature': legacy() } })).toBe(true);
    });
    it('accepts a pretty-printed raw body signed over its compact form (docs say strip whitespace)', async () => {
        const pretty = JSON.stringify(JSON.parse(BODY), null, 2);
        const h = { 'openphone-signature': legacy(BODY) };
        expect(await call({ headers: h, rawBody: pretty })).toBe(true);
    });
    it('accepts a comma-separated list when one entry matches', async () => {
        const h = { 'openphone-signature': `${legacy('zzz')},${legacy()}` };
        expect(await call({ headers: h })).toBe(true);
    });
    it('rejects wrong secret, tampered body', async () => {
        expect(await new Api({ webhookSecret: Buffer.from('nope').toString('base64') }).verifyWebhookSignature({ headers: { 'openphone-signature': legacy() }, rawBody: BODY, now: NOW })).toBe(false);
        expect(await call({ rawBody: BODY.replace('hi', 'yo') })).toBe(false);
    });
    it('rejects a stale timestamp with a valid signature; accepts 299s', async () => {
        expect(await call({ now: NOW + 301000 })).toBe(false);
        expect(await call({ now: NOW + 299000 })).toBe(true);
    });
    it('rejects a missing header, malformed header, different-length signature', async () => {
        expect(await call({ headers: {} })).toBe(false);
        expect(await call({ headers: { 'openphone-signature': 'garbage' } })).toBe(false);
        expect(await call({ headers: { 'openphone-signature': legacy(BODY, TS_MS, KEY, 'abc') } })).toBe(false);
        expect(await call({ headers: { 'openphone-signature': 'hmac;2;' + TS_MS + ';' + hmac(`${TS_MS}.${BODY}`) } })).toBe(false);
    });
    it('returns false with no secret; reads QUO_WEBHOOK_SECRET', async () => {
        expect(await new Api({}).verifyWebhookSignature({ headers: { 'openphone-signature': legacy() }, rawBody: BODY, now: NOW })).toBe(false);
        process.env.QUO_WEBHOOK_SECRET = KEY_B64;
        try {
            expect(await new Api({}).verifyWebhookSignature({ headers: { 'openphone-signature': legacy() }, rawBody: BODY, now: NOW })).toBe(true);
        } finally { delete process.env.QUO_WEBHOOK_SECRET; }
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
