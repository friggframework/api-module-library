const { Api } = require('../api');

// Fully offline: stub _get/_post and assert on the request options the API
// methods construct. No network is touched. Fixtures are minimal and local —
// no client-repo sample data.
function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        redirect_uri: 'https://example.com/redirect/google-analytics',
        scope: 'https://www.googleapis.com/auth/analytics.readonly',
        access_token: 'test-access-token',
        ...overrides,
    });
    api.sent = [];
    api._get = async (options) => {
        api.sent.push({ method: 'GET', ...options });
        return { id: 'user-1', email: 'analyst@example.com', name: 'Analyst' };
    };
    api._post = async (options) => {
        api.sent.push({ method: 'POST', ...options });
        return { rows: [], rowCount: 0 };
    };
    return api;
}

describe('Google Analytics Api', () => {
    describe('construction & auth', () => {
        it('sets the Data API v1beta baseUrl and token URI', () => {
            const api = makeApi();
            expect(api.baseUrl).toBe(
                'https://analyticsdata.googleapis.com/v1beta'
            );
            expect(api.tokenUri).toBe('https://oauth2.googleapis.com/token');
        });

        it('prefers GOOGLE_ANALYTICS_REDIRECT_URI when constructing from env', () => {
            const prev = process.env.GOOGLE_ANALYTICS_REDIRECT_URI;
            process.env.GOOGLE_ANALYTICS_REDIRECT_URI =
                'https://app.example.com/oauth/google-analytics';
            try {
                const api = new Api({
                    client_id: 'c',
                    client_secret: 's',
                });
                expect(api.redirect_uri).toBe(
                    'https://app.example.com/oauth/google-analytics'
                );
            } finally {
                if (prev === undefined) {
                    delete process.env.GOOGLE_ANALYTICS_REDIRECT_URI;
                } else {
                    process.env.GOOGLE_ANALYTICS_REDIRECT_URI = prev;
                }
            }
        });

        it('builds an authorize URL with offline access and consent prompt', () => {
            const api = makeApi({ state: 'state-xyz' });
            const url = new URL(api.getAuthorizationUri());
            expect(url.origin + url.pathname).toBe(
                'https://accounts.google.com/o/oauth2/v2/auth'
            );
            expect(url.searchParams.get('response_type')).toBe('code');
            expect(url.searchParams.get('client_id')).toBe('test-client-id');
            expect(url.searchParams.get('redirect_uri')).toBe(
                'https://example.com/redirect/google-analytics'
            );
            expect(url.searchParams.get('scope')).toBe(
                'https://www.googleapis.com/auth/analytics.readonly'
            );
            expect(url.searchParams.get('access_type')).toBe('offline');
            expect(url.searchParams.get('prompt')).toBe('consent');
            expect(url.searchParams.get('state')).toBe('state-xyz');
        });

        it('getAuthorizationRequirements returns oauth2 with the authorize URL', () => {
            const api = makeApi();
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain(
                'https://accounts.google.com/o/oauth2/v2/auth'
            );
        });

        it('addAuthHeaders sets Bearer and JSON content type', async () => {
            const api = makeApi({ access_token: 'tok-abc' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer tok-abc');
            expect(headers['Content-Type']).toBe('application/json');
        });
    });

    describe('property id normalization', () => {
        it('strips a properties/ prefix', () => {
            const api = makeApi();
            expect(api._propertyId('properties/1234')).toBe('1234');
            expect(api._propertyId('1234')).toBe('1234');
            expect(api._propertyId(0)).toBe('0');
        });
    });

    describe('Reports', () => {
        it('runReport POSTs to :runReport with the body', async () => {
            const api = makeApi();
            const body = {
                dateRanges: [{ startDate: '7daysAgo', endDate: 'yesterday' }],
                dimensions: [{ name: 'country' }],
                metrics: [{ name: 'activeUsers' }],
            };
            await api.runReport('1234', body);
            const req = api.sent[0];
            expect(req.method).toBe('POST');
            expect(req.url).toBe(
                'https://analyticsdata.googleapis.com/v1beta/properties/1234:runReport'
            );
            expect(req.body).toEqual(body);
        });

        it('runReport accepts a properties/ resource name', async () => {
            const api = makeApi();
            await api.runReport('properties/999', { metrics: [] });
            expect(api.sent[0].url).toBe(
                'https://analyticsdata.googleapis.com/v1beta/properties/999:runReport'
            );
        });

        it('batchRunReports POSTs { requests } to :batchRunReports', async () => {
            const api = makeApi();
            const requests = [
                { metrics: [{ name: 'activeUsers' }] },
                { metrics: [{ name: 'sessions' }] },
            ];
            await api.batchRunReports(555, requests);
            const req = api.sent[0];
            expect(req.method).toBe('POST');
            expect(req.url).toBe(
                'https://analyticsdata.googleapis.com/v1beta/properties/555:batchRunReports'
            );
            expect(req.body).toEqual({ requests });
        });
    });

    describe('Metadata', () => {
        it('getMetadata GETs /properties/{id}/metadata', async () => {
            const api = makeApi();
            await api.getMetadata('1234');
            expect(api.sent[0].method).toBe('GET');
            expect(api.sent[0].url).toBe(
                'https://analyticsdata.googleapis.com/v1beta/properties/1234/metadata'
            );
        });

        it('getMetadata supports property id 0 for universal metadata', async () => {
            const api = makeApi();
            await api.getMetadata(0);
            expect(api.sent[0].url).toBe(
                'https://analyticsdata.googleapis.com/v1beta/properties/0/metadata'
            );
        });
    });

    describe('Identity & testAuth', () => {
        it('getUserDetails GETs Google oauth2 userinfo', async () => {
            const api = makeApi();
            await api.getUserDetails();
            expect(api.sent[0].url).toBe(
                'https://www.googleapis.com/oauth2/v2/userinfo'
            );
        });

        it('getTokenIdentity maps id/email/name', async () => {
            const api = makeApi();
            const identity = await api.getTokenIdentity();
            expect(identity).toEqual({
                identifier: 'user-1',
                name: 'Analyst',
                email: 'analyst@example.com',
            });
        });

        it('testAuth probes getMetadata(0)', async () => {
            const api = makeApi();
            await api.testAuth();
            expect(api.sent[0].url).toBe(
                'https://analyticsdata.googleapis.com/v1beta/properties/0/metadata'
            );
        });
    });
});
