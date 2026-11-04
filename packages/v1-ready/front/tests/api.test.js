const crypto = require('crypto');
const {
    Api,
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
    CHALLENGE_HEADER,
} = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'tok',
        client_id: 'cid',
        client_secret: 'csec',
        redirect_uri: 'https://app.example/redirect/front',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { _results: [], _pagination: {} };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'created' };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return { id: 'patched' };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return { status: 204 };
    };
    return api;
}

describe('Front Api', () => {
    describe('construction & auth', () => {
        it('sets the Core API base URL and OAuth token URI', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/redirect/front',
            });
            expect(api.baseUrl).toBe('https://api2.frontapp.com');
            expect(api.tokenUri).toBe('https://app.frontapp.com/oauth/token');
            expect(api.getAuthUri()).toContain(
                'https://app.frontapp.com/oauth/authorize?'
            );
            expect(api.getAuthUri()).toContain('response_type=code');
            expect(api.getAuthUri()).toContain('client_id=cid');
            // Front does not put scopes in the authorize URL.
            expect(api.getAuthUri()).not.toContain('scope=');
        });

        it('exposes oauth2 authorization requirements', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/redirect/front',
            });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain('oauth/authorize');
        });
    });

    describe('identity', () => {
        it('getMe hits GET /me', async () => {
            const api = makeApi();
            await api.getMe();
            expect(api._captured[0].url).toBe('https://api2.frontapp.com/me');
        });
    });

    describe('conversations', () => {
        it('listConversations hits GET /conversations', async () => {
            const api = makeApi();
            await api.listConversations({ limit: 10, page_token: 'p1' });
            const { url } = api._captured[0];
            expect(url).toContain('https://api2.frontapp.com/conversations?');
            expect(url).toContain('limit=10');
            expect(url).toContain('page_token=p1');
        });

        it('getConversation hits the by-id path', async () => {
            const api = makeApi();
            await api.getConversation('cnv_1');
            expect(api._captured[0].url).toBe(
                'https://api2.frontapp.com/conversations/cnv_1'
            );
        });

        it('createConversation POSTs JSON', async () => {
            const api = makeApi();
            const body = { type: 'discussion', subject: 'Hello' };
            await api.createConversation(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual(body);
            expect(api._captured[0].headers['Content-Type']).toBe(
                'application/json'
            );
        });

        it('updateConversation PATCHes JSON', async () => {
            const api = makeApi();
            await api.updateConversation('cnv_1', { status: 'archived' });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toBe(
                'https://api2.frontapp.com/conversations/cnv_1'
            );
        });
    });

    describe('contacts', () => {
        it('listContacts / getContact / createContact / deleteContact', async () => {
            const api = makeApi();
            await api.listContacts({ limit: 5 });
            await api.getContact('crd_1');
            await api.createContact({
                name: 'Ada',
                handles: [{ handle: 'ada@example.com', source: 'email' }],
            });
            await api.deleteContact('crd_1');
            expect(api._captured[0].url).toContain('/contacts?');
            expect(api._captured[1].url).toBe(
                'https://api2.frontapp.com/contacts/crd_1'
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[3].method).toBe('DELETE');
        });

        it('updateContact treats 204 as success', async () => {
            const api = makeApi();
            api._request = async () => ({ status: 204 });
            const result = await api.updateContact('crd_1', { name: 'New' });
            expect(result).toBe('');
        });
    });

    describe('channels / teammates / inboxes / tags / events', () => {
        it('hits the documented list and get paths', async () => {
            const api = makeApi();
            await api.listChannels();
            await api.getChannel('cha_1');
            await api.listTeammates();
            await api.getTeammate('tea_1');
            await api.listInboxes();
            await api.getInbox('inb_1');
            await api.listTags();
            await api.getTag('tag_1');
            await api.createTag({ name: 'vip' });
            await api.updateTag('tag_1', { name: 'vip2' });
            await api.listEvents({ limit: 2 });
            await api.getEvent('evt_1');

            const urls = api._captured.map((c) => c.url);
            expect(urls).toEqual(
                expect.arrayContaining([
                    'https://api2.frontapp.com/channels',
                    'https://api2.frontapp.com/channels/cha_1',
                    'https://api2.frontapp.com/teammates',
                    'https://api2.frontapp.com/teammates/tea_1',
                    'https://api2.frontapp.com/inboxes',
                    'https://api2.frontapp.com/inboxes/inb_1',
                    'https://api2.frontapp.com/tags',
                    'https://api2.frontapp.com/tags/tag_1',
                    expect.stringContaining('/events?'),
                    'https://api2.frontapp.com/events/evt_1',
                ])
            );
        });
    });

    describe('messages & comments', () => {
        it('lists and fetches messages / comments', async () => {
            const api = makeApi();
            await api.listConversationMessages('cnv_1');
            await api.getMessage('msg_1');
            await api.listConversationComments('cnv_1');
            await api.addComment('cnv_1', { body: 'hi' });
            expect(api._captured[0].url).toBe(
                'https://api2.frontapp.com/conversations/cnv_1/messages'
            );
            expect(api._captured[1].url).toBe(
                'https://api2.frontapp.com/messages/msg_1'
            );
            expect(api._captured[2].url).toBe(
                'https://api2.frontapp.com/conversations/cnv_1/comments'
            );
            expect(api._captured[3].method).toBe('POST');
            expect(api._captured[3].body).toEqual({ body: 'hi' });
        });
    });

    describe('verifyWebhookSignature', () => {
        const secret = 'app-signing-secret';
        const timestamp = '1710000000000';
        const rawBody = JSON.stringify({
            type: 'inbound_received',
            authorization: { id: 'cmp_abc' },
            payload: { id: 'evt_1' },
        });

        function sign(ts, body, key) {
            return crypto
                .createHmac('sha256', key)
                .update(Buffer.concat([Buffer.from(`${ts}:`, 'utf8'), Buffer.from(body, 'utf8')]))
                .digest('base64');
        }

        it('accepts a valid signature', () => {
            const api = new Api({ webhookSecret: secret });
            const signature = sign(timestamp, rawBody, secret);
            const result = api.verifyWebhookSignature({
                headers: {
                    [SIGNATURE_HEADER]: signature,
                    [TIMESTAMP_HEADER]: timestamp,
                },
                rawBody,
            });
            expect(result).toEqual({ valid: true });
        });

        it('returns the challenge when present', () => {
            const api = new Api({ webhookSecret: secret });
            const signature = sign(timestamp, rawBody, secret);
            const result = api.verifyWebhookSignature({
                headers: {
                    [SIGNATURE_HEADER]: signature,
                    [TIMESTAMP_HEADER]: timestamp,
                    [CHALLENGE_HEADER]: 'challenge-token',
                },
                rawBody,
            });
            expect(result.valid).toBe(true);
            expect(result.challenge).toBe('challenge-token');
        });

        it('rejects a bad signature', () => {
            const api = new Api({ webhookSecret: secret });
            const result = api.verifyWebhookSignature({
                headers: {
                    [SIGNATURE_HEADER]: 'nope',
                    [TIMESTAMP_HEADER]: timestamp,
                },
                rawBody,
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toMatch(/mismatch|missing/);
        });
    });
});
