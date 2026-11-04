const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        api_key: 'test-key',
        siteNumber: 'agency123',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { results: { clients: [] }, errors: null };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { results: {}, errors: null };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return { results: {}, errors: null };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { results: {}, errors: null };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return undefined;
    };
    return api;
}

describe('AxisCare Api', () => {
    describe('construction & auth', () => {
        it('builds the per-site base URL and Bearer Authorization header', () => {
            const api = new Api({ api_key: 'abc', siteNumber: 'site9' });
            expect(api.baseUrl).toBe('https://site9.axiscare.com');
            expect(api.api_key_name).toBe('Authorization');
            expect(api.api_key).toBe('Bearer abc');
            expect(api.api_key_raw).toBe('abc');
            expect(api.siteNumber).toBe('site9');
        });

        it('uses the OpenAPI template base URL when siteNumber is missing', () => {
            const api = new Api({ api_key: 'abc' });
            expect(api.baseUrl).toBe('https://{siteNumber}.axiscare.com');
        });

        it('strips a pre-existing Bearer prefix', () => {
            const api = new Api({ api_key: 'Bearer already' });
            expect(api.api_key_raw).toBe('already');
            expect(api.api_key).toBe('Bearer already');
        });

        it('accepts access_token as an alias for api_key', () => {
            const api = new Api({ access_token: 'from-token' });
            expect(api.api_key_raw).toBe('from-token');
        });

        it('adds the Authorization Bearer auth header', async () => {
            const api = new Api({ api_key: 'secret', siteNumber: 's1' });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
        });

        it('setSiteNumber rebuilds the base URL', () => {
            const api = new Api({ api_key: 'k', siteNumber: 'a' });
            api.setSiteNumber('b');
            expect(api.baseUrl).toBe('https://b.axiscare.com');
        });

        it('setSiteNumber rejects an empty value', () => {
            const api = new Api({ api_key: 'k', siteNumber: 'a' });
            expect(() => api.setSiteNumber('')).toThrow(/Site number/);
        });

        it('sends the required API version header', async () => {
            const api = makeApi();
            await api.listClients();
            expect(api._captured[0].headers['X-AxisCare-Api-Version']).toBe(
                '2023-10-01'
            );
            expect(Api.API_KEY_VERSION).toBe('2023-10-01');
        });
    });

    describe('clients', () => {
        it('listClients hits GET /api/clients', async () => {
            const api = makeApi();
            await api.listClients({ limit: 10 });
            expect(api._captured[0].url).toBe(
                'https://agency123.axiscare.com/api/clients'
            );
            expect(api._captured[0].query).toEqual({ limit: 10 });
        });

        it('createClient POSTs the body', async () => {
            const api = makeApi();
            const body = { firstName: 'Ada', lastName: 'Lovelace' };
            await api.createClient(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual(body);
        });

        it('getClient and updateClient hit the id path', async () => {
            const api = makeApi();
            await api.getClient(42);
            await api.updateClient(42, { status: 'Active' });
            expect(api._captured[0].url).toBe(
                'https://agency123.axiscare.com/api/clients/42'
            );
            expect(api._captured[1].method).toBe('PATCH');
        });

        it('responsible-party helpers hit nested paths', async () => {
            const api = makeApi();
            await api.listClientResponsibleParties(7);
            await api.getClientResponsibleParty(7, 1);
            await api.updateClientResponsibleParty(7, 2, { name: 'Pat' });
            expect(api._captured[0].url).toContain(
                '/api/clients/7/responsibleParties'
            );
            expect(api._captured[1].url).toContain(
                '/api/clients/7/responsibleParties/1'
            );
            expect(api._captured[2].method).toBe('PUT');
        });
    });

    describe('leads / caregivers / applicants', () => {
        it('listLeads / createLead / getLead / updateLead', async () => {
            const api = makeApi();
            await api.listLeads();
            await api.createLead({ firstName: 'A', lastName: 'B' });
            await api.getLead(9);
            await api.updateLead(9, { status: 'Active' });
            expect(api._captured[0].url).toContain('/api/leads');
            expect(api._captured[2].url).toContain('/api/leads/9');
            expect(api._captured[3].method).toBe('PATCH');
        });

        it('getCaregiver unwraps results.data', async () => {
            const api = makeApi();
            api._get = async () => ({
                results: { data: { id: 5, firstName: 'Care' } },
                errors: null,
            });
            const out = await api.getCaregiver(5);
            expect(out).toEqual({
                results: { id: 5, firstName: 'Care' },
                errors: null,
            });
        });

        it('getApplicant unwraps results.data', async () => {
            const api = makeApi();
            api._get = async () => ({
                results: { data: { id: 3, firstName: 'App' } },
                errors: null,
            });
            const out = await api.getApplicant(3);
            expect(out.results.id).toBe(3);
        });
    });

    describe('visits & call logs', () => {
        it('listVisits / createVisit / getVisit / updateVisit / deleteVisit', async () => {
            const api = makeApi();
            const visitId = 's=222:d=2024-03-04';
            await api.listVisits({ startDate: '2024-01-01', endDate: '2024-01-31' });
            await api.createVisit({
                clientId: 1,
                visitDate: '2024-03-04',
                startTime: '09:00',
                endTime: '10:00',
            });
            await api.getVisit(visitId);
            await api.updateVisit(visitId, { startTime: '09:30' });
            await api.deleteVisit(visitId, { modificationReason: 1 });
            expect(api._captured[0].url).toContain('/api/visits');
            expect(api._captured[2].url).toContain(`/api/visits/${visitId}`);
            expect(api._captured[4].method).toBe('DELETE');
        });

        it('call log CRUD hits /api/call-logs', async () => {
            const api = makeApi();
            await api.listCallLogs({ limit: 10 });
            await api.createCallLog({
                callerName: 'Sam',
                callerPhone: '555',
                followUp: false,
                dateTime: '2025-07-01T15:23:45-05:00',
                subject: 'Intake',
                notes: 'Called',
                tags: [],
            });
            await api.getCallLog(11);
            await api.updateCallLog(11, { followUpDone: true });
            expect(api._captured[0].url).toContain('/api/call-logs');
            expect(api._captured[2].url).toContain('/api/call-logs/11');
            expect(api._captured[3].method).toBe('PATCH');
        });
    });

    describe('getFromUrl', () => {
        it('GETs the absolute nextPage URL with the version header', async () => {
            const api = makeApi();
            const next =
                'https://agency123.axiscare.com/api/clients?startAfterId=100&limit=50';
            await api.getFromUrl(next);
            expect(api._captured[0].url).toBe(next);
            expect(api._captured[0].headers['X-AxisCare-Api-Version']).toBe(
                '2023-10-01'
            );
        });
    });
});
