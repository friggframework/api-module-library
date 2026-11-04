const crypto = require('crypto');
const {
    Api,
    BASE_URL,
    AUTHORIZE_URL,
    TOKEN_URI,
    SIGNATURE_HEADER,
} = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'test-token',
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://app.example/cb/kit',
        ...overrides,
    });
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
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return { id: 'patched' };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Kit Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and OAuth endpoints', () => {
            const api = new Api({ access_token: 'abc' });
            expect(api.baseUrl).toBe(BASE_URL);
            expect(api.tokenUri).toBe(TOKEN_URI);
            expect(api.baseUrl).toBe('https://api.kit.com/v4');
        });

        it('builds the authorize URL with required params', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/cb',
                scope: 'public',
                state: 'xyz',
            });
            const url = api.getAuthorizationUri();
            expect(url.startsWith(AUTHORIZE_URL + '?')).toBe(true);
            expect(url).toContain('client_id=cid');
            expect(url).toContain('response_type=code');
            expect(url).toContain(
                'redirect_uri=' + encodeURIComponent('https://app.example/cb')
            );
            expect(url).toContain('scope=public');
            expect(url).toContain('state=xyz');
        });

        it('adds Bearer auth header from access_token', async () => {
            const api = new Api({ access_token: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
        });

        it('falls back to X-Kit-Api-Key when only api_key is set', async () => {
            const api = new Api({ api_key: 'k-key' });
            const headers = await api.addAuthHeaders({});
            expect(headers['X-Kit-Api-Key']).toBe('k-key');
            expect(headers.Authorization).toBeUndefined();
        });

        it('getTokenFromCode posts JSON to the token URI', async () => {
            const api = makeApi({ access_token: null });
            api.setTokens = async () => {};
            await api.getTokenFromCode('auth-code');
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(TOKEN_URI);
            expect(captured.headers['Content-Type']).toBe('application/json');
            expect(captured.body).toEqual({
                client_id: 'cid',
                client_secret: 'csecret',
                grant_type: 'authorization_code',
                code: 'auth-code',
                redirect_uri: 'https://app.example/cb/kit',
            });
        });

        it('refreshAccessToken posts JSON without client_secret', async () => {
            const api = makeApi();
            api.setTokens = async () => {};
            await api.refreshAccessToken({ refresh_token: 'rt' });
            const captured = api._captured[0];
            expect(captured.url).toBe(TOKEN_URI);
            expect(captured.body).toEqual({
                client_id: 'cid',
                grant_type: 'refresh_token',
                refresh_token: 'rt',
            });
            expect(captured.body.client_secret).toBeUndefined();
        });
    });

    describe('account', () => {
        it('getAccount hits GET /account', async () => {
            const api = makeApi();
            await api.getAccount();
            expect(api._captured[0].url).toBe(`${BASE_URL}/account`);
        });
    });

    describe('subscribers', () => {
        it('listSubscribers serializes query params', async () => {
            const api = makeApi();
            await api.listSubscribers({
                after: 'c1',
                email_address: 'a@b.com',
                status: 'active',
            });
            const { url } = api._captured[0];
            expect(url).toContain(`${BASE_URL}/subscribers?`);
            expect(url).toContain('after=c1');
            expect(url).toContain('email_address=a%40b.com');
            expect(url).toContain('status=active');
        });

        it('getSubscriber hits GET /subscribers/{id}', async () => {
            const api = makeApi();
            await api.getSubscriber(42);
            expect(api._captured[0].url).toBe(`${BASE_URL}/subscribers/42`);
        });

        it('createSubscriber POSTs JSON', async () => {
            const api = makeApi();
            const body = { email_address: 'a@b.com', first_name: 'Ada' };
            await api.createSubscriber(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(`${BASE_URL}/subscribers`);
            expect(api._captured[0].body).toEqual(body);
        });

        it('updateSubscriber PUTs JSON', async () => {
            const api = makeApi();
            await api.updateSubscriber(9, { first_name: 'Ada' });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toBe(`${BASE_URL}/subscribers/9`);
        });
    });

    describe('tags', () => {
        it('listTags hits GET /tags', async () => {
            const api = makeApi();
            await api.listTags({ per_page: 10 });
            expect(api._captured[0].url).toContain(`${BASE_URL}/tags?`);
        });

        it('createTag POSTs to /tags', async () => {
            const api = makeApi();
            await api.createTag({ name: 'vip' });
            expect(api._captured[0].url).toBe(`${BASE_URL}/tags`);
            expect(api._captured[0].body).toEqual({ name: 'vip' });
        });

        it('tagSubscriber POSTs to nested path', async () => {
            const api = makeApi();
            await api.tagSubscriber(1, 2);
            expect(api._captured[0].url).toBe(
                `${BASE_URL}/tags/1/subscribers/2`
            );
        });

        it('removeTagFromSubscriber DELETEs nested path', async () => {
            const api = makeApi();
            await api.removeTagFromSubscriber(1, 2);
            expect(api._captured[0].method).toBe('DELETE');
            expect(api._captured[0].url).toBe(
                `${BASE_URL}/tags/1/subscribers/2`
            );
        });
    });

    describe('broadcasts & sequences', () => {
        it('listBroadcasts hits GET /broadcasts', async () => {
            const api = makeApi();
            await api.listBroadcasts();
            expect(api._captured[0].url).toBe(`${BASE_URL}/broadcasts`);
        });

        it('getBroadcast hits GET /broadcasts/{id}', async () => {
            const api = makeApi();
            await api.getBroadcast(7);
            expect(api._captured[0].url).toBe(`${BASE_URL}/broadcasts/7`);
        });

        it('listSequences hits GET /sequences', async () => {
            const api = makeApi();
            await api.listSequences();
            expect(api._captured[0].url).toBe(`${BASE_URL}/sequences`);
        });

        it('createSequence POSTs to /sequences', async () => {
            const api = makeApi();
            await api.createSequence({ name: 'Welcome' });
            expect(api._captured[0].url).toBe(`${BASE_URL}/sequences`);
        });
    });

    describe('forms & custom fields', () => {
        it('listForms hits GET /forms', async () => {
            const api = makeApi();
            await api.listForms({ status: 'active' });
            expect(api._captured[0].url).toContain(`${BASE_URL}/forms?`);
        });

        it('listCustomFields hits GET /custom_fields', async () => {
            const api = makeApi();
            await api.listCustomFields();
            expect(api._captured[0].url).toBe(`${BASE_URL}/custom_fields`);
        });

        it('createCustomField POSTs label', async () => {
            const api = makeApi();
            await api.createCustomField({ label: 'Company' });
            expect(api._captured[0].body).toEqual({ label: 'Company' });
        });
    });

    describe('webhook endpoints', () => {
        it('listWebhookEndpoints hits GET /webhook_endpoints', async () => {
            const api = makeApi();
            await api.listWebhookEndpoints();
            expect(api._captured[0].url).toBe(`${BASE_URL}/webhook_endpoints`);
        });

        it('createWebhookEndpoint POSTs body', async () => {
            const api = makeApi();
            const body = {
                url: 'https://hooks.example/kit/1',
                events: ['subscriber.created'],
                name: 'frigg',
            };
            await api.createWebhookEndpoint(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual(body);
        });

        it('updateWebhookEndpoint PATCHes', async () => {
            const api = makeApi();
            await api.updateWebhookEndpoint(3, { status: 'disabled' });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toBe(
                `${BASE_URL}/webhook_endpoints/3`
            );
        });

        it('deleteWebhookEndpoint DELETEs', async () => {
            const api = makeApi();
            await api.deleteWebhookEndpoint(3);
            expect(api._captured[0].method).toBe('DELETE');
        });
    });

    describe('verifyWebhookSignature', () => {
        it('accepts a valid X-Kit-Signature', () => {
            const secret = 'whsec_test';
            const rawBody = '{"delivery_id":1,"events":[]}';
            const t = Math.floor(Date.now() / 1000);
            const sig = crypto
                .createHmac('sha256', secret)
                .update(`${t}.${rawBody}`)
                .digest('hex');
            const api = new Api({ webhookSecret: secret });
            const result = api.verifyWebhookSignature({
                headers: { [SIGNATURE_HEADER]: `t=${t},v1=${sig}` },
                rawBody,
            });
            expect(result.valid).toBe(true);
        });

        it('rejects a mismatched signature', () => {
            const api = new Api({ webhookSecret: 'whsec_test' });
            const t = Math.floor(Date.now() / 1000);
            const result = api.verifyWebhookSignature({
                headers: { [SIGNATURE_HEADER]: `t=${t},v1=deadbeef` },
                rawBody: '{}',
            });
            expect(result.valid).toBe(false);
        });
    });
});
