const crypto = require('crypto');
const { Api, PRODUCTION_BASE_URL, SIGNATURE_HEADER } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'test-token',
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://app.example/redirect/attentive',
        scope: 'subscriptions:write',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { companyId: 'co_1', companyName: 'Acme' };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { ok: true };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { ok: true };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return undefined;
    };
    return api;
}

describe('Attentive Api', () => {
    describe('construction & auth', () => {
        it('sets the production base URL and token URI', () => {
            const api = new Api({ access_token: 't' });
            expect(api.baseUrl).toBe(PRODUCTION_BASE_URL);
            expect(api.tokenUri).toContain('/authorization-codes/tokens');
            expect(api.isRefreshable).toBe(false);
        });

        it('builds the OAuth install URL with client_id, redirect_uri, scope', () => {
            const api = new Api({
                client_id: 'abc',
                redirect_uri: 'https://cb.example/attentive',
                scope: 'events:write',
            });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain(
                'ui.attentivemobile.com/integrations/oauth-install'
            );
            expect(reqs.url).toContain('client_id=abc');
            expect(reqs.url).toContain(
                encodeURIComponent('https://cb.example/attentive')
            );
            expect(reqs.url).toContain('scope=events%3Awrite');
        });

        it('honours ATTENTIVE_BASE_URL override', () => {
            const prev = process.env.ATTENTIVE_BASE_URL;
            process.env.ATTENTIVE_BASE_URL = 'https://example.test/v1';
            const api = new Api({});
            expect(api.baseUrl).toBe('https://example.test/v1');
            if (prev === undefined) delete process.env.ATTENTIVE_BASE_URL;
            else process.env.ATTENTIVE_BASE_URL = prev;
        });
    });

    describe('identity', () => {
        it('getMe hits GET /me', async () => {
            const api = makeApi();
            await api.getMe();
            expect(api._captured[0].url).toBe(
                'https://api.attentivemobile.com/v1/me'
            );
        });
    });

    describe('subscriptions', () => {
        it('addSubscriptions POSTs to /subscriptions', async () => {
            const api = makeApi();
            const body = { user: { phone: '+13115552368' } };
            await api.addSubscriptions(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://api.attentivemobile.com/v1/subscriptions'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('getSubscriptions serializes phone/email query params', async () => {
            const api = makeApi();
            await api.getSubscriptions({
                phone: '+13115552368',
                email: 'a@b.com',
            });
            const { url } = api._captured[0];
            expect(url).toContain('/subscriptions?');
            expect(url).toContain('phone=%2B13115552368');
            expect(url).toContain('email=a%40b.com');
        });

        it('unsubscribeSubscriptions POSTs to /subscriptions/unsubscribe', async () => {
            const api = makeApi();
            await api.unsubscribeSubscriptions({
                user: { email: 'a@b.com' },
            });
            expect(api._captured[0].url).toBe(
                'https://api.attentivemobile.com/v1/subscriptions/unsubscribe'
            );
        });
    });

    describe('attributes & events', () => {
        it('postCustomAttributes POSTs to /attributes/custom', async () => {
            const api = makeApi();
            await api.postCustomAttributes({
                properties: { VIP: 'TRUE' },
                user: { email: 'a@b.com' },
            });
            expect(api._captured[0].url).toBe(
                'https://api.attentivemobile.com/v1/attributes/custom'
            );
        });

        it('getCustomAttributes hits GET /attributes/custom', async () => {
            const api = makeApi();
            await api.getCustomAttributes({ email: 'a@b.com' });
            expect(api._captured[0].url).toContain(
                '/attributes/custom?email=a%40b.com'
            );
        });

        it('posts ecommerce and custom events to the documented paths', async () => {
            const api = makeApi();
            const body = {
                items: [{ productId: '1', name: 'Tee', price: [{ currencyCode: 'USD', amount: '10' }] }],
                user: { phone: '+13115552368' },
            };
            await api.postProductViewEvents(body);
            await api.postAddToCartEvents(body);
            await api.postPurchaseEvents({ ...body, orderId: 'o1' });
            await api.postCustomEvents({
                type: 'Order Shipped',
                user: { email: 'a@b.com' },
            });
            const urls = api._captured.map((c) => c.url);
            expect(urls).toEqual([
                'https://api.attentivemobile.com/v1/events/ecommerce/product-view',
                'https://api.attentivemobile.com/v1/events/ecommerce/add-to-cart',
                'https://api.attentivemobile.com/v1/events/ecommerce/purchase',
                'https://api.attentivemobile.com/v1/events/custom',
            ]);
        });
    });

    describe('product catalog', () => {
        it('postUpload / getUploads / lookupUpload hit catalog paths', async () => {
            const api = makeApi();
            await api.postUpload({ validateOnly: true });
            await api.getUploads();
            await api.lookupUpload('up_1');
            expect(api._captured.map((c) => [c.method, c.url])).toEqual([
                [
                    'POST',
                    'https://api.attentivemobile.com/v1/product-catalog/uploads',
                ],
                [
                    'GET',
                    'https://api.attentivemobile.com/v1/product-catalog/uploads',
                ],
                [
                    'GET',
                    'https://api.attentivemobile.com/v1/product-catalog/uploads/up_1',
                ],
            ]);
            expect(api._captured[0].body).toEqual({ validateOnly: true });
        });
    });

    describe('webhooks', () => {
        it('CRUD hits /webhooks paths', async () => {
            const api = makeApi();
            await api.getWebhooks();
            await api.createWebhook({
                url: 'https://hook.example/a',
                events: ['sms.subscribed'],
            });
            await api.updateWebhook('wh_1', { disabled: true });
            await api.deleteWebhook('wh_1');
            expect(api._captured.map((c) => [c.method, c.url])).toEqual([
                ['GET', 'https://api.attentivemobile.com/v1/webhooks'],
                ['POST', 'https://api.attentivemobile.com/v1/webhooks'],
                ['PUT', 'https://api.attentivemobile.com/v1/webhooks/wh_1'],
                ['DELETE', 'https://api.attentivemobile.com/v1/webhooks/wh_1'],
            ]);
        });

        it('verifyWebhookSignature accepts a valid hex HMAC', async () => {
            const secret = 'signing-key';
            const rawBody = '{"type":"sms.subscribed","companyId":"co_1"}';
            const signature = crypto
                .createHmac('sha256', secret)
                .update(rawBody, 'utf8')
                .digest('hex');
            const api = new Api({
                access_token: 't',
                webhookSigningKey: secret,
            });
            const ok = await api.verifyWebhookSignature({
                headers: { [SIGNATURE_HEADER]: signature },
                rawBody,
            });
            expect(ok).toBe(true);
        });

        it('verifyWebhookSignature rejects a bad signature', async () => {
            const api = new Api({
                access_token: 't',
                webhookSigningKey: 'signing-key',
            });
            const ok = await api.verifyWebhookSignature({
                headers: { [SIGNATURE_HEADER]: 'deadbeef' },
                rawBody: '{}',
            });
            expect(ok).toBe(false);
        });
    });
});
