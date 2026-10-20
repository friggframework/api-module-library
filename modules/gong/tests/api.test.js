const { Api } = require('../api');

function makeApi(params = { access_key: 'ak-123', access_key_secret: 'sk-123' }) {
    const api = new Api(params);
    // Capture requests instead of hitting the network.
    api.sent = [];
    const record = (method) => async (options) => {
        api.sent.push({ method, ...options });
        return { ok: true };
    };
    api._get = record('GET');
    api._post = record('POST');
    api._patch = record('PATCH');
    api._delete = record('DELETE');
    return api;
}

describe('Gong Api', () => {
    describe('auth', () => {
        it('maps access_key/access_key_secret onto Basic auth username/password', () => {
            const api = new Api({
                access_key: 'ak',
                access_key_secret: 'sk',
            });
            expect(api.access_key).toBe('ak');
            expect(api.access_key_secret).toBe('sk');
            expect(api.username).toBe('ak');
            expect(api.password).toBe('sk');
        });

        it('builds the Base64(accessKey:accessKeySecret) Basic header', async () => {
            const api = new Api({
                access_key: 'ak',
                access_key_secret: 'sk',
            });
            const headers = await api.addAuthHeaders({});
            const expected =
                'Basic ' + Buffer.from('ak:sk').toString('base64');
            expect(headers['Authorization']).toBe(expected);
        });

        it('defaults to the documented Gong base URL', () => {
            const api = new Api({ access_key: 'ak', access_key_secret: 'sk' });
            expect(api.baseUrl).toBe('https://api.gong.io/v2');
        });

        it('honors a company-specific base_url override', () => {
            const api = new Api({
                access_key: 'ak',
                access_key_secret: 'sk',
                base_url: 'https://us-55616.api.gong.io',
            });
            expect(api.baseUrl).toBe('https://us-55616.api.gong.io');
        });
    });

    describe('calls endpoints', () => {
        it('listCalls GETs /calls with date-range query params', async () => {
            const api = makeApi();
            await api.listCalls({
                fromDateTime: '2026-08-01T00:00:00Z',
                toDateTime: '2026-08-19T00:00:00Z',
                cursor: 'abc',
            });
            const req = api.sent[0];
            expect(req.method).toBe('GET');
            expect(req.url).toBe('https://api.gong.io/v2/calls');
            expect(req.query).toEqual({
                fromDateTime: '2026-08-01T00:00:00Z',
                toDateTime: '2026-08-19T00:00:00Z',
                cursor: 'abc',
            });
        });

        it('getCall GETs /calls/{id}', async () => {
            const api = makeApi();
            await api.getCall('call-9');
            expect(api.sent[0].method).toBe('GET');
            expect(api.sent[0].url).toBe('https://api.gong.io/v2/calls/call-9');
        });

        it('listCallsExtensive POSTs the filter/contentSelector body to /calls/extensive', async () => {
            const api = makeApi();
            const body = {
                filter: { callIds: ['call-9'] },
                contentSelector: { exposedFields: { parties: true } },
            };
            await api.listCallsExtensive(body);
            const req = api.sent[0];
            expect(req.method).toBe('POST');
            expect(req.url).toBe('https://api.gong.io/v2/calls/extensive');
            expect(req.body).toEqual(body);
            expect(req.headers['Content-Type']).toBe('application/json');
        });

        it('getTranscripts POSTs to /calls/transcript', async () => {
            const api = makeApi();
            await api.getTranscripts({ filter: { callIds: ['call-9'] } });
            const req = api.sent[0];
            expect(req.method).toBe('POST');
            expect(req.url).toBe('https://api.gong.io/v2/calls/transcript');
            expect(req.body).toEqual({ filter: { callIds: ['call-9'] } });
        });
    });

    describe('users endpoints', () => {
        it('listUsers GETs /users with the includeAvatars flag', async () => {
            const api = makeApi();
            await api.listUsers({ includeAvatars: false });
            expect(api.sent[0].method).toBe('GET');
            expect(api.sent[0].url).toBe('https://api.gong.io/v2/users');
            expect(api.sent[0].query).toEqual({ includeAvatars: false });
        });

        it('getUser GETs /users/{id}', async () => {
            const api = makeApi();
            await api.getUser('user-1');
            expect(api.sent[0].url).toBe('https://api.gong.io/v2/users/user-1');
        });
    });

    describe('testAuth', () => {
        it('performs a lightweight authenticated users listing', async () => {
            const api = makeApi();
            await api.testAuth();
            expect(api.sent[0].method).toBe('GET');
            expect(api.sent[0].url).toBe('https://api.gong.io/v2/users');
        });
    });

    describe('getAuthorizationRequirements', () => {
        it('declares a basic requirement for access_key and access_key_secret', () => {
            const api = new Api({ access_key: 'ak', access_key_secret: 'sk' });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('basic');
            expect(reqs.data.jsonSchema.required).toEqual([
                'access_key',
                'access_key_secret',
            ]);
            expect(reqs.data.uiSchema.access_key_secret['ui:widget']).toBe(
                'password'
            );
        });
    });
});
