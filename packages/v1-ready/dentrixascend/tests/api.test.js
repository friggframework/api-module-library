const { Api } = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'test-client',
        client_secret: 'test-secret',
        organization_id: 'org-1006',
        access_token: 'tok-abc',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { statusCode: 200, data: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { statusCode: 200, data: { id: '1' } };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { statusCode: 200, data: { id: '1' } };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return { statusCode: 200, data: {} };
    };
    return api;
}

describe('Dentrix Ascend Api', () => {
    describe('construction & auth', () => {
        it('defaults to production Public API base URL and host', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
            });
            expect(api.baseUrl).toBe(
                'https://prod.hs1api.com/ascend-gateway/api'
            );
            expect(api.apiHost).toBe('https://prod.hs1api.com');
            expect(api.grant_type).toBe('client_credentials');
            expect(api.tokenUri).toBe(
                'https://prod.hs1api.com/oauth/client_credential/accesstoken?grant_type=client_credentials'
            );
        });

        it('accepts sandbox host overrides', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                api_host: 'https://test.hs1api.com',
                baseUrl: 'https://test.hs1api.com/ascend-gateway/api',
            });
            expect(api.baseUrl).toBe(
                'https://test.hs1api.com/ascend-gateway/api'
            );
            expect(api.tokenUri).toContain('https://test.hs1api.com/oauth/');
        });

        it('adds Bearer and Organization-ID headers', async () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                access_token: 'tok',
                organization_id: 'org-9',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer tok');
            expect(headers['Organization-ID']).toBe('org-9');
        });

        it('isAuthenticated with access_token only (no refresh_token)', () => {
            expect(
                new Api({
                    client_id: 'c',
                    client_secret: 's',
                    access_token: 't',
                }).isAuthenticated()
            ).toBe(true);
            expect(
                new Api({ client_id: 'c', client_secret: 's' }).isAuthenticated()
            ).toBe(false);
        });

        it('getTokenFromClientCredentials posts form body to tokenUri', async () => {
            const api = makeApi({ access_token: null });
            api.setTokens = async (res) => {
                api.access_token = res.access_token;
            };
            api._post = async (options) => {
                api._captured.push({ method: 'POST', ...options });
                return {
                    access_token: 'new-tok',
                    expires_in: '3599',
                    token_type: 'Bearer',
                };
            };
            const res = await api.getTokenFromClientCredentials();
            expect(res.access_token).toBe('new-tok');
            const call = api._captured[0];
            expect(call.url).toContain(
                '/oauth/client_credential/accesstoken?grant_type=client_credentials'
            );
            expect(call.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            expect(String(call.body)).toContain('client_id=test-client');
            expect(String(call.body)).toContain('client_secret=test-secret');
        });

        it('exposes a client_credentials authorization form', () => {
            const api = new Api({ client_id: 'c', client_secret: 's' });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.grantType).toBe('client_credentials');
            expect(reqs.url).toBeNull();
            expect(reqs.data.jsonSchema.required).toEqual(
                expect.arrayContaining([
                    'client_id',
                    'client_secret',
                    'organization_id',
                ])
            );
        });
    });

    describe('identity', () => {
        it('listLinkedOrganizations hits the API host OrgMapper path', async () => {
            const api = makeApi();
            await api.listLinkedOrganizations();
            expect(api._captured[0].url).toBe(
                'https://prod.hs1api.com/orgmapper/LinkedOrgs'
            );
        });

        it('getOrganization hits /v1/organizations/{id}', async () => {
            const api = makeApi();
            await api.getOrganization('org-1006');
            expect(api._captured[0].url).toBe(
                'https://prod.hs1api.com/ascend-gateway/api/v1/organizations/org-1006'
            );
        });
    });

    describe('patients', () => {
        it('listPatients hits GET /v1/patients with query params', async () => {
            const api = makeApi();
            await api.listPatients({
                filter: 'lastModified>=2025-01-01',
                pageSize: 50,
            });
            const { url } = api._captured[0];
            expect(url).toContain(
                'https://prod.hs1api.com/ascend-gateway/api/v1/patients?'
            );
            expect(url).toContain('filter=lastModified%3E%3D2025-01-01');
            expect(url).toContain('pageSize=50');
        });

        it('getPatient / createPatient / updatePatient use the patient paths', async () => {
            const api = makeApi();
            await api.getPatient('p1');
            await api.createPatient({ firstName: 'Ada' });
            await api.updatePatient('p1', { firstName: 'Ada' });
            expect(api._captured[0].url).toBe(
                'https://prod.hs1api.com/ascend-gateway/api/v1/patients/p1'
            );
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[1].url).toBe(
                'https://prod.hs1api.com/ascend-gateway/api/v1/patients'
            );
            expect(api._captured[2].method).toBe('PUT');
            expect(api._captured[2].url).toBe(
                'https://prod.hs1api.com/ascend-gateway/api/v1/patients/p1'
            );
        });
    });

    describe('appointments', () => {
        it('covers list/get/create/update/delete', async () => {
            const api = makeApi();
            await api.listAppointments({ filter: 'location.id==1' });
            await api.getAppointment('a1');
            await api.createAppointment({ status: 'UNCONFIRMED' });
            await api.updateAppointment('a1', { status: 'CONFIRMED' });
            await api.deleteAppointment('a1');
            expect(api._captured.map((c) => c.method)).toEqual([
                'GET',
                'GET',
                'POST',
                'PUT',
                'DELETE',
            ]);
            expect(api._captured[4].url).toBe(
                'https://prod.hs1api.com/ascend-gateway/api/v1/appointments/a1'
            );
        });
    });

    describe('ledger & related', () => {
        it('listTransactions and patient payments hit transaction paths', async () => {
            const api = makeApi();
            await api.listTransactions({
                filter: 'patient.id==123',
            });
            await api.getTransaction('t1');
            await api.listPatientPayments({
                filter: 'patient.id==123',
            });
            await api.getPatientPayment('t2');
            expect(api._captured[0].url).toContain('/v1/transactions?');
            expect(api._captured[1].url).toContain('/v1/transactions/t1');
            expect(api._captured[2].url).toContain(
                '/v1/transactions/patientpayments?'
            );
            expect(api._captured[3].url).toContain(
                '/v1/transactions/patientpayments/t2'
            );
        });

        it('covers claims, fee schedules, procedures, statements, insurance plans', async () => {
            const api = makeApi();
            await api.listInsuranceClaims();
            await api.getInsuranceClaim('c1');
            await api.listFeeSchedules();
            await api.getFeeSchedule('f1');
            await api.listPatientProcedures();
            await api.getPatientProcedure('pr1');
            await api.listPatientStatements();
            await api.getPatientStatement('s1');
            await api.listPatientInsurancePlans();
            await api.getPatientInsurancePlan('ip1');
            expect(api._captured).toHaveLength(10);
            expect(api._captured[0].url).toContain('/v1/insuranceclaims');
            expect(api._captured[2].url).toContain('/v1/feeschedules');
            expect(api._captured[4].url).toContain('/v1/patientprocedures');
            expect(api._captured[6].url).toContain('/v1/patientstatements');
            expect(api._captured[8].url).toContain('/v1/patientinsuranceplans');
        });
    });

    describe('locations & providers', () => {
        it('covers location and provider CRUD surfaces that exist', async () => {
            const api = makeApi();
            await api.listLocations();
            await api.getLocation('l1');
            await api.updateLocation('l1', { name: 'Main' });
            await api.listProviders();
            await api.getProvider('pv1');
            await api.createProvider({ firstName: 'Pat' });
            await api.updateProvider('pv1', { lastName: 'Lee' });
            expect(api._captured[2].method).toBe('PUT');
            expect(api._captured[5].method).toBe('POST');
            expect(api._captured[5].url).toContain('/v1/providers');
        });
    });
});
