const crypto = require('crypto');
const { Api } = require('../api');
const { verifyCloseWebhook } = require('../extensions/webhooks/signature-verifier');

function makeApi(overrides = {}) {
    const api = new Api({ access_token: 'test-token', ...overrides });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { data: [], has_more: false };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'created_1' };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { id: 'updated_1' };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Close Api', () => {
    describe('construction & auth', () => {
        it('sets the Close API v1 base URL and OAuth endpoints', () => {
            const api = new Api({
                access_token: 't',
                client_id: 'cid',
                redirect_uri: 'https://app.example/redirect/close',
            });
            expect(api.baseUrl).toBe('https://api.close.com/api/v1');
            expect(api.tokenUri).toBe('https://api.close.com/oauth2/token/');
            expect(api.authorizationUri).toContain(
                'https://app.close.com/oauth2/authorize/'
            );
            expect(api.authorizationUri).toContain('client_id=cid');
            expect(api.authorizationUri).toContain('response_type=code');
        });

        it('adds Bearer auth when access_token is set', async () => {
            const api = new Api({ access_token: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
        });

        it('adds HTTP Basic auth when only api_key is set', async () => {
            const api = new Api({ api_key: 'mykey' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe(
                `Basic ${Buffer.from('mykey:').toString('base64')}`
            );
        });

        it('prefers Bearer over API key when both are set', async () => {
            const api = new Api({ access_token: 'tok', api_key: 'key' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer tok');
        });

        it('reports authenticated with token or api key', () => {
            expect(new Api({ access_token: 'x' }).isAuthenticated()).toBe(true);
            expect(new Api({ api_key: 'k' }).isAuthenticated()).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('identity', () => {
        it('getMe hits GET /me/', async () => {
            const api = makeApi();
            await api.getMe();
            expect(api._captured[0].url).toBe(
                'https://api.close.com/api/v1/me/'
            );
        });

        it('listUsers hits GET /user/', async () => {
            const api = makeApi();
            await api.listUsers({ _limit: 10 });
            expect(api._captured[0].url).toContain(
                'https://api.close.com/api/v1/user/'
            );
            expect(api._captured[0].url).toContain('_limit=10');
        });
    });

    describe('leads', () => {
        it('listLeads / getLead / createLead / updateLead', async () => {
            const api = makeApi();
            await api.listLeads({ _skip: 0, _limit: 5 });
            expect(api._captured[0].url).toContain('/lead/?');
            await api.getLead('lead_1');
            expect(api._captured[1].url).toBe(
                'https://api.close.com/api/v1/lead/lead_1/'
            );
            await api.createLead({ name: 'Acme' });
            expect(api._captured[2]).toMatchObject({
                method: 'POST',
                body: { name: 'Acme' },
            });
            await api.updateLead('lead_1', { description: 'x' });
            expect(api._captured[3]).toMatchObject({
                method: 'PUT',
                url: 'https://api.close.com/api/v1/lead/lead_1/',
                body: { description: 'x' },
            });
        });
    });

    describe('contacts & opportunities', () => {
        it('list/get/create/update contacts', async () => {
            const api = makeApi();
            await api.listContacts();
            expect(api._captured[0].url).toBe(
                'https://api.close.com/api/v1/contact/'
            );
            await api.getContact('cont_1');
            expect(api._captured[1].url).toContain('/contact/cont_1/');
            await api.createContact({ name: 'Pat', lead_id: 'lead_1' });
            expect(api._captured[2].method).toBe('POST');
            await api.updateContact('cont_1', { title: 'CEO' });
            expect(api._captured[3].method).toBe('PUT');
        });

        it('list/get/create/update opportunities', async () => {
            const api = makeApi();
            await api.listOpportunities({ lead_id: 'lead_1' });
            expect(api._captured[0].url).toContain('/opportunity/');
            expect(api._captured[0].url).toContain('lead_id=lead_1');
            await api.getOpportunity('oppo_1');
            expect(api._captured[1].url).toContain('/opportunity/oppo_1/');
            await api.createOpportunity({ lead_id: 'lead_1', value: 1000 });
            expect(api._captured[2].method).toBe('POST');
            await api.updateOpportunity('oppo_1', { confidence: 80 });
            expect(api._captured[3].method).toBe('PUT');
        });
    });

    describe('activities', () => {
        it('lists activities, calls, emails, notes and creates notes/calls', async () => {
            const api = makeApi();
            await api.listActivities();
            expect(api._captured[0].url).toBe(
                'https://api.close.com/api/v1/activity/'
            );
            await api.listCalls();
            expect(api._captured[1].url).toContain('/activity/call/');
            await api.getCall('acti_c');
            expect(api._captured[2].url).toContain('/activity/call/acti_c/');
            await api.createCall({ lead_id: 'lead_1', direction: 'outbound' });
            expect(api._captured[3].method).toBe('POST');
            await api.listEmails();
            expect(api._captured[4].url).toContain('/activity/email/');
            await api.getEmail('acti_e');
            expect(api._captured[5].url).toContain('/activity/email/acti_e/');
            await api.listNotes();
            expect(api._captured[6].url).toContain('/activity/note/');
            await api.getNote('acti_n');
            expect(api._captured[7].url).toContain('/activity/note/acti_n/');
            await api.createNote({ lead_id: 'lead_1', note: 'hello' });
            expect(api._captured[8].method).toBe('POST');
        });
    });

    describe('custom fields & webhooks', () => {
        it('lists custom fields and fetches schema', async () => {
            const api = makeApi();
            await api.listLeadCustomFields();
            expect(api._captured[0].url).toContain('/custom_field/lead/');
            await api.listContactCustomFields();
            expect(api._captured[1].url).toContain('/custom_field/contact/');
            await api.listOpportunityCustomFields();
            expect(api._captured[2].url).toContain(
                '/custom_field/opportunity/'
            );
            await api.getCustomFieldSchema('lead');
            expect(api._captured[3].url).toBe(
                'https://api.close.com/api/v1/custom_field_schema/lead/'
            );
        });

        it('manages webhook subscriptions', async () => {
            const api = makeApi();
            await api.listWebhooks();
            expect(api._captured[0].url).toBe(
                'https://api.close.com/api/v1/webhook/'
            );
            const body = {
                url: 'https://hook.example.com',
                events: [{ object_type: 'lead', action: 'created' }],
            };
            await api.createWebhook(body);
            expect(api._captured[1]).toMatchObject({
                method: 'POST',
                body,
            });
            await api.getWebhook('whsub_1');
            expect(api._captured[2].url).toContain('/webhook/whsub_1/');
            await api.updateWebhook('whsub_1', { status: 'active' });
            expect(api._captured[3].method).toBe('PUT');
            await api.deleteWebhook('whsub_1');
            expect(api._captured[4].method).toBe('DELETE');
        });
    });

    describe('token exchange', () => {
        it('getTokenFromCode posts form body without redirect_uri', async () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 'sec',
                redirect_uri: 'https://app.example/close',
            });
            let captured;
            api._post = async (options) => {
                captured = options;
                return {
                    access_token: 'a',
                    refresh_token: 'r',
                    organization_id: 'orga_1',
                };
            };
            api.setTokens = async () => {};
            await api.getTokenFromCode('code123');
            expect(captured.url).toBe('https://api.close.com/oauth2/token/');
            expect(captured.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            const body = captured.body.toString();
            expect(body).toContain('grant_type=authorization_code');
            expect(body).toContain('code=code123');
            expect(body).toContain('client_id=cid');
            expect(body).not.toContain('redirect_uri');
            expect(api.organization_id).toBe('orga_1');
        });
    });
});

describe('Close webhook signature verifier', () => {
    it('accepts a valid close-sig-hash', () => {
        const keyHex = '058bfb6a3d8cfdc4da7c3be5901b16ae11da982b46a25fb2cd7016e97a140a1c';
        const timestamp = '1544271440';
        const payload = '{"subscription_id":"whsub_1"}';
        const hash = crypto
            .createHmac('sha256', Buffer.from(keyHex, 'hex'))
            .update(timestamp + payload, 'utf8')
            .digest('hex');
        const result = verifyCloseWebhook({
            signatureKey: keyHex,
            req: {
                headers: {
                    'close-sig-hash': hash,
                    'close-sig-timestamp': timestamp,
                },
                rawBody: payload,
            },
        });
        expect(result.valid).toBe(true);
    });

    it('rejects a bad signature', () => {
        const result = verifyCloseWebhook({
            signatureKey: 'aa'.repeat(32),
            req: {
                headers: {
                    'close-sig-hash': '00'.repeat(32),
                    'close-sig-timestamp': '1',
                },
                rawBody: '{}',
            },
        });
        expect(result.valid).toBe(false);
    });
});
