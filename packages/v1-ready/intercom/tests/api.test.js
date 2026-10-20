const crypto = require('crypto');
const {
    Api,
    SIGNATURE_HEADER,
    DEFAULT_BASE_URL,
    DEFAULT_AUTH_HOST,
    DEFAULT_API_VERSION,
} = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'tok',
        client_id: 'cid',
        client_secret: 'csec',
        redirect_uri: 'https://app.example/redirect/intercom',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { type: 'list', data: [] };
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
        return { status: 200 };
    };
    return api;
}

describe('Intercom Api', () => {
    describe('construction & auth', () => {
        it('sets the default base URL, auth host, token URI, and API version', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/redirect/intercom',
            });
            expect(api.baseUrl).toBe(DEFAULT_BASE_URL);
            expect(api.authHost).toBe(DEFAULT_AUTH_HOST);
            expect(api.apiVersion).toBe(DEFAULT_API_VERSION);
            expect(api.tokenUri).toBe(
                'https://api.intercom.io/auth/eagle/token'
            );
            expect(api.isRefreshable).toBe(false);
            expect(api.getAuthUri()).toContain(
                'https://app.intercom.com/oauth?'
            );
            expect(api.getAuthUri()).toContain('client_id=cid');
            // Scopes are configured in the Developer Hub, not the authorize URL.
            expect(api.getAuthUri()).not.toContain('scope=');
        });

        it('exposes oauth2 authorization requirements', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/redirect/intercom',
            });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain('/oauth?');
        });

        it('adds Bearer + Intercom-Version auth headers', async () => {
            const api = new Api({
                access_token: 'secret-token',
                apiVersion: '2.17',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret-token');
            expect(headers['Intercom-Version']).toBe('2.17');
            expect(headers.Accept).toBe('application/json');
        });

        it('reports authenticated only with a non-empty access_token', () => {
            expect(new Api({ access_token: 'x' }).isAuthenticated()).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });

        it('getTokenFromCode posts to Eagle without grant_type', async () => {
            const api = makeApi();
            api.setTokens = async (tokens) => {
                api.access_token = tokens.access_token;
            };
            api._post = async (options) => {
                api._captured.push({ method: 'POST', ...options });
                return {
                    token_type: 'Bearer',
                    token: 't1',
                    access_token: 't1',
                };
            };
            const result = await api.getTokenFromCode('auth-code');
            expect(result.access_token).toBe('t1');
            const captured = api._captured[0];
            expect(captured.url).toBe(
                'https://api.intercom.io/auth/eagle/token'
            );
            expect(captured.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            const body = captured.body.toString();
            expect(body).toContain('code=auth-code');
            expect(body).toContain('client_id=cid');
            expect(body).toContain('client_secret=csec');
            expect(body).not.toContain('grant_type');
        });
    });

    describe('identity', () => {
        it('getMe hits GET /me', async () => {
            const api = makeApi();
            await api.getMe();
            expect(api._captured[0].url).toBe('https://api.intercom.io/me');
        });
    });

    describe('contacts', () => {
        it('listContacts hits GET /contacts with query', async () => {
            const api = makeApi();
            await api.listContacts({ include_merge_history: true });
            const { url } = api._captured[0];
            expect(url).toContain('https://api.intercom.io/contacts?');
            expect(url).toContain('include_merge_history=true');
        });

        it('getContact hits the by-id path', async () => {
            const api = makeApi();
            await api.getContact('ct_1', { include_merge_history: true });
            expect(api._captured[0].url).toContain(
                'https://api.intercom.io/contacts/ct_1?'
            );
            expect(api._captured[0].url).toContain(
                'include_merge_history=true'
            );
        });

        it('createContact POSTs JSON', async () => {
            const api = makeApi();
            const body = { role: 'user', email: 'a@b.com' };
            await api.createContact(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual(body);
            expect(api._captured[0].headers['Content-Type']).toBe(
                'application/json'
            );
        });

        it('updateContact PUTs JSON', async () => {
            const api = makeApi();
            await api.updateContact('ct_1', { name: 'Ada' });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toBe(
                'https://api.intercom.io/contacts/ct_1'
            );
            expect(api._captured[0].body).toEqual({ name: 'Ada' });
        });
    });

    describe('conversations', () => {
        it('listConversations hits GET /conversations', async () => {
            const api = makeApi();
            await api.listConversations({ per_page: 5 });
            expect(api._captured[0].url).toContain(
                'https://api.intercom.io/conversations?'
            );
            expect(api._captured[0].url).toContain('per_page=5');
        });

        it('getConversation hits the by-id path', async () => {
            const api = makeApi();
            await api.getConversation(123);
            expect(api._captured[0].url).toBe(
                'https://api.intercom.io/conversations/123'
            );
        });

        it('getConversation forwards display_as / include_* flags', async () => {
            const api = makeApi();
            await api.getConversation(123, {
                display_as: 'plaintext',
                include_translations: true,
                include_monitors: true,
                include_scorecards: true,
            });
            const { url } = api._captured[0];
            expect(url).toContain('/conversations/123?');
            expect(url).toContain('display_as=plaintext');
            expect(url).toContain('include_translations=true');
            expect(url).toContain('include_monitors=true');
            expect(url).toContain('include_scorecards=true');
        });

        it('listConversations forwards include_monitors / include_scorecards', async () => {
            const api = makeApi();
            await api.listConversations({
                per_page: 5,
                include_monitors: true,
                include_scorecards: true,
            });
            const { url } = api._captured[0];
            expect(url).toContain('per_page=5');
            expect(url).toContain('include_monitors=true');
            expect(url).toContain('include_scorecards=true');
        });

        it('createConversation POSTs JSON', async () => {
            const api = makeApi();
            const body = {
                from: { type: 'user', id: 'ct_1' },
                body: 'hello',
            };
            await api.createConversation(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual(body);
        });

        it('updateConversation PUTs JSON and optional display_as', async () => {
            const api = makeApi();
            await api.updateConversation(
                123,
                { read: true, company_id: 'co_1' },
                { display_as: 'plaintext' }
            );
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toContain(
                'https://api.intercom.io/conversations/123?'
            );
            expect(api._captured[0].url).toContain('display_as=plaintext');
            expect(api._captured[0].body).toEqual({
                read: true,
                company_id: 'co_1',
            });
        });

        it('replyConversation POSTs to /reply', async () => {
            const api = makeApi();
            const body = {
                message_type: 'comment',
                type: 'admin',
                admin_id: '1',
                body: 'hi',
            };
            await api.replyConversation('cv_1', body);
            expect(api._captured[0].url).toBe(
                'https://api.intercom.io/conversations/cv_1/reply'
            );
            expect(api._captured[0].body).toEqual(body);
        });
    });

    describe('admins / companies / tags', () => {
        it('listAdmins and getAdmin hit the admin paths', async () => {
            const api = makeApi();
            await api.listAdmins({ display_avatar: true });
            await api.getAdmin(99);
            expect(api._captured[0].url).toContain(
                'https://api.intercom.io/admins?'
            );
            expect(api._captured[0].url).toContain('display_avatar=true');
            expect(api._captured[1].url).toBe(
                'https://api.intercom.io/admins/99'
            );
        });

        it('listCompanies POSTs to /companies/list with query params', async () => {
            const api = makeApi();
            await api.listCompanies({ page: 2, per_page: 20, order: 'asc' });
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toContain(
                'https://api.intercom.io/companies/list?'
            );
            expect(api._captured[0].url).toContain('page=2');
            expect(api._captured[0].url).toContain('per_page=20');
            expect(api._captured[0].url).toContain('order=asc');
            expect(api._captured[0].body).toEqual({});
        });

        it('getCompany and createOrUpdateCompany hit company paths', async () => {
            const api = makeApi();
            await api.getCompany('co_1');
            await api.createOrUpdateCompany({
                company_id: 'acme',
                name: 'Acme',
            });
            expect(api._captured[0].url).toBe(
                'https://api.intercom.io/companies/co_1'
            );
            expect(api._captured[1].url).toBe(
                'https://api.intercom.io/companies'
            );
            expect(api._captured[1].method).toBe('POST');
        });

        it('listTags / getTag / createTag hit tag paths', async () => {
            const api = makeApi();
            await api.listTags();
            await api.getTag('tg_1');
            await api.createTag({ name: 'vip' });
            expect(api._captured[0].url).toBe('https://api.intercom.io/tags');
            expect(api._captured[1].url).toBe(
                'https://api.intercom.io/tags/tg_1'
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[2].body).toEqual({ name: 'vip' });
        });
    });

    describe('verifyWebhookSignature', () => {
        const secret = 'client-secret';
        const rawBody = '{"topic":"contact.created","app_id":"abc"}';

        function sign(body, key) {
            return (
                'sha1=' +
                crypto.createHmac('sha1', key).update(body).digest('hex')
            );
        }

        it('accepts a valid X-Hub-Signature', () => {
            const api = new Api({ webhookSecret: secret });
            const result = api.verifyWebhookSignature({
                headers: { [SIGNATURE_HEADER]: sign(rawBody, secret) },
                rawBody,
            });
            expect(result).toEqual({ valid: true });
        });

        it('rejects a mismatched signature', () => {
            const api = new Api({ webhookSecret: secret });
            const result = api.verifyWebhookSignature({
                headers: { [SIGNATURE_HEADER]: sign(rawBody, 'wrong') },
                rawBody,
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('signature mismatch');
        });

        it('rejects when secret or signature header is missing', () => {
            expect(
                new Api({}).verifyWebhookSignature({
                    headers: { [SIGNATURE_HEADER]: 'sha1=abc' },
                    rawBody,
                }).reason
            ).toMatch(/missing webhook secret/);
            expect(
                new Api({ webhookSecret: secret }).verifyWebhookSignature({
                    headers: {},
                    rawBody,
                }).reason
            ).toMatch(/missing x-hub-signature/i);
        });
    });
});
