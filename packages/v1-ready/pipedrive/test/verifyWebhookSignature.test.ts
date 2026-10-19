import { describe, it, expect } from 'vitest';
import { Api } from '../src/api';

const USER = 'frigg-hook';
const PASS = 's3cret:with:colons';
const basic = (u: string, p: string) => 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64');

describe('Pipedrive verifyWebhookSignature (HTTP basic auth)', () => {
    const api = new Api({ webhookUsername: USER, webhookPassword: PASS });
    const call = (headers: any, a: Api = api) => a.verifyWebhookSignature({ headers, body: {} });

    it('accepts the configured credentials (header case-insensitive, scheme case-insensitive)', async () => {
        expect(await call({ Authorization: basic(USER, PASS) })).toBe(true);
        expect(await call({ authorization: basic(USER, PASS) })).toBe(true);
        expect(await call({ AUTHORIZATION: basic(USER, PASS).replace('Basic', 'basic') })).toBe(true);
    });
    it('rejects a wrong password, wrong username, and a prefix/extension of the right pair', async () => {
        expect(await call({ Authorization: basic(USER, 'wrong') })).toBe(false);
        expect(await call({ Authorization: basic('other', PASS) })).toBe(false);
        expect(await call({ Authorization: basic(USER, PASS + 'x') })).toBe(false);
        expect(await call({ Authorization: basic(USER, PASS.slice(0, -1)) })).toBe(false);
    });
    it('rejects a missing header, a non-Basic scheme, and junk', async () => {
        expect(await call({})).toBe(false);
        expect(await call(undefined)).toBe(false);
        expect(await call({ Authorization: 'Bearer abc' })).toBe(false);
        expect(await call({ Authorization: 'Basic' })).toBe(false);
        expect(await call({ Authorization: 'Basic !!!notbase64' })).toBe(false);
    });
    it('returns false when no credentials are configured (an unauthenticated webhook cannot be verified)', async () => {
        const a = new Api({});
        expect(await call({ Authorization: basic('', '') }, a)).toBe(false);
        expect(await call({}, a)).toBe(false);
        const onlyUser = new Api({ webhookUsername: USER });
        expect(await call({ Authorization: basic(USER, '') }, onlyUser)).toBe(false);
    });
    it('reads PIPEDRIVE_WEBHOOK_USERNAME / PIPEDRIVE_WEBHOOK_PASSWORD', async () => {
        process.env.PIPEDRIVE_WEBHOOK_USERNAME = USER;
        process.env.PIPEDRIVE_WEBHOOK_PASSWORD = PASS;
        try {
            expect(await call({ Authorization: basic(USER, PASS) }, new Api({}))).toBe(true);
        } finally {
            delete process.env.PIPEDRIVE_WEBHOOK_USERNAME;
            delete process.env.PIPEDRIVE_WEBHOOK_PASSWORD;
        }
    });
});
