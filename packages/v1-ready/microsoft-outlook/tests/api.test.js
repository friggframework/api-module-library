const { Api, GRAPH_BASE_URL, DEFAULT_SCOPE } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'tok',
        refresh_token: 'ref',
        client_id: 'cid',
        client_secret: 'sec',
        redirect_uri: 'https://app.example/redirect/microsoft-outlook',
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

describe('Microsoft Outlook Api', () => {
    describe('construction & auth', () => {
        it('defaults to Graph v1.0 base URL', () => {
            const api = new Api({ access_token: 'a' });
            expect(api.baseUrl).toBe(GRAPH_BASE_URL);
            expect(api.baseUrl).toBe('https://graph.microsoft.com/v1.0');
        });

        it('builds the Microsoft identity authorize URL', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example/redirect/microsoft-outlook',
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
            expect(url).toContain('Mail.ReadWrite');
            expect(url).toContain('Calendars.ReadWrite');
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

    describe('messages', () => {
        it('listMessages hits GET /me/messages', async () => {
            const api = makeApi();
            await api.listMessages({ $top: 10 });
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me/messages'
            );
            expect(api._captured[0].query).toEqual({ $top: 10 });
        });

        it('getMessage hits GET /me/messages/{id}', async () => {
            const api = makeApi();
            await api.getMessage('msg-1');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me/messages/msg-1'
            );
        });

        it('createMessage POSTs to /me/messages', async () => {
            const api = makeApi();
            const body = { subject: 'Hi', body: { content: 'x' } };
            await api.createMessage(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me/messages'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('updateMessage PATCHes /me/messages/{id}', async () => {
            const api = makeApi();
            await api.updateMessage('msg-1', { isRead: true });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me/messages/msg-1'
            );
        });

        it('deleteMessage DELETEs /me/messages/{id}', async () => {
            const api = makeApi();
            await api.deleteMessage('msg-1');
            expect(api._captured[0].method).toBe('DELETE');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me/messages/msg-1'
            );
        });

        it('sendMail POSTs to /me/sendMail', async () => {
            const api = makeApi();
            const body = {
                message: { subject: 'Hi', toRecipients: [] },
                saveToSentItems: true,
            };
            await api.sendMail(body);
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me/sendMail'
            );
            expect(api._captured[0].body).toEqual(body);
        });
    });

    describe('mail folders', () => {
        it('listMailFolders hits GET /me/mailFolders', async () => {
            const api = makeApi();
            await api.listMailFolders();
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me/mailFolders'
            );
        });

        it('getMailFolder hits GET /me/mailFolders/{id}', async () => {
            const api = makeApi();
            await api.getMailFolder('inbox');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me/mailFolders/inbox'
            );
        });
    });

    describe('calendars & events', () => {
        it('listCalendars hits GET /me/calendars', async () => {
            const api = makeApi();
            await api.listCalendars();
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me/calendars'
            );
        });

        it('getCalendar hits GET /me/calendars/{id}', async () => {
            const api = makeApi();
            await api.getCalendar('cal-1');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me/calendars/cal-1'
            );
        });

        it('listEvents hits GET /me/events', async () => {
            const api = makeApi();
            await api.listEvents();
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me/events'
            );
        });

        it('getEvent hits GET /me/events/{id}', async () => {
            const api = makeApi();
            await api.getEvent('evt-1');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me/events/evt-1'
            );
        });

        it('createEvent POSTs to /me/events', async () => {
            const api = makeApi();
            const body = {
                subject: 'Meet',
                start: { dateTime: '2026-01-01T10:00:00', timeZone: 'UTC' },
                end: { dateTime: '2026-01-01T11:00:00', timeZone: 'UTC' },
            };
            await api.createEvent(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me/events'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('updateEvent PATCHes /me/events/{id}', async () => {
            const api = makeApi();
            await api.updateEvent('evt-1', { subject: 'Updated' });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me/events/evt-1'
            );
        });

        it('deleteEvent DELETEs /me/events/{id}', async () => {
            const api = makeApi();
            await api.deleteEvent('evt-1');
            expect(api._captured[0].method).toBe('DELETE');
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me/events/evt-1'
            );
        });

        it('listCalendarView hits GET /me/calendarView with query', async () => {
            const api = makeApi();
            await api.listCalendarView({
                startDateTime: '2026-01-01T00:00:00Z',
                endDateTime: '2026-01-08T00:00:00Z',
            });
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/me/calendarView'
            );
            expect(api._captured[0].query.startDateTime).toBe(
                '2026-01-01T00:00:00Z'
            );
        });
    });

    describe('subscriptions', () => {
        it('createSubscription POSTs to /subscriptions', async () => {
            const api = makeApi();
            const body = {
                changeType: 'created',
                notificationUrl: 'https://hook.example/outlook',
                resource: "me/mailFolders('Inbox')/messages",
                expirationDateTime: '2026-11-20T18:23:45.9356913Z',
                clientState: 'secret',
            };
            await api.createSubscription(body);
            expect(api._captured[0].url).toBe(
                'https://graph.microsoft.com/v1.0/subscriptions'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('listSubscriptions / get / renew / delete', async () => {
            const api = makeApi();
            await api.listSubscriptions();
            await api.getSubscription('sub-1');
            await api.renewSubscription('sub-1', {
                expirationDateTime: '2026-12-01T00:00:00Z',
            });
            await api.deleteSubscription('sub-1');
            expect(api._captured.map((c) => c.method)).toEqual([
                'GET',
                'GET',
                'PATCH',
                'DELETE',
            ]);
            expect(api._captured[1].url).toBe(
                'https://graph.microsoft.com/v1.0/subscriptions/sub-1'
            );
        });

        it('verifyWebhookClientState checks the secret', () => {
            const api = makeApi({ webhookClientState: 'secret' });
            expect(
                api.verifyWebhookClientState({ clientState: 'secret' }).valid
            ).toBe(true);
            expect(
                api.verifyWebhookClientState({ clientState: 'wrong' }).valid
            ).toBe(false);
            expect(api.verifyWebhookClientState({}).valid).toBe(false);
        });
    });
});
