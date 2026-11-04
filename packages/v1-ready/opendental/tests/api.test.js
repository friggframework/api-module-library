const { Api } = require('../api');

// Fully offline: stub low-level HTTP methods and assert on the request
// options the API methods construct. No network is touched.
function makeApi(overrides = {}) {
    const api = new Api({
        developerKey: 'dev-key',
        customerKey: 'cust-key',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return [];
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { ok: true };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { ok: true };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return { ok: true };
    };
    return api;
}

describe('Open Dental Api', () => {
    describe('construction & auth', () => {
        it('sets the base URL and ODFHIR Authorization header', () => {
            const api = new Api({
                developerKey: 'DEV',
                customerKey: 'CUST',
            });
            expect(api.baseUrl).toBe('https://api.opendental.com/api/v1');
            expect(api.api_key_name).toBe('Authorization');
            expect(api.api_key).toBe('ODFHIR DEV/CUST');
            expect(api.developerKey).toBe('DEV');
            expect(api.customerKey).toBe('CUST');
        });

        it('setCredentials rebuilds the Authorization value', () => {
            const api = new Api({});
            expect(api.isAuthenticated()).toBe(false);
            api.setCredentials('A', 'B');
            expect(api.api_key).toBe('ODFHIR A/B');
            expect(api.isAuthenticated()).toBe(true);
        });

        it('addAuthHeaders sends the ODFHIR Authorization header', async () => {
            const api = new Api({
                developerKey: 'D',
                customerKey: 'C',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('ODFHIR D/C');
        });

        it('exposes a dual-key authorization form', () => {
            const api = new Api({});
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('apiKey');
            expect(reqs.data.jsonSchema.required).toEqual([
                'developerKey',
                'customerKey',
            ]);
        });
    });

    describe('patients', () => {
        it('listPatients hits GET /patients with Pascal query params', async () => {
            const api = makeApi();
            await api.listPatients({ LName: 'Smith', Offset: 0 });
            const captured = api._captured[0];
            expect(captured.url).toBe(
                'https://api.opendental.com/api/v1/patients'
            );
            expect(captured.query).toEqual({ LName: 'Smith', Offset: 0 });
        });

        it('listPatientsSimple hits GET /patients/Simple', async () => {
            const api = makeApi();
            await api.listPatientsSimple({ FName: 'Ann' });
            expect(api._captured[0].url).toBe(
                'https://api.opendental.com/api/v1/patients/Simple'
            );
        });

        it('getPatient / createPatient / updatePatient hit the documented paths', async () => {
            const api = makeApi();
            await api.getPatient(48);
            await api.createPatient({ LName: 'Doe', FName: 'Jane' });
            await api.updatePatient(48, { Email: 'a@b.co' });
            expect(api._captured[0].url).toBe(
                'https://api.opendental.com/api/v1/patients/48'
            );
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[1].body).toEqual({
                LName: 'Doe',
                FName: 'Jane',
            });
            expect(api._captured[2].method).toBe('PUT');
            expect(api._captured[2].url).toBe(
                'https://api.opendental.com/api/v1/patients/48'
            );
        });

        it('getPatientBalances hits accountmodules PatientBalances', async () => {
            const api = makeApi();
            await api.getPatientBalances(16);
            expect(api._captured[0].url).toBe(
                'https://api.opendental.com/api/v1/accountmodules/16/PatientBalances'
            );
        });

        it('omits null/undefined query params', async () => {
            const api = makeApi();
            await api.listPatients({ LName: undefined, FName: null });
            expect(api._captured[0].query).toEqual({});
        });
    });

    describe('appointments', () => {
        it('listAppointments uses dateStart/dateEnd (not AptDate*)', async () => {
            const api = makeApi();
            await api.listAppointments({
                PatNum: 20,
                dateStart: '2020-07-30',
                dateEnd: '2020-08-02',
            });
            expect(api._captured[0].query).toEqual({
                PatNum: 20,
                dateStart: '2020-07-30',
                dateEnd: '2020-08-02',
            });
        });

        it('getAppointment / createAppointment / updateAppointment', async () => {
            const api = makeApi();
            await api.getAppointment(18);
            await api.createAppointment({ PatNum: 1 });
            await api.updateAppointment(18, { Note: 'x' });
            expect(api._captured[0].url).toContain('/appointments/18');
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[2].method).toBe('PUT');
        });
    });

    describe('payments & aging', () => {
        it('listPayments / createPayment / updatePayment', async () => {
            const api = makeApi();
            await api.listPayments({ PatNum: 1337, DateEntry: '2022-06-24' });
            await api.createPayment({ PayAmt: '10', PatNum: 1 });
            await api.updatePayment(56734, { PayNote: 'n' });
            expect(api._captured[0].url).toContain('/payments');
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[2].url).toContain('/payments/56734');
        });

        it('listAging hits GET /reports/Aging', async () => {
            const api = makeApi();
            await api.listAging({ DateAsOf: '2020-07-30', ClinicNum: 5 });
            expect(api._captured[0].url).toBe(
                'https://api.opendental.com/api/v1/reports/Aging'
            );
            expect(api._captured[0].query).toEqual({
                DateAsOf: '2020-07-30',
                ClinicNum: 5,
            });
        });
    });

    describe('subscriptions', () => {
        it('CRUD hits /subscriptions', async () => {
            const api = makeApi();
            await api.listSubscriptions();
            await api.createSubscription({
                EndPointUrl: 'https://hook.example.com/',
                Workstation: 'MOLLYR',
                WatchTable: 'Appointment',
                PollingSeconds: 5,
            });
            await api.updateSubscription(14, { PollingSeconds: 30 });
            await api.deleteSubscription(14);
            expect(api._captured[0].url).toContain('/subscriptions');
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[2].url).toContain('/subscriptions/14');
            expect(api._captured[3].method).toBe('DELETE');
        });
    });

    describe('other resources', () => {
        it('listClinics / listPreferences / listClaims / listInsPlans / listFees', async () => {
            const api = makeApi();
            await api.listClinics();
            await api.listPreferences({ PrefName: 'PracticeTitle' });
            await api.listClaims({ PatNum: 23 });
            await api.getClaim(1);
            await api.listInsPlans();
            await api.getInsPlan(6);
            await api.listPatPlans({ PatNum: 1897 });
            await api.listFeeScheds();
            await api.listFees({ FeeSched: 13 });
            await api.getFee(112);
            await api.listProcedureLogs({ PatNum: 261 });
            await api.getProcedureLog(20);
            await api.listStatements({ PatNum: 1430 });
            await api.getStatement(1);
            expect(api._captured.map((c) => c.url)).toEqual([
                'https://api.opendental.com/api/v1/clinics',
                'https://api.opendental.com/api/v1/preferences',
                'https://api.opendental.com/api/v1/claims',
                'https://api.opendental.com/api/v1/claims/1',
                'https://api.opendental.com/api/v1/insplans',
                'https://api.opendental.com/api/v1/insplans/6',
                'https://api.opendental.com/api/v1/patplans',
                'https://api.opendental.com/api/v1/feescheds',
                'https://api.opendental.com/api/v1/fees',
                'https://api.opendental.com/api/v1/fees/112',
                'https://api.opendental.com/api/v1/procedurelogs',
                'https://api.opendental.com/api/v1/procedurelogs/20',
                'https://api.opendental.com/api/v1/statements',
                'https://api.opendental.com/api/v1/statements/1',
            ]);
        });
    });
});
