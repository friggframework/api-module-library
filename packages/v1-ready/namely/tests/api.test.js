const { Api } = require('../api');

// Fully offline: stub the low-level HTTP methods and assert on the request
// options the API methods construct. No network is touched.
function makeApi(overrides = {}) {
    const api = new Api({
        company: 'acme',
        access_token: 'test-token',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { profiles: [], meta: { count: 0 } };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { profiles: [{ id: 'p1' }] };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { profiles: [{ id: 'p1' }] };
    };
    return api;
}

describe('Namely Api', () => {
    describe('construction & auth', () => {
        it('builds the tenant base URL from the company subdomain', () => {
            const api = new Api({ company: 'acme', access_token: 't' });
            expect(api.baseUrl).toBe('https://acme.namely.com/api/v1');
            expect(api.company).toBe('acme');
        });

        it('keeps the OpenAPI template host when company is unset', () => {
            const api = new Api({});
            expect(api.baseUrl).toBe('https://{company}.namely.com/api/v1');
        });

        it('sets Authorization Bearer from access_token', () => {
            const api = new Api({ company: 'acme', access_token: 'secret' });
            expect(api.api_key_name).toBe('Authorization');
            expect(api.api_key).toBe('Bearer secret');
            expect(api.access_token).toBe('secret');
        });

        it('strips a pre-existing Bearer prefix', () => {
            const api = new Api({
                company: 'acme',
                access_token: 'Bearer already',
            });
            expect(api.access_token).toBe('already');
            expect(api.api_key).toBe('Bearer already');
        });

        it('accepts api_token / api_key aliases', () => {
            expect(
                new Api({ company: 'a', api_token: 'from-token' }).access_token
            ).toBe('from-token');
            expect(
                new Api({ company: 'a', api_key: 'from-key' }).access_token
            ).toBe('from-key');
        });

        it('adds the Authorization auth header', async () => {
            const api = new Api({ company: 'acme', access_token: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
        });

        it('setCompany / setAccessToken update baseUrl and header', () => {
            const api = new Api({});
            api.setCompany('reed-sandbox');
            api.setAccessToken('tok');
            expect(api.baseUrl).toBe('https://reed-sandbox.namely.com/api/v1');
            expect(api.api_key).toBe('Bearer tok');
        });

        it('exposes an apiKey authorization form for company + access_token', () => {
            const api = new Api({});
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('apiKey');
            expect(reqs.data.jsonSchema.required).toEqual(
                expect.arrayContaining(['company', 'access_token'])
            );
        });
    });

    describe('identity', () => {
        it('getCompanyInfo hits GET /companies/info', async () => {
            const api = makeApi();
            await api.getCompanyInfo();
            expect(api._captured[0].url).toBe(
                'https://acme.namely.com/api/v1/companies/info'
            );
        });

        it('getCurrentProfile hits GET /profiles/me', async () => {
            const api = makeApi();
            await api.getCurrentProfile();
            expect(api._captured[0].url).toBe(
                'https://acme.namely.com/api/v1/profiles/me'
            );
        });
    });

    describe('profiles', () => {
        it('listProfiles hits GET /profiles with query', async () => {
            const api = makeApi();
            await api.listProfiles({
                page: 1,
                per_page: 20,
                'filter[user_status]': 'active',
            });
            const captured = api._captured[0];
            expect(captured.url).toBe(
                'https://acme.namely.com/api/v1/profiles'
            );
            expect(captured.query).toEqual({
                page: 1,
                per_page: 20,
                'filter[user_status]': 'active',
            });
        });

        it('getProfile hits GET /profiles/{id}', async () => {
            const api = makeApi();
            await api.getProfile('abc-123');
            expect(api._captured[0].url).toBe(
                'https://acme.namely.com/api/v1/profiles/abc-123'
            );
        });

        it('createProfile POSTs the profiles envelope', async () => {
            const api = makeApi();
            const body = {
                profiles: [
                    {
                        first_name: 'John',
                        last_name: 'Smith',
                        user_status: 'active',
                        start_date: '2026-01-01',
                        email: 'john@acme.com',
                    },
                ],
            };
            await api.createProfile(body);
            const captured = api._captured[0];
            expect(captured.method).toBe('POST');
            expect(captured.url).toBe(
                'https://acme.namely.com/api/v1/profiles'
            );
            expect(captured.body).toEqual(body);
        });

        it('updateProfile PUTs to /profiles/{id}', async () => {
            const api = makeApi();
            const body = { profiles: [{ first_name: 'Jane' }] };
            await api.updateProfile('p1', body);
            const captured = api._captured[0];
            expect(captured.method).toBe('PUT');
            expect(captured.url).toBe(
                'https://acme.namely.com/api/v1/profiles/p1'
            );
            expect(captured.body).toEqual(body);
        });

        it('listProfileFields hits GET /profiles/fields', async () => {
            const api = makeApi();
            await api.listProfileFields();
            expect(api._captured[0].url).toBe(
                'https://acme.namely.com/api/v1/profiles/fields'
            );
        });
    });

    describe('groups & teams', () => {
        it('listGroups / getGroup hit the groups paths', async () => {
            const api = makeApi();
            await api.listGroups();
            await api.getGroup('g1');
            expect(api._captured[0].url).toBe(
                'https://acme.namely.com/api/v1/groups'
            );
            expect(api._captured[1].url).toBe(
                'https://acme.namely.com/api/v1/groups/g1'
            );
        });

        it('listGroupTypes / getGroupType hit the group_types paths', async () => {
            const api = makeApi();
            await api.listGroupTypes();
            await api.getGroupType('gt1');
            expect(api._captured[0].url).toBe(
                'https://acme.namely.com/api/v1/group_types'
            );
            expect(api._captured[1].url).toBe(
                'https://acme.namely.com/api/v1/group_types/gt1'
            );
        });

        it('listTeams / getTeam hit the teams paths', async () => {
            const api = makeApi();
            await api.listTeams();
            await api.getTeam('t1');
            expect(api._captured[0].url).toBe(
                'https://acme.namely.com/api/v1/teams'
            );
            expect(api._captured[1].url).toBe(
                'https://acme.namely.com/api/v1/teams/t1'
            );
        });
    });

    describe('job titles & tiers', () => {
        it('list/get/create/update job titles', async () => {
            const api = makeApi();
            await api.listJobTitles();
            await api.getJobTitle('jt1');
            await api.createJobTitle({
                job_titles: [{ title: 'Engineer', parent: 'tier-1' }],
            });
            await api.updateJobTitle('jt1', {
                job_titles: [{ title: 'Senior Engineer' }],
            });
            expect(api._captured[0].url).toBe(
                'https://acme.namely.com/api/v1/job_titles'
            );
            expect(api._captured[1].url).toBe(
                'https://acme.namely.com/api/v1/job_titles/jt1'
            );
            expect(api._captured[2].method).toBe('POST');
            expect(api._captured[3].method).toBe('PUT');
        });

        it('listJobTiers / getJobTier hit the job_tiers paths', async () => {
            const api = makeApi();
            await api.listJobTiers();
            await api.getJobTier('tier-1');
            expect(api._captured[0].url).toBe(
                'https://acme.namely.com/api/v1/job_tiers'
            );
            expect(api._captured[1].url).toBe(
                'https://acme.namely.com/api/v1/job_tiers/tier-1'
            );
        });
    });

    describe('events', () => {
        it('listEvents hits GET /events with filters', async () => {
            const api = makeApi();
            await api.listEvents({
                limit: 10,
                'filter[type]': 'announcement',
                order: 'desc',
            });
            const captured = api._captured[0];
            expect(captured.url).toBe(
                'https://acme.namely.com/api/v1/events'
            );
            expect(captured.query).toEqual({
                limit: 10,
                'filter[type]': 'announcement',
                order: 'desc',
            });
        });

        it('getEvent hits GET /events/{id}', async () => {
            const api = makeApi();
            await api.getEvent('e1');
            expect(api._captured[0].url).toBe(
                'https://acme.namely.com/api/v1/events/e1'
            );
        });
    });
});
