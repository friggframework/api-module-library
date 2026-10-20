const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'tok',
        client_id: 'cid',
        client_secret: 'csec',
        redirect_uri: 'https://app.example.com/redirect/mailchimp',
        server_prefix: 'us6',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return {};
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { access_token: 'new-tok' };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return {};
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return {};
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Mailchimp Api', () => {
    describe('construction & auth', () => {
        it('defaults base URL to the vendor swagger host', () => {
            const api = new Api({ access_token: 't' });
            expect(api.baseUrl).toBe('https://server.api.mailchimp.com/3.0');
            expect(api.tokenUri).toBe(
                'https://login.mailchimp.com/oauth2/token'
            );
            expect(api.authorizeBase).toBe(
                'https://login.mailchimp.com/oauth2/authorize'
            );
        });

        it('routes to the DC host when server_prefix is set', () => {
            const api = new Api({
                access_token: 't',
                server_prefix: 'us6',
            });
            expect(api.baseUrl).toBe('https://us6.api.mailchimp.com/3.0');
        });

        it('derives server_prefix from an API key suffix', () => {
            const api = new Api({
                api_key: 'abcdef0123456789abcdef0123456789-us19',
            });
            expect(api.server_prefix).toBe('us19');
            expect(api.baseUrl).toBe('https://us19.api.mailchimp.com/3.0');
        });

        it('emits Bearer for OAuth access_token on Marketing API calls', async () => {
            const api = new Api({ access_token: 'atok' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer atok');
        });

        it('emits HTTP Basic for api_key when no access_token', async () => {
            const api = new Api({ api_key: 'key-us1' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe(
                `Basic ${Buffer.from('anystring:key-us1').toString('base64')}`
            );
        });

        it('prefers Bearer access_token over api_key Basic', async () => {
            const api = new Api({
                access_token: 'atok',
                api_key: 'key-us1',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer atok');
        });

        it('builds an authorize URL without scopes', () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 'csec',
                redirect_uri: 'https://app.example.com/redirect/mailchimp',
                state: 'cust-1',
            });
            const url = api.getAuthorizationUri();
            expect(url).toContain(
                'https://login.mailchimp.com/oauth2/authorize?'
            );
            expect(url).toContain('response_type=code');
            expect(url).toContain('client_id=cid');
            expect(url).not.toContain('scope=');
        });

        it('exchanges code with form-urlencoded body', async () => {
            const api = makeApi({ access_token: null, server_prefix: null });
            api.setTokens = async (response) => {
                api.access_token = response.access_token;
            };
            api.applyMetadata = async () => ({});
            await api.getTokenFromCode('auth-code');
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://login.mailchimp.com/oauth2/token'
            );
            expect(captured.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            const body = captured.body.toString();
            expect(body).toContain('grant_type=authorization_code');
            expect(body).toContain('code=auth-code');
        });

        it('uses OAuth header for metadata and sets server_prefix from dc', async () => {
            const api = makeApi({ server_prefix: null });
            api._get = async (options) => {
                api._captured.push({ method: 'GET', ...options });
                const headers = await api.addAuthHeaders(options.headers || {});
                api._captured[api._captured.length - 1].resolvedHeaders =
                    headers;
                return {
                    dc: 'us6',
                    api_endpoint: 'https://us6.api.mailchimp.com',
                };
            };
            const meta = await api.applyMetadata();
            expect(meta.dc).toBe('us6');
            expect(api.server_prefix).toBe('us6');
            expect(api.baseUrl).toBe('https://us6.api.mailchimp.com/3.0');
            expect(api._captured[0].resolvedHeaders.Authorization).toBe(
                'OAuth tok'
            );
        });

        it('refuses refreshAccessToken', async () => {
            const api = new Api({ access_token: 't' });
            await expect(api.refreshAccessToken()).rejects.toThrow(
                /do not expire/i
            );
        });

        it('computes subscriber_hash as md5 of lowercase email', () => {
            expect(Api.subscriberHash('API@Mailchimp.com')).toBe(
                require('crypto')
                    .createHash('md5')
                    .update('api@mailchimp.com')
                    .digest('hex')
            );
        });
    });

    describe('root / ping', () => {
        it('getRoot hits GET /', async () => {
            const api = makeApi();
            await api.getRoot();
            expect(api._captured[0].url).toBe(
                'https://us6.api.mailchimp.com/3.0/'
            );
        });

        it('getPing hits GET /ping', async () => {
            const api = makeApi();
            await api.getPing();
            expect(api._captured[0].url).toBe(
                'https://us6.api.mailchimp.com/3.0/ping'
            );
        });
    });

    describe('lists', () => {
        it('getLists hits GET /lists', async () => {
            const api = makeApi();
            await api.getLists({ count: 10 });
            expect(api._captured[0].url).toBe(
                'https://us6.api.mailchimp.com/3.0/lists'
            );
            expect(api._captured[0].query).toEqual({ count: 10 });
        });

        it('getListsId / postLists / patchListsId hit the list paths', async () => {
            const api = makeApi();
            await api.getListsId('abc');
            await api.postLists({ name: 'N' });
            await api.patchListsId('abc', { name: 'N2' });
            expect(api._captured[0].url).toBe(
                'https://us6.api.mailchimp.com/3.0/lists/abc'
            );
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[1].url).toBe(
                'https://us6.api.mailchimp.com/3.0/lists'
            );
            expect(api._captured[2].method).toBe('PATCH');
        });
    });

    describe('members', () => {
        it('getListsIdMembers / postListsIdMembers hit member collection paths', async () => {
            const api = makeApi();
            await api.getListsIdMembers('L1', { status: 'subscribed' });
            await api.postListsIdMembers('L1', {
                email_address: 'a@b.com',
                status: 'subscribed',
            });
            expect(api._captured[0].url).toBe(
                'https://us6.api.mailchimp.com/3.0/lists/L1/members'
            );
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[1].body.email_address).toBe('a@b.com');
        });

        it('get/patch/put member methods hash emails', async () => {
            const api = makeApi();
            const hash = Api.subscriberHash('User@Example.com');
            await api.getListsIdMembersId('L1', 'User@Example.com');
            await api.patchListsIdMembersId('L1', 'User@Example.com', {
                status: 'unsubscribed',
            });
            await api.putListsIdMembersId('L1', hash, {
                email_address: 'user@example.com',
                status_if_new: 'subscribed',
            });
            expect(api._captured[0].url).toBe(
                `https://us6.api.mailchimp.com/3.0/lists/L1/members/${hash}`
            );
            expect(api._captured[1].method).toBe('PATCH');
            expect(api._captured[2].method).toBe('PUT');
            expect(api._captured[2].url).toContain(hash);
        });
    });

    describe('campaigns', () => {
        it('get/post/patch campaign paths', async () => {
            const api = makeApi();
            await api.getCampaigns({ status: 'sent' });
            await api.getCampaignsId('c1');
            await api.postCampaigns({ type: 'regular' });
            await api.patchCampaignsId('c1', { settings: { title: 'T' } });
            expect(api._captured[0].url).toBe(
                'https://us6.api.mailchimp.com/3.0/campaigns'
            );
            expect(api._captured[1].url).toBe(
                'https://us6.api.mailchimp.com/3.0/campaigns/c1'
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[3].method).toBe('PATCH');
        });
    });

    describe('webhooks', () => {
        it('CRUD list webhook paths (vendor operationIds)', async () => {
            const api = makeApi();
            await api.getListsIdWebhooks('L1');
            await api.getListsIdWebhooksId('L1', 'w1');
            await api.postListsIdWebhooks('L1', {
                url: 'https://hook.example.com?account_id=acc',
                events: { subscribe: true },
            });
            await api.patchListsIdWebhooksId('L1', 'w1', {
                events: { unsubscribe: true },
            });
            await api.deleteListsIdWebhooksId('L1', 'w1');
            expect(api._captured[0].url).toBe(
                'https://us6.api.mailchimp.com/3.0/lists/L1/webhooks'
            );
            expect(api._captured[1].url).toBe(
                'https://us6.api.mailchimp.com/3.0/lists/L1/webhooks/w1'
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[3].method).toBe('PATCH');
            expect(api._captured[4].method).toBe('DELETE');
        });
    });
});
