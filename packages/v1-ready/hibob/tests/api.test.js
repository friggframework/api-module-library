const crypto = require('crypto');
const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        service_user_id: 'su-id',
        service_user_token: 'su-token',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return {};
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { employees: [] };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return {};
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('HiBob Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and maps service user onto Basic auth', () => {
            const api = new Api({
                service_user_id: 'id1',
                service_user_token: 'tok1',
            });
            expect(api.baseUrl).toBe('https://api.hibob.com/v1');
            expect(api.username).toBe('id1');
            expect(api.password).toBe('tok1');
            expect(api.service_user_id).toBe('id1');
            expect(api.service_user_token).toBe('tok1');
        });

        it('accepts base_url override (sandbox)', () => {
            const api = new Api({
                service_user_id: 'a',
                service_user_token: 'b',
                base_url: 'https://api.sandbox.hibob.com/v1',
            });
            expect(api.baseUrl).toBe('https://api.sandbox.hibob.com/v1');
        });

        it('adds Basic Authorization header via BasicAuthRequester', async () => {
            const api = new Api({
                service_user_id: 'user',
                service_user_token: 'secret',
            });
            const headers = await api.addAuthHeaders({});
            const expected = Buffer.from('user:secret').toString('base64');
            expect(headers.Authorization || headers.authorization).toBe(
                `Basic ${expected}`
            );
        });
    });

    describe('people', () => {
        it('searchPeople POSTs to /people/search', async () => {
            const api = makeApi();
            const body = { fields: ['root.id'], showInactive: false };
            await api.searchPeople(body);
            expect(api._captured[0]).toMatchObject({
                method: 'POST',
                url: 'https://api.hibob.com/v1/people/search',
                body,
            });
        });

        it('getPerson POSTs to /people/{identifier}', async () => {
            const api = makeApi();
            await api.getPerson('emp-1', { fields: ['root.email'] });
            expect(api._captured[0].url).toBe(
                'https://api.hibob.com/v1/people/emp-1'
            );
            expect(api._captured[0].body).toEqual({ fields: ['root.email'] });
        });

        it('createPerson POSTs to /people', async () => {
            const api = makeApi();
            const body = {
                email: 'a@b.com',
                firstName: 'A',
                surname: 'B',
                work: { site: 'NY', startDate: '2024-01-01' },
            };
            await api.createPerson(body);
            expect(api._captured[0]).toMatchObject({
                method: 'POST',
                url: 'https://api.hibob.com/v1/people',
                body,
            });
        });

        it('updatePerson PUTs to /people/{identifier}', async () => {
            const api = makeApi();
            await api.updatePerson('emp-2', { firstName: 'Pat' });
            expect(api._captured[0]).toMatchObject({
                method: 'PUT',
                url: 'https://api.hibob.com/v1/people/emp-2',
                body: { firstName: 'Pat' },
            });
        });

        it('listProfiles GETs /profiles', async () => {
            const api = makeApi();
            await api.listProfiles();
            expect(api._captured[0].url).toBe(
                'https://api.hibob.com/v1/profiles'
            );
        });
    });

    describe('metadata', () => {
        it('listEmployeeFields GETs /company/people/fields', async () => {
            const api = makeApi();
            await api.listEmployeeFields();
            expect(api._captured[0].url).toBe(
                'https://api.hibob.com/v1/company/people/fields'
            );
        });

        it('listNamedLists GETs /company/named-lists', async () => {
            const api = makeApi();
            await api.listNamedLists({ includeArchived: true });
            expect(api._captured[0].url).toBe(
                'https://api.hibob.com/v1/company/named-lists'
            );
            expect(api._captured[0].query).toEqual({ includeArchived: true });
        });

        it('getNamedList GETs /company/named-lists/{listName}', async () => {
            const api = makeApi();
            await api.getNamedList('site');
            expect(api._captured[0].url).toBe(
                'https://api.hibob.com/v1/company/named-lists/site'
            );
        });
    });

    describe('time off', () => {
        it('listTimeOffChanges GETs /timeoff/requests/changes', async () => {
            const api = makeApi();
            await api.listTimeOffChanges({
                since: '2024-01-01',
                includePending: true,
            });
            expect(api._captured[0].url).toBe(
                'https://api.hibob.com/v1/timeoff/requests/changes'
            );
            expect(api._captured[0].query).toEqual({
                since: '2024-01-01',
                includePending: true,
            });
        });

        it('getTimeOffRequest GETs the request path', async () => {
            const api = makeApi();
            await api.getTimeOffRequest('e1', 'r1');
            expect(api._captured[0].url).toBe(
                'https://api.hibob.com/v1/timeoff/employees/e1/requests/r1'
            );
        });

        it('createTimeOffRequest POSTs to the requests path', async () => {
            const api = makeApi();
            const body = {
                requestRangeType: 'days',
                policyType: 'Holiday',
                startDate: '2024-06-01',
                endDate: '2024-06-02',
            };
            await api.createTimeOffRequest('e1', body);
            expect(api._captured[0]).toMatchObject({
                method: 'POST',
                url: 'https://api.hibob.com/v1/timeoff/employees/e1/requests',
                body,
            });
        });

        it('cancelTimeOffRequest DELETEs the request path', async () => {
            const api = makeApi();
            await api.cancelTimeOffRequest('e1', 'r9');
            expect(api._captured[0]).toMatchObject({
                method: 'DELETE',
                url: 'https://api.hibob.com/v1/timeoff/employees/e1/requests/r9',
            });
        });

        it('listWhosOut / listOutToday / getTimeOffBalance / listPolicyTypes', async () => {
            const api = makeApi();
            await api.listWhosOut({ from: '2024-01-01', to: '2024-01-31' });
            await api.listOutToday({ today: '2024-01-15' });
            await api.getTimeOffBalance('e1', {
                policyType: 'Holiday',
                date: '2024-01-15',
            });
            await api.listPolicyTypes();
            expect(api._captured.map((c) => c.url)).toEqual([
                'https://api.hibob.com/v1/timeoff/whosout',
                'https://api.hibob.com/v1/timeoff/outtoday',
                'https://api.hibob.com/v1/timeoff/employees/e1/balance',
                'https://api.hibob.com/v1/timeoff/policy-types',
            ]);
        });
    });

    describe('resolveCompanyId', () => {
        it('returns configured company_id without calling the API', async () => {
            const api = makeApi({ company_id: '637323' });
            const id = await api.resolveCompanyId();
            expect(id).toBe('637323');
            expect(api._captured).toHaveLength(0);
        });

        it('derives companyId from searchPeople employees', async () => {
            const api = makeApi();
            api._post = async () => ({
                employees: [{ id: '1', companyId: 999001 }],
            });
            const id = await api.resolveCompanyId();
            expect(id).toBe('999001');
            expect(api.company_id).toBe('999001');
        });
    });

    describe('verifyWebhookSignature', () => {
        it('accepts a valid HMAC-SHA512 Base64 Bob-Signature', () => {
            const api = new Api({
                service_user_id: 'a',
                service_user_token: 'b',
            });
            const secret = 'webhook-secret';
            const rawBody = JSON.stringify({
                companyId: 1,
                type: 'employee.created',
                data: { employeeId: 'e1' },
            });
            const signature = crypto
                .createHmac('sha512', secret)
                .update(rawBody, 'utf8')
                .digest('base64');
            const result = api.verifyWebhookSignature({
                req: {
                    headers: { 'bob-signature': signature },
                    rawBody,
                    body: JSON.parse(rawBody),
                },
                secret,
            });
            expect(result.valid).toBe(true);
        });

        it('rejects a tampered body', () => {
            const api = new Api({
                service_user_id: 'a',
                service_user_token: 'b',
            });
            const secret = 'webhook-secret';
            const signature = crypto
                .createHmac('sha512', secret)
                .update('{"ok":true}', 'utf8')
                .digest('base64');
            const result = api.verifyWebhookSignature({
                req: {
                    headers: { 'Bob-Signature': signature },
                    rawBody: '{"ok":false}',
                },
                secret,
            });
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('signature mismatch');
        });
    });
});
