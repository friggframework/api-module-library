const { Api, DEFAULT_BASE_URL } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        api_key: 'test-key',
        base_url: 'https://acme.gainsightcloud.com',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { result: true, data: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { result: true, data: [] };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { result: true, data: [] };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return { result: true };
    };
    return api;
}

describe('Gainsight Api', () => {
    describe('construction & auth', () => {
        it('sets default base URL and accesskey header name', () => {
            const api = new Api({ api_key: 'abc' });
            expect(api.baseUrl).toBe(DEFAULT_BASE_URL);
            expect(api.api_key_name).toBe('accesskey');
            expect(api.api_key).toBe('abc');
        });

        it('accepts access_key as an alias for api_key', () => {
            const api = new Api({ access_key: 'from-access' });
            expect(api.api_key).toBe('from-access');
        });

        it('strips trailing slash from base_url', () => {
            const api = new Api({
                api_key: 'k',
                base_url: 'https://acme.gainsightcloud.com/',
            });
            expect(api.baseUrl).toBe('https://acme.gainsightcloud.com');
        });

        it('adds the accesskey auth header', async () => {
            const api = new Api({ api_key: 'secret' });
            const headers = await api.addAuthHeaders({});
            expect(headers.accesskey).toBe('secret');
        });

        it('reports authenticated only with a non-empty key', () => {
            expect(new Api({ api_key: 'x' }).isAuthenticated()).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });
    });

    describe('Company', () => {
        it('queryCompanies POSTs to query/Company', async () => {
            const api = makeApi();
            const body = { select: ['Name'], limit: 10 };
            await api.queryCompanies(body);
            expect(api._captured[0]).toMatchObject({
                method: 'POST',
                url: 'https://acme.gainsightcloud.com/v1/data/objects/query/Company',
                body,
            });
        });

        it('createCompanies POSTs to /Company', async () => {
            const api = makeApi();
            await api.createCompanies({ records: [{ Name: 'Acme' }] });
            expect(api._captured[0].url).toBe(
                'https://acme.gainsightcloud.com/v1/data/objects/Company'
            );
        });

        it('updateCompanies PUTs with keys query', async () => {
            const api = makeApi();
            await api.updateCompanies({ records: [{ Name: 'Acme' }] }, [
                'Name',
            ]);
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toContain('keys=Name');
        });

        it('deleteCompany DELETEs by GSID', async () => {
            const api = makeApi();
            await api.deleteCompany('GSID1');
            expect(api._captured[0].url).toBe(
                'https://acme.gainsightcloud.com/v1/data/objects/Company/GSID1'
            );
        });
    });

    describe('People', () => {
        it('getPersonByEmail uses Email query', async () => {
            const api = makeApi();
            await api.getPersonByEmail('a@b.com');
            expect(api._captured[0].url).toBe(
                'https://acme.gainsightcloud.com/v1/peoplemgmt/v1.0/people?Email=a%40b.com'
            );
        });

        it('getPersonByGsid uses path param', async () => {
            const api = makeApi();
            await api.getPersonByGsid('P1');
            expect(api._captured[0].url).toBe(
                'https://acme.gainsightcloud.com/v1/peoplemgmt/v1.0/people/P1'
            );
        });

        it('upsertPeople PUTs to people', async () => {
            const api = makeApi();
            await api.upsertPeople({ Email: 'a@b.com' });
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].url).toBe(
                'https://acme.gainsightcloud.com/v1/peoplemgmt/v1.0/people'
            );
        });
    });

    describe('Users & metadata', () => {
        it('listUsers POSTs to users/services/list', async () => {
            const api = makeApi();
            await api.listUsers({ select: ['Email'], limit: 25 });
            expect(api._captured[0].url).toBe(
                'https://acme.gainsightcloud.com/v1/users/services/list'
            );
        });

        it('listObjects GETs meta objects list', async () => {
            const api = makeApi();
            await api.listObjects({ po: 'company' });
            expect(api._captured[0].url).toContain(
                '/v1/meta/services/objects/list?po=company'
            );
        });

        it('describeObject hits describe path', async () => {
            const api = makeApi();
            await api.describeObject('Company', { ic: true });
            expect(api._captured[0].url).toContain(
                '/v1/meta/services/objects/Company/describe?ic=true'
            );
        });
    });

    describe('Custom objects / health', () => {
        it('queryCustomObject POSTs to query/{objectName}', async () => {
            const api = makeApi();
            await api.queryCustomObject('scorecard_fact__gc', {
                select: ['Gsid'],
                limit: 10,
            });
            expect(api._captured[0].url).toBe(
                'https://acme.gainsightcloud.com/v1/data/objects/query/scorecard_fact__gc'
            );
        });
    });

    describe('Cockpit', () => {
        it('listCtas POSTs to cta/list', async () => {
            const api = makeApi();
            await api.listCtas({ pageSize: 100 });
            expect(api._captured[0].url).toBe(
                'https://acme.gainsightcloud.com/v2/cockpit/cta/list'
            );
        });

        it('listTasks GETs task list for CTA', async () => {
            const api = makeApi();
            await api.listTasks('CTA1', { pn: 1, ps: 500 });
            expect(api._captured[0].url).toBe(
                'https://acme.gainsightcloud.com/v2/cockpit/task/list/CTA1?pn=1&ps=500'
            );
        });

        it('createTask POSTs and updateTask PUTs', async () => {
            const api = makeApi();
            await api.createTask({ requests: [] });
            await api.updateTask({ requests: [] });
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[1].method).toBe('PUT');
            expect(api._captured[0].url).toBe(
                'https://acme.gainsightcloud.com/v2/cockpit/task'
            );
        });
    });

    describe('Timeline', () => {
        it('queryTimelineActivities POSTs to activity_timeline query', async () => {
            const api = makeApi();
            await api.queryTimelineActivities({ select: ['Gsid'], limit: 10 });
            expect(api._captured[0].url).toBe(
                'https://acme.gainsightcloud.com/v1/data/objects/query/activity_timeline'
            );
        });

        it('createTimelineActivities and getTimelineJobStatus', async () => {
            const api = makeApi();
            await api.createTimelineActivities({ records: [] });
            await api.getTimelineJobStatus('job-1');
            expect(api._captured[0].url).toContain('/v1/ant/es/activity/bulk');
            expect(api._captured[1].url).toContain(
                '/v1/ant/es/job/status/job-1'
            );
        });
    });
});
