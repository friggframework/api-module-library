const { Api } = require('../api');

function makeApi(
    params = { api_key: 'test-key', companyDomain: 'acme' }
) {
    const api = new Api(params);
    api._captured = [];
    const record = (method) => async (options) => {
        api._captured.push({ method, ...options });
        return { ok: true };
    };
    api._get = record('GET');
    api._post = record('POST');
    api._put = record('PUT');
    api._delete = record('DELETE');
    return api;
}

describe('BambooHR Api', () => {
    describe('construction & auth', () => {
        it('maps api_key onto Basic auth username and defaults password to x', () => {
            const api = new Api({
                api_key: 'ak',
                companyDomain: 'acme',
            });
            expect(api.api_key).toBe('ak');
            expect(api.username).toBe('ak');
            expect(api.password).toBe('x');
            expect(api.companyDomain).toBe('acme');
            expect(api.baseUrl).toBe('https://acme.bamboohr.com/api/v1');
        });

        it('uses the template baseUrl when companyDomain is missing', () => {
            const api = new Api({ api_key: 'ak' });
            expect(api.baseUrl).toBe(
                'https://{companyDomain}.bamboohr.com/api/v1'
            );
        });

        it('builds the Base64(apiKey:password) Basic header', async () => {
            const api = new Api({
                api_key: 'ak',
                api_password: 'x',
                companyDomain: 'acme',
            });
            const headers = await api.addAuthHeaders({});
            const expected =
                'Basic ' + Buffer.from('ak:x').toString('base64');
            expect(headers['Authorization']).toBe(expected);
        });

        it('accepts access_token as an alias for api_key', () => {
            const api = new Api({
                access_token: 'from-token',
                companyDomain: 'acme',
            });
            expect(api.api_key).toBe('from-token');
            expect(api.username).toBe('from-token');
        });

        it('setCompanyDomain rebuilds baseUrl', () => {
            const api = new Api({ api_key: 'ak', companyDomain: 'a' });
            api.setCompanyDomain('b');
            expect(api.baseUrl).toBe('https://b.bamboohr.com/api/v1');
        });

        it('addJsonHeaders sets Accept application/json', () => {
            const api = new Api({ api_key: 'ak', companyDomain: 'acme' });
            const opts = api.addJsonHeaders({});
            expect(opts.headers.Accept).toBe('application/json');
        });
    });

    describe('company', () => {
        it('getCompanyInformation GETs /company_information', async () => {
            const api = makeApi();
            await api.getCompanyInformation();
            expect(api._captured[0].method).toBe('GET');
            expect(api._captured[0].url).toBe(
                'https://acme.bamboohr.com/api/v1/company_information'
            );
        });
    });

    describe('employees', () => {
        it('listEmployees GETs /employees with query params', async () => {
            const api = makeApi();
            await api.listEmployees({ fields: 'workEmail', page: { size: 50 } });
            const req = api._captured[0];
            expect(req.method).toBe('GET');
            expect(req.url).toBe('https://acme.bamboohr.com/api/v1/employees');
            expect(req.query).toEqual({
                fields: 'workEmail',
                page: { size: 50 },
            });
        });

        it('getEmployee GETs /employees/{id}', async () => {
            const api = makeApi();
            await api.getEmployee('42', { fields: 'firstName,lastName' });
            expect(api._captured[0].url).toBe(
                'https://acme.bamboohr.com/api/v1/employees/42'
            );
            expect(api._captured[0].query).toEqual({
                fields: 'firstName,lastName',
            });
        });

        it('createEmployee POSTs /employees with body', async () => {
            const api = makeApi();
            const body = { firstName: 'Ada', lastName: 'Lovelace' };
            await api.createEmployee(body);
            const req = api._captured[0];
            expect(req.method).toBe('POST');
            expect(req.url).toBe('https://acme.bamboohr.com/api/v1/employees');
            expect(req.body).toEqual(body);
        });

        it('updateEmployee POSTs /employees/{id} with body', async () => {
            const api = makeApi();
            await api.updateEmployee('9', { jobTitle: 'Engineer' });
            const req = api._captured[0];
            expect(req.method).toBe('POST');
            expect(req.url).toBe(
                'https://acme.bamboohr.com/api/v1/employees/9'
            );
            expect(req.body).toEqual({ jobTitle: 'Engineer' });
        });

        it('getEmployeesDirectory GETs /employees/directory', async () => {
            const api = makeApi();
            await api.getEmployeesDirectory({ onlyCurrent: true });
            expect(api._captured[0].url).toBe(
                'https://acme.bamboohr.com/api/v1/employees/directory'
            );
            expect(api._captured[0].query).toEqual({ onlyCurrent: true });
        });

        it('getChangedEmployeeIds GETs /employees/changed', async () => {
            const api = makeApi();
            await api.getChangedEmployeeIds({
                since: '2026-01-01T00:00:00Z',
                type: 'inserted',
            });
            expect(api._captured[0].url).toBe(
                'https://acme.bamboohr.com/api/v1/employees/changed'
            );
            expect(api._captured[0].query).toEqual({
                since: '2026-01-01T00:00:00Z',
                type: 'inserted',
            });
        });
    });

    describe('fields', () => {
        it('listFields GETs /meta/fields', async () => {
            const api = makeApi();
            await api.listFields();
            expect(api._captured[0].url).toBe(
                'https://acme.bamboohr.com/api/v1/meta/fields'
            );
        });
    });

    describe('webhooks', () => {
        it('listWebhooks GETs /webhooks', async () => {
            const api = makeApi();
            await api.listWebhooks();
            expect(api._captured[0].url).toBe(
                'https://acme.bamboohr.com/api/v1/webhooks'
            );
        });

        it('createWebhook POSTs /webhooks with body', async () => {
            const api = makeApi();
            const body = {
                name: 'Sync',
                url: 'https://hook.example.com',
                format: 'json',
                monitorFields: ['firstName'],
            };
            await api.createWebhook(body);
            const req = api._captured[0];
            expect(req.method).toBe('POST');
            expect(req.url).toBe(
                'https://acme.bamboohr.com/api/v1/webhooks'
            );
            expect(req.body).toEqual(body);
        });

        it('getWebhook GETs /webhooks/{id}', async () => {
            const api = makeApi();
            await api.getWebhook('4');
            expect(api._captured[0].url).toBe(
                'https://acme.bamboohr.com/api/v1/webhooks/4'
            );
        });

        it('updateWebhook PUTs /webhooks/{id}', async () => {
            const api = makeApi();
            await api.updateWebhook('4', { name: 'Renamed' });
            const req = api._captured[0];
            expect(req.method).toBe('PUT');
            expect(req.url).toBe(
                'https://acme.bamboohr.com/api/v1/webhooks/4'
            );
            expect(req.body).toEqual({ name: 'Renamed' });
        });

        it('deleteWebhook DELETEs /webhooks/{id}', async () => {
            const api = makeApi();
            await api.deleteWebhook('4');
            expect(api._captured[0].method).toBe('DELETE');
            expect(api._captured[0].url).toBe(
                'https://acme.bamboohr.com/api/v1/webhooks/4'
            );
        });

        it('listMonitorFields GETs /webhooks/monitor_fields', async () => {
            const api = makeApi();
            await api.listMonitorFields();
            expect(api._captured[0].url).toBe(
                'https://acme.bamboohr.com/api/v1/webhooks/monitor_fields'
            );
        });
    });
});
