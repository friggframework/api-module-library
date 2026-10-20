const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://app.example.com/redirect/calendly',
        scope: 'users:read event_types:read',
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        state: 'state-1',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { collection: [], pagination: {} };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { resource: { uri: 'https://api.calendly.com/webhook_subscriptions/WH' } };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Calendly Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and OAuth endpoints', () => {
            const api = makeApi();
            expect(api.baseUrl).toBe('https://api.calendly.com');
            expect(api.tokenUri).toBe('https://auth.calendly.com/oauth/token');
            expect(api.authorizationUri).toContain(
                'https://auth.calendly.com/oauth/authorize'
            );
            expect(api.authorizationUri).toContain('client_id=cid');
            expect(api.authorizationUri).toContain('response_type=code');
        });

        it('getTokenFromCode delegates to Basic Auth exchange', async () => {
            const api = makeApi();
            api.getTokenFromCodeBasicAuthHeader = jest
                .fn()
                .mockResolvedValue({ access_token: 'a' });
            await api.getTokenFromCode('auth-code');
            expect(api.getTokenFromCodeBasicAuthHeader).toHaveBeenCalledWith(
                'auth-code'
            );
        });

        it('refreshAccessToken posts with Basic Auth and form body', async () => {
            const api = makeApi();
            api.setTokens = jest.fn().mockResolvedValue(undefined);
            await api.refreshAccessToken({ refresh_token: 'rt' });
            const call = api._captured[0];
            expect(call.method).toBe('POST');
            expect(call.url).toBe(api.tokenUri);
            expect(call.headers.Authorization).toMatch(/^Basic /);
            expect(call.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            expect(call.body.get('grant_type')).toBe('refresh_token');
            expect(call.body.get('refresh_token')).toBe('rt');
        });
    });

    describe('getCurrentUser', () => {
        it('hits GET /users/me', async () => {
            const api = makeApi();
            await api.getCurrentUser();
            expect(api._captured[0].url).toBe(
                'https://api.calendly.com/users/me'
            );
        });
    });

    describe('event types', () => {
        it('listEventTypes hits GET /event_types with query', async () => {
            const api = makeApi();
            await api.listEventTypes({
                user: 'https://api.calendly.com/users/U1',
                count: 10,
            });
            expect(api._captured[0].url).toBe(
                'https://api.calendly.com/event_types'
            );
            expect(api._captured[0].query).toEqual({
                user: 'https://api.calendly.com/users/U1',
                count: 10,
            });
        });

        it('getEventType hits GET /event_types/{uuid}', async () => {
            const api = makeApi();
            await api.getEventType('ET-UUID');
            expect(api._captured[0].url).toBe(
                'https://api.calendly.com/event_types/ET-UUID'
            );
        });
    });

    describe('scheduled events', () => {
        it('listScheduledEvents hits GET /scheduled_events', async () => {
            const api = makeApi();
            await api.listScheduledEvents({
                organization: 'https://api.calendly.com/organizations/O1',
                status: 'active',
            });
            expect(api._captured[0].url).toBe(
                'https://api.calendly.com/scheduled_events'
            );
            expect(api._captured[0].query.status).toBe('active');
        });

        it('getScheduledEvent hits GET /scheduled_events/{uuid}', async () => {
            const api = makeApi();
            await api.getScheduledEvent('SE-UUID');
            expect(api._captured[0].url).toBe(
                'https://api.calendly.com/scheduled_events/SE-UUID'
            );
        });
    });

    describe('invitees', () => {
        it('listEventInvitees hits the invitees collection', async () => {
            const api = makeApi();
            await api.listEventInvitees('SE-UUID', { email: 'a@b.com' });
            expect(api._captured[0].url).toBe(
                'https://api.calendly.com/scheduled_events/SE-UUID/invitees'
            );
            expect(api._captured[0].query).toEqual({ email: 'a@b.com' });
        });

        it('getEventInvitee hits the invitee path', async () => {
            const api = makeApi();
            await api.getEventInvitee('SE-UUID', 'INV-UUID');
            expect(api._captured[0].url).toBe(
                'https://api.calendly.com/scheduled_events/SE-UUID/invitees/INV-UUID'
            );
        });
    });

    describe('webhook subscriptions', () => {
        it('listWebhookSubscriptions requires organization+scope in query', async () => {
            const api = makeApi();
            await api.listWebhookSubscriptions({
                organization: 'https://api.calendly.com/organizations/O1',
                scope: 'organization',
            });
            expect(api._captured[0].url).toBe(
                'https://api.calendly.com/webhook_subscriptions'
            );
            expect(api._captured[0].query.scope).toBe('organization');
        });

        it('createWebhookSubscription POSTs JSON body', async () => {
            const api = makeApi();
            const body = {
                url: 'https://hook.example.com/calendly',
                events: ['invitee.created', 'invitee.canceled'],
                organization: 'https://api.calendly.com/organizations/O1',
                scope: 'organization',
            };
            await api.createWebhookSubscription(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://api.calendly.com/webhook_subscriptions'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('getWebhookSubscription and deleteWebhookSubscription hit by uuid', async () => {
            const api = makeApi();
            await api.getWebhookSubscription('WH-UUID');
            await api.deleteWebhookSubscription('WH-UUID');
            expect(api._captured[0].url).toBe(
                'https://api.calendly.com/webhook_subscriptions/WH-UUID'
            );
            expect(api._captured[1].method).toBe('DELETE');
            expect(api._captured[1].url).toBe(
                'https://api.calendly.com/webhook_subscriptions/WH-UUID'
            );
        });
    });
});
