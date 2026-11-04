const {
    Api,
    DEFAULT_API_BASE,
    DEFAULT_OAUTH_HOST,
    challengeFromVerifier,
} = require('../api');

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://app.example.com/redirect/digitail',
        access_token: 'test-token',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { data: [] };
    };
    api._post = async (options, stringify) => {
        api._captured.push({ method: 'POST', stringify, ...options });
        return { id: 1 };
    };
    api._patch = async (options) => {
        api._captured.push({ method: 'PATCH', ...options });
        return { data: {} };
    };
    return api;
}

describe('Digitail Api', () => {
    describe('construction & auth', () => {
        it('defaults to production API and OAuth hosts', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://x/digitail',
            });
            expect(api.baseUrl).toBe(DEFAULT_API_BASE);
            expect(api.oauthHost).toBe(DEFAULT_OAUTH_HOST);
            expect(api.tokenUri).toBe(`${DEFAULT_OAUTH_HOST}/oauth/token`);
            expect(api.baseUrl).toBe('https://vet.digitail.io/api/v1');
        });

        it('accepts sandbox host overrides', () => {
            const api = new Api({
                baseUrl: 'https://developer.digitail.io/api/v1',
                oauthHost: 'https://developer.digitail.io',
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://x/digitail',
            });
            expect(api.baseUrl).toBe('https://developer.digitail.io/api/v1');
            expect(api.tokenUri).toBe(
                'https://developer.digitail.io/oauth/token'
            );
        });

        it('builds an authorize URL with PKCE S256', () => {
            const api = new Api({
                client_id: 'cid',
                client_secret: 'sec',
                redirect_uri: 'https://app.example.com/redirect/digitail',
            });
            const uri = api.getAuthorizationUri('caller-state');
            expect(uri).toContain(`${DEFAULT_OAUTH_HOST}/oauth/authorize`);
            expect(uri).toContain('response_type=code');
            expect(uri).toContain('client_id=cid');
            expect(uri).toContain('code_challenge_method=S256');
            expect(uri).toContain('code_challenge=');
            expect(uri).toContain('state=');
            expect(api.code_verifier).toBeTruthy();
            expect(uri).toContain(
                `code_challenge=${challengeFromVerifier(api.code_verifier)}`
            );
        });

        it('accepts an access_token from params', () => {
            const api = new Api({ access_token: 'tok' });
            expect(api.access_token).toBe('tok');
        });

        it('adds Bearer auth headers and optional X-ClinicId', async () => {
            const api = new Api({
                access_token: 'secret',
                clinicId: '766',
            });
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer secret');
            expect(headers['X-ClinicId']).toBe('766');
            expect(headers.Accept).toBe('application/json');
        });

        it('getTokenFromCode POSTs form-urlencoded with code_verifier', async () => {
            const api = makeApi({ access_token: 'stale' });
            api.code_verifier = 'verifier-abc';
            api.setTokens = async () => {};
            await api.getTokenFromCode('auth-code');
            const captured = api._captured[0];
            expect(captured.url).toBe(`${DEFAULT_OAUTH_HOST}/oauth/token`);
            expect(captured.headers['Content-Type']).toBe(
                'application/x-www-form-urlencoded'
            );
            expect(captured.stringify).toBe(false);
            expect(captured.body).toContain('grant_type=authorization_code');
            expect(captured.body).toContain('code=auth-code');
            expect(captured.body).toContain('code_verifier=verifier-abc');
            expect(captured.body).toContain('client_id=cid');
            expect(captured.body).toContain('client_secret=csecret');
        });

        it('getTokenFromCode restores verifier from encrypted state', async () => {
            const api = makeApi({ access_token: undefined });
            api.setTokens = async () => {};
            const uri = api.getAuthorizationUri('app');
            const state = new URL(uri).searchParams.get('state');
            api.code_verifier = null;
            await api.getTokenFromCode('c', { state });
            expect(api._captured[0].body).toContain('code_verifier=');
        });

        it('refreshAccessToken POSTs form-urlencoded without PKCE', async () => {
            const api = makeApi();
            api.setTokens = async () => {};
            await api.refreshAccessToken({ refresh_token: 'rt' });
            const captured = api._captured[0];
            expect(captured.url).toBe(`${DEFAULT_OAUTH_HOST}/oauth/token`);
            expect(captured.body).toContain('grant_type=refresh_token');
            expect(captured.body).toContain('refresh_token=rt');
            expect(captured.body).not.toContain('code_verifier');
        });
    });

    describe('identity & clinics', () => {
        it('getAuthMe hits GET /auth/me', async () => {
            const api = makeApi();
            await api.getAuthMe({ 'include[]': ['clinic'] });
            expect(api._captured[0].url).toContain(
                `${DEFAULT_API_BASE}/auth/me`
            );
            expect(api._captured[0].url).toContain('include');
        });

        it('listClinics hits GET /clinics', async () => {
            const api = makeApi();
            await api.listClinics({ 'filter[clinic_id]': '1,2' });
            expect(api._captured[0].url).toBe(
                `${DEFAULT_API_BASE}/clinics?filter%5Bclinic_id%5D=1%2C2`
            );
        });
    });

    describe('pet parents', () => {
        it('listPetParents hits GET /pet-parents', async () => {
            const api = makeApi();
            await api.listPetParents({ 'filter[email]': 'a@b.com', page: 2 });
            const { url } = api._captured[0];
            expect(url).toContain(`${DEFAULT_API_BASE}/pet-parents?`);
            expect(url).toContain('filter%5Bemail%5D=a%40b.com');
            expect(url).toContain('page=2');
        });

        it('getPetParent hits GET /pet-parents/{id}', async () => {
            const api = makeApi();
            await api.getPetParent(42);
            expect(api._captured[0].url).toBe(
                `${DEFAULT_API_BASE}/pet-parents/42`
            );
        });

        it('createPetParent POSTs JSON', async () => {
            const api = makeApi();
            const body = {
                name: 'John',
                last_name: 'Doe',
                phone: '+16175551212',
                terms_and_conditions: true,
            };
            await api.createPetParent(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                `${DEFAULT_API_BASE}/pet-parents`
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('updatePetParent PATCHes /pet-parents/{id}', async () => {
            const api = makeApi();
            await api.updatePetParent(9, { email: 'n@e.com' });
            expect(api._captured[0].method).toBe('PATCH');
            expect(api._captured[0].url).toBe(
                `${DEFAULT_API_BASE}/pet-parents/9`
            );
            expect(api._captured[0].body).toEqual({ email: 'n@e.com' });
        });
    });

    describe('pets', () => {
        it('listPets hits GET /pets', async () => {
            const api = makeApi();
            await api.listPets({ 'filter[clinic_id]': 1, per_page: 15 });
            const { url } = api._captured[0];
            expect(url).toContain(`${DEFAULT_API_BASE}/pets?`);
            expect(url).toContain('filter%5Bclinic_id%5D=1');
        });

        it('getPet hits GET /pets/{id}', async () => {
            const api = makeApi();
            await api.getPet(7);
            expect(api._captured[0].url).toBe(`${DEFAULT_API_BASE}/pets/7`);
        });

        it('createPet POSTs multipart FormData', async () => {
            const api = makeApi();
            await api.createPet({
                clinic_id: 1,
                vet_id: 1,
                owner_id: 1,
                nickname: 'Fluffy',
                birthday: '2017-11-28',
                species_id: 1,
                breed_id: 1,
                gender: 'male',
            });
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(`${DEFAULT_API_BASE}/pets`);
            expect(api._captured[0].stringify).toBe(false);
            expect(api._captured[0].body).toBeInstanceOf(FormData);
        });
    });

    describe('appointments', () => {
        it('listAppointments hits GET /appointments', async () => {
            const api = makeApi();
            await api.listAppointments({
                'filter[date_after]': '2026-01-01',
                'filter[statuses]': [5],
            });
            const { url } = api._captured[0];
            expect(url).toContain(`${DEFAULT_API_BASE}/appointments?`);
            expect(url).toContain('filter%5Bdate_after%5D=2026-01-01');
        });

        it('getAppointment hits GET /appointments/{id}', async () => {
            const api = makeApi();
            await api.getAppointment(3);
            expect(api._captured[0].url).toBe(
                `${DEFAULT_API_BASE}/appointments/3`
            );
        });

        it('createAppointment POSTs JSON', async () => {
            const api = makeApi();
            const body = {
                clinic_id: 1,
                vet_id: 1,
                patient_id: 1,
                visit_type_id: 1,
                reminder_notifications: [],
            };
            await api.createAppointment(body);
            expect(api._captured[0].body).toEqual(body);
            expect(api._captured[0].url).toBe(
                `${DEFAULT_API_BASE}/appointments`
            );
        });
    });

    describe('invoices, sales, records', () => {
        it('listInvoices hits GET /invoices', async () => {
            const api = makeApi();
            await api.listInvoices({ 'filter[sale_id]': 10 });
            expect(api._captured[0].url).toContain(
                `${DEFAULT_API_BASE}/invoices?`
            );
        });

        it('getInvoice hits GET /invoices/{id}', async () => {
            const api = makeApi();
            await api.getInvoice(55);
            expect(api._captured[0].url).toBe(
                `${DEFAULT_API_BASE}/invoices/55`
            );
        });

        it('getSale hits GET /sales/{id}', async () => {
            const api = makeApi();
            await api.getSale(88, { include: 'payments,invoice' });
            expect(api._captured[0].url).toBe(
                `${DEFAULT_API_BASE}/sales/88?include=payments%2Cinvoice`
            );
        });

        it('listRecords hits GET /records', async () => {
            const api = makeApi();
            await api.listRecords({ 'filter[has_diagnoses]': 1 });
            expect(api._captured[0].url).toContain(
                `${DEFAULT_API_BASE}/records?`
            );
        });
    });
});
