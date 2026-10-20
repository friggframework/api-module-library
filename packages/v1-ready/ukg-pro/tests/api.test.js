const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        username: 'svc-user',
        password: 'svc-pass',
        customer_api_key: 'ABCDE',
        base_url: 'https://servicet.ultipro.com',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return [];
    };
    return api;
}

describe('UKG Pro Api', () => {
    describe('construction & auth', () => {
        it('sets the default base URL and credential fields', () => {
            const api = new Api({
                username: 'u',
                password: 'p',
                customer_api_key: 'KEY01',
            });
            expect(api.baseUrl).toBe('https://servicet.ultipro.com');
            expect(api.base_url).toBe('https://servicet.ultipro.com');
            expect(api.username).toBe('u');
            expect(api.password).toBe('p');
            expect(api.customer_api_key).toBe('KEY01');
        });

        it('accepts baseUrl / customerApiKey aliases and strips trailing slash', () => {
            const api = new Api({
                username: 'u',
                password: 'p',
                customerApiKey: 'ZZZZZ',
                baseUrl: 'https://service2.ultipro.com/',
            });
            expect(api.customer_api_key).toBe('ZZZZZ');
            expect(api.baseUrl).toBe('https://service2.ultipro.com');
        });

        it('adds Basic Authorization and US-Customer-Api-Key headers', async () => {
            const api = new Api({
                username: 'alice',
                password: 'secret',
                customer_api_key: 'CUS01',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe(
                'Basic ' + Buffer.from('alice:secret').toString('base64')
            );
            expect(headers['US-Customer-Api-Key']).toBe('CUS01');
        });

        it('reports authenticated only with username, password, and customer key', () => {
            expect(
                new Api({
                    username: 'u',
                    password: 'p',
                    customer_api_key: 'K',
                }).isAuthenticated()
            ).toBe(true);
            expect(
                new Api({ username: 'u', password: 'p' }).isAuthenticated()
            ).toBe(false);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });

        it('exposes a basic auth form via getAuthorizationRequirements', () => {
            const reqs = new Api({}).getAuthorizationRequirements();
            expect(reqs.type).toBe('basic');
            expect(reqs.data.jsonSchema.required).toEqual(
                expect.arrayContaining([
                    'username',
                    'password',
                    'customer_api_key',
                    'base_url',
                ])
            );
            expect(reqs.data.uiSchema.password['ui:widget']).toBe('password');
        });
    });

    describe('listCompanyDetails', () => {
        it('hits GET /configuration/v1/company-details', async () => {
            const api = makeApi();
            await api.listCompanyDetails({ page: 1, per_Page: 10 });
            expect(api._captured[0].url).toBe(
                'https://servicet.ultipro.com/configuration/v1/company-details'
            );
            expect(api._captured[0].query).toEqual({ page: 1, per_Page: 10 });
        });
    });

    describe('person details', () => {
        it('listPersonDetails hits GET /personnel/v1/person-details', async () => {
            const api = makeApi();
            await api.listPersonDetails({ lastName: 'Smith' });
            expect(api._captured[0].url).toBe(
                'https://servicet.ultipro.com/personnel/v1/person-details'
            );
            expect(api._captured[0].query.lastName).toBe('Smith');
        });

        it('getPersonDetailsByEmployeeId hits the employee path', async () => {
            const api = makeApi();
            await api.getPersonDetailsByEmployeeId('EE123');
            expect(api._captured[0].url).toBe(
                'https://servicet.ultipro.com/personnel/v1/person-details/EE123'
            );
        });

        it('getPersonDetails hits company + employee path', async () => {
            const api = makeApi();
            await api.getPersonDetails('C0014', 'EE123');
            expect(api._captured[0].url).toBe(
                'https://servicet.ultipro.com/personnel/v1/companies/C0014/employees/EE123/person-details'
            );
        });
    });

    describe('employment details', () => {
        it('listEmploymentDetails hits the list path', async () => {
            const api = makeApi();
            await api.listEmploymentDetails({ employeeStatusCode: 'A' });
            expect(api._captured[0].url).toBe(
                'https://servicet.ultipro.com/personnel/v1/employment-details'
            );
        });

        it('getEmploymentDetails hits company + employee path', async () => {
            const api = makeApi();
            await api.getEmploymentDetails('C0014', 'EE123');
            expect(api._captured[0].url).toBe(
                'https://servicet.ultipro.com/personnel/v1/companies/C0014/employees/EE123/employment-details'
            );
        });
    });

    describe('compensation details', () => {
        it('listCompensationDetails hits the list path', async () => {
            const api = makeApi();
            await api.listCompensationDetails({ page: 2 });
            expect(api._captured[0].url).toBe(
                'https://servicet.ultipro.com/personnel/v1/compensation-details'
            );
        });

        it('getCompensationDetails hits company + employee path', async () => {
            const api = makeApi();
            await api.getCompensationDetails('C0014', 'EE123');
            expect(api._captured[0].url).toBe(
                'https://servicet.ultipro.com/personnel/v1/companies/C0014/employees/EE123/compensation-details'
            );
        });
    });

    describe('testAuth', () => {
        it('calls listCompanyDetails with a single page', async () => {
            const api = makeApi();
            await api.testAuth();
            expect(api._captured[0].url).toContain('/configuration/v1/company-details');
            expect(api._captured[0].query).toEqual({ page: 1, per_Page: 1 });
        });
    });
});
