const crypto = require('crypto');
const { Api } = require('../api');

const SECRET = '8f742231b10e8888abcd99yyyzzz85a5';
const TS = 1531420618;
const NOW = TS * 1000;
const BODY = 'token=xyzz0WbapA4vBCDEFasx0q6G&team_id=T1DC2JH3J&command=%2Fweather&text=94070';
const sign = ({ secret = SECRET, ts = TS, body = BODY } = {}) =>
    'v0=' + crypto.createHmac('sha256', secret).update(`v0:${ts}:${body}`).digest('hex');
const headers = (over = {}) => ({
    'X-Slack-Signature': sign(),
    'X-Slack-Request-Timestamp': String(TS),
    ...over,
});

describe('Slack verifyWebhookSignature', () => {
    const api = new Api({ webhookSecret: SECRET });
    const call = (over = {}) => api.verifyWebhookSignature({ headers: headers(), rawBody: BODY, now: NOW, ...over });

    it('accepts a genuine delivery', async () => expect(await call()).toBe(true));
    it('is case-insensitive on headers and takes a Buffer', async () => {
        const h = { 'x-slack-signature': sign(), 'x-slack-request-timestamp': String(TS) };
        expect(await call({ headers: h, rawBody: Buffer.from(BODY) })).toBe(true);
    });
    it('reads the secret from SLACK_SIGNING_SECRET', async () => {
        process.env.SLACK_SIGNING_SECRET = SECRET;
        try {
            expect(await new Api({}).verifyWebhookSignature({ headers: headers(), rawBody: BODY, now: NOW })).toBe(true);
        } finally {
            delete process.env.SLACK_SIGNING_SECRET;
        }
    });
    it('rejects a wrong secret', async () => {
        expect(await new Api({ webhookSecret: 'x' }).verifyWebhookSignature({ headers: headers(), rawBody: BODY, now: NOW })).toBe(false);
    });
    it('rejects a tampered body', async () => expect(await call({ rawBody: BODY + '&a=1' })).toBe(false));
    it('rejects a stale (and a far-future) timestamp even when correctly signed, accepts 4:59', async () => {
        const h = (ts) => ({ 'X-Slack-Signature': sign({ ts }), 'X-Slack-Request-Timestamp': String(ts) });
        expect(await call({ headers: h(TS), now: NOW + 301000 })).toBe(false);
        expect(await call({ headers: h(TS), now: NOW - 301000 })).toBe(false);
        expect(await call({ headers: h(TS), now: NOW + 299000 })).toBe(true);
    });
    it('rejects missing headers', async () => {
        expect(await call({ headers: { 'X-Slack-Request-Timestamp': String(TS) } })).toBe(false);
        expect(await call({ headers: { 'X-Slack-Signature': sign() } })).toBe(false);
        expect(await call({ headers: null })).toBe(false);
    });
    it('rejects a different-length signature without throwing', async () => {
        expect(await call({ headers: headers({ 'X-Slack-Signature': 'v0=abc' }) })).toBe(false);
        expect(await call({ headers: headers({ 'X-Slack-Signature': sign() + '00' }) })).toBe(false);
    });
    it('rejects a v1/unprefixed signature', async () => {
        expect(await call({ headers: headers({ 'X-Slack-Signature': sign().slice(3) }) })).toBe(false);
    });
    it('returns false with no secret configured', async () => {
        expect(await new Api({}).verifyWebhookSignature({ headers: headers(), rawBody: BODY, now: NOW })).toBe(false);
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
