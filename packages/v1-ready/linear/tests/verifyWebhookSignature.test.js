const crypto = require('crypto');
jest.mock('@linear/sdk', () => ({ LinearClient: jest.fn() }), { virtual: true });
const { Api } = require('../api');

const SECRET = 'lin_wh_secret';
const NOW = 1700000000000;
const mk = (over = {}) => JSON.stringify({ action: 'create', type: 'Issue', webhookTimestamp: NOW, webhookId: 'w1', ...over });
const sign = (body, secret = SECRET) => crypto.createHmac('sha256', secret).update(body).digest('hex');

describe('Linear verifyWebhookSignature', () => {
    const api = new Api({ webhookSecret: SECRET });
    const BODY = mk();
    const call = (over = {}) => api.verifyWebhookSignature({ headers: { 'Linear-Signature': sign(BODY) }, rawBody: BODY, now: NOW, ...over });

    it('accepts a genuine delivery', async () => expect(await call()).toBe(true));
    it('is case-insensitive on headers and takes a Buffer', async () => {
        expect(await call({ headers: { 'linear-signature': sign(BODY) }, rawBody: Buffer.from(BODY) })).toBe(true);
    });
    it('verifies from a string body when rawBody is absent', async () => {
        expect(await call({ rawBody: undefined, body: BODY })).toBe(true);
    });
    it('rejects a wrong secret', async () => {
        expect(await new Api({ webhookSecret: 'x' }).verifyWebhookSignature({ headers: { 'Linear-Signature': sign(BODY) }, rawBody: BODY, now: NOW })).toBe(false);
    });
    it('rejects a tampered body', async () => expect(await call({ rawBody: mk({ action: 'remove' }) })).toBe(false));
    it('rejects a stale webhookTimestamp (> 60s) with a valid signature; accepts 59s', async () => {
        expect(await call({ now: NOW + 61000 })).toBe(false);
        expect(await call({ now: NOW - 61000 })).toBe(false);
        expect(await call({ now: NOW + 59000 })).toBe(true);
    });
    it('rejects a validly-signed body with no webhookTimestamp', async () => {
        const b = JSON.stringify({ action: 'create', type: 'Issue' });
        expect(await call({ headers: { 'Linear-Signature': sign(b) }, rawBody: b })).toBe(false);
    });
    it('rejects a missing header', async () => {
        expect(await call({ headers: {} })).toBe(false);
        expect(await call({ headers: undefined })).toBe(false);
    });
    it('rejects a different-length signature without throwing', async () => {
        expect(await call({ headers: { 'Linear-Signature': 'abcd' } })).toBe(false);
        expect(await call({ headers: { 'Linear-Signature': sign(BODY) + '00' } })).toBe(false);
    });
    it('returns false for a non-JSON body that happens to be signed, and with no secret', async () => {
        const b = 'not json';
        expect(await call({ headers: { 'Linear-Signature': sign(b) }, rawBody: b })).toBe(false);
        expect(await new Api({}).verifyWebhookSignature({ headers: { 'Linear-Signature': sign(BODY) }, rawBody: BODY, now: NOW })).toBe(false);
    });
    it('reads LINEAR_WEBHOOK_SECRET', async () => {
        process.env.LINEAR_WEBHOOK_SECRET = SECRET;
        try {
            expect(await new Api({}).verifyWebhookSignature({ headers: { 'Linear-Signature': sign(BODY) }, rawBody: BODY, now: NOW })).toBe(true);
        } finally { delete process.env.LINEAR_WEBHOOK_SECRET; }
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
