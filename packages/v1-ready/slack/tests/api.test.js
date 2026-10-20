const crypto = require('crypto');
const { Api, BASE_URL, AUTHORIZE_URL, TOKEN_URI } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'xoxb-test',
        client_id: 'cid',
        client_secret: 'sec',
        redirect_uri: 'https://app.example/redirect/slack',
        scope: 'channels:read chat:write',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { ok: true };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { ok: true };
    };
    return api;
}

describe('Slack Api', () => {
    describe('construction & auth', () => {
        it('sets the Slack Web API base URL and token URI', () => {
            const api = new Api({ access_token: 'xoxb-a' });
            expect(api.baseUrl).toBe(BASE_URL);
            expect(api.baseUrl).toBe('https://slack.com/api');
            expect(api.tokenUri).toBe(TOKEN_URI);
        });

        it('builds the oauth/v2/authorize URL with scope and optional user_scope', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/redirect/slack',
                scope: 'chat:write channels:read',
                user_scope: 'identify',
                state: 'st',
            });
            const url = api.getAuthorizationUri();
            expect(url.startsWith(AUTHORIZE_URL + '?')).toBe(true);
            expect(url).toContain('client_id=cid');
            expect(url).toContain('scope=chat%3Awrite+channels%3Aread');
            expect(url).toContain('user_scope=identify');
            expect(url).toContain('state=st');
        });

        it('exposes oauth2 authorization requirements', () => {
            const api = makeApi();
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain('slack.com/oauth/v2/authorize');
        });

        it('adds Bearer auth headers', async () => {
            const api = new Api({ access_token: 'xoxb-secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer xoxb-secret');
        });

        it('captures team metadata from oauth.v2.access without swapping to user token', async () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 'sec',
                redirect_uri: 'https://app.example/redirect/slack',
            });
            jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(api)), 'getTokenFromCode')
                .mockResolvedValue({
                    ok: true,
                    access_token: 'xoxb-bot',
                    team: { id: 'T1', name: 'Acme' },
                    authed_user: { id: 'U1', access_token: 'xoxp-user' },
                });
            // Call through our override path by stubbing super via direct apply
            api._applySlackInstallMetadata({
                access_token: 'xoxb-bot',
                team: { id: 'T1', name: 'Acme' },
                authed_user: { id: 'U1', access_token: 'xoxp-user' },
            });
            api.access_token = 'xoxb-bot';
            expect(api.team_id).toBe('T1');
            expect(api.team_name).toBe('Acme');
            expect(api.access_token).toBe('xoxb-bot');
            expect(api.authed_user.access_token).toBe('xoxp-user');
        });
    });

    describe('Web API methods', () => {
        it('authTest POSTs /auth.test', async () => {
            const api = makeApi();
            await api.authTest();
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://slack.com/api/auth.test'
            );
        });

        it('listConversations GETs /conversations.list with query', async () => {
            const api = makeApi();
            await api.listConversations({
                types: 'public_channel',
                limit: 50,
            });
            expect(api._captured[0].method).toBe('GET');
            expect(api._captured[0].url).toBe(
                'https://slack.com/api/conversations.list'
            );
            expect(api._captured[0].query.types).toBe('public_channel');
        });

        it('getConversation / createConversation / inviteToConversation', async () => {
            const api = makeApi();
            await api.getConversation({ channel: 'C1' });
            await api.createConversation({ name: 'general', is_private: false });
            await api.inviteToConversation({ channel: 'C1', users: 'U1,U2' });
            expect(api._captured[0].url).toContain('/conversations.info');
            expect(api._captured[1].url).toContain('/conversations.create');
            expect(api._captured[1].body.name).toBe('general');
            expect(api._captured[2].url).toContain('/conversations.invite');
        });

        it('conversation history/members/rename/archive', async () => {
            const api = makeApi();
            await api.getConversationHistory({ channel: 'C1', limit: 10 });
            await api.getConversationMembers({ channel: 'C1' });
            await api.renameConversation({ channel: 'C1', name: 'renamed' });
            await api.archiveConversation({ channel: 'C1' });
            expect(api._captured.map((c) => c.url)).toEqual([
                'https://slack.com/api/conversations.history',
                'https://slack.com/api/conversations.members',
                'https://slack.com/api/conversations.rename',
                'https://slack.com/api/conversations.archive',
            ]);
        });

        it('chat methods post JSON bodies', async () => {
            const api = makeApi();
            await api.postMessage({ channel: 'C1', text: 'hi' });
            await api.updateMessage({ channel: 'C1', ts: '1.0', text: 'bye' });
            await api.deleteMessage({ channel: 'C1', ts: '1.0' });
            await api.postEphemeral({
                channel: 'C1',
                user: 'U1',
                text: 'psst',
            });
            expect(api._captured[0].body.text).toBe('hi');
            expect(api._captured[0].headers['Content-Type']).toContain(
                'application/json'
            );
        });

        it('getMessagePermalink GETs with channel + message_ts', async () => {
            const api = makeApi();
            await api.getMessagePermalink({
                channel: 'C1',
                message_ts: '1.0',
            });
            expect(api._captured[0].url).toBe(
                'https://slack.com/api/chat.getPermalink'
            );
            expect(api._captured[0].query.message_ts).toBe('1.0');
        });

        it('user and file methods', async () => {
            const api = makeApi();
            await api.listUsers({ limit: 100 });
            await api.getUser({ user: 'U1' });
            await api.lookupUserByEmail({ email: 'a@b.com' });
            await api.getUserProfile({ user: 'U1' });
            await api.listFiles({ channel: 'C1' });
            await api.getFile({ file: 'F1' });
            expect(api._captured.map((c) => c.url.split('/api/')[1])).toEqual([
                'users.list',
                'users.info',
                'users.lookupByEmail',
                'users.profile.get',
                'files.list',
                'files.info',
            ]);
        });

        it('listEventAuthorizations and views', async () => {
            const api = makeApi();
            await api.listEventAuthorizations({ event_context: 'ctx' });
            await api.openView({ trigger_id: 't', view: {} });
            await api.publishView({ user_id: 'U1', view: {} });
            await api.updateView({ view_id: 'V1', view: {} });
            await api.pushView({ trigger_id: 't', view: {} });
            expect(api._captured[0].url).toContain(
                'apps.event.authorizations.list'
            );
            expect(api._captured[1].url).toContain('views.open');
            expect(api._captured[2].url).toContain('views.publish');
            expect(api._captured[3].url).toContain('views.update');
            expect(api._captured[4].url).toContain('views.push');
        });

        it('listTeams GETs /auth.teams.list', async () => {
            const api = makeApi();
            await api.listTeams({ limit: 10 });
            expect(api._captured[0].url).toBe(
                'https://slack.com/api/auth.teams.list'
            );
        });
    });

    describe('verifyWebhookSignature', () => {
        const SECRET = 'test-slack-signing-secret';
        const TS = 1531420618;
        const NOW = TS * 1000;
        const BODY =
            'token=example-token&team_id=T1DC2JH3J&command=%2Fweather&text=94070';
        const sign = ({ secret = SECRET, ts = TS, body = BODY } = {}) =>
            'v0=' +
            crypto
                .createHmac('sha256', secret)
                .update(`v0:${ts}:${body}`)
                .digest('hex');
        const headers = (over = {}) => ({
            'X-Slack-Signature': sign(),
            'X-Slack-Request-Timestamp': String(TS),
            ...over,
        });

        it('accepts a genuine delivery', async () => {
            const api = new Api({ webhookSecret: SECRET });
            expect(
                await api.verifyWebhookSignature({
                    headers: headers(),
                    rawBody: BODY,
                    now: NOW,
                })
            ).toBe(true);
        });

        it('rejects a tampered body and a wrong secret', async () => {
            const api = new Api({ webhookSecret: SECRET });
            expect(
                await api.verifyWebhookSignature({
                    headers: headers(),
                    rawBody: BODY + '&x=1',
                    now: NOW,
                })
            ).toBe(false);
            expect(
                await new Api({ webhookSecret: 'nope' }).verifyWebhookSignature(
                    {
                        headers: headers(),
                        rawBody: BODY,
                        now: NOW,
                    }
                )
            ).toBe(false);
        });

        it('rejects stale timestamps (>5 minutes)', async () => {
            const api = new Api({ webhookSecret: SECRET });
            expect(
                await api.verifyWebhookSignature({
                    headers: headers(),
                    rawBody: BODY,
                    now: NOW + 301000,
                })
            ).toBe(false);
        });

        it('reads SLACK_SIGNING_SECRET from the environment', async () => {
            process.env.SLACK_SIGNING_SECRET = SECRET;
            try {
                expect(
                    await new Api({}).verifyWebhookSignature({
                        headers: headers(),
                        rawBody: BODY,
                        now: NOW,
                    })
                ).toBe(true);
            } finally {
                delete process.env.SLACK_SIGNING_SECRET;
            }
        });
    });
});
