const {
    Api,
    DEFAULT_GOOGLE_SCOPE,
    GOOGLE_PROXY_BASE_URLS,
    GOOGLE_ADS_HOST,
} = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'g-client',
        client_secret: 'secret',
        redirect_uri: 'https://example.com/redirect/google',
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
        return { id: 'ok' };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return {};
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return {};
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Google Api', () => {
    describe('construction & auth', () => {
        it('defaults baseUrl to www.googleapis.com and exposes named proxy bases', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
            });
            expect(api.baseUrl).toBe('https://www.googleapis.com');
            expect(api.userInfoUrl).toBe(
                'https://openidconnect.googleapis.com/v1/userinfo'
            );
            expect(api.tokenUri).toBe('https://oauth2.googleapis.com/token');
            expect(api.proxyBaseUrls).toEqual(GOOGLE_PROXY_BASE_URLS);
            expect(api.resolveBaseUrl('sheets')).toBe(
                'https://sheets.googleapis.com'
            );
            expect(api.resolveBaseUrl('docs')).toBe(
                'https://docs.googleapis.com'
            );
            expect(api.resolveBaseUrl('googleads')).toBe(
                'https://googleads.googleapis.com'
            );
            expect(GOOGLE_ADS_HOST).toBe('googleads.googleapis.com');
        });

        it('builds a Google authorize URL with offline consent', () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r/google',
                scope: DEFAULT_GOOGLE_SCOPE,
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
                'redirect_uri=https%3A%2F%2Fex.com%2Fr%2Fgoogle'
            );
            expect(api.getAuthorizationRequirements()).toEqual({
                url: uri,
                type: 'oauth2',
            });
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

        it('attaches developer-token only for Ads host requests', async () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://ex.com/r',
                access_token: 't',
                developer_token: 'dev-tok',
            });
            const seen = [];
            // Api._request mutates headers then calls super._request — stub the
            // parent so we observe what the override passes through.
            const parentProto = Object.getPrototypeOf(Api.prototype);
            const orig = parentProto._request;
            parentProto._request = async function (url, options = {}) {
                seen.push({ url, headers: { ...(options.headers || {}) } });
                return {};
            };
            try {
                await api._request('https://googleads.googleapis.com/v26/x', {
                    headers: {},
                });
                await api._request(
                    'https://www.googleapis.com/drive/v3/files',
                    { headers: {} }
                );
            } finally {
                parentProto._request = orig;
            }
            expect(seen[0].headers['developer-token']).toBe('dev-tok');
            expect(seen[1].headers['developer-token']).toBeUndefined();
        });
    });

    describe('identity', () => {
        it('getUserInfo hits OpenID Connect userinfo', async () => {
            const api = makeApi();
            await api.getUserInfo();
            expect(api._captured[0].url).toBe(
                'https://openidconnect.googleapis.com/v1/userinfo'
            );
        });
    });

    describe('Gmail', () => {
        it('listMessages hits GET /gmail/v1/users/me/messages', async () => {
            const api = makeApi();
            await api.listMessages('me', { q: 'is:unread' });
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/gmail/v1/users/me/messages?q=is%3Aunread'
            );
        });

        it('getMessage hits GET /gmail/v1/users/{userId}/messages/{id}', async () => {
            const api = makeApi();
            await api.getMessage('me', 'm1');
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/gmail/v1/users/me/messages/m1'
            );
        });

        it('listLabels hits GET /gmail/v1/users/me/labels', async () => {
            const api = makeApi();
            await api.listLabels();
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/gmail/v1/users/me/labels'
            );
        });

        it('watchMailbox posts to users.watch', async () => {
            const api = makeApi();
            await api.watchMailbox('me', {
                topicName: 'projects/p/topics/t',
            });
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/gmail/v1/users/me/watch'
            );
            expect(api._captured[0].body.topicName).toBe(
                'projects/p/topics/t'
            );
        });
    });

    describe('Calendar', () => {
        it('listCalendars / listEvents / CRUD / watch / stopChannel', async () => {
            const api = makeApi();
            await api.listCalendars();
            await api.listEvents('primary', { maxResults: 5 });
            await api.getEvent('primary', 'e1');
            await api.createEvent('primary', { summary: 'Hi' });
            await api.updateEvent('primary', 'e1', { summary: 'Bye' });
            await api.deleteEvent('primary', 'e1');
            await api.watchEvents('primary', {
                id: 'ch1',
                type: 'web_hook',
                address: 'https://ex.com/hook',
            });
            await api.stopChannel({ id: 'ch1', resourceId: 'r1' });

            expect(api._captured[0].url).toBe(
                'https://www.googleapis.com/calendar/v3/users/me/calendarList'
            );
            expect(api._captured[1].url).toContain(
                '/calendar/v3/calendars/primary/events?maxResults=5'
            );
            expect(api._captured[2].url).toContain(
                '/calendar/v3/calendars/primary/events/e1'
            );
            expect(api._captured[3].method).toBe('POST');
            expect(api._captured[4].method).toBe('PUT');
            expect(api._captured[5].method).toBe('DELETE');
            expect(api._captured[6].url).toContain('/events/watch');
            expect(api._captured[7].url).toBe(
                'https://www.googleapis.com/calendar/v3/channels/stop'
            );
        });
    });

    describe('Drive', () => {
        it('list/get/create/update files and changes watch', async () => {
            const api = makeApi();
            await api.listFiles({ q: "mimeType='text/plain'" });
            await api.getFile('f1', { fields: 'id,name' });
            await api.createFile({ name: 'n', mimeType: 'text/plain' });
            await api.updateFile('f1', { name: 'n2' });
            await api.getChangesStartPageToken();
            await api.listChanges({ pageToken: '1' });
            await api.watchChanges(
                { id: 'c', type: 'web_hook', address: 'https://ex.com/h' },
                { pageToken: '1' }
            );

            expect(api._captured[0].url).toContain('/drive/v3/files?q=');
            expect(api._captured[1].url).toContain('/drive/v3/files/f1?fields=');
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[3].method).toBe('PATCH');
            expect(api._captured[4].url).toContain(
                '/drive/v3/changes/startPageToken'
            );
            expect(api._captured[5].url).toContain(
                '/drive/v3/changes?pageToken=1'
            );
            expect(api._captured[6].url).toContain('/drive/v3/changes/watch');
        });
    });

    describe('Docs / Sheets (named bases)', () => {
        it('routes Docs and Sheets to their hosts', async () => {
            const api = makeApi();
            await api.createDocument({ title: 'Doc' });
            await api.getDocument('d1');
            await api.batchUpdateDocument('d1', { requests: [] });
            await api.createSpreadsheet({ properties: { title: 'S' } });
            await api.getSpreadsheet('s1');
            await api.batchUpdateSpreadsheet('s1', { requests: [] });
            await api.getValues('s1', 'A1:B2');
            await api.updateValues(
                's1',
                'A1',
                { values: [['x']] },
                { valueInputOption: 'RAW' }
            );

            expect(api._captured[0].url).toBe(
                'https://docs.googleapis.com/v1/documents'
            );
            expect(api._captured[1].url).toBe(
                'https://docs.googleapis.com/v1/documents/d1'
            );
            expect(api._captured[2].url).toBe(
                'https://docs.googleapis.com/v1/documents/d1:batchUpdate'
            );
            expect(api._captured[3].url).toBe(
                'https://sheets.googleapis.com/v4/spreadsheets'
            );
            expect(api._captured[4].url).toBe(
                'https://sheets.googleapis.com/v4/spreadsheets/s1'
            );
            expect(api._captured[6].url).toContain(
                '/v4/spreadsheets/s1/values/A1%3AB2'
            );
            expect(api._captured[7].method).toBe('PUT');
        });
    });

    describe('Analytics / Search Console / Ads', () => {
        it('hits Analytics Admin/Data, Search Console, and Ads hosts', async () => {
            const api = makeApi({ developer_token: 'dev' });
            await api.listAnalyticsAccounts({ pageSize: 10 });
            await api.runReport('properties/123', {
                dimensions: [{ name: 'city' }],
            });
            await api.listSites();
            await api.querySearchAnalytics('https://example.com/', {
                startDate: '2026-01-01',
                endDate: '2026-01-31',
            });
            await api.listAccessibleCustomers();
            await api.searchGoogleAds(
                '123',
                { query: 'SELECT customer.id FROM customer' },
                { 'login-customer-id': '999' }
            );

            expect(api._captured[0].url).toBe(
                'https://analyticsadmin.googleapis.com/v1beta/accounts?pageSize=10'
            );
            expect(api._captured[1].url).toBe(
                'https://analyticsdata.googleapis.com/v1beta/properties/123:runReport'
            );
            expect(api._captured[2].url).toBe(
                'https://www.googleapis.com/webmasters/v3/sites'
            );
            expect(api._captured[3].url).toContain(
                '/webmasters/v3/sites/https%3A%2F%2Fexample.com%2F/searchAnalytics/query'
            );
            expect(api._captured[4].url).toBe(
                'https://googleads.googleapis.com/v26/customers:listAccessibleCustomers'
            );
            expect(api._captured[5].url).toBe(
                'https://googleads.googleapis.com/v26/customers/123/googleAds:search'
            );
            expect(api._captured[5].headers['login-customer-id']).toBe('999');
        });
    });
});
