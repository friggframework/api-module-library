const crypto = require('crypto');
const { Api } = require('../api');

const SECRET = 'cfc68c0b-4b4e-4ef8-b764-95350e4ea479';
const URL_ = 'https://example.com/webhooks/hubspot?x=1';
const NOW = 1752613922216;
const BODY = '[{"eventId":100,"subscriptionType":"contact.creation","portalId":1}]';

const sign = ({ secret = SECRET, method = 'POST', uri = URL_, body = BODY, ts = NOW } = {}) =>
    crypto.createHmac('sha256', secret).update(`${method}${uri}${body}${ts}`, 'utf8').digest('base64');

const headersFor = (over = {}) => ({
    'X-HubSpot-Signature-v3': sign(),
    'X-HubSpot-Request-Timestamp': String(NOW),
    ...over,
});

describe('HubSpot verifyWebhookSignature (v3)', () => {
    const api = new Api({ client_secret: SECRET });
    const call = (over = {}) =>
        api.verifyWebhookSignature({ headers: headersFor(), rawBody: BODY, url: URL_, now: NOW, ...over });

    it('accepts a genuine delivery', async () => {
        expect(await call()).toBe(true);
    });
    it('matches headers case-insensitively and accepts a Buffer rawBody', async () => {
        const h = { 'x-hubspot-signature-v3': sign(), 'x-hubspot-request-timestamp': String(NOW) };
        expect(await call({ headers: h, rawBody: Buffer.from(BODY) })).toBe(true);
    });
    it('uses the configured webhookUrl and webhookSecret when not passed per call', async () => {
        const a = new Api({ webhookSecret: 'other', webhookUrl: URL_ });
        const h = headersFor({ 'X-HubSpot-Signature-v3': sign({ secret: 'other' }) });
        expect(await a.verifyWebhookSignature({ headers: h, rawBody: BODY, now: NOW })).toBe(true);
    });
    it('decodes the URI characters HubSpot lists before hashing', async () => {
        const wire = 'https://example.com/hook%3Fa%3D1?b=2%2C3';
        const signed = 'https://example.com/hook?a%3D1?b=2,3';
        const h = headersFor({ 'X-HubSpot-Signature-v3': sign({ uri: signed }) });
        expect(await call({ headers: h, url: wire })).toBe(true);
    });
    it('rejects a different method (method is part of the signed string)', async () => {
        expect(await call({ method: 'GET' })).toBe(false);
    });
    it('rejects a wrong secret', async () => {
        const a = new Api({ client_secret: 'nope' });
        expect(await a.verifyWebhookSignature({ headers: headersFor(), rawBody: BODY, url: URL_, now: NOW })).toBe(false);
    });
    it('rejects a tampered body', async () => {
        expect(await call({ rawBody: BODY.replace('100', '101') })).toBe(false);
    });
    it('rejects a different URI', async () => {
        expect(await call({ url: 'https://example.com/other' })).toBe(false);
    });
    it('rejects a stale timestamp (> 5 min) even with a valid signature, accepts at 4:59', async () => {
        const old = NOW - 5 * 60 * 1000 - 1;
        const h = {
            'X-HubSpot-Signature-v3': sign({ ts: old }),
            'X-HubSpot-Request-Timestamp': String(old),
        };
        expect(await call({ headers: h })).toBe(false);
        const ok = NOW - 4 * 60 * 1000 - 59000;
        const h2 = {
            'X-HubSpot-Signature-v3': sign({ ts: ok }),
            'X-HubSpot-Request-Timestamp': String(ok),
        };
        expect(await call({ headers: h2 })).toBe(true);
    });
    it('rejects missing headers', async () => {
        expect(await call({ headers: { 'X-HubSpot-Request-Timestamp': String(NOW) } })).toBe(false);
        expect(await call({ headers: { 'X-HubSpot-Signature-v3': sign() } })).toBe(false);
        expect(await call({ headers: undefined })).toBe(false);
    });
    it('rejects a different-length signature without throwing', async () => {
        expect(await call({ headers: headersFor({ 'X-HubSpot-Signature-v3': 'abc' }) })).toBe(false);
        expect(await call({ headers: headersFor({ 'X-HubSpot-Signature-v3': sign() + 'AA' }) })).toBe(false);
    });
    it('returns false with no secret or no URL configured', async () => {
        const saved = process.env.HUBSPOT_CLIENT_SECRET;
        delete process.env.HUBSPOT_CLIENT_SECRET;
        const a = new Api({});
        expect(await a.verifyWebhookSignature({ headers: headersFor(), rawBody: BODY, url: URL_, now: NOW })).toBe(false);
        expect(await new Api({ client_secret: SECRET }).verifyWebhookSignature({ headers: headersFor(), rawBody: BODY, now: NOW })).toBe(false);
        if (saved !== undefined) process.env.HUBSPOT_CLIENT_SECRET = saved;
    });
    it('falls back to JSON.stringify of a parsed body', async () => {
        const parsed = JSON.parse(BODY);
        const h = headersFor({ 'X-HubSpot-Signature-v3': sign({ body: JSON.stringify(parsed) }) });
        expect(await call({ headers: h, rawBody: undefined, body: parsed })).toBe(true);
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
