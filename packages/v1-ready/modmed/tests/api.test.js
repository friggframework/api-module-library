const { Api } = require('../api');

const DEMO_BASE = 'https://fhirmp.mmi.prod.fhir.ema-api.com/fhir/r4';

function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'cid',
        client_secret: 'csecret',
        redirect_uri: 'https://app.example/redirect/modmed',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { resourceType: 'Bundle', entry: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return {
            access_token: 'at',
            refresh_token: 'rt',
            expires_in: 3600,
            fhirUser: `${DEMO_BASE}/Practitioner/p1`,
        };
    };
    return api;
}

describe('ModMed Api', () => {
    describe('construction & auth', () => {
        it('defaults to the Certified demonstration FHIR base and SSO endpoints', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
                redirect_uri: 'https://app.example/r',
            });
            expect(api.baseUrl).toBe(DEMO_BASE);
            expect(api.tokenUri).toBe(
                'https://sso.ema.md/auth/realms/fhir/protocol/openid-connect/token'
            );
            expect(api.authorizationUri).toBe(
                'https://sso.ema.md/auth/realms/fhir/protocol/openid-connect/auth'
            );
        });

        it('setFhirBase updates baseUrl, tenant alias, and aud', () => {
            const api = makeApi();
            api.setFhirBase('https://pod.example.fhir.ema-api.com/fhir/r4');
            expect(api.baseUrl).toBe(
                'https://pod.example.fhir.ema-api.com/fhir/r4'
            );
            expect(api.tenant).toBe(api.baseUrl);
            expect(api.audience).toBe(api.baseUrl);
        });

        it('getAuthorizationUri includes aud, scope, and response_type=code', () => {
            const api = makeApi({ state: 'st1' });
            const uri = api.getAuthorizationUri();
            expect(uri).toContain(
                'https://sso.ema.md/auth/realms/fhir/protocol/openid-connect/auth?'
            );
            expect(uri).toContain('response_type=code');
            expect(uri).toContain('client_id=cid');
            expect(uri).toContain(`aud=${encodeURIComponent(DEMO_BASE)}`);
            expect(uri).toContain('state=st1');
            expect(uri).toContain('openid');
        });

        it('getAuthorizationRequirements is oauth2 with fhir_base form', () => {
            const reqs = makeApi().getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain('response_type=code');
            expect(reqs.data.jsonSchema.required).toContain('fhir_base');
        });

        it('getTokenFromCode posts to the token endpoint without inventing grant fields', async () => {
            const api = makeApi();
            const tokens = await api.getTokenFromCode('auth-code');
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(api.tokenUri);
            const body = api._captured[0].body;
            expect(body.get('grant_type')).toBe('authorization_code');
            expect(body.get('code')).toBe('auth-code');
            expect(body.get('client_id')).toBe('cid');
            expect(body.get('client_secret')).toBe('csecret');
            expect(tokens.access_token).toBe('at');
            expect(api.fhirUser).toContain('Practitioner/p1');
        });

        it('refreshAccessToken uses refresh_token grant', async () => {
            const api = makeApi();
            await api.refreshAccessToken({ refresh_token: 'rt-old' });
            const body = api._captured[0].body;
            expect(body.get('grant_type')).toBe('refresh_token');
            expect(body.get('refresh_token')).toBe('rt-old');
        });

        it('addAuthHeaders sends Bearer token', async () => {
            const api = makeApi();
            api.access_token = 'tok';
            const headers = await api.addAuthHeaders({});
            expect(headers.Authorization).toBe('Bearer tok');
        });
    });

    describe('FHIR reads', () => {
        it('getMetadata hits GET /metadata', async () => {
            const api = makeApi();
            await api.getMetadata();
            expect(api._captured[0].url).toBe(`${DEMO_BASE}/metadata`);
            expect(api._captured[0].headers.Accept).toBe(
                'application/fhir+json'
            );
        });

        it('listPatients defaults _count=50', async () => {
            const api = makeApi();
            await api.listPatients();
            expect(api._captured[0].url).toBe(`${DEMO_BASE}/Patient`);
            expect(api._captured[0].query._count).toBe(50);
        });

        it('getPatient hits /Patient/{id}', async () => {
            const api = makeApi();
            await api.getPatient('pt-1');
            expect(api._captured[0].url).toBe(`${DEMO_BASE}/Patient/pt-1`);
        });

        it('listPractitioners and getPractitioner hit Practitioner paths', async () => {
            const api = makeApi();
            await api.listPractitioners({ name: 'Ada' });
            await api.getPractitioner('pr-9');
            expect(api._captured[0].url).toBe(`${DEMO_BASE}/Practitioner`);
            expect(api._captured[0].query.name).toBe('Ada');
            expect(api._captured[1].url).toBe(
                `${DEMO_BASE}/Practitioner/pr-9`
            );
        });

        it('listLocations / getLocation', async () => {
            const api = makeApi();
            await api.listLocations();
            await api.getLocation('loc-1');
            expect(api._captured[0].url).toBe(`${DEMO_BASE}/Location`);
            expect(api._captured[1].url).toBe(`${DEMO_BASE}/Location/loc-1`);
        });

        it('listEncounters / getEncounter', async () => {
            const api = makeApi();
            await api.listEncounters({ patient: 'Patient/1' });
            await api.getEncounter('enc-1');
            expect(api._captured[0].query.patient).toBe('Patient/1');
            expect(api._captured[1].url).toBe(`${DEMO_BASE}/Encounter/enc-1`);
        });

        it('listCoverages / getCoverage', async () => {
            const api = makeApi();
            await api.listCoverages({ patient: '1' });
            await api.getCoverage('cov-1');
            expect(api._captured[0].url).toBe(`${DEMO_BASE}/Coverage`);
            expect(api._captured[1].url).toBe(`${DEMO_BASE}/Coverage/cov-1`);
        });

        it('listOrganizations / getOrganization', async () => {
            const api = makeApi();
            await api.listOrganizations({ type: 'prov' });
            await api.getOrganization('org-1');
            expect(api._captured[0].query.type).toBe('prov');
            expect(api._captured[1].url).toBe(
                `${DEMO_BASE}/Organization/org-1`
            );
        });

        it('listPractitionerRoles / getPractitionerRole', async () => {
            const api = makeApi();
            await api.listPractitionerRoles();
            await api.getPractitionerRole('role-1');
            expect(api._captured[0].url).toBe(`${DEMO_BASE}/PractitionerRole`);
            expect(api._captured[1].url).toBe(
                `${DEMO_BASE}/PractitionerRole/role-1`
            );
        });

        it('getCurrentUser GETs absolute fhirUser URL when set', async () => {
            const api = makeApi();
            api.fhirUser = `${DEMO_BASE}/Practitioner/me`;
            await api.getCurrentUser();
            expect(api._captured[0].url).toBe(
                `${DEMO_BASE}/Practitioner/me`
            );
        });

        it('getCurrentUser falls back to Practitioner search', async () => {
            const api = makeApi();
            api._get = async (options) => {
                api._captured.push(options);
                return {
                    resourceType: 'Bundle',
                    entry: [
                        {
                            resource: {
                                resourceType: 'Practitioner',
                                id: 'p-fallback',
                                name: [{ text: 'Dr Fallback' }],
                            },
                        },
                    ],
                };
            };
            const user = await api.getCurrentUser();
            expect(api._captured[0].url).toBe(`${DEMO_BASE}/Practitioner`);
            expect(user.id).toBe('p-fallback');
        });
    });
});
