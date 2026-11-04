const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'gw-client',
        client_secret: 'secret',
        redirect_uri: 'https://example.com/redirect/google-workspace',
        access_token: 'tok',
        refresh_token: 'ref',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return {};
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 'ch1' };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return {};
    };
    return api;
}

describe('Google Workspace Api', () => {
    describe('construction & auth', () => {
        it('defaults baseUrl to www.googleapis.com', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
            });
            expect(api.baseUrl).toBe('https://www.googleapis.com');
            expect(api.userInfoUrl).toBe(
                'https://www.googleapis.com/oauth2/v2/userinfo'
            );
            expect(api.tokenUri).toBe('https://oauth2.googleapis.com/token');
        });

        it('builds a Google authorize URL with offline consent', () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r/google-workspace',
                scope: 'https://www.googleapis.com/auth/drive',
                state: 'xyz',
            });
            const uri = api.getAuthorizationUri();
            expect(uri).toContain(
                'https://accounts.google.com/o/oauth2/v2/auth?'
            );
            expect(uri).toContain('client_id=cid');
            expect(uri).toContain('response_type=code');
            expect(uri).toContain('access_type=offline');
            expect(uri).toContain('prompt=consent');
            expect(uri).toContain('state=xyz');
            expect(uri).toContain(
                'redirect_uri=https%3A%2F%2Fex.com%2Fr%2Fgoogle-workspace'
            );
            expect(api.getAuthUri()).toBe(uri);
        });

        it('adds Bearer Authorization header', async () => {
            const api = new Api({
                access_token: 'tok-1',
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer tok-1');
        });
    });

    describe('identity', () => {
        it('getUserDetails hits OAuth2 userinfo', async () => {
            const api = makeApi();
            await api.getUserDetails();
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/oauth2/v2/userinfo'
            );
        });
    });

    describe('Drive', () => {
        it('getAbout hits GET /drive/v3/about', async () => {
            const api = makeApi();
            await api.getAbout({ fields: 'user' });
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/drive/v3/about?fields=user'
            );
        });

        it('listDrives hits GET /drive/v3/drives', async () => {
            const api = makeApi();
            await api.listDrives({ pageSize: 10 });
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/drive/v3/drives?pageSize=10'
            );
        });

        it('listFiles hits GET /drive/v3/files', async () => {
            const api = makeApi();
            await api.listFiles({ q: "trashed=false", pageSize: 50 });
            expect(api._captured[0].url).toContain(
                'https://www.googleapis.com/drive/v3/files?'
            );
            expect(api._captured[0].url).toContain('pageSize=50');
        });

        it('getFile hits GET /drive/v3/files/{id}', async () => {
            const api = makeApi();
            await api.getFile('file1', {
                fields: 'id,name',
                supportsAllDrives: true,
            });
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/drive/v3/files/file1?fields=id%2Cname&supportsAllDrives=true'
            );
        });

        it('createFile POSTs metadata to /drive/v3/files', async () => {
            const api = makeApi();
            const body = {
                name: 'Notes',
                mimeType: 'application/vnd.google-apps.document',
            };
            await api.createFile(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/drive/v3/files'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('updateFile PATCHes /drive/v3/files/{id}', async () => {
            const api = makeApi();
            await api.updateFile('file1', { name: 'Renamed' });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/drive/v3/files/file1'
            );
            expect(api._captured[0].body).toEqual({ name: 'Renamed' });
        });

        it('exportFile hits GET /drive/v3/files/{id}/export', async () => {
            const api = makeApi();
            await api.exportFile('file1', {
                mimeType: 'application/pdf',
            });
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/drive/v3/files/file1/export?mimeType=application%2Fpdf'
            );
            expect(api._captured[0].returnFullRes).toBe(true);
        });

        it('getChangesStartPageToken hits the startPageToken path', async () => {
            const api = makeApi();
            await api.getChangesStartPageToken();
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/drive/v3/changes/startPageToken'
            );
        });

        it('watchFile POSTs a Channel to files/{id}/watch', async () => {
            const api = makeApi();
            const channel = {
                id: 'ch-1',
                type: 'web_hook',
                address: 'https://hook.example.com/gw',
                token: 'tok',
            };
            await api.watchFile('file1', channel);
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/drive/v3/files/file1/watch'
            );
            expect(api._captured[0].body).toEqual(channel);
        });

        it('watchChanges POSTs with pageToken query', async () => {
            const api = makeApi();
            await api.watchChanges(
                { id: 'ch', type: 'web_hook', address: 'https://h' },
                { pageToken: '1' }
            );
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/drive/v3/changes/watch?pageToken=1'
            );
        });

        it('stopDriveChannel POSTs to /drive/v3/channels/stop', async () => {
            const api = makeApi();
            await api.stopDriveChannel({ id: 'ch', resourceId: 'r' });
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/drive/v3/channels/stop'
            );
        });
    });

    describe('Calendar', () => {
        it('listCalendars hits calendarList', async () => {
            const api = makeApi();
            await api.listCalendars();
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/calendar/v3/users/me/calendarList'
            );
        });

        it('getCalendar hits calendars/{id}', async () => {
            const api = makeApi();
            await api.getCalendar('primary');
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/calendar/v3/calendars/primary'
            );
        });

        it('listEvents hits calendars/{id}/events', async () => {
            const api = makeApi();
            await api.listEvents('primary', { maxResults: 5 });
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=5'
            );
        });

        it('getEvent hits calendars/{id}/events/{eventId}', async () => {
            const api = makeApi();
            await api.getEvent('primary', 'evt1');
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/calendar/v3/calendars/primary/events/evt1'
            );
        });

        it('createEvent POSTs to calendars/{id}/events', async () => {
            const api = makeApi();
            const body = {
                summary: 'Sync',
                start: { dateTime: '2026-01-01T10:00:00Z' },
                end: { dateTime: '2026-01-01T11:00:00Z' },
            };
            await api.createEvent('primary', body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/calendar/v3/calendars/primary/events'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('updateEvent PATCHes calendars/{id}/events/{eventId}', async () => {
            const api = makeApi();
            await api.updateEvent('primary', 'evt1', { summary: 'Updated' });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/calendar/v3/calendars/primary/events/evt1'
            );
        });

        it('watchCalendarEvents POSTs Channel to events/watch', async () => {
            const api = makeApi();
            const channel = {
                id: 'ch-cal',
                type: 'web_hook',
                address: 'https://hook.example.com/gw',
            };
            await api.watchCalendarEvents('primary', channel);
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/calendar/v3/calendars/primary/events/watch'
            );
            expect(api._captured[0].body).toEqual(channel);
        });

        it('stopCalendarChannel POSTs to /calendar/v3/channels/stop', async () => {
            const api = makeApi();
            await api.stopCalendarChannel({ id: 'ch', resourceId: 'r' });
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/calendar/v3/channels/stop'
            );
        });
    });
});
