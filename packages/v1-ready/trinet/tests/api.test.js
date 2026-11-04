const crypto = require('crypto');
const { Api } = require('../api');

// Fully offline: stub _get/_post and assert on request options.
function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csec',
        redirect_uri: 'https://app.example.com/redirect/trinet',
        access_token: 'tok',
        refresh_token: 'rtok',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { status: 200, data: {} };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { access_token: 'new', refresh_token: 'newr', expires_in: 2592000 };
    };
    return api;
}

describe('TriNet Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and OAuth endpoints', () => {
            const api = new Api({
                client_id: 'a',
                client_secret: 'b',
                redirect_uri: 'https://x/trinet',
            });
            expect(api.baseUrl).toBe('https://api.trinet.com');
            expect(api.tokenUri).toBe('https://secure.trinet.com/oauth2/token/');
            expect(api.authorizationUri).toContain(
                'https://secure.trinet.com/oauth2/platform-authorize/'
            );
            expect(api.authorizationUri).toContain('response_type=code');
            expect(api.authorizationUri).toContain('client_id=a');
        });

        it('adds the Bearer auth header', async () => {
            const api = new Api({ access_token: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
        });

        it('getTokenFromCode posts form body without scope', async () => {
            const api = makeApi();
            await api.getTokenFromCode('auth-code');
            const { body, url, headers } = api._captured[0];
            expect(url).toBe('https://secure.trinet.com/oauth2/token/');
            expect(headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            const params = new URLSearchParams(body.toString());
            expect(params.get('grant_type')).toBe('authorization_code');
            expect(params.get('code')).toBe('auth-code');
            expect(params.get('client_id')).toBe('cid');
            expect(params.get('client_secret')).toBe('csec');
            expect(params.get('redirect_uri')).toBe(
                'https://app.example.com/redirect/trinet'
            );
            expect(params.has('scope')).toBe(false);
        });

        it('refreshAccessToken omits redirect_uri', async () => {
            const api = makeApi();
            await api.refreshAccessToken({ refresh_token: 'rtok' });
            const params = new URLSearchParams(api._captured[0].body.toString());
            expect(params.get('grant_type')).toBe('refresh_token');
            expect(params.get('refresh_token')).toBe('rtok');
            expect(params.has('redirect_uri')).toBe(false);
        });
    });

    describe('identity & core reads', () => {
        it('getMe hits GET /core/me', async () => {
            const api = makeApi();
            await api.getMe({ includes: 'company' });
            expect(api._captured[0].url).toBe('https://api.trinet.com/core/me');
            expect(api._captured[0].query).toEqual({ includes: 'company' });
        });

        it('listCompanies / getCompany', async () => {
            const api = makeApi();
            await api.listCompanies({ limit: 20 });
            expect(api._captured[0].url).toBe(
                'https://api.trinet.com/core/companies'
            );
            await api.getCompany('48');
            expect(api._captured[1].url).toBe(
                'https://api.trinet.com/core/companies/48'
            );
        });

        it('listPeople / getPerson / listCompanyPeople', async () => {
            const api = makeApi();
            await api.listPeople({ status: 'active' });
            expect(api._captured[0].url).toBe(
                'https://api.trinet.com/core/people'
            );
            expect(api._captured[0].query.status).toBe('active');
            await api.getPerson('105024');
            expect(api._captured[1].url).toBe(
                'https://api.trinet.com/core/people/105024'
            );
            await api.listCompanyPeople('1');
            expect(api._captured[2].url).toBe(
                'https://api.trinet.com/core/companies/1/people'
            );
        });

        it('employments / departments / locations', async () => {
            const api = makeApi();
            await api.listEmployments();
            await api.getEmployment('1');
            await api.listPersonEmployments('2');
            await api.listDepartments();
            await api.getDepartment('9');
            await api.listCompanyDepartments('1');
            await api.listLocations();
            await api.getLocation('2');
            await api.listCompanyLocations('1');
            const urls = api._captured.map((c) => c.url);
            expect(urls).toEqual([
                'https://api.trinet.com/core/employments',
                'https://api.trinet.com/core/employments/1',
                'https://api.trinet.com/core/people/2/employments',
                'https://api.trinet.com/core/departments',
                'https://api.trinet.com/core/departments/9',
                'https://api.trinet.com/core/companies/1/departments',
                'https://api.trinet.com/core/locations',
                'https://api.trinet.com/core/locations/2',
                'https://api.trinet.com/core/companies/1/locations',
            ]);
        });
    });

    describe('platform & time off', () => {
        it('applications and company installs', async () => {
            const api = makeApi();
            await api.listApplications();
            await api.getApplication('app.1');
            await api.listCompanyInstalls({ status: 'ok' });
            await api.getCompanyInstall('137');
            expect(api._captured[0].url).toBe(
                'https://api.trinet.com/platform/applications'
            );
            expect(api._captured[3].url).toBe(
                'https://api.trinet.com/platform/company_installs/137'
            );
        });

        it('setCompanyInstallStatus POSTs status', async () => {
            const api = makeApi();
            await api.setCompanyInstallStatus('1', { status: 'ok' });
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://api.trinet.com/platform/company_installs/1/status_changes/'
            );
            expect(captured.body).toEqual({ status: 'ok' });
        });

        it('setPersonSubscriptionStatus POSTs status', async () => {
            const api = makeApi();
            await api.setPersonSubscriptionStatus('9', { status: 'ok' });
            expect(api._captured[0].url).toBe(
                'https://api.trinet.com/platform/person_subscriptions/9/status_changes/'
            );
        });

        it('vacation requests', async () => {
            const api = makeApi();
            await api.listVacationRequests({ status: 'approved' });
            await api.getVacationRequest('1000');
            expect(api._captured[0].url).toBe(
                'https://api.trinet.com/time_off/vacation_requests'
            );
            expect(api._captured[1].url).toBe(
                'https://api.trinet.com/time_off/vacation_requests/1000'
            );
        });
    });

    describe('verifyWebhookSignature', () => {
        // Official test vector from https://developers.zenefits.com/reference/webhooks
        const SECRET =
            'lDVtBQnoRcqYv4fUeVD0oyzgsKWHGtqhatjBX5wXRFQzkVUCzBA571E4qUxvR5LE';
        const PAYLOAD = '{"test":"valid payload"}';
        const EXPECTED =
            '219a08ea32f319931dc849badc076323f40367aad859ddba4de82e33135fad31';

        it('accepts the official docs test vector', () => {
            const api = new Api({});
            expect(
                api.verifyWebhookSignature({
                    rawBody: PAYLOAD,
                    headers: { Signature: EXPECTED },
                    secret: SECRET,
                })
            ).toEqual({ valid: true });
        });

        it('rejects a wrong signature', () => {
            const api = new Api({});
            const result = api.verifyWebhookSignature({
                rawBody: PAYLOAD,
                headers: { signature: 'deadbeef' },
                secret: SECRET,
            });
            expect(result.valid).toBe(false);
        });

        it('matches a locally computed HMAC', () => {
            const api = new Api({});
            const body = JSON.stringify({ type: 'people.did_create' });
            const sig = crypto
                .createHmac('sha256', SECRET)
                .update(body, 'utf8')
                .digest('hex');
            expect(
                api.verifyWebhookSignature({
                    rawBody: body,
                    headers: { signature: sig },
                    secret: SECRET,
                }).valid
            ).toBe(true);
        });
    });
});
