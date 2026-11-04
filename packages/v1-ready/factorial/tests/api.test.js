const { Api } = require('../api');
const {
    verifyFactorialChallenge,
} = require('../extensions/webhooks/signature-verifier');

const BASE = 'https://api.factorialhr.com/api/2026-10-01';

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://app.example/redirect/factorial',
        access_token: 'tok',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { data: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 1 };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { id: 1 };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Factorial Api', () => {
    describe('construction & auth', () => {
        it('sets the pinned version base URL and Factorial ID token URI', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://x/r',
            });
            expect(api.baseUrl).toBe(BASE);
            expect(api.tokenUri).toBe(
                'https://id.factorialhr.com/api/oauth/token'
            );
            expect(api.authorizationUri).toContain(
                'resource_owner_type=company'
            );
            expect(api.authorizationUri).toContain(
                'https://id.factorialhr.com/oauth/authorize'
            );
        });

        it('adds Bearer auth by default', async () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://x/r',
                access_token: 'abc',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer abc');
            expect(headers.Accept).toBe('application/json');
        });

        it('prefers x-api-key when api_key is set', async () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://x/r',
                access_token: 'abc',
                api_key: 'key-1',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers['x-api-key']).toBe('key-1');
            expect(headers.Authorization).toBeUndefined();
        });
    });

    describe('listCredentials / resolveCompanyId', () => {
        it('hits GET /resources/api_public/credentials', async () => {
            const api = makeApi();
            await api.listCredentials();
            expect(api._captured[0].url).toBe(BASE + '/resources/api_public/credentials');
        });

        it('resolveCompanyId caches company_id from credentials', async () => {
            const api = makeApi();
            api._get = async () => ({
                data: [{ company_id: 42, name: 'Acme' }],
            });
            const id = await api.resolveCompanyId();
            expect(id).toBe(42);
            expect(api.company_id).toBe(42);
            const again = await api.resolveCompanyId();
            expect(again).toBe(42);
        });
    });

    describe('employees', () => {
        it('listEmployees defaults only_active and only_managers', async () => {
            const api = makeApi();
            await api.listEmployees();
            const { url, query } = api._captured[0];
            expect(url).toBe(BASE + '/resources/employees/employees');
            expect(query.only_active).toBe(true);
            expect(query.only_managers).toBe(false);
        });

        it('getEmployee hits the employee path', async () => {
            const api = makeApi();
            await api.getEmployee(9);
            expect(api._captured[0].url).toBe(
                BASE + '/resources/employees/employees/9'
            );
        });

        it('createEmployeeWithContract POSTs to create_with_contract', async () => {
            const api = makeApi();
            const body = {
                company_id: 1,
                first_name: 'Ada',
                last_name: 'Lovelace',
                email: 'ada@example.com',
            };
            await api.createEmployeeWithContract(body);
            const cap = api._captured[0];
            expect(cap.method).toBe('POST');
            expect(cap.url).toBe(
                BASE + '/resources/employees/employees/create_with_contract'
            );
            expect(cap.body).toEqual(body);
        });

        it('updateEmployee PUTs with id in the body', async () => {
            const api = makeApi();
            await api.updateEmployee(5, { first_name: 'Ann' });
            const cap = api._captured[0];
            expect(cap.method).toBe('PUT');
            expect(cap.url).toBe(BASE + '/resources/employees/employees/5');
            expect(cap.body).toEqual({ id: 5, first_name: 'Ann' });
        });

        it('inviteEmployee / terminateEmployee / unterminateEmployee hit action paths', async () => {
            const api = makeApi();
            await api.inviteEmployee({ id: 1 });
            await api.terminateEmployee({ id: 1, terminated_on: '2026-01-01' });
            await api.unterminateEmployee({ id: 1 });
            expect(api._captured.map((c) => c.url)).toEqual([
                BASE + '/resources/employees/employees/invite',
                BASE + '/resources/employees/employees/terminate',
                BASE + '/resources/employees/employees/unterminate',
            ]);
        });
    });

    describe('legal entities', () => {
        it('list / get / create', async () => {
            const api = makeApi();
            await api.listLegalEntities();
            await api.getLegalEntity(3);
            await api.createLegalEntity({
                company_id: 1,
                country: 'es',
                legal_name: 'Acme SL',
                currency: 'EUR',
            });
            expect(api._captured[0].url).toBe(
                BASE + '/resources/companies/legal_entities'
            );
            expect(api._captured[1].url).toBe(
                BASE + '/resources/companies/legal_entities/3'
            );
            expect(api._captured[2].method).toBe('POST');
        });
    });

    describe('teams & memberships', () => {
        it('team CRUD paths', async () => {
            const api = makeApi();
            await api.listTeams();
            await api.getTeam(2);
            await api.createTeam({ name: 'Eng' });
            await api.updateTeam(2, { name: 'Engineering' });
            await api.deleteTeam(2);
            expect(api._captured.map((c) => c.method)).toEqual([
                'GET',
                'GET',
                'POST',
                'PUT',
                'DELETE',
            ]);
            expect(api._captured[2].url).toBe(BASE + '/resources/teams/teams');
        });

        it('membership CRUD paths', async () => {
            const api = makeApi();
            await api.listMemberships();
            await api.getMembership(8);
            await api.createMembership({ team_id: 1, employee_id: 2 });
            await api.updateMembership(8, { lead: true });
            await api.deleteMembership(8);
            expect(api._captured[2].body).toEqual({
                team_id: 1,
                employee_id: 2,
            });
        });
    });

    describe('locations', () => {
        it('location CRUD paths', async () => {
            const api = makeApi();
            await api.listLocations();
            await api.getLocation(4);
            await api.createLocation({
                name: 'HQ',
                country: 'es',
                timezone: 'Europe/Madrid',
                company_id: 1,
            });
            await api.updateLocation(4, { name: 'HQ2' });
            await api.deleteLocation(4);
            expect(api._captured[0].url).toBe(
                BASE + '/resources/locations/locations'
            );
            expect(api._captured[4].method).toBe('DELETE');
        });
    });

    describe('webhook subscriptions', () => {
        it('list / get / create / update / delete', async () => {
            const api = makeApi();
            await api.listWebhookSubscriptions({ company_id: 1 });
            await api.getWebhookSubscription(10);
            await api.createWebhookSubscription({
                subscription_type: 'employees/employee/update',
                target_url: 'https://hook.example/factorial',
                company_id: 1,
                challenge: 'secret',
            });
            await api.updateWebhookSubscription(10, { enabled: false });
            await api.deleteWebhookSubscription(10);
            expect(api._captured[0].url).toBe(
                BASE + '/resources/api_public/webhook_subscriptions'
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[3].method).toBe('PUT');
            expect(api._captured[4].method).toBe('DELETE');
        });

        it('verifyWebhookChallenge delegates to the challenge verifier', () => {
            const api = makeApi();
            const ok = api.verifyWebhookChallenge({
                challengeHeader: 'abc',
                challenge: 'abc',
            });
            expect(ok).toEqual({ valid: true });
            const bad = api.verifyWebhookChallenge({
                challengeHeader: 'nope',
                challenge: 'abc',
            });
            expect(bad.valid).toBe(false);
        });
    });

    describe('challenge verifier', () => {
        it('accepts a matching header and rejects mismatches', () => {
            expect(
                verifyFactorialChallenge({
                    challengeHeader: '2zal4e6d',
                    challenge: '2zal4e6d',
                })
            ).toEqual({ valid: true });
            expect(
                verifyFactorialChallenge({
                    req: { headers: { 'X-Factorial-Wh-Challenge': '2zal4e6d' } },
                    challenge: '2zal4e6d',
                }).valid
            ).toBe(true);
            expect(
                verifyFactorialChallenge({
                    challengeHeader: 'wrong',
                    challenge: '2zal4e6d',
                }).reason
            ).toMatch(/mismatch/);
            expect(
                verifyFactorialChallenge({ challenge: 'x' }).reason
            ).toMatch(/missing x-factorial-wh-challenge/i);
        });
    });
});
