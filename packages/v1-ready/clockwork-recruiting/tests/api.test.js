const { Api } = require('../api');

// Fully offline: stub low-level HTTP methods and assert on request options.
function makeApi(overrides = {}) {
    const api = new Api({
        access_token: 'test-token',
        firm_subdomain: 'example',
        client_id: 'cid',
        client_secret: 'sec',
        redirect_uri: 'https://app.example.com/redirect/clockwork-recruiting',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return { people: [] };
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { id: 1 };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { id: 1 };
    };
    api._delete = async (options) => {
        api._captured.push({ method: 'DELETE', ...options });
        return {};
    };
    return api;
}

describe('Clockwork Recruiting Api', () => {
    describe('construction & auth', () => {
        it('sets per-firm base URL from firm_subdomain', () => {
            const api = new Api({ firm_subdomain: 'example' });
            expect(api.baseUrl).toBe(
                'https://example.clockworkrecruiting.com/api/v3'
            );
        });

        it('leaves baseUrl null until firm_subdomain is set', () => {
            const api = new Api({});
            expect(api.baseUrl).toBeNull();
            api.setFirmSubdomain('acme');
            expect(api.baseUrl).toBe(
                'https://acme.clockworkrecruiting.com/api/v3'
            );
        });

        it('rejects invalid firm_subdomain characters', () => {
            expect(() => new Api({ firm_subdomain: 'bad/firm' })).toThrow(
                /alphanumeric/
            );
        });

        it('uses stage resource template for qa', () => {
            const prev = process.env.CLOCKWORK_STAGE;
            process.env.CLOCKWORK_STAGE = 'qa';
            try {
                const api = new Api({ firm_subdomain: 'acme' });
                expect(api.baseUrl).toBe(
                    'https://acme.qa.clockworkrecruiting.com/api/v3'
                );
                expect(api.authorizationUri).toContain(
                    'account.qa.clockworkrecruiting.com'
                );
            } finally {
                if (prev === undefined) delete process.env.CLOCKWORK_STAGE;
                else process.env.CLOCKWORK_STAGE = prev;
            }
        });

        it('builds an OAuth authorize URL with read write scope', () => {
            const api = new Api({
                client_id: 'cid',
                redirect_uri: 'https://app.example.com/r',
                scope: 'read write',
            });
            const url = api.getAuthorizationUri();
            expect(url).toContain(
                'https://account.clockworkrecruiting.com/oauth/authorize?'
            );
            expect(url).toContain('client_id=cid');
            expect(url).toContain('response_type=code');
            expect(url).toContain('scope=read+write');
        });

        it('getAuthorizationRequirements returns oauth2', () => {
            const api = new Api({ client_id: 'cid' });
            const reqs = api.getAuthorizationRequirements();
            expect(reqs.type).toBe('oauth2');
            expect(reqs.url).toContain('oauth/authorize');
        });

        it('isAuthenticated requires access, refresh, and accessTokenExpire', () => {
            const api = new Api({
                access_token: 'a',
                refresh_token: 'r',
                firm_subdomain: 'example',
            });
            api.accessTokenExpire = new Date(Date.now() + 60_000);
            expect(api.isAuthenticated()).toBe(true);
            api.accessTokenExpire = null;
            expect(api.isAuthenticated()).toBe(false);
        });

        it('setTokens extracts firm_hostname from JWT when firm unset', async () => {
            const api = new Api({});
            const payload = Buffer.from(
                JSON.stringify({ firm_hostname: 'jwt-firm' })
            ).toString('base64url');
            const token = `hdr.${payload}.sig`;
            api.access_token = null;
            // Avoid network: stub parent setTokens side effects by assigning after extract
            const original = Object.getPrototypeOf(
                Object.getPrototypeOf(api)
            ).setTokens;
            // Call only the firm-extract path by invoking our override with a
            // mocked super.setTokens via temporary replace.
            let calledSuper = false;
            const OAuthProto = Object.getPrototypeOf(Object.getPrototypeOf(api));
            const prev = OAuthProto.setTokens;
            OAuthProto.setTokens = async function () {
                calledSuper = true;
                this.access_token = token;
            };
            try {
                await api.setTokens({ access_token: token });
                expect(api.firm_subdomain).toBe('jwt-firm');
                expect(api.baseUrl).toBe(
                    'https://jwt-firm.clockworkrecruiting.com/api/v3'
                );
                expect(calledSuper).toBe(true);
            } finally {
                OAuthProto.setTokens = prev;
            }
            expect(original).toBeDefined();
        });
    });

    describe('people', () => {
        it('listPeople hits GET /people with default limit/offset', async () => {
            const api = makeApi();
            await api.listPeople();
            expect(api._captured[0].url).toBe(
                'https://example.clockworkrecruiting.com/api/v3/people'
            );
            expect(api._captured[0].query.limit).toBe(100);
            expect(api._captured[0].query.offset).toBe(0);
        });

        it('getPerson hits GET /people/{id}', async () => {
            const api = makeApi();
            await api.getPerson(42, { include: 'tags' });
            expect(api._captured[0].url).toBe(
                'https://example.clockworkrecruiting.com/api/v3/people/42'
            );
            expect(api._captured[0].query.include).toBe('tags');
        });

        it('createPerson posts { person } envelope', async () => {
            const api = makeApi();
            await api.createPerson({ first_name: 'Ada' });
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].body).toEqual({
                person: { first_name: 'Ada' },
            });
        });

        it('updatePerson puts { person } envelope', async () => {
            const api = makeApi();
            await api.updatePerson(9, { last_name: 'Lovelace' });
            expect(api._captured[0].url).toContain('/people/9');
            expect(api._captured[0].body).toEqual({
                person: { last_name: 'Lovelace' },
            });
        });

        it('deletePerson deletes /people/{id}', async () => {
            const api = makeApi();
            await api.deletePerson(9);
            expect(api._captured[0].method).toBe('DELETE');
            expect(api._captured[0].url).toContain('/people/9');
        });

        it('searchPeople hits /people_search', async () => {
            const api = makeApi();
            await api.searchPeople({ q: 'ceo' });
            expect(api._captured[0].url).toContain('/people_search');
            expect(api._captured[0].query.q).toBe('ceo');
        });
    });

    describe('companies & projects & candidacies', () => {
        it('listCompanies / getCompany / createCompany / updateCompany', async () => {
            const api = makeApi();
            await api.listCompanies({ name: 'Acme' });
            expect(api._captured[0].url).toContain('/companies');
            await api.getCompany(3);
            expect(api._captured[1].url).toContain('/companies/3');
            await api.createCompany({ name: 'Acme' });
            expect(api._captured[2].body).toEqual({
                company: { name: 'Acme' },
            });
            await api.updateCompany(3, { name: 'Acme Inc' });
            expect(api._captured[3].body).toEqual({
                company: { name: 'Acme Inc' },
            });
        });

        it('listProjects and getProject', async () => {
            const api = makeApi();
            await api.listProjects({ status: 'open' });
            expect(api._captured[0].url).toContain('/projects');
            await api.getProject(5, { include: 'clients' });
            expect(api._captured[1].url).toContain('/projects/5');
            expect(api._captured[1].query.include).toBe('clients');
        });

        it('candidacy CRUD under a project', async () => {
            const api = makeApi();
            await api.listCandidacies(10);
            expect(api._captured[0].url).toContain(
                '/projects/10/candidacies'
            );
            await api.createCandidacy(10, { person_id: 1 });
            expect(api._captured[1].body).toEqual({
                candidacy: { person_id: 1 },
            });
            await api.updateCandidacy(10, 2, { status: 'interview' });
            expect(api._captured[2].url).toContain(
                '/projects/10/candidacies/2'
            );
            await api.deleteCandidacy(10, 2);
            expect(api._captured[3].method).toBe('DELETE');
        });
    });

    describe('webhooks & identity probe', () => {
        it('createWebhook POSTs /webhooks', async () => {
            const api = makeApi();
            await api.createWebhook({ url: 'https://hook.example.com' });
            expect(api._captured[0].url).toContain('/webhooks');
            expect(api._captured[0].method).toBe('POST');
        });

        it('deleteWebhook DELETEs /webhooks/{id}', async () => {
            const api = makeApi();
            await api.deleteWebhook(7);
            expect(api._captured[0].url).toContain('/webhooks/7');
            expect(api._captured[0].method).toBe('DELETE');
        });

        it('testConnection lists one person and requires firm', async () => {
            const api = makeApi();
            await api.testConnection();
            expect(api._captured[0].query.limit).toBe(1);
            const bare = new Api({ access_token: 't' });
            await expect(bare.testConnection()).rejects.toThrow(
                /firm_subdomain/
            );
        });

        it('listUsers hits GET /users', async () => {
            const api = makeApi();
            await api.listUsers();
            expect(api._captured[0].url).toContain('/users');
        });
    });

    describe('person sub-resources', () => {
        it('createPersonEmailAddress uses email envelope', async () => {
            const api = makeApi();
            await api.createPersonEmailAddress(1, {
                address: 'a@example.com',
            });
            expect(api._captured[0].url).toContain(
                '/people/1/email_addresses'
            );
            expect(api._captured[0].body).toEqual({
                email: { address: 'a@example.com' },
            });
        });

        it('createPersonTag uses tag envelope', async () => {
            const api = makeApi();
            await api.createPersonTag(1, { name: 'CFO' });
            expect(api._captured[0].body).toEqual({ tag: { name: 'CFO' } });
        });
    });
});
