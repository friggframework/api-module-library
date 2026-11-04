const crypto = require('crypto');
const { Api, BASE_URL, SIGNATURE_HEADER } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({ access_token: 'test-token', ...overrides });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return {};
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'created' };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { id: 'updated' };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Attentive Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and Bearer access_token', () => {
            const api = new Api({ access_token: 'abc' });
            expect(api.baseUrl).toBe(BASE_URL);
            expect(api.access_token).toBe('abc');
            expect(api.tokenUri).toContain('/authorization-codes/tokens');
        });

        it('accepts api_key as an alias for access_token', () => {
            const api = new Api({ api_key: 'from-key' });
            expect(api.access_token).toBe('from-key');
        });

        it('builds the OAuth install URL with client_id, redirect_uri, scope', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/cb',
                scope: 'subscriptions:write attributes:write',
            });
            const url = api.getAuthUri();
            expect(url).toContain(
                'https://ui.attentivemobile.com/integrations/oauth-install?'
            );
            expect(url).toContain('client_id=cid');
            expect(url).toContain(
                'redirect_uri=' + encodeURIComponent('https://app.example/cb')
            );
            expect(url).toContain('scope=subscriptions');
        });

        it('setApiToken updates the Bearer credential', () => {
            const api = new Api({});
            api.setApiToken('new-key');
            expect(api.access_token).toBe('new-key');
        });
    });

    describe('identity', () => {
        it('getMe hits GET /me', async () => {
            const api = makeApi();
            await api.getMe();
            expect(api._captured[0].url).toBe(`${BASE_URL}/me`);
        });
    });

    describe('subscribers', () => {
        it('getSubscriptions serializes phone/email query params', async () => {
            const api = makeApi();
            await api.getSubscriptions({
                phone: '+13115552368',
                email: 'a@b.com',
            });
            const { url } = api._captured[0];
            expect(url).toContain(`${BASE_URL}/subscriptions?`);
            expect(url).toContain(encodeURIComponent('+13115552368'));
            expect(url).toContain('email=a%40b.com');
        });

        it('addSubscriptions POSTs JSON to /subscriptions', async () => {
            const api = makeApi();
            const body = {
                user: { email: 'a@b.com' },
                signUpSourceId: '123',
            };
            await api.addSubscriptions(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(`${BASE_URL}/subscriptions`);
            expect(api._captured[0].body).toEqual(body);
            expect(api._captured[0].headers['Content-Type']).toBe(
                'application/json'
            );
        });

        it('unsubscribeSubscriptions POSTs to /subscriptions/unsubscribe', async () => {
            const api = makeApi();
            await api.unsubscribeSubscriptions({
                user: { phone: '+15555550100' },
            });
            expect(api._captured[0].url).toBe(
                `${BASE_URL}/subscriptions/unsubscribe`
            );
        });
    });

    describe('custom attributes & events', () => {
        it('getCustomAttributes hits GET /attributes/custom', async () => {
            const api = makeApi();
            await api.getCustomAttributes({ email: 'x@y.com' });
            expect(api._captured[0].url).toContain(
                `${BASE_URL}/attributes/custom?email=`
            );
        });

        it('postCustomAttributes POSTs to /attributes/custom', async () => {
            const api = makeApi();
            await api.postCustomAttributes({ properties: {} });
            expect(api._captured[0].url).toBe(`${BASE_URL}/attributes/custom`);
        });

        it('postCustomEvents POSTs to /events/custom', async () => {
            const api = makeApi();
            await api.postCustomEvents({ type: 'loyalty.signup' });
            expect(api._captured[0].url).toBe(`${BASE_URL}/events/custom`);
        });
    });

    describe('product catalog', () => {
        it('getUploads hits GET /product-catalog/uploads', async () => {
            const api = makeApi();
            await api.getUploads();
            expect(api._captured[0].url).toBe(
                `${BASE_URL}/product-catalog/uploads`
            );
        });

        it('postUpload POSTs to /product-catalog/uploads', async () => {
            const api = makeApi();
            await api.postUpload({ validateOnly: true });
            expect(api._captured[0].url).toBe(
                `${BASE_URL}/product-catalog/uploads`
            );
            expect(api._captured[0].body).toEqual({ validateOnly: true });
        });

        it('lookupUpload hits GET /product-catalog/uploads/{id}', async () => {
            const api = makeApi();
            await api.lookupUpload('up-1');
            expect(api._captured[0].url).toBe(
                `${BASE_URL}/product-catalog/uploads/up-1`
            );
        });
    });

    describe('webhooks', () => {
        it('getWebhooks hits GET /webhooks', async () => {
            const api = makeApi();
            await api.getWebhooks();
            expect(api._captured[0].url).toBe(`${BASE_URL}/webhooks`);
        });

        it('createWebhook POSTs JSON body', async () => {
            const api = makeApi();
            await api.createWebhook({
                url: 'https://example.com/hooks',
                events: ['sms.subscribed'],
            });
            expect(api._captured[0].url).toBe(`${BASE_URL}/webhooks`);
            expect(api._captured[0].body.events).toEqual(['sms.subscribed']);
        });

        it('updateWebhook PUTs to /webhooks/{id}', async () => {
            const api = makeApi();
            await api.updateWebhook('wh-1', { events: ['sms.sent'] });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toBe(`${BASE_URL}/webhooks/wh-1`);
        });

        it('deleteWebhook DELETEs /webhooks/{id}', async () => {
            const api = makeApi();
            await api.deleteWebhook('wh-1');
            expect(api._captured[0].method).toBe('DELETE');
            expect(api._captured[0].url).toBe(`${BASE_URL}/webhooks/wh-1`);
        });
    });

    describe('verifyWebhookSignature', () => {
        it('accepts a valid HMAC-SHA256 hex digest', () => {
            const secret = 'signing-key';
            const rawBody = '{"type":"sms.subscribed","timestamp":1}';
            const digest = crypto
                .createHmac('sha256', secret)
                .update(rawBody)
                .digest('hex');
            const api = new Api({ webhookSecret: secret });
            const result = api.verifyWebhookSignature({
                headers: { [SIGNATURE_HEADER]: digest },
                rawBody,
            });
            expect(result.valid).toBe(true);
        });

        it('rejects a mismatched signature', () => {
            const api = new Api({ webhookSecret: 'signing-key' });
            const result = api.verifyWebhookSignature({
                headers: { [SIGNATURE_HEADER]: 'deadbeef' },
                rawBody: '{"type":"sms.subscribed"}',
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toMatch(/mismatch|missing/);
        });

        it('rejects when secret is missing', () => {
            const api = new Api({});
            const result = api.verifyWebhookSignature({
                headers: { [SIGNATURE_HEADER]: 'abc' },
                rawBody: '{}',
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toMatch(/secret/i);
        });
    });
});
