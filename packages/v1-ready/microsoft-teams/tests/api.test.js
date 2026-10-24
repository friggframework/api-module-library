const { Api, GRAPH_BASE_URL, DEFAULT_SCOPE } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'tok',
        refresh_token: 'ref',
        client_id: 'cid',
        client_secret: 'sec',
        redirect_uri: 'https://app.example/redirect/microsoft-teams',
        tenant_id: 'common',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { value: [] };
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
        return {};
    };
    return api;
}

describe('Microsoft Teams Api', () => {
    describe('construction & auth', () => {
        it('defaults to Graph v1.0 base URL', () => {
            const api = new Api({ access_token: 'a' });
            expect(api.baseUrl).toBe(GRAPH_BASE_URL);
            expect(api.baseUrl).toBe('https://graph.microsoft.com/v1.0');
        });

        it('builds the Microsoft identity authorize URL', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/redirect/microsoft-teams',
                scope: DEFAULT_SCOPE,
                state: 'st',
                tenant_id: 'common',
            });
            const url = api.getAuthorizationUri();
            expect(url).toContain(
                'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?'
            );
            expect(url).toContain('client_id=cid');
            expect(url).toContain('response_type=code');
            expect(url).toContain('prompt=consent');
            expect(url).toContain('User.Read');
        });

        it('getAuthorizationRequirements returns oauth2', () => {
            const api = makeApi();
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain('login.microsoftonline.com');
        });

        it('getTokenFromCode delegates to the OAuth2Requester implementation', async () => {
            const api = makeApi();
            const spy = jest
                .spyOn(api, 'getTokenFromCode')
                .mockResolvedValue({ access_token: 'a', refresh_token: 'r' });
            const result = await api.getTokenFromCode('the-code');
            expect(spy).toHaveBeenCalledWith('the-code');
            expect(result.access_token).toBe('a');
            spy.mockRestore();
        });

        it('getTokenFromClientCredentials posts .default scope', async () => {
            const api = makeApi();
            api.setTokens = async () => {};
            await api.getTokenFromClientCredentials();
            const call = api._captured[0];
            expect(call.method).toBe('POST');
            expect(call.url).toContain(
                'login.microsoftonline.com/common/oauth2/v2.0/token'
            );
            expect(call.body.get('grant_type')).toBe('client_credentials');
            expect(call.body.get('scope')).toBe(
                'https://graph.microsoft.com/.default'
            );
        });
    });

    describe('identity', () => {
        it('getMe hits GET /me', async () => {
            const api = makeApi();
            await api.getMe();
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me'
            );
        });

        it('getOrganization returns value[0]', async () => {
            const api = makeApi();
            api._get = async () => ({
                value: [{ id: 'tenant-1', displayName: 'Contoso' }],
            });
            const org = await api.getOrganization();
            expect(org.id).toBe('tenant-1');
        });
    });

    describe('teams & channels', () => {
        it('listJoinedTeams hits /me/joinedTeams', async () => {
            const api = makeApi();
            await api.listJoinedTeams();
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me/joinedTeams'
            );
        });

        it('getTeam hits /teams/{id}', async () => {
            const api = makeApi();
            await api.getTeam('team-1');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/teams/team-1'
            );
        });

        it('listChannels / createChannel / updateChannel use channel paths', async () => {
            const api = makeApi();
            await api.listChannels('t1');
            await api.createChannel('t1', { displayName: 'General' });
            await api.updateChannel('t1', 'c1', { description: 'x' });
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/teams/t1/channels'
            );
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[1].body).toEqual({ displayName: 'General' });
            expect(api._captured[2].method).toBe('PATCH');
            expect(api._captured[2].url).toBe(
                'https://graph.microsoft.com/v1.0/teams/t1/channels/c1'
            );
        });

        it('getChannel hits the channel path', async () => {
            const api = makeApi();
            await api.getChannel('t1', 'c1');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/teams/t1/channels/c1'
            );
        });
    });

    describe('messages & chats', () => {
        it('list/get/send channel messages', async () => {
            const api = makeApi();
            await api.listChannelMessages('t1', 'c1');
            await api.getChannelMessage('t1', 'c1', 'm1');
            await api.sendChannelMessage('t1', 'c1', {
                body: { content: 'hi' },
            });
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/teams/t1/channels/c1/messages'
            );
            expect(api._captured[1].url).toBe(
                'https://graph.microsoft.com/v1.0/teams/t1/channels/c1/messages/m1'
            );
            expect(api._captured[2].method).toBe('POST');
        });

        it('list/get chats and chat messages', async () => {
            const api = makeApi();
            await api.listChats();
            await api.getChat('chat-1');
            await api.listChatMessages('chat-1');
            await api.sendChatMessage('chat-1', {
                body: { content: 'yo' },
            });
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/chats'
            );
            expect(api._captured[1].url).toBe(
                'https://graph.microsoft.com/v1.0/chats/chat-1'
            );
            expect(api._captured[3].method).toBe('POST');
        });

        it('listTeamMembers hits /teams/{id}/members', async () => {
            const api = makeApi();
            await api.listTeamMembers('t1');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/teams/t1/members'
            );
        });
    });

    describe('subscriptions', () => {
        it('CRUD subscription endpoints', async () => {
            const api = makeApi();
            await api.createSubscription({
                changeType: 'created',
                notificationUrl: 'https://hook.example/webhooks',
                resource: '/teams/t/channels/c/messages',
                expirationDateTime: '2026-10-21T00:00:00Z',
                clientState: 'secret',
            });
            await api.listSubscriptions();
            await api.getSubscription('sub-1');
            await api.renewSubscription('sub-1', {
                expirationDateTime: '2026-10-22T00:00:00Z',
            });
            await api.deleteSubscription('sub-1');
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/subscriptions'
            );
            expect(api._captured[1].method).toBe('GET');
            expect(api._captured[2].url).toBe(
                'https://graph.microsoft.com/v1.0/subscriptions/sub-1'
            );
            expect(api._captured[3].method).toBe('PATCH');
            expect(api._captured[4].method).toBe('DELETE');
        });
    });

    describe('verifyWebhookClientState', () => {
        it('accepts a matching clientState', () => {
            const api = new Api({ webhookClientState: 'secret' });
            expect(
                api.verifyWebhookClientState({ clientState: 'secret' }).valid
            ).toBe(true);
        });

        it('rejects a mismatch or missing secret', () => {
            const api = new Api({ webhookClientState: 'secret' });
            expect(
                api.verifyWebhookClientState({ clientState: 'nope' }).valid
            ).toBe(false);
            expect(new Api({}).verifyWebhookClientState({}).valid).toBe(false);
        });
    });
});
