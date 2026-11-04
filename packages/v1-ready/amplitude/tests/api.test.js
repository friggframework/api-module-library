const { Api, REGION_HOSTS, DEFAULT_PROFILE_BASE_URL } = require('../api');

function makeApi(
    params = { api_key: 'ak-123', secret_key: 'sk-123' }
) {
    const api = new Api(params);
    api.sent = [];
    const record = (method) => async (options) => {
        api.sent.push({ method, ...options });
        return { ok: true };
    };
    api._get = record('GET');
    api._post = record('POST');
    return api;
}

describe('Amplitude Api', () => {
    describe('auth', () => {
        it('maps api_key/secret_key onto Basic auth username/password', () => {
            const api = new Api({
                api_key: 'ak',
                secret_key: 'sk',
            });
            expect(api.api_key).toBe('ak');
            expect(api.secret_key).toBe('sk');
            expect(api.username).toBe('ak');
            expect(api.password).toBe('sk');
        });

        it('builds the Base64(api_key:secret_key) Basic header', async () => {
            const api = new Api({
                api_key: 'ak',
                secret_key: 'sk',
            });
            const headers = await api.addAuthHeaders({});
            const expected =
                'Basic ' + Buffer.from('ak:sk').toString('base64');
            expect(headers['Authorization']).toBe(expected);
        });

        it('defaults to the US Dashboard REST host', () => {
            const api = new Api({ api_key: 'ak', secret_key: 'sk' });
            expect(api.baseUrl).toBe(REGION_HOSTS.us);
            expect(api.baseUrl).toBe('https://amplitude.com');
        });

        it('selects the EU host when region=eu', () => {
            const api = new Api({
                api_key: 'ak',
                secret_key: 'sk',
                region: 'eu',
            });
            expect(api.baseUrl).toBe(REGION_HOSTS.eu);
            expect(api.baseUrl).toBe('https://analytics.eu.amplitude.com');
        });

        it('honors an explicit base_url override', () => {
            const api = new Api({
                api_key: 'ak',
                secret_key: 'sk',
                base_url: 'https://amplitude.com',
            });
            expect(api.baseUrl).toBe('https://amplitude.com');
        });

        it('defaults the User Profile host', () => {
            const api = new Api({ api_key: 'ak', secret_key: 'sk' });
            expect(api.profileBaseUrl).toBe(DEFAULT_PROFILE_BASE_URL);
        });
    });

    describe('Dashboard REST endpoints', () => {
        it('getEventSegmentation GETs /api/2/events/segmentation', async () => {
            const api = makeApi();
            await api.getEventSegmentation({
                e: '{"event_type":"_active"}',
                start: '20260801',
                end: '20260831',
                m: 'uniques',
            });
            const req = api.sent[0];
            expect(req.method).toBe('GET');
            expect(req.url).toBe(
                'https://amplitude.com/api/2/events/segmentation'
            );
            expect(req.query).toEqual({
                e: '{"event_type":"_active"}',
                start: '20260801',
                end: '20260831',
                m: 'uniques',
            });
        });

        it('getUserActivity GETs /api/2/useractivity', async () => {
            const api = makeApi();
            await api.getUserActivity({
                user: '123456789',
                offset: 0,
                limit: 100,
            });
            const req = api.sent[0];
            expect(req.url).toBe('https://amplitude.com/api/2/useractivity');
            expect(req.query).toEqual({
                user: '123456789',
                offset: 0,
                limit: 100,
            });
        });

        it('searchUsers GETs /api/2/usersearch', async () => {
            const api = makeApi();
            await api.searchUsers({ user: 'user@example.com' });
            expect(api.sent[0].url).toBe(
                'https://amplitude.com/api/2/usersearch'
            );
            expect(api.sent[0].query).toEqual({ user: 'user@example.com' });
        });

        it('listEvents GETs /api/2/events/list', async () => {
            const api = makeApi();
            await api.listEvents();
            expect(api.sent[0].url).toBe(
                'https://amplitude.com/api/2/events/list'
            );
        });
    });

    describe('Export', () => {
        it('exportEvents GETs /api/2/export with start/end', async () => {
            const api = makeApi();
            await api.exportEvents({
                start: '20260101T00',
                end: '20260102T00',
            });
            const req = api.sent[0];
            expect(req.url).toBe('https://amplitude.com/api/2/export');
            expect(req.query).toEqual({
                start: '20260101T00',
                end: '20260102T00',
            });
        });
    });

    describe('Cohorts', () => {
        it('listCohorts GETs /api/3/cohorts', async () => {
            const api = makeApi();
            await api.listCohorts({ includeSyncInfo: true });
            expect(api.sent[0].url).toBe('https://amplitude.com/api/3/cohorts');
            expect(api.sent[0].query).toEqual({ includeSyncInfo: true });
        });

        it('requestCohortExport GETs /api/5/cohorts/request/{cohortId}', async () => {
            const api = makeApi();
            await api.requestCohortExport('cohort-1', { props: 1 });
            expect(api.sent[0].url).toBe(
                'https://amplitude.com/api/5/cohorts/request/cohort-1'
            );
            expect(api.sent[0].query).toEqual({ props: 1 });
        });

        it('getCohortExportStatus GETs request-status path', async () => {
            const api = makeApi();
            await api.getCohortExportStatus('req-9');
            expect(api.sent[0].url).toBe(
                'https://amplitude.com/api/5/cohorts/request-status/req-9'
            );
        });

        it('downloadCohort GETs the export file path', async () => {
            const api = makeApi();
            await api.downloadCohort('req-9');
            expect(api.sent[0].url).toBe(
                'https://amplitude.com/api/5/cohorts/request/req-9/file'
            );
        });
    });

    describe('User Profile', () => {
        it('getUserProfile GETs the profile-api host', async () => {
            const api = makeApi();
            await api.getUserProfile({
                user_id: 'u-1',
                get_amp_props: true,
                get_cohort_ids: true,
            });
            const req = api.sent[0];
            expect(req.method).toBe('GET');
            expect(req.url).toBe(
                'https://profile-api.amplitude.com/v1/userprofile'
            );
            expect(req.query).toEqual({
                user_id: 'u-1',
                get_amp_props: true,
                get_cohort_ids: true,
            });
        });
    });

    describe('testAuth', () => {
        it('performs a lightweight authenticated events listing', async () => {
            const api = makeApi();
            await api.testAuth();
            expect(api.sent[0].method).toBe('GET');
            expect(api.sent[0].url).toBe(
                'https://amplitude.com/api/2/events/list'
            );
        });
    });

    describe('getAuthorizationRequirements', () => {
        it('declares a basic requirement for api_key and secret_key', () => {
            const api = new Api({ api_key: 'ak', secret_key: 'sk' });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('basic');
            expect(reqs.data.jsonSchema.required).toEqual([
                'api_key',
                'secret_key',
            ]);
            expect(reqs.data.uiSchema.secret_key['ui:widget']).toBe('password');
        });
    });
});
