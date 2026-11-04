const { Api } = require('../api');

// Fully offline: stub _get/_post/_put and assert on constructed request options.
function makeApi(overrides = {}) {
    const api = new Api({
        client_id: 'test-client',
        client_secret: 'test-secret',
        access_token: 'tok',
        ...overrides,
    });
    api._captured = [];
    api._get = async (options) => {
        api._captured.push({ method: 'GET', ...options });
        return [];
    };
    api._post = async (options) => {
        api._captured.push({ method: 'POST', ...options });
        return { Token: 'new-tok', RefreshToken: 'new-ref', id: 1 };
    };
    api._put = async (options) => {
        api._captured.push({ method: 'PUT', ...options });
        return { CompanyID: 1 };
    };
    api.setTokens = async (tokens) => {
        api.access_token = tokens.access_token;
        api.refresh_token = tokens.refresh_token;
    };
    return api;
}

describe('Aspire Api', () => {
    describe('construction & auth', () => {
        it('defaults baseUrl to production Aspire Cloud API', () => {
            const api = new Api({
                client_id: 'c',
                client_secret: 's',
            });
            expect(api.baseUrl).toBe('https://cloud-api.youraspire.com');
            expect(api.grant_type).toBe('client_credentials');
        });

        it('accepts baseUrl override and env-style aliases', () => {
            const api = new Api({
                baseUrl: 'https://cloudsandbox-api.youraspire.com',
                clientId: 'cid',
                clientSecret: 'sec',
            });
            expect(api.baseUrl).toBe(
                'https://cloudsandbox-api.youraspire.com'
            );
            expect(api.client_id).toBe('cid');
            expect(api.client_secret).toBe('sec');
        });

        it('reports authenticated with token or client credentials', () => {
            expect(
                new Api({ access_token: 't' }).isAuthenticated()
            ).toBe(true);
            expect(
                new Api({
                    client_id: 'c',
                    client_secret: 's',
                }).isAuthenticated()
            ).toBe(true);
            expect(new Api({}).isAuthenticated()).toBe(false);
        });

        it('getTokenFromClientCredentials POSTs ClientId/Secret to /Authorization', async () => {
            const api = makeApi();
            const result = await api.getTokenFromClientCredentials();
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://cloud-api.youraspire.com/Authorization'
            );
            expect(api._captured[0].body).toEqual({
                ClientId: 'test-client',
                Secret: 'test-secret',
            });
            expect(result.Token).toBe('new-tok');
            expect(api.access_token).toBe('new-tok');
            expect(api.refresh_token).toBe('new-ref');
        });

        it('throws when client credentials are missing', async () => {
            const api = makeApi({ client_id: '', client_secret: '' });
            await expect(api.getTokenFromClientCredentials()).rejects.toThrow(
                /client_id and client_secret/
            );
        });

        it('refreshToken POSTs RefreshToken to /Authorization/RefreshToken', async () => {
            const api = makeApi({ refresh_token: 'old-ref' });
            await api.refreshToken();
            expect(api._captured[0].url).toBe(
                'https://cloud-api.youraspire.com/Authorization/RefreshToken'
            );
            expect(api._captured[0].body).toEqual({
                RefreshToken: 'old-ref',
            });
        });
    });

    describe('OData query builder', () => {
        it('serializes filter/skip/top/select/orderby/expand', () => {
            const api = new Api({});
            const qs = api.buildQueryString({
                filter: 'Active eq true',
                skip: 10,
                top: 25,
                select: 'CompanyID,CompanyName',
                orderby: 'CompanyName',
                expand: 'OfficeAddress',
            });
            expect(qs).toContain('$filter=Active eq true');
            expect(qs).toContain('$skip=10');
            expect(qs).toContain('$top=25');
            expect(qs).toContain('$select=CompanyID,CompanyName');
            expect(qs).toContain('$orderby=CompanyName');
            expect(qs).toContain('$expand=OfficeAddress');
        });

        it('returns empty string with no params', () => {
            expect(new Api({}).buildQueryString()).toBe('');
        });
    });

    describe('Companies', () => {
        it('getCompanies hits GET /Companies', async () => {
            const api = makeApi();
            await api.getCompanies();
            expect(api._captured[0].url).toBe(
                'https://cloud-api.youraspire.com/Companies'
            );
        });

        it('getCompanies appends OData query', async () => {
            const api = makeApi();
            await api.getCompanies({ top: 1, filter: 'Active eq true' });
            expect(api._captured[0].url).toContain('$top=1');
            expect(api._captured[0].url).toContain(
                '$filter=Active eq true'
            );
        });

        it('createCompany POSTs body to /Companies', async () => {
            const api = makeApi();
            const body = { CompanyName: 'Acme', Active: true };
            await api.createCompany(body);
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[0].url).toBe(
                'https://cloud-api.youraspire.com/Companies'
            );
            expect(api._captured[0].body).toEqual(body);
        });

        it('updateCompany PUTs body to /Companies', async () => {
            const api = makeApi();
            const body = { CompanyID: 9, CompanyName: 'Acme' };
            await api.updateCompany(body);
            expect(api._captured[0].method).toBe('PUT');
            expect(api._captured[0].body).toEqual(body);
        });
    });

    describe('Contacts', () => {
        it('getContacts hits GET /Contacts', async () => {
            const api = makeApi();
            await api.getContacts({ top: 5 });
            expect(api._captured[0].url).toContain('/Contacts');
            expect(api._captured[0].url).toContain('$top=5');
        });

        it('createContact and updateContact use POST/PUT', async () => {
            const api = makeApi();
            await api.createContact({
                Contact: { FirstName: 'A', LastName: 'B' },
            });
            await api.updateContact({
                Contact: { ContactID: 1, FirstName: 'A' },
            });
            expect(api._captured[0].method).toBe('POST');
            expect(api._captured[1].method).toBe('PUT');
        });

        it('getContact filters by ContactID', async () => {
            const api = makeApi();
            api._get = async (options) => {
                api._captured.push({ method: 'GET', ...options });
                return [{ ContactID: 42, FirstName: 'Pat' }];
            };
            const contact = await api.getContact(42);
            expect(api._captured[0].url).toContain(
                '$filter=ContactID eq 42'
            );
            expect(contact.ContactID).toBe(42);
        });
    });

    describe('Invoices / Opportunities / PaymentTerms', () => {
        it('getInvoices hits GET /Invoices', async () => {
            const api = makeApi();
            await api.getInvoices({ top: 2 });
            expect(api._captured[0].url).toBe(
                'https://cloud-api.youraspire.com/Invoices?$top=2'
            );
        });

        it('getOpportunities and createOpportunity', async () => {
            const api = makeApi();
            await api.getOpportunities();
            await api.createOpportunity({ OpportunityName: 'Job' });
            expect(api._captured[0].url).toContain('/Opportunities');
            expect(api._captured[1].method).toBe('POST');
            expect(api._captured[1].body.OpportunityName).toBe('Job');
        });

        it('getOpportunity filters by OpportunityID', async () => {
            const api = makeApi();
            api._get = async (options) => {
                api._captured.push({ method: 'GET', ...options });
                return [{ OpportunityID: 7 }];
            };
            const opp = await api.getOpportunity(7);
            expect(api._captured[0].url).toContain(
                '$filter=OpportunityID eq 7'
            );
            expect(opp.OpportunityID).toBe(7);
        });

        it('getPaymentTerms lists or filters by id', async () => {
            const api = makeApi();
            await api.getPaymentTerms({ top: 10 });
            expect(api._captured[0].url).toContain('/PaymentTerms');
            expect(api._captured[0].url).toContain('$top=10');

            api._get = async (options) => {
                api._captured.push({ method: 'GET', ...options });
                return [{ PaymentTermsID: 3, Terms: 'Net 30' }];
            };
            const term = await api.getPaymentTerms(3);
            expect(api._captured[1].url).toContain(
                '$filter=PaymentTermsID eq 3'
            );
            expect(term.Terms).toBe('Net 30');
        });
    });
});
