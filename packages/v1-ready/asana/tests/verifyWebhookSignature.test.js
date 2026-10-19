const crypto = require('crypto');
const { Api } = require('../api');

const SECRET = 'b537207f56d0a3d0e5b0e5d8e1f6a9c4';
const BODY = '{"events":[{"action":"changed","resource":{"gid":"1","resource_type":"task"},"created_at":"2026-01-01T00:00:00.000Z"}]}';
const sign = (body = BODY, secret = SECRET) => crypto.createHmac('sha256', secret).update(body).digest('hex');

describe('Asana verifyWebhookSignature', () => {
    const api = new Api({ webhookSecret: SECRET });
    const call = (over = {}) =>
        api.verifyWebhookSignature({ headers: { 'X-Hook-Signature': sign() }, rawBody: BODY, ...over });

    it('accepts a genuine delivery', async () => expect(await call()).toBe(true));
    it('is case-insensitive on headers and takes a Buffer', async () => {
        expect(await call({ headers: { 'x-hook-signature': sign() }, rawBody: Buffer.from(BODY) })).toBe(true);
    });
    it('verifies an empty heartbeat body signed by Asana', async () => {
        const hb = '{"events":[]}';
        expect(await call({ headers: { 'X-Hook-Signature': sign(hb) }, rawBody: hb })).toBe(true);
    });
    it('reads ASANA_WEBHOOK_SECRET', async () => {
        process.env.ASANA_WEBHOOK_SECRET = SECRET;
        try {
            expect(await new Api({}).verifyWebhookSignature({ headers: { 'X-Hook-Signature': sign() }, rawBody: BODY })).toBe(true);
        } finally { delete process.env.ASANA_WEBHOOK_SECRET; }
    });
    it('rejects a wrong secret (e.g. another installation\'s)', async () => {
        expect(await new Api({ webhookSecret: 'other' }).verifyWebhookSignature({ headers: { 'X-Hook-Signature': sign() }, rawBody: BODY })).toBe(false);
    });
    it('rejects a tampered body', async () => expect(await call({ rawBody: BODY.replace('changed', 'deleted') })).toBe(false));
    it('rejects a missing header', async () => {
        expect(await call({ headers: {} })).toBe(false);
        expect(await call({ headers: undefined })).toBe(false);
    });
    it('rejects a different-length / non-hex signature without throwing', async () => {
        expect(await call({ headers: { 'X-Hook-Signature': 'abcd' } })).toBe(false);
        expect(await call({ headers: { 'X-Hook-Signature': sign() + 'ab' } })).toBe(false);
        expect(await call({ headers: { 'X-Hook-Signature': 'zz' } })).toBe(false);
    });
    it('returns false with no secret configured', async () => {
        expect(await new Api({}).verifyWebhookSignature({ headers: { 'X-Hook-Signature': sign() }, rawBody: BODY })).toBe(false);
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
    it('treats an empty-string secret as unconfigured (HMAC with an empty key would otherwise verify)', async () => {
        const empty = new Api({ webhookSecret: '' });
        expect(await empty.verifyWebhookSignature({ headers: { 'X-Hook-Signature': sign(BODY, '') }, rawBody: BODY })).toBe(false);
    });
});
